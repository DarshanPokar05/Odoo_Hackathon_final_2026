'use strict';

const router          = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl            = require('./controller');

const VIEW_ROLES   = ['ADMIN', 'SALES_MANAGER', 'FINANCE', 'SALES_REP'];
const ACTION_ROLES = ['ADMIN', 'SALES_MANAGER', 'FINANCE'];

// ── Order fulfillment list & detail ────────────────────────────────────────
router.get('/',           requireAuth, requireRole(...VIEW_ROLES),   ctrl.list);
router.get('/:orderId',   requireAuth, requireRole(...VIEW_ROLES),   ctrl.getOne);

// ── Split workflow ─────────────────────────────────────────────────────────
// POST /api/fulfillment/:orderId/suggest-split  — preview (no commit)
// POST /api/fulfillment/:orderId/accept-split   — commit auto split
// POST /api/fulfillment/:orderId/override       — commit manual split
router.post('/:orderId/suggest-split', requireAuth, requireRole(...VIEW_ROLES),   ctrl.suggestSplit);
router.post('/:orderId/accept-split',  requireAuth, requireRole(...ACTION_ROLES), ctrl.acceptSplit);
router.post('/:orderId/override',      requireAuth, requireRole(...ACTION_ROLES), ctrl.overrideSplit);

// ── Backorder consolidation ────────────────────────────────────────────────
// POST /api/fulfillment/backorders/:backorderId/consolidate
// NOTE: this route must be declared BEFORE '/:orderId' or Express would match
//       "backorders" as an orderId.  Express matches in declaration order.
router.post('/backorders/:backorderId/consolidate', requireAuth, requireRole(...ACTION_ROLES), ctrl.consolidate);

// ── Events from Track A ────────────────────────────────────────────────────
// POST /api/fulfillment/events/handoff — triggered when order is confirmed
router.post('/events/handoff', ctrl.handleHandoff);

module.exports = router;
