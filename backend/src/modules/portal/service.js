'use strict';

/**
 * Portal Service
 * ==============
 * Per Global Constraint 5 + 6 + 7:
 *
 * CONSTRAINT 5 — CUSTOMER role:
 *   - Sees ONLY quotations tied to their own customer_id.
 *   - Enforced as a WHERE clause server-side, NEVER a frontend filter.
 *   - Portal credentials auto-generated on customer record creation:
 *       portalEmail = slugify(companyName) + '@dealflow360.com'
 *       portalPassword = Capitalize(companyName, no spaces) + '@deal123'
 *       mustChangePassword = true (forced change before any data is visible)
 *   - Plaintext password sent ONCE to customer.realEmail via Nodemailer.
 *   - Only the bcrypt hash is ever stored.
 *
 * CONSTRAINT 6 — Negotiation Re-Approval:
 *   - Customer counter-discount recomputes blended score server-side.
 *   - If it now crosses a new threshold, the quotation re-enters approval
 *     by reusing the ApprovalStep creation logic from Phase 3.
 *   - If it doesn't cross a new threshold, the rep can accept/reject directly.
 */

const bcrypt = require('bcrypt');
const { z }  = require('zod');
const prisma = require('../../config/prisma');
const { logAudit }   = require('../../utils/logAudit');
const { sendMail }   = require('../../config/mailer');
const { computeBlendedRiskScore } = require('../../utils/blendedRiskScore');
const discountSvc   = require('../discountConfig/service');
const realtime      = require('../../realtime/index');

const SALT_ROUNDS = 12;

// ── Portal credential generation ──────────────────────────────────────────────

/**
 * Convert a company name to a URL/email-safe slug.
 *
 * slugify('Acme Corp!')       → 'acmecorp'
 * slugify('Globex Industries') → 'globexindustries'
 */
function _slugify(companyName) {
  return companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Capitalize a company name by removing spaces.
 * Used for the initial password component.
 *
 * capitalize('Acme Corp')        → 'AcmeCorp'
 * capitalize('Globex Industries') → 'GlobexIndustries'
 */
function _capitalize(companyName) {
  return companyName
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/**
 * provisionPortalAccount
 * ─────────────────────
 * Creates a CUSTOMER-role User and sends credentials to customer.realEmail.
 *
 * SECURITY NOTES:
 *   - The initial password follows a predictable pattern; mustChangePassword=true
 *     forces the customer to change it before seeing ANY quotation data.
 *     This is the required mitigation for the predictable initial password.
 *   - The plaintext password is transmitted ONCE to realEmail then discarded.
 *     Only the bcrypt hash is stored. The portal login address (portalEmail)
 *     is separate from the customer's realEmail.
 *   - Collision handling: if portalEmail is taken, append an incrementing
 *     number (e.g. acmecorp2@dealflow360.com) until a free slot is found.
 *     Never overwrite an existing account.
 *
 * @param {string} customerId
 * @returns {Promise<{ portalEmail: string, user: object }>}
 */
async function provisionPortalAccount(customerId) {
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });

  // Check if a portal account already exists
  if (await prisma.user.findFirst({ where: { customerId } })) {
    const e = new Error('Portal account already exists for this customer');
    e.statusCode = 409; e.code = 'ALREADY_EXISTS'; throw e;
  }

  const slug        = _slugify(customer.companyName);
  const plainPass   = `${_capitalize(customer.companyName)}@deal123`;

  // Collision-safe email generation
  let portalEmail = `${slug}@dealflow360.com`;
  let suffix      = 2;
  while (await prisma.user.findUnique({ where: { email: portalEmail } })) {
    portalEmail = `${slug}${suffix}@dealflow360.com`;
    suffix++;
  }

  const passwordHash = await bcrypt.hash(plainPass, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name:               `${customer.companyName} Portal`,
      email:              portalEmail,
      passwordHash,
      role:               'CUSTOMER',
      mustChangePassword: true, // REQUIRED — mitigates predictable initial password
      customerId,
    },
    select: { id: true, email: true, role: true, mustChangePassword: true },
  });

  // Send credentials to realEmail (NEVER to portalEmail — that is the login address,
  // not the customer's actual inbox)
  await sendMail({
    to:      customer.realEmail, // <── the customer's real business email
    subject: 'Your DealFlow360 Customer Portal Access',
    html: `
      <h2>Welcome to DealFlow360!</h2>
      <p>Hi ${customer.companyName},</p>
      <p>Your customer portal account has been created.</p>
      <table style="border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0"><strong>Portal Login Email:</strong></td>
            <td style="font-family:monospace">${portalEmail}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Temporary Password:</strong></td>
            <td style="font-family:monospace">${plainPass}</td></tr>
      </table>
      <p><strong>You will be required to change your password on first login</strong>
         before accessing your quotations.</p>
      <p>— DealFlow360</p>
    `,
  });

  await logAudit({
    userId:     null,
    action:     'PORTAL_ACCOUNT_PROVISIONED',
    entityType: 'Customer',
    entityId:   customerId,
    details:    { portalEmail, sentToRealEmail: customer.realEmail },
  });

  return { portalEmail, user };
}

// ── Change password (forced first-login) ──────────────────────────────────────

const changePasswordSchema = z.object({
  userId:      z.string().uuid(),
  newPassword: z.string().min(8).max(128),
});

async function changePassword(body) {
  const { userId, newPassword } = changePasswordSchema.parse(body);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true, mustChangePassword: true },
  });

  if (user.role !== 'CUSTOMER') {
    const e = new Error('This endpoint is for customer portal users only');
    e.statusCode = 403; throw e;
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const updated = await prisma.user.update({
    where: { id: userId },
    data:  { passwordHash, mustChangePassword: false },
    select: { id: true, email: true, role: true, customerId: true },
  });

  return updated;
}

// ── Quotation access (customer-scoped) ────────────────────────────────────────

async function listQuotations(user) {
  // GLOBAL CONSTRAINT 5: WHERE clause enforced server-side
  return prisma.quotation.findMany({
    where: { customerId: user.customerId }, // <── NOT a frontend filter
    include: {
      customer: { select: { id: true, companyName: true } },
      lines:    { include: { product: { select: { id: true, name: true } } } },
      approvalSteps: { orderBy: { order: 'asc' } },
    },
    orderBy: { lastActivityAt: 'desc' },
  });
}

async function getQuotation(id, user) {
  const q = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, companyName: true, tier: true } },
      lines:    {
        include: {
          product: {
            select: { id: true, name: true, unit: true,
                      category: { select: { name: true, maxDiscountPercent: true } } },
          },
        },
      },
      approvalSteps:      { orderBy: { order: 'asc' } },
      negotiationMessages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!q) { const e = new Error('Quotation not found'); e.statusCode = 404; throw e; }

  // GLOBAL CONSTRAINT 5: customer can only access their own quotation
  if (q.customerId !== user.customerId) {
    const e = new Error('Access denied to this quotation');
    e.statusCode = 403; e.code = 'FORBIDDEN'; throw e;
  }

  return q;
}

// ── Negotiation messages ──────────────────────────────────────────────────────

const messageSchema = z.object({
  message: z.string().min(1).max(4000),
  lineId:  z.string().uuid().optional().nullable(),
});

async function postMessage(quotationId, body, user) {
  const { message, lineId } = messageSchema.parse(body);

  // Customer scope check
  await getQuotation(quotationId, user);

  const msg = await prisma.negotiationMessage.create({
    data: {
      quotationId,
      senderType: 'CUSTOMER',
      message,
      lineId: lineId ?? null,
    },
  });

  // Update lastActivityAt
  await prisma.quotation.update({
    where: { id: quotationId },
    data:  { lastActivityAt: new Date() },
  });

  // Real-time: notify the rep
  const q = await prisma.quotation.findUnique({
    where: { id: quotationId },
    select: { repId: true },
  });
  if (q) {
    realtime.emitNegotiationMessage({
      repId:      q.repId,
      customerId: user.customerId,
      message:    msg,
    });
  }

  await logAudit({
    userId:     user.userId,
    action:     'PORTAL_MESSAGE_SENT',
    entityType: 'Quotation',
    entityId:   quotationId,
    details:    { senderType: 'CUSTOMER' },
  });

  return msg;
}

// ── Counter-discount proposal (re-approval trigger) ───────────────────────────

const counterDiscountSchema = z.object({
  lineId:          z.string().uuid(),
  requestedDiscount: z.coerce.number().min(0).max(100),
  deliveryDate:    z.string().optional(),
  message:         z.string().max(2000).optional(),
});

/**
 * POST /api/portal/quotations/:id/counter-discount
 *
 * The customer proposes a different discount on a specific line.
 * Per Global Constraint 6:
 *   1. Recompute blended score with the proposed discount.
 *   2. If the new score requires a level NOT already cleared:
 *      → set quotation to PENDING_APPROVAL, create ApprovalStep rows.
 *   3. If the new score is within already-cleared limits:
 *      → the rep can accept/reject directly (status → UNDER_NEGOTIATION).
 */
async function counterDiscount(quotationId, body, user) {
  const { lineId, requestedDiscount, deliveryDate, message } =
    counterDiscountSchema.parse(body);

  const q = await getQuotation(quotationId, user);

  if (!['APPROVED', 'UNDER_NEGOTIATION'].includes(q.status)) {
    const e = new Error(`Cannot counter-propose on a quotation with status "${q.status}"`);
    e.statusCode = 409; throw e;
  }

  // Build proposed lines (replace the one line with requestedDiscount)
  const proposedLines = q.lines.map((l) => ({
    discountPercent:  l.id === lineId ? requestedDiscount : Number(l.discountPercent),
    categoryCeiling:  Number(l.product?.category?.maxDiscountPercent ?? 100),
  }));

  const tierCeiling = await discountSvc.getCeilingForTier(q.customer.tier);
  const { blendedScore } = computeBlendedRiskScore(proposedLines, tierCeiling);
  const requiredLevel = await discountSvc.resolveApprovalLevel(blendedScore);

  // Determine the highest level already cleared
  const clearedLevels = new Set(
    q.approvalSteps.filter((s) => s.status === 'APPROVED').map((s) => s.level)
  );

  const needsNewApproval =
    requiredLevel !== 'NONE' &&
    !(requiredLevel === 'SALES_MANAGER'             && clearedLevels.has('SALES_MANAGER')) &&
    !(requiredLevel === 'SALES_MANAGER_THEN_FINANCE' && clearedLevels.has('SALES_MANAGER') && clearedLevels.has('FINANCE'));

  const result = await prisma.$transaction(async (tx) => {
    let newStatus = 'UNDER_NEGOTIATION';
    const newSteps = [];

    if (needsNewApproval) {
      // Re-enter approval from the current step
      newStatus = 'PENDING_APPROVAL';
      const steps = [];
      if (requiredLevel === 'SALES_MANAGER' || requiredLevel === 'SALES_MANAGER_THEN_FINANCE') {
        steps.push({ quotationId, level: 'SALES_MANAGER', status: 'PENDING', order: 1 });
      }
      if (requiredLevel === 'SALES_MANAGER_THEN_FINANCE') {
        steps.push({ quotationId, level: 'FINANCE', status: 'PENDING', order: 2 });
      }
      for (const s of steps) {
        newSteps.push(await tx.approvalStep.create({ data: s }));
      }
    }

    // Save the counter-proposal as a negotiation message
    await tx.negotiationMessage.create({
      data: {
        quotationId,
        senderType: 'CUSTOMER',
        lineId,
        message: message ?? `Counter-discount proposal: ${requestedDiscount}% on line ${lineId}`,
      },
    });

    const updated = await tx.quotation.update({
      where: { id: quotationId },
      data:  {
        status:           newStatus,
        blendedRiskScore: blendedScore,
        lastActivityAt:   new Date(),
      },
    });

    return { updated, newSteps, needsNewApproval, newStatus, blendedScore };
  });

  await logAudit({
    userId:     user.userId,
    action:     'PORTAL_COUNTER_DISCOUNT',
    entityType: 'Quotation',
    entityId:   quotationId,
    details:    { lineId, requestedDiscount, blendedScore, needsNewApproval, newStatus: result.newStatus },
  });

  // Real-time: notify rep and approvers
  realtime.emitQuotationUpdated({
    repId:       q.repId,
    quotationId,
    status:      result.newStatus,
    extra:       { counterDiscount: requestedDiscount, blendedScore },
  });

  if (result.needsNewApproval && result.newSteps[0]) {
    realtime.emitApprovalPending(result.newSteps[0].level, {
      quotationId,
      blendedScore,
      reason: 'Customer counter-discount triggered re-approval',
    });
  }

  return result;
}

// ── One-click confirm ─────────────────────────────────────────────────────────

async function confirmQuotation(quotationId, user) {
  const q = await getQuotation(quotationId, user);

  if (!['APPROVED', 'UNDER_NEGOTIATION'].includes(q.status)) {
    const e = new Error(`Quotation must be APPROVED or UNDER_NEGOTIATION to confirm, not "${q.status}"`);
    e.statusCode = 409; throw e;
  }

  // Check no pending approval steps remain
  const pendingSteps = q.approvalSteps.filter((s) => s.status === 'PENDING');
  if (pendingSteps.length > 0) {
    const e = new Error('There are pending approval steps that must be completed first');
    e.statusCode = 409; throw e;
  }

  const confirmed = await prisma.quotation.update({
    where: { id: quotationId },
    data:  { status: 'CONFIRMED', lastActivityAt: new Date() },
  });

  await logAudit({
    userId: user.userId, action: 'PORTAL_QUOTATION_CONFIRMED',
    entityType: 'Quotation', entityId: quotationId,
  });

  realtime.emitQuotationUpdated({
    repId:       q.repId,
    quotationId,
    status:      'CONFIRMED',
    extra:       { confirmedByCustomer: true },
  });

  return confirmed;
}

module.exports = {
  provisionPortalAccount,
  changePassword,
  listQuotations,
  getQuotation,
  postMessage,
  counterDiscount,
  confirmQuotation,
};
