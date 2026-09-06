'use strict';

const router = require('express').Router();
const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/rbac');
const ctrl = require('./controller');

// Webhook: unauthenticated — Razorpay signs the request with its own signature.
// Must be registered BEFORE express.json() on this route so rawBody is available.
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    // Attach rawBody string for signature verification
    req.rawBody = req.body.toString('utf8');
    next();
  },
  ctrl.webhook
);

// Authenticated payment actions
router.post('/create-order',
  requireAuth,
  requireRole('ADMIN', 'FINANCE', 'SALES_REP', 'SALES_MANAGER', 'CUSTOMER'),
  ctrl.createOrder
);

router.post('/verify',
  requireAuth,
  requireRole('ADMIN', 'FINANCE', 'SALES_REP', 'SALES_MANAGER', 'CUSTOMER'),
  ctrl.verify
);

module.exports = router;
