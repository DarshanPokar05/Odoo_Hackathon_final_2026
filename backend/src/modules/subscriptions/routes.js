'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

const ALL_INTERNAL = ['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE'];

// ── Subscription Plans CRUD — MUST come before /:id wildcard ─────────────────
router.get(   '/plans',     requireAuth, requireRole(...ALL_INTERNAL), ctrl.listPlans);
router.get(   '/plans/:id', requireAuth, requireRole(...ALL_INTERNAL), ctrl.getPlan);
router.post(  '/plans',     requireAuth, requireRole('ADMIN'),          ctrl.createPlan);
router.put(   '/plans/:id', requireAuth, requireRole('ADMIN'),          ctrl.updatePlan);
router.delete('/plans/:id', requireAuth, requireRole('ADMIN'),          ctrl.deletePlan);

// ── Active subscriptions ──────────────────────────────────────────────────────
router.get('/',    requireAuth, requireRole(...ALL_INTERNAL), ctrl.list);
router.get('/:id', requireAuth, requireRole(...ALL_INTERNAL), ctrl.getOne);
router.post('/',   requireAuth, requireRole('ADMIN', 'FINANCE'), ctrl.create);

router.patch('/:id/modify', requireAuth, requireRole(...ALL_INTERNAL), ctrl.modify);
router.patch('/:id/cancel', requireAuth, requireRole(...ALL_INTERNAL), ctrl.cancel);

module.exports = router;
