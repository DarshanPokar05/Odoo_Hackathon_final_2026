'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

const ALL_INTERNAL = ['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE'];

router.get('/',    requireAuth, requireRole(...ALL_INTERNAL), ctrl.list);
router.get('/:id', requireAuth, requireRole(...ALL_INTERNAL), ctrl.getOne);
router.post('/',   requireAuth, requireRole('ADMIN', 'FINANCE'), ctrl.create);

// Mid-cycle modify and cancel
router.patch('/:id/modify', requireAuth, requireRole(...ALL_INTERNAL), ctrl.modify);
router.patch('/:id/cancel', requireAuth, requireRole(...ALL_INTERNAL), ctrl.cancel);

module.exports = router;
