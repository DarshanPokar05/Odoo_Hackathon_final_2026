'use strict';

const prisma = require('../config/prisma');

/**
 * Write an entry to the ActivityLog table.
 *
 * @param {object} params
 * @param {string|null} params.userId     — null for system-generated actions
 * @param {string}      params.action     — e.g. "QUOTATION_CREATED", "PAYMENT_VERIFIED"
 * @param {string}      params.entityType — e.g. "Quotation", "Payment"
 * @param {string}      params.entityId
 * @param {object}      [params.details]  — arbitrary JSON metadata
 * @returns {Promise<void>}
 */
async function logAudit({ userId = null, action, entityType, entityId, details }) {
  try {
    await prisma.activityLog.create({
      data: { userId, action, entityType, entityId, details: details ?? undefined },
    });
  } catch (err) {
    // Audit logging must never crash the calling request
    console.error('[logAudit] Failed to write audit log:', err.message);
  }
}

module.exports = { logAudit };
