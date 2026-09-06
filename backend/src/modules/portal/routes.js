'use strict';

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

// Unauthenticated: forced password change on first login (user has no token yet)
router.post('/auth/change-password', ctrl.changePassword);

// Internal admin: provision a portal account for a customer
router.post('/provision/:customerId',
  requireAuth,
  requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER'),
  ctrl.provision
);

// Customer-only routes: all scoped to the authenticated customer's data
router.get('/quotations',
  requireAuth, requireRole('CUSTOMER'),
  ctrl.listQuotations
);

router.get('/quotations/:id',
  requireAuth, requireRole('CUSTOMER'),
  ctrl.getQuotation
);

router.post('/quotations/:id/messages',
  requireAuth, requireRole('CUSTOMER'),
  ctrl.postMessage
);

router.post('/quotations/:id/counter-discount',
  requireAuth, requireRole('CUSTOMER'),
  ctrl.counterDiscount
);

router.post('/quotations/:id/confirm',
  requireAuth, requireRole('CUSTOMER'),
  ctrl.confirmQuotation
);

module.exports = router;
