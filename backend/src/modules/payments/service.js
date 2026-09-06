'use strict';

/**
 * Payments Service — Razorpay
 * ===========================
 * Per Global Constraint 7:
 *   - Razorpay order is ALWAYS created server-side (never trust client amount).
 *   - Payment signature is ALWAYS verified server-side (HMAC-SHA256) before
 *     marking an invoice Paid. A client "success" callback alone is NEVER enough.
 *   - Webhook endpoint is the source of truth — handles dropped connections
 *     after payment without leaving invoices stuck at UNPAID.
 *   - Idempotent: a webhook double-fire does NOT double-mark or double-credit.
 */

const crypto  = require('crypto');
const { z }   = require('zod');
const Razorpay = require('razorpay');
const prisma   = require('../../config/prisma');
const { logAudit } = require('../../utils/logAudit');
const realtime     = require('../../realtime/index');
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = require('../../config/env');

// Razorpay SDK instance — initialised lazily so tests/dev without keys don't crash
let _razorpay = null;
function _getRazorpay() {
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id:     RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const createOrderSchema = z.object({
  invoiceId: z.string().uuid(),
});

const verifySchema = z.object({
  invoiceId:         z.string().uuid(),
  razorpayOrderId:   z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Verify the HMAC-SHA256 signature Razorpay sends back.
 * Per Razorpay docs: expected_signature = HMAC_SHA256(
 *   key = key_secret,
 *   message = razorpayOrderId + "|" + razorpayPaymentId
 * )
 *
 * This is the ONLY function that should gate marking an invoice Paid.
 *
 * @returns {boolean} true if signature is valid
 */
function _verifySignature(razorpayOrderId, razorpayPaymentId, signature) {
  const message  = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(message)
    .digest('hex');
  // Use timingSafeEqual to prevent timing attacks — buffers MUST be same length
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Mark an invoice as PAID and update the payment record.
 * Idempotent — if already VERIFIED, returns existing record without error.
 *
 * @param {string} invoiceId
 * @param {string} razorpayPaymentId
 * @param {string} razorpaySignature
 */
async function _markInvoicePaid(invoiceId, razorpayPaymentId, razorpaySignature) {
  return prisma.$transaction(async (tx) => {
    // Idempotency: if payment already verified, skip
    const existing = await tx.payment.findFirst({
      where: { invoiceId, status: 'VERIFIED' },
    });
    if (existing) return { alreadyVerified: true, payment: existing };

    // Update payment record to VERIFIED
    const payment = await tx.payment.updateMany({
      where: { invoiceId, razorpayPaymentId: null },
      data:  {
        razorpayPaymentId,
        razorpaySignature,
        status: 'VERIFIED',
      },
    });

    // Mark invoice PAID
    const invoice = await tx.invoice.update({
      where: { id: invoiceId },
      data:  { status: 'PAID' },
      include: {
        order: {
          include: {
            quotation: { include: { customer: { select: { id: true } } } },
          },
        },
      },
    });

    return { alreadyVerified: false, payment, invoice };
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * POST /api/payments/create-order
 * Create a Razorpay order server-side.
 * The amount comes from the INVOICE in the DB — never from the client.
 */
async function createOrder(body, user) {
  const { invoiceId } = createOrderSchema.parse(body);

  // Load invoice — amount is authoritative from DB
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { order: { include: { quotation: { include: { customer: true } } } } },
  });

  if (invoice.status === 'PAID') {
    const e = new Error('Invoice is already paid');
    e.statusCode = 409; e.code = 'ALREADY_PAID'; throw e;
  }

  // Razorpay expects amount in paise (smallest currency unit = 100 per rupee)
  // For USD: multiply by 100 (cents). Using INR proxy here; swap currency as needed.
  const amountInPaise = Math.round(Number(invoice.amount) * 100);

  // Guard: if Razorpay keys are not configured (dev/test env), return a mock response
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    const mockOrderId = `order_mock_${invoiceId.slice(0, 8)}_${Date.now()}`;
    await prisma.payment.create({
      data: { invoiceId, razorpayOrderId: mockOrderId, amount: invoice.amount, status: 'CREATED' },
    });
    return {
      razorpayOrderId: mockOrderId,
      amount:          amountInPaise,
      currency:        'INR',
      keyId:           RAZORPAY_KEY_ID || 'rzp_test_mock',
      invoiceId,
      _mock:           true,
    };
  }

  const razorpayOrder = await _getRazorpay().orders.create({
    amount:   amountInPaise,
    currency: 'INR',
    receipt:  `inv_${invoiceId.slice(0, 8)}`,
    notes:    { invoiceId, companyName: invoice.order?.quotation?.customer?.companyName ?? '' },
  });

  // Persist the Razorpay order ID to link it back on verify / webhook
  await prisma.payment.create({
    data: {
      invoiceId,
      razorpayOrderId: razorpayOrder.id,
      amount:          invoice.amount,
      status:          'CREATED',
    },
  });

  await logAudit({
    userId: user.userId, action: 'PAYMENT_ORDER_CREATED',
    entityType: 'Invoice', entityId: invoiceId,
    details: { razorpayOrderId: razorpayOrder.id, amount: invoice.amount },
  });

  return {
    razorpayOrderId: razorpayOrder.id,
    amount:          amountInPaise,
    currency:        razorpayOrder.currency,
    keyId:           RAZORPAY_KEY_ID,
    invoiceId,
  };
}

/**
 * POST /api/payments/verify
 * Verify the Razorpay signature AFTER the user completes payment in the UI.
 * This is a belt-and-suspenders check — the webhook is the authoritative
 * source of truth, but this lets the frontend update immediately after success.
 */
async function verify(body, user) {
  const { invoiceId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
    verifySchema.parse(body);

  const valid = _verifySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!valid) {
    const e = new Error('Payment signature verification failed');
    e.statusCode = 400; e.code = 'INVALID_SIGNATURE'; throw e;
  }

  const { alreadyVerified, invoice } = await _markInvoicePaid(
    invoiceId, razorpayPaymentId, razorpaySignature
  );

  if (!alreadyVerified) {
    await logAudit({
      userId: user?.userId ?? null, action: 'PAYMENT_VERIFIED',
      entityType: 'Invoice', entityId: invoiceId,
      details: { razorpayOrderId, razorpayPaymentId, source: 'verify-endpoint' },
    });

    // Real-time: notify the rep and customer that invoice is paid
    if (invoice?.order?.quotation?.customer?.id) {
      realtime.emitQuotationCustomerUpdate({
        customerId:  invoice.order.quotation.customer.id,
        quotationId: invoice.order.quotationId,
        status:      'PAID',
        extra:       { invoiceId },
      });
    }
  }

  return { verified: true, alreadyVerified, invoiceId };
}

/**
 * POST /api/payments/webhook
 * Razorpay webhook — source of truth for payment status.
 * Handles dropped connections after payment: even if the user closes the tab
 * right after paying, this endpoint ensures the invoice gets marked Paid.
 *
 * IDEMPOTENT: a double-fire does NOT produce a second PAID marking.
 *
 * Webhook signature is verified via the X-Razorpay-Signature header.
 */
async function webhook(rawBody, signature) {
  // Verify webhook signature to confirm it came from Razorpay
  const webhookSecret = RAZORPAY_KEY_SECRET; // use a dedicated webhook secret in prod
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const sigValid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature ?? ''));
  if (!sigValid) {
    const e = new Error('Webhook signature invalid'); e.statusCode = 400; throw e;
  }

  const event = JSON.parse(rawBody);

  if (event.event === 'payment.captured') {
    const p          = event.payload?.payment?.entity;
    const orderId    = p?.order_id;
    const paymentId  = p?.id;
    const sig        = event.payload?.payment?.entity?.description ?? 'webhook';

    if (!orderId || !paymentId) return { ignored: true, reason: 'Missing order/payment ID' };

    // Find the invoice linked to this Razorpay order
    const paymentRecord = await prisma.payment.findFirst({ where: { razorpayOrderId: orderId } });
    if (!paymentRecord) return { ignored: true, reason: 'No payment record for this order' };

    const { alreadyVerified } = await _markInvoicePaid(
      paymentRecord.invoiceId, paymentId, sig
    );

    if (!alreadyVerified) {
      await logAudit({
        userId: null, action: 'PAYMENT_VERIFIED_WEBHOOK',
        entityType: 'Invoice', entityId: paymentRecord.invoiceId,
        details: { razorpayOrderId: orderId, razorpayPaymentId: paymentId, source: 'webhook' },
      });
    }

    return { processed: true, alreadyVerified, invoiceId: paymentRecord.invoiceId };
  }

  return { ignored: true, reason: `Unhandled event type: ${event.event}` };
}

module.exports = { createOrder, verify, webhook };
