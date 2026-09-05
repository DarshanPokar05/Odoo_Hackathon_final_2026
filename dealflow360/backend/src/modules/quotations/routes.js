'use strict';

const router = require('express').Router();
const { requireAuth }          = require('../../middleware/auth');
const { requireRole, requireCustomerScope } = require('../../middleware/rbac');
const ctrl = require('./controller');

const INTERNAL = ['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE'];
const ALL_ROLES = [...INTERNAL, 'CUSTOMER'];

// ── List / create ─────────────────────────────────────────────────────────────
router.get('/',
  requireAuth,
  requireRole(...ALL_ROLES),
  requireCustomerScope,
  ctrl.list
);

router.post('/',
  requireAuth,
  requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER'),
  ctrl.create
);

// ── Single quotation ──────────────────────────────────────────────────────────
router.get('/:id',
  requireAuth,
  requireRole(...ALL_ROLES),
  requireCustomerScope,
  ctrl.getOne
);

// ── Line management ───────────────────────────────────────────────────────────
router.post('/:id/lines',
  requireAuth,
  requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER'),
  ctrl.addLine
);

router.patch('/:id/lines/:lineId',
  requireAuth,
  requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER'),
  ctrl.updateLine
);

router.delete('/:id/lines/:lineId',
  requireAuth,
  requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER'),
  ctrl.removeLine
);

// ── Workflow ──────────────────────────────────────────────────────────────────
router.patch('/:id/save-draft',
  requireAuth,
  requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER'),
  ctrl.saveDraft
);

router.post('/:id/submit',
  requireAuth,
  requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER'),
  ctrl.submit
);

module.exports = router;
