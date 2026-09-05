'use strict';

/**
 * Stalled Deal Detection Job
 * ──────────────────────────
 * Runs every hour.
 * Cron expression: '0 * * * *'
 *
 * A deal is considered STALLED when:
 *   - Its status is one of: DRAFT, PENDING_APPROVAL, UNDER_NEGOTIATION
 *   - Its lastActivityAt is older than STALL_THRESHOLD_HOURS
 *   - There is no existing unresolved STALLED flag for that quotation
 *
 * When a stall is detected:
 *   1. Creates a DealHealthFlag record (type = "STALLED").
 *   2. Emits a real-time event to managers/finance via the realtime helpers.
 *   3. Logs to ActivityLog.
 */

const cron    = require('node-cron');
const prisma  = require('../config/prisma');
const { logAudit }          = require('../utils/logAudit');
const { emitDealHealthFlag } = require('../realtime');

// Deals with no activity for this many hours are flagged as stalled.
const STALL_THRESHOLD_HOURS = 48;

// Statuses that can stall (confirmed/invoiced/closed deals are not checked).
const STALL_CANDIDATE_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'UNDER_NEGOTIATION',
];

/**
 * Core detection logic — extracted so it can be invoked manually / in tests.
 */
async function runStalledDealDetection() {
  const now       = new Date();
  const threshold = new Date(now.getTime() - STALL_THRESHOLD_HOURS * 60 * 60 * 1000);

  console.log(`[stalledDealDetection] Checking for stalled deals (threshold: ${STALL_THRESHOLD_HOURS}h)`);

  // Find stalled candidates
  const candidates = await prisma.quotation.findMany({
    where: {
      status:        { in: STALL_CANDIDATE_STATUSES },
      lastActivityAt: { lt: threshold },
    },
    select: {
      id:             true,
      status:         true,
      customerId:     true,
      repId:          true,
      lastActivityAt: true,
    },
  });

  if (candidates.length === 0) {
    console.log('[stalledDealDetection] No stalled deals found');
    return;
  }

  // Filter out any that already have an unresolved STALLED flag
  const existingFlags = await prisma.dealHealthFlag.findMany({
    where: {
      quotationId: { in: candidates.map((q) => q.id) },
      type:        'STALLED',
      resolved:    false,
    },
    select: { quotationId: true },
  });
  const alreadyFlagged = new Set(existingFlags.map((f) => f.quotationId));

  const toFlag = candidates.filter((q) => !alreadyFlagged.has(q.id));
  console.log(`[stalledDealDetection] ${toFlag.length} new stall(s) to flag (${alreadyFlagged.size} already flagged)`);

  for (const quotation of toFlag) {
    try {
      const hoursStalled = Math.floor((now - new Date(quotation.lastActivityAt)) / (1000 * 60 * 60));
      const detail = `No activity for ${hoursStalled} hours (status: ${quotation.status})`;

      const flag = await prisma.dealHealthFlag.create({
        data: {
          quotationId: quotation.id,
          type:        'STALLED',
          detail,
          resolved:    false,
        },
      });

      // Real-time push to managers/finance/admin
      emitDealHealthFlag(flag);

      await logAudit({
        userId:     null,
        action:     'DEAL_STALLED_FLAGGED',
        entityType: 'Quotation',
        entityId:   quotation.id,
        details:    { hoursStalled, status: quotation.status },
      });
    } catch (err) {
      console.error(`[stalledDealDetection] Failed to flag quotation ${quotation.id}:`, err.message);
    }
  }

  console.log('[stalledDealDetection] Run complete');
}

/**
 * Register the cron schedule.
 * Call this once from server.js.
 */
function scheduleStalledDealDetection() {
  // '0 * * * *' = top of every hour
  cron.schedule('0 * * * *', runStalledDealDetection, {
    timezone: 'UTC',
  });
  console.log('[stalledDealDetection] Scheduled: every hour at :00');
}

module.exports = { scheduleStalledDealDetection, runStalledDealDetection };
