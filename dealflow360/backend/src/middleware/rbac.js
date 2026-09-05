'use strict';

const { fail } = require('../utils/response');

/**
 * requireRole(...roles) — must be used AFTER requireAuth.
 * Accepts one or more Role enum values.
 *
 * Usage:
 *   router.get('/admin-only', requireAuth, requireRole('ADMIN'), handler)
 *   router.get('/sales',      requireAuth, requireRole('ADMIN', 'SALES_REP'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(fail('Not authenticated', 'UNAUTHORIZED'));
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json(
        fail(`Role '${req.user.role}' is not permitted for this resource`, 'FORBIDDEN')
      );
    }
    next();
  };
}

/**
 * requireCustomerScope — for portal routes.
 * Ensures a CUSTOMER-role JWT can only access their own customer's data.
 * Compares req.user.customerId against the :customerId param OR req.body.customerId.
 */
function requireCustomerScope(req, res, next) {
  if (req.user.role !== 'CUSTOMER') return next(); // internal roles pass through

  const targetCustomerId =
    req.params.customerId ||
    req.query.customerId ||
    req.body?.customerId;

  if (targetCustomerId && targetCustomerId !== req.user.customerId) {
    return res.status(403).json(fail('Access denied to this customer resource', 'FORBIDDEN'));
  }
  next();
}

module.exports = { requireRole, requireCustomerScope };
