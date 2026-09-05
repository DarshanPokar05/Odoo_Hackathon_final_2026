'use strict';

/**
 * Monthly Billing Job
 * ───────────────────
 * Runs at 00:05 on the 1st of every month.
 * Cron expression: '5 0 1 * *'
 *
 * For every ACTIVE subscription whose nextBillDate has arrived:
 *   1. Create an Invoice record (type = RECURRING).
 *   2. Advance nextBillDate by the plan interval.
 *   3. Log the action in ActivityLog.
 *
 * Intentionally kept simple for Phase 0 — proration and credit-note handling
 * will be layered on in the billing/subscriptions phase.
 */

const cron   = require('node-cron');
const prisma = require('../config/prisma');
const { logAudit } = require('../utils/logAudit');

/**
 * Advance a date by one billing interval.
 * @param {Date}   date
 * @param {string} interval — "MONTHLY" | "QUARTERLY" | "YEARLY"
 * @returns {Date}
 */
function advanceByInterval(date, interval) {
  const d = new Date(date);
  switch (interval) {
    case 'QUARTERLY':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'YEARLY':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'MONTHLY':
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/**
 * Core billing logic — extracted so it can be invoked manually / in tests.
 */
async function runMonthlyBilling() {
  const now = new Date();
  console.log(`[monthlyBilling] Starting run at ${now.toISOString()}`);

  // Find all active subscriptions due for billing
  const due = await prisma.subscription.findMany({
    where: {
      status:       'ACTIVE',
      nextBillDate: { lte: now },
    },
    include: {
      plan: {
        select: { interval: true, name: true },
      },
    },
  });

  console.log(`[monthlyBilling] ${due.length} subscription(s) due`);

  let created = 0;
  let errors  = 0;

  for (const sub of due) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Determine billing amount from the most recent invoice for this sub
        //    (or fall back to 0 — phase 2 will derive the correct amount from the plan/order)
        const lastInvoice = await tx.invoice.findFirst({
          where:   { subscriptionId: sub.id },
          orderBy: { createdAt: 'desc' },
        });
        const amount = lastInvoice?.amount ?? 0;

        // 2. Create new invoice
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 30); // net-30 terms by default

        await tx.invoice.create({
          data: {
            subscriptionId: sub.id,
            type:           'RECURRING',
            amount,
            status:         'UNPAID',
            dueDate,
          },
        });

        // 3. Advance nextBillDate
        const nextBillDate = advanceByInterval(sub.nextBillDate, sub.plan?.interval ?? 'MONTHLY');
        await tx.subscription.update({
          where: { id: sub.id },
          data:  { nextBillDate },
        });
      });

      await logAudit({
        userId:     null,
        action:     'RECURRING_INVOICE_CREATED',
        entityType: 'Subscription',
        entityId:   sub.id,
        details:    { interval: sub.plan?.interval },
      });

      created++;
    } catch (err) {
      errors++;
      console.error(`[monthlyBilling] Failed for subscription ${sub.id}:`, err.message);
    }
  }

  console.log(`[monthlyBilling] Done — created: ${created}, errors: ${errors}`);
}

/**
 * Register the cron schedule.
 * Call this once from server.js.
 */
function scheduleMonthlyBilling() {
  // '5 0 1 * *' = 00:05 on the 1st of every month
  cron.schedule('5 0 1 * *', runMonthlyBilling, {
    timezone: 'UTC',
  });
  console.log('[monthlyBilling] Scheduled: 00:05 UTC on the 1st of every month');
}

module.exports = { scheduleMonthlyBilling, runMonthlyBilling };
