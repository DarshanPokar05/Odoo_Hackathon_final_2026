'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

// TODO: implement full routes in the relevant phase
router.get('/',    requireAuth, requireRole('ADMIN', 'SALES_MANAGER', 'FINANCE'), ctrl.list);
router.get('/:id', requireAuth, requireRole('ADMIN', 'SALES_MANAGER', 'FINANCE'), ctrl.getOne);
router.post('/',   requireAuth, requireRole('ADMIN', 'SALES_MANAGER', 'FINANCE'), ctrl.create);
router.put('/:id', requireAuth, requireRole('ADMIN', 'SALES_MANAGER', 'FINANCE'), ctrl.update);
router.delete('/:id', requireAuth, requireRole('ADMIN', 'SALES_MANAGER', 'FINANCE'), ctrl.remove);

module.exports = router;
