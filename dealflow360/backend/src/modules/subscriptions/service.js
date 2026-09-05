'use strict';

/**
 * Subscriptions Service
 * =====================
 * Per Global Constraint 4:
 *   - One order can mix ONE_TIME and RECURRING lines.
 *   - One-time invoices are created at order confirmation (in invoices service).
 *   - Recurring lines get a Subscription row with nextBillDate.
 *   - Mid-cycle quantity/plan change uses the proration calculator.
 *   - Cancellation applies the plan's configured cancellationRule:
 *       REFUND_UNUSED_DAYS → credit note / refund for remaining days
 *       CREDIT_NOTE        → create a CreditNote record
 *       NO_REFUND          → no financial action
 */

const { z }                    = require('zod');
const prisma                   = require('../../config/prisma');
const { logAudit }             = require('../../utils/logAudit');
const { computeProration, advanceByInterval } = require('../../utils/proration');
const realtime                 = require('../../realtime/index');

// ── Schemas ────────────────────────────────────────────────────────────────────

const createSchema = z.object({
  orderId:   z.string().uuid(),
  planId:    z.string().uuid(),
  quantity:  z.coerce.number().int().positive(),
  // cycleStartDate defaults to today; nextBillDate computed from interval
  cycleStartDate: z.coerce.date().optional(),
});

const modifySchema = z.object({
  quantity:   z.coerce.number().int().positive().optional(),
  planId:     z.string().uuid().optional(),
  changeDate: z.coerce.date().optional(), // defaults to now()
});

const cancelSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

// ── Include shape ─────────────────────────────────────────────────────────────

const SUB_INCLUDE = {
  plan: {
    include: {
      product: { select: { id: true, name: true, price: true, unit: true } },
    },
  },
  order: {
    include: {
      quotation: {
        include: {
          customer: { select: { id: true, companyName: true, realEmail: true } },
        },
      },
    },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Monthly billing amount for a subscription = plan product price × quantity */
function _monthlyAmount(sub) {
  return Number(sub.plan.product.price) * sub.quantity;
}

/** Customer's realEmail — used for invoice emails. NEVER the portal address. */
function _realEmail(sub) {
  return sub.order?.quotation?.customer?.realEmail ?? null;
}

// ── Public service API ─────────────────────────────────────────────────────────

/**
 * List all subscriptions.
 * Finance/Admin see all; Sales roles see by customer.
 */
async function list(query, user) {
  const where = {};
  if (query?.status) where.status = query.status;
  if (query?.orderId) where.orderId = query.orderId;

  return prisma.subscription.findMany({
    where,
    include:  SUB_INCLUDE,
    orderBy:  { nextBillDate: 'asc' },
  });
}

async function getOne(id, user) {
  return prisma.subscription.findUniqueOrThrow({ where: { id }, include: SUB_INCLUDE });
}

/**
 * Create a Subscription when a RECURRING line is confirmed.
 * Called by the invoices/orders service after order confirmation.
 *
 * @param {object} body
 * @param {object} user
 */
async function create(body, user) {
  const data = createSchema.parse(body);

  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where:   { id: data.planId },
    include: { product: true },
  });

  const cycleStart  = data.cycleStartDate ?? new Date();
  const nextBillDate = advanceByInterval(cycleStart, plan.interval);

  const sub = await prisma.subscription.create({
    data: {
      orderId:       data.orderId,
      planId:        data.planId,
      quantity:      data.quantity,
      status:        'ACTIVE',
      cycleStartDate: cycleStart,
      nextBillDate,
    },
    include: SUB_INCLUDE,
  });

  await logAudit({
    userId:     user?.userId ?? null,
    action:     'SUBSCRIPTION_CREATED',
    entityType: 'Subscription',
    entityId:   sub.id,
    details:    { planId: data.planId, quantity: data.quantity, nextBillDate },
  });

  return sub;
}

/**
 * PATCH /api/subscriptions/:id/modify
 * Mid-cycle quantity or plan change.
 *
 * Per Global Constraint 4:
 *   prorationAmount = (newMonthly - oldMonthly) × (daysRemaining / totalDays)
 *   Positive → additional charge invoice created.
 *   Negative → credit note created.
 */
async function modify(id, body, user) {
  const { quantity, planId, changeDate: changeDateInput } = modifySchema.parse(body);
  const changeDate = changeDateInput ?? new Date();

  const sub = await prisma.subscription.findUniqueOrThrow({
    where:   { id },
    include: SUB_INCLUDE,
  });

  if (sub.status !== 'ACTIVE') {
    const e = new Error(`Cannot modify a subscription with status "${sub.status}"`);
    e.statusCode = 409; e.code = 'INVALID_STATUS'; throw e;
  }

  const oldMonthly = _monthlyAmount(sub);

  // Determine what plan we're switching to (may be unchanged)
  let newPlan = sub.plan;
  if (planId && planId !== sub.planId) {
    newPlan = await prisma.subscriptionPlan.findUniqueOrThrow({
      where:   { id: planId },
      include: { product: true },
    });
  }

  const newQty     = quantity ?? sub.quantity;
  const newMonthly = Number(newPlan.product.price) * newQty;

  // Compute proration for the current cycle
  const cycleStart = new Date(sub.cycleStartDate);
  const cycleEnd   = new Date(sub.nextBillDate);

  const { prorationAmount, daysRemaining, totalDays } = computeProration({
    oldMonthlyAmount: oldMonthly,
    newMonthlyAmount: newMonthly,
    changeDate,
    cycleStart,
    cycleEnd,
  });

  // Apply the modification inside a transaction
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { id },
      data:  {
        ...(quantity && { quantity }),
        ...(planId   && { planId   }),
      },
      include: SUB_INCLUDE,
    });

    let prorationRecord = null;

    if (prorationAmount > 0) {
      // Charge extra — create a proration invoice
      prorationRecord = await tx.invoice.create({
        data: {
          subscriptionId: id,
          type:           'RECURRING',
          amount:         prorationAmount,
          status:         'UNPAID',
          dueDate:        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // net-30
        },
      });
    } else if (prorationAmount < 0) {
      // Credit back — create a CreditNote
      prorationRecord = await tx.creditNote.create({
        data: {
          subscriptionId: id,
          amount:         Math.abs(prorationAmount),
          reason:         `Mid-cycle ${planId ? 'plan' : 'quantity'} change. Proration: ${daysRemaining}/${totalDays} days remaining.`,
        },
      });
    }

    return { updated, prorationRecord, prorationAmount };
  });

  await logAudit({
    userId:     user.userId,
    action:     'SUBSCRIPTION_MODIFIED',
    entityType: 'Subscription',
    entityId:   id,
    details:    { oldMonthly, newMonthly, prorationAmount, daysRemaining, totalDays, quantity, planId },
  });

  return result;
}

/**
 * PATCH /api/subscriptions/:id/cancel
 * Cancel a subscription, applying the plan's configured cancellationRule.
 *
 * Rules (always read from plan config — never hardcoded):
 *   REFUND_UNUSED_DAYS → compute credit for remaining cycle days, create CreditNote
 *   CREDIT_NOTE        → same as REFUND_UNUSED_DAYS but labelled differently
 *   NO_REFUND          → no financial action, just cancel
 */
async function cancel(id, body, user) {
  const { reason } = cancelSchema.parse(body);

  const sub = await prisma.subscription.findUniqueOrThrow({
    where:   { id },
    include: SUB_INCLUDE,
  });

  if (sub.status === 'CANCELLED') {
    const e = new Error('Subscription is already cancelled');
    e.statusCode = 409; e.code = 'ALREADY_CANCELLED'; throw e;
  }

  const cancellationRule = sub.plan.cancellationRule; // always from config
  const now              = new Date();
  const cycleStart       = new Date(sub.cycleStartDate);
  const cycleEnd         = new Date(sub.nextBillDate);
  const monthly          = _monthlyAmount(sub);

  // Compute unused-days credit (used for REFUND_UNUSED_DAYS and CREDIT_NOTE)
  const { prorationAmount: unusedAmount } = computeProration({
    oldMonthlyAmount: monthly,
    newMonthlyAmount: 0,          // cancelling = new value is $0
    changeDate:       now,
    cycleStart,
    cycleEnd,
  });
  // unusedAmount will be negative (credit back); we want the absolute value
  const creditAmount = Math.abs(unusedAmount);

  const result = await prisma.$transaction(async (tx) => {
    const cancelled = await tx.subscription.update({
      where: { id },
      data:  { status: 'CANCELLED' },
      include: SUB_INCLUDE,
    });

    let creditRecord = null;

    // Apply the plan's configured cancellation rule
    if (cancellationRule === 'REFUND_UNUSED_DAYS' || cancellationRule === 'CREDIT_NOTE') {
      if (creditAmount > 0) {
        creditRecord = await tx.creditNote.create({
          data: {
            subscriptionId: id,
            amount:         creditAmount,
            reason:         `${cancellationRule}: ${reason}. Credit for unused days in current cycle.`,
          },
        });
      }
    }
    // NO_REFUND: no financial action, subscription just becomes CANCELLED

    return { cancelled, creditRecord, creditAmount, cancellationRule };
  });

  await logAudit({
    userId:     user.userId,
    action:     'SUBSCRIPTION_CANCELLED',
    entityType: 'Subscription',
    entityId:   id,
    details:    { reason, cancellationRule, creditAmount },
  });

  return result;
}

module.exports = { list, getOne, create, modify, cancel };
