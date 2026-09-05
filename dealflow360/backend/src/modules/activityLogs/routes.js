'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

// Accessible by all internal roles — used by the dashboard feed
router.get('/',    requireAuth, requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE'), ctrl.list);
router.get('/:id', requireAuth, requireRole('ADMIN', 'SALES_MANAGER', 'FINANCE'), ctrl.getOne);

module.exports = router;
