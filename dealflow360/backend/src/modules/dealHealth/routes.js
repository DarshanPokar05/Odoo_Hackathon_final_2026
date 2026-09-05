'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

const VIEWERS = ['ADMIN', 'SALES_MANAGER', 'FINANCE'];

router.get('/',               requireAuth, requireRole(...VIEWERS), ctrl.list);
router.get('/:id',            requireAuth, requireRole(...VIEWERS), ctrl.getOne);
router.patch('/:id/resolve',  requireAuth, requireRole(...VIEWERS), ctrl.resolve);
router.patch('/:id/escalate', requireAuth, requireRole(...VIEWERS), ctrl.escalate);

module.exports = router;
