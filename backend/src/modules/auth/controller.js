'use strict';

const { z }      = require('zod');
const svc        = require('./service');
const { success } = require('../../utils/response');

// ── Validation schemas ────────────────────────────────────────────────────────

const signupSchema = z.object({
  name:     z.string().min(1).max(100),
  email:    z.string().email(),
  password: z.string().min(8).max(128),
  role:     z.enum(['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE']).optional(),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  userId:      z.string().uuid(),
  newPassword: z.string().min(8).max(128),
});

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/signup
 */
exports.signup = async (req, res, next) => {
  try {
    const body   = signupSchema.parse(req.body);
    const result = await svc.signup(body);
    res.status(201).json(success(result));
  } catch (e) { next(e); }
};

/**
 * POST /api/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const body   = loginSchema.parse(req.body);
    const result = await svc.login(body);
    res.json(success(result));
  } catch (e) { next(e); }
};

/**
 * POST /api/auth/change-password
 * Body: { userId, newPassword }
 * The userId can come from a pre-auth "change password required" screen.
 */
exports.changePassword = async (req, res, next) => {
  try {
    const body   = changePasswordSchema.parse(req.body);
    const result = await svc.changePassword(body);
    res.json(success(result));
  } catch (e) { next(e); }
};

/**
 * GET /api/auth/me
 * Requires a valid Bearer JWT (requireAuth applied in routes).
 */
exports.me = async (req, res, next) => {
  try {
    const user = await svc.me(req.user.userId);
    res.json(success(user));
  } catch (e) { next(e); }
};
