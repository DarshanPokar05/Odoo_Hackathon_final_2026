'use strict';

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { success, fail } = require('../utils/response');

/**
 * requireAuth — verifies the Bearer JWT and attaches `req.user` to the request.
 * req.user shape: { userId, email, role, customerId? }
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json(fail('No token provided', 'UNAUTHORIZED'));
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json(fail(message, 'UNAUTHORIZED'));
  }
}

module.exports = { requireAuth };
