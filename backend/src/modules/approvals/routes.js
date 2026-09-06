'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

const APPROVERS = ['ADMIN', 'SALES_MANAGER', 'FINANCE'];

// List pending approval steps (scoped to role in service layer)
router.get('/',    requireAuth, requireRole(...APPROVERS), ctrl.list);
router.get('/:id', requireAuth, requireRole(...APPROVERS), ctrl.getOne);

// Approval workflow actions
router.patch('/:id/approve',          requireAuth, requireRole(...APPROVERS), ctrl.approve);
router.patch('/:id/reject',           requireAuth, requireRole(...APPROVERS), ctrl.reject);
router.patch('/:id/return-for-revision', requireAuth, requireRole(...APPROVERS), ctrl.returnForRevision);

module.exports = router;
