'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

// TODO: implement full routes in the relevant phase
router.get('/',    requireAuth, requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE', 'CUSTOMER'), ctrl.list);
router.get('/:id', requireAuth, requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE', 'CUSTOMER'), ctrl.getOne);
router.post('/',   requireAuth, requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE', 'CUSTOMER'), ctrl.create);
router.put('/:id', requireAuth, requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE', 'CUSTOMER'), ctrl.update);
router.delete('/:id', requireAuth, requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE', 'CUSTOMER'), ctrl.remove);

module.exports = router;
