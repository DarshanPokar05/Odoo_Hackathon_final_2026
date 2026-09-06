'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

const VIEWERS = ['ADMIN', 'SALES_MANAGER', 'FINANCE', 'SALES_REP'];

router.get('/',            requireAuth, requireRole(...VIEWERS), ctrl.getSummary);
router.get('/export/pdf',  requireAuth, requireRole(...VIEWERS), ctrl.exportPdf);
router.get('/export/csv',  requireAuth, requireRole(...VIEWERS), ctrl.exportCsv);

module.exports = router;
