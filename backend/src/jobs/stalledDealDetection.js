'use strict';

/**
 * Stalled Deal Detection + Deal Health Monitoring Job
 * ────────────────────────────────────────────────────
 * Cron: '0 * * * *' — top of every hour.
 *
 * Runs three checks:
 *
 * 1. STALLED — Deals with no activity for STALL_THRESHOLD_HOURS in
 *    actionable statuses (DRAFT, PENDING_APPROVAL, UNDER_NEGOTIATION).
 *
 * 2. DISCOUNT_ANOMALY — Quotation lines where a rep's discount on a
 *    product category is significantly above their own historical average
 *    for that category (ANOMALY_SIGMA_MULTIPLE standard deviations above mean).
 *
 * 3. DELIVERY_SLIPPAGE — Confirmed orders that have been in
 *    PENDING_FULFILLMENT or SPLIT_ACCEPTED status for more than
 *    SLIPPAGE_THRESHOLD_DAYS without advancing to DELIVERED.
 *
 * For each newly detected issue:
 *   - Creates a DealHealthFlag record.
 *   - Emits a Socket.io event to SALES_MANAGER / FINANCE / ADMIN rooms.
 *   - Logs to ActivityLog.
 *   - Skips if an unresolved flag of the same type already exists.
 */

const cron   = require('node-cron');
const prisma = require('../config/prisma');
const { logAudit }          = require('../utils/logAudit');
const { emitDealHealthFlag } = require('../realtime');

const STALL_THRESHOLD_HOURS    = 48;
const SLIPPAGE_THRESHOLD_DAYS  = 14;
const ANOMALY_SIGMA_MULTIPLE   = 1.5; // flag if discount > mean + 1.5×stddev

const STALL_STATUSES     = ['DRAFT', 'PENDING_APPROVAL', 'UNDER_NEGOTIATION'];
const SLIPPAGE_STATUSES  = ['PENDING_FULFILLMENT', 'SPLIT_ACCEPTED', 'BACKORDERED'];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function _alreadyFlagged(quotationId, type) {
  const existing = await prisma.dealHealthFlag.findFirst({
    where: { quotationId, type, resolved: false },
  });
  return !!existing;
}

async function _createFlag(quotationId, type, detail) {
  const flag = await prisma.dealHealthFlag.create({
    data: { quotationId, type, detail, resolved: false },
  });
  emitDealHealthFlag(flag);
  await logAudit({
    userId:     null,
    action:     `DEAL_${type}_FLAGGED`,
    entityType: 'Quotation',
    entityId:   quotationId,
    details:    { type, detail },
  });
  return flag;
}

// ── Check 1: Stalled deals ─────────────────────────────────────────────────────

async function _checkStalledDeals(now) {
  const threshold = new Date(now - STALL_THRESHOLD_HOURS * 60 * 60 * 1000);

  const candidates = await prisma.quotation.findMany({
    where: {
      status:         { in: STALL_STATUSES },
      lastActivityAt: { lt: threshold },
    },
    select: { id: true, status: true, lastActivityAt: true },
  });

  let count = 0;
  for (const q of candidates) {
    if (await _alreadyFlagged(q.id, 'STALLED')) continue;
    const hours = Math.floor((now - new Date(q.lastActivityAt)) / (1000 * 60 * 60));
    await _createFlag(q.id, 'STALLED', `No activity for ${hours} hours (status: ${q.status})`);
    count++;
  }
  if (count) console.log(`[dealHealth] Stalled: flagged ${count} new deal(s)`);
}

// ── Check 2: Discount anomalies ───────────────────────────────────────────────

async function _checkDiscountAnomalies() {
  // Load all quotation lines with their rep, category, and discount
  const lines = await prisma.quotationLine.findMany({
    include: {
      quotation: { select: { id: true, repId: true, status: true } },
      product:   { include: { category: { select: { id: true, name: true } } } },
    },
  });

  // Skip lines on terminal quotations (CLOSED, REJECTED)
  const activeLinesOnly = lines.filter(
    (l) => !['CLOSED', 'REJECTED'].includes(l.quotation.status)
  );

  // Group by repId + categoryId to compute historical mean/stddev
  const repCatGroups = new Map();
  for (const l of activeLinesOnly) {
    const key = `${l.quotation.repId}::${l.product?.category?.id}`;
    if (!repCatGroups.has(key)) repCatGroups.set(key, []);
    repCatGroups.get(key).push({
      discount:    Number(l.discountPercent),
      quotationId: l.quotation.id,
      lineId:      l.id,
      categoryName: l.product?.category?.name,
    });
  }

  let count = 0;
  for (const [, entries] of repCatGroups.entries()) {
    if (entries.length < 3) continue; // need enough history for stats

    const discounts = entries.map((e) => e.discount);
    const mean      = discounts.reduce((a, b) => a + b, 0) / discounts.length;
    const variance  = discounts.reduce((s, d) => s + (d - mean) ** 2, 0) / discounts.length;
    const stddev    = Math.sqrt(variance);
    const threshold = mean + ANOMALY_SIGMA_MULTIPLE * stddev;

    for (const e of entries) {
      if (e.discount <= threshold) continue;
      if (await _alreadyFlagged(e.quotationId, 'DISCOUNT_ANOMALY')) continue;
      await _createFlag(
        e.quotationId,
        'DISCOUNT_ANOMALY',
        `${e.categoryName} discount (${e.discount.toFixed(1)}%) is ${(e.discount - mean).toFixed(1)}pts above rep average (${mean.toFixed(1)}% ± ${stddev.toFixed(1)}%)`
      );
      count++;
    }
  }
  if (count) console.log(`[dealHealth] Anomalies: flagged ${count} discount anomaly/anomalies`);
}

// ── Check 3: Delivery slippage ─────────────────────────────────────────────────

async function _checkDeliverySlippage(now) {
  const threshold = new Date(now - SLIPPAGE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status:      { in: SLIPPAGE_STATUSES },
      confirmedAt: { lt: threshold },
    },
    include: {
      quotation: { select: { id: true } },
    },
  });

  let count = 0;
  for (const o of orders) {
    const qId  = o.quotation.id;
    const days = Math.floor((now - new Date(o.confirmedAt)) / (1000 * 60 * 60 * 24));
    if (await _alreadyFlagged(qId, 'DELIVERY_SLIPPAGE')) continue;
    await _createFlag(
      qId,
      'DELIVERY_SLIPPAGE',
      `Order confirmed ${days} days ago but still in status "${o.status}" — delivery not confirmed`
    );
    count++;
  }
  if (count) console.log(`[dealHealth] Slippage: flagged ${count} delayed order(s)`);
}

// ── Main runner ────────────────────────────────────────────────────────────────

async function runStalledDealDetection() {
  const now = Date.now();
  console.log(`[dealHealth] Running at ${new Date(now).toISOString()}`);
  try {
    await _checkStalledDeals(now);
    await _checkDiscountAnomalies();
    await _checkDeliverySlippage(now);
  } catch (err) {
    console.error('[dealHealth] Error during run:', err.message);
  }
  console.log('[dealHealth] Run complete');
}

function scheduleStalledDealDetection() {
  cron.schedule('0 * * * *', runStalledDealDetection, { timezone: 'UTC' });
  console.log('[stalledDealDetection] Scheduled: every hour at :00');
}

module.exports = { scheduleStalledDealDetection, runStalledDealDetection };
