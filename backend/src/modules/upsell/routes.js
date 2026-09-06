'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

// Upsell rules CRUD (Admin manages, reps/managers can view)
router.get('/',       requireAuth, requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER'), ctrl.list);
router.get('/:id',    requireAuth, requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER'), ctrl.getOne);
router.post('/',      requireAuth, requireRole('ADMIN'), ctrl.create);
router.put('/:id',    requireAuth, requireRole('ADMIN'), ctrl.update);
router.delete('/:id', requireAuth, requireRole('ADMIN'), ctrl.remove);

// Suggestions for a quotation
router.get('/suggestions/:quotationId',
  requireAuth,
  requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER'),
  ctrl.getSuggestions
);

module.exports = router;
