'use strict';

/**
 * Realtime helpers — thin wrappers around the Socket.io emitToRoom helper.
 *
 * Import these from any module that needs to push live updates.
 * Never import the raw `io` instance directly — always go through emitToRoom.
 *
 * Event naming convention:  <ENTITY>_<ACTION>  (uppercase, underscore-separated)
 * e.g. QUOTATION_UPDATED, NOTIFICATION_CREATED, DEAL_HEALTH_FLAGGED
 */

const { emitToRoom } = require('../config/socket');

// ── Quotation events ─────────────────────────────────────────────────────────

/**
 * Broadcast a quotation status change to the rep who owns it and to all
 * SALES_MANAGER / FINANCE role rooms (approvers need to see the queue update).
 *
 * @param {object} params
 * @param {string} params.repId       — userId of the sales rep
 * @param {string} params.quotationId
 * @param {string} params.status      — new status string
 * @param {object} [params.extra]     — any additional payload fields
 */
function emitQuotationUpdated({ repId, quotationId, status, extra = {} }) {
  const payload = { quotationId, status, ...extra };
  emitToRoom(`user:${repId}`,         'QUOTATION_UPDATED', payload);
  emitToRoom('role:SALES_MANAGER',    'QUOTATION_UPDATED', payload);
  emitToRoom('role:FINANCE',          'QUOTATION_UPDATED', payload);
}

/**
 * Notify the customer's portal room that their quotation changed.
 *
 * @param {string} customerId
 * @param {string} quotationId
 * @param {string} status
 * @param {object} [extra]
 */
function emitQuotationCustomerUpdate({ customerId, quotationId, status, extra = {} }) {
  emitToRoom(`customer:${customerId}`, 'QUOTATION_UPDATED', { quotationId, status, ...extra });
}

// ── Notification events ───────────────────────────────────────────────────────

/**
 * Push a new in-app notification to a single user.
 *
 * @param {string} userId
 * @param {object} notification — shape from Notification model
 */
function emitNotification(userId, notification) {
  emitToRoom(`user:${userId}`, 'NOTIFICATION_CREATED', notification);
}

// ── Approval events ───────────────────────────────────────────────────────────

/**
 * Notify approver roles that a quotation is waiting for their action.
 *
 * @param {string} level — "SALES_MANAGER" | "FINANCE"
 * @param {object} payload
 */
function emitApprovalPending(level, payload) {
  emitToRoom(`role:${level}`, 'APPROVAL_PENDING', payload);
}

/**
 * Notify the rep that an approver has acted on their quotation.
 *
 * @param {string} repId
 * @param {object} payload
 */
function emitApprovalActed(repId, payload) {
  emitToRoom(`user:${repId}`, 'APPROVAL_ACTED', payload);
}

// ── Deal health events ────────────────────────────────────────────────────────

/**
 * Broadcast a new deal health flag to managers and finance.
 *
 * @param {object} flag — DealHealthFlag record
 */
function emitDealHealthFlag(flag) {
  emitToRoom('role:SALES_MANAGER', 'DEAL_HEALTH_FLAGGED', flag);
  emitToRoom('role:FINANCE',       'DEAL_HEALTH_FLAGGED', flag);
  emitToRoom('role:ADMIN',         'DEAL_HEALTH_FLAGGED', flag);
}

// ── Negotiation events ────────────────────────────────────────────────────────

/**
 * Notify all parties to a negotiation that a new message arrived.
 *
 * @param {string} repId
 * @param {string} customerId
 * @param {object} message — NegotiationMessage record
 */
function emitNegotiationMessage({ repId, customerId, message }) {
  emitToRoom(`user:${repId}`,          'NEGOTIATION_MESSAGE', message);
  emitToRoom(`customer:${customerId}`, 'NEGOTIATION_MESSAGE', message);
}

// ── Fulfillment & stock events ────────────────────────────────────────────────

/**
 * Broadcast that a warehouse's stock level changed.
 * Internal roles (ADMIN, SALES_MANAGER, FINANCE) all need the live stock table
 * on Screen 7 to update without a page refresh.
 *
 * @param {object} payload
 * @param {string} payload.warehouseId
 * @param {string} payload.productId
 * @param {number} payload.onHand
 * @param {number} payload.reserved
 * @param {number} payload.available   — onHand - reserved, pre-computed for the client
 */
function emitStockUpdated(payload) {
  emitToRoom('role:ADMIN',          'STOCK_UPDATED', payload);
  emitToRoom('role:SALES_MANAGER',  'STOCK_UPDATED', payload);
  emitToRoom('role:FINANCE',        'STOCK_UPDATED', payload);
}

/**
 * Tell fulfillment operators that stock has been restocked to a level that can
 * now cover a previously-backordered quantity.  The frontend shows the
 * "Consolidate Remaining Backorder" banner in real-time on Screen 8.
 *
 * @param {object} payload
 * @param {string} payload.orderId
 * @param {string} payload.backorderId
 * @param {string} payload.productId
 * @param {number} payload.qtyPending
 * @param {number} payload.totalAvailable
 */
function emitBackorderCoverable(payload) {
  emitToRoom('role:ADMIN',          'BACKORDER_COVERABLE', payload);
  emitToRoom('role:SALES_MANAGER',  'BACKORDER_COVERABLE', payload);
  emitToRoom('role:FINANCE',        'BACKORDER_COVERABLE', payload);
}

/**
 * Notify that a fulfillment split was committed (accepted or overridden)
 * or that a backorder was consolidated.
 *
 * @param {object} payload
 * @param {string} payload.orderId
 * @param {string} payload.status   — new Order status
 * @param {Array}  payload.splits
 * @param {Array}  payload.backorders
 */
function emitFulfillmentUpdated(payload) {
  emitToRoom('role:ADMIN',          'FULFILLMENT_UPDATED', payload);
  emitToRoom('role:SALES_MANAGER',  'FULFILLMENT_UPDATED', payload);
  emitToRoom('role:FINANCE',        'FULFILLMENT_UPDATED', payload);
  // Also push to the quotation room so Track A's dashboard reflects the status
  if (payload.orderId) {
    emitToRoom(`order:${payload.orderId}`, 'FULFILLMENT_UPDATED', payload);
  }
}

// ── Generic room emit (escape hatch for modules with unusual needs) ───────────

/**
 * Pass-through for ad-hoc events not covered by the helpers above.
 * Prefer the typed helpers whenever possible.
 */
function emitToRoomRaw(room, event, payload) {
  emitToRoom(room, event, payload);
}

module.exports = {
  emitQuotationUpdated,
  emitQuotationCustomerUpdate,
  emitNotification,
  emitApprovalPending,
  emitApprovalActed,
  emitDealHealthFlag,
  emitNegotiationMessage,
  emitStockUpdated,
  emitBackorderCoverable,
  emitFulfillmentUpdated,
  emitToRoomRaw,
};
