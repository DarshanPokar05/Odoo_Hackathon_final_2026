'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

router.get('/',    requireAuth, requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE', 'CUSTOMER'), ctrl.list);
router.get('/:id', requireAuth, requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE', 'CUSTOMER'), ctrl.getOne);
router.post('/',   requireAuth, requireRole('ADMIN'), ctrl.create);
router.put('/:id',    requireAuth, requireRole('ADMIN'), ctrl.update);
router.patch('/:id',  requireAuth, requireRole('ADMIN'), ctrl.update);
router.delete('/:id', requireAuth, requireRole('ADMIN'), ctrl.remove);

module.exports = router;
