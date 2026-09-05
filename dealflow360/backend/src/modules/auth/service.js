'use strict';

const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const prisma = require('../../config/prisma');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/env');

const SALT_ROUNDS = 12;

// Roles that can be created via the public signup endpoint.
// CUSTOMER is intentionally excluded — portal accounts are auto-generated later.
const INTERNAL_ROLES = new Set(['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE']);

/**
 * Sign a JWT for the given user row.
 * Payload shape: { userId, email, role, customerId? }
 */
function signToken(user) {
  const payload = {
    userId:     user.id,
    email:      user.email,
    role:       user.role,
    ...(user.customerId ? { customerId: user.customerId } : {}),
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * POST /api/auth/signup
 * Creates an internal (non-customer) user account.
 */
async function signup({ name, email, password, role = 'SALES_REP' }) {
  if (!INTERNAL_ROLES.has(role)) {
    const err = new Error('Invalid role. CUSTOMER accounts are created via the customer onboarding flow.');
    err.statusCode = 400;
    err.code = 'INVALID_ROLE';
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { name, email, passwordHash, role },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return { user, token: signToken(user) };
}

/**
 * POST /api/auth/login
 * Returns the JWT on success, or a mustChangePassword flag for first-time portal customers.
 */
async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  // First-time portal customers must change their temporary password before getting a session.
  if (user.mustChangePassword) {
    return {
      mustChangePassword: true,
      userId: user.id,
      message: 'Password change required before accessing the portal.',
    };
  }

  const token = signToken(user);
  return {
    mustChangePassword: false,
    token,
    user: {
      id:         user.id,
      name:       user.name,
      email:      user.email,
      role:       user.role,
      customerId: user.customerId ?? undefined,
    },
  };
}

/**
 * POST /api/auth/change-password
 * Allows users with mustChangePassword=true to set their real password
 * and receive a normal session token.
 */
async function changePassword({ userId, newPassword }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });

  return {
    token: signToken(updated),
    user: {
      id:         updated.id,
      name:       updated.name,
      email:      updated.email,
      role:       updated.role,
      customerId: updated.customerId ?? undefined,
    },
  };
}

/**
 * GET /api/auth/me
 * Returns the current user's profile (read from DB for freshness).
 */
async function me(userId) {
  const user = await prisma.user.findUniqueOrThrow({
    where:  { id: userId },
    select: { id: true, name: true, email: true, role: true, customerId: true, createdAt: true },
  });
  return user;
}

module.exports = { signup, login, changePassword, me };
