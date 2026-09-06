'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole, requireCustomerScope } = require('../../middleware/rbac');
const ctrl = require('./controller');

router.get('/',    requireAuth, requireRole('ADMIN', 'FINANCE', 'SALES_MANAGER', 'SALES_REP', 'CUSTOMER'), requireCustomerScope, ctrl.list);
router.get('/:id', requireAuth, requireRole('ADMIN', 'FINANCE', 'SALES_MANAGER', 'SALES_REP', 'CUSTOMER'), requireCustomerScope, ctrl.getOne);

module.exports = router;
