'use strict';

const router          = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl            = require('./controller');

const READ_ROLES  = ['ADMIN', 'SALES_MANAGER', 'FINANCE', 'SALES_REP'];
const WRITE_ROLES = ['ADMIN'];
const STOCK_ROLES = ['ADMIN', 'FINANCE'];          // who can set/adjust stock
const VIEW_ROLES  = ['ADMIN', 'SALES_MANAGER', 'FINANCE', 'SALES_REP'];

// ── Warehouse CRUD ─────────────────────────────────────────────────────────
router.get('/',    requireAuth, requireRole(...READ_ROLES),  ctrl.list);
router.get('/:id', requireAuth, requireRole(...VIEW_ROLES),  ctrl.getOne);
router.post('/',   requireAuth, requireRole(...WRITE_ROLES), ctrl.create);
router.put('/:id', requireAuth, requireRole(...WRITE_ROLES), ctrl.update);
router.delete('/:id', requireAuth, requireRole(...WRITE_ROLES), ctrl.remove);

// ── StockLevel sub-routes ──────────────────────────────────────────────────
// GET  /api/warehouses/:id/stock          — list stock for a warehouse
// PUT  /api/warehouses/:id/stock          — upsert (set absolute) stock
// POST /api/warehouses/:id/stock/adjust   — apply signed delta (restock/drawdown)

router.get( '/:id/stock',        requireAuth, requireRole(...VIEW_ROLES),  ctrl.listStock);
router.put( '/:id/stock',        requireAuth, requireRole(...STOCK_ROLES), ctrl.setStock);
router.post('/:id/stock/adjust', requireAuth, requireRole(...STOCK_ROLES), ctrl.adjustStock);

module.exports = router;
