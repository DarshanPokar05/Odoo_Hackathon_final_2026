'use strict';

const svc         = require('./service');
const { success } = require('../../utils/response');

// ── Tier Discount Ceilings ────────────────────────────────────────────────────

exports.listCeilings = async (req, res, next) => {
  try { res.json(success(await svc.listCeilings())); } catch (e) { next(e); }
};

exports.updateCeiling = async (req, res, next) => {
  try {
    // :tier param is e.g. "BRONZE", "SILVER", "GOLD"
    res.json(success(await svc.updateCeiling(req.params.tier.toUpperCase(), req.body, req.user.userId)));
  } catch (e) { next(e); }
};

// ── Approval Chain Rules ──────────────────────────────────────────────────────

exports.listApprovalRules = async (req, res, next) => {
  try { res.json(success(await svc.listApprovalRules())); } catch (e) { next(e); }
};

/**
 * PUT /api/discount-config/approval-rules
 * Body: { rules: [{ minScore, maxScore, requiredLevel }, ...] }
 * Replaces the entire rule set atomically after gap/overlap validation.
 */
exports.saveApprovalRules = async (req, res, next) => {
  try {
    const rules = req.body?.rules;
    res.json(success(await svc.saveApprovalRules(rules, req.user.userId)));
  } catch (e) { next(e); }
};

// ── Legacy CRUD (kept for compatibility with stub routes) ─────────────────────
// These proxy to the new ceiling/rule endpoints — generic :id CRUD is replaced
// by the tier-keyed and bulk-rule endpoints above.
exports.list   = async (req, res, next) => {
  try { res.json(success(await svc.listCeilings())); } catch (e) { next(e); }
};
exports.getOne = async (req, res, next) => {
  try { res.json(success(await svc.listCeilings())); } catch (e) { next(e); }
};
exports.create = async (req, res, next) => {
  try { res.status(201).json(success(await svc.updateCeiling(req.body.tier, req.body, req.user.userId))); } catch (e) { next(e); }
};
exports.update = async (req, res, next) => {
  // Deprecated — use PUT /discount-config/ceilings/:tier instead
  try { res.json(success(await svc.listCeilings())); } catch (e) { next(e); }
};
exports.remove = async (req, res, next) => {
  try { res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Tier ceilings cannot be deleted, only updated.' } }); } catch (e) { next(e); }
};
