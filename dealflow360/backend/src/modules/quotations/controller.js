'use strict';

const svc         = require('./service');
const { success } = require('../../utils/response');

// ── List / get ────────────────────────────────────────────────────────────────

exports.list = async (req, res, next) => {
  try { res.json(success(await svc.list(req.query, req.user))); }
  catch (e) { next(e); }
};

exports.getOne = async (req, res, next) => {
  try { res.json(success(await svc.getOne(req.params.id, req.user))); }
  catch (e) { next(e); }
};

// ── Create quotation ──────────────────────────────────────────────────────────

exports.create = async (req, res, next) => {
  try { res.status(201).json(success(await svc.create(req.body, req.user))); }
  catch (e) { next(e); }
};

// ── Line management ───────────────────────────────────────────────────────────

exports.addLine = async (req, res, next) => {
  try { res.status(201).json(success(await svc.addLine(req.params.id, req.body, req.user))); }
  catch (e) { next(e); }
};

exports.updateLine = async (req, res, next) => {
  try { res.json(success(await svc.updateLine(req.params.id, req.params.lineId, req.body, req.user))); }
  catch (e) { next(e); }
};

exports.removeLine = async (req, res, next) => {
  try { res.json(success(await svc.removeLine(req.params.id, req.params.lineId, req.user))); }
  catch (e) { next(e); }
};

// ── Workflow actions ──────────────────────────────────────────────────────────

exports.saveDraft = async (req, res, next) => {
  try { res.json(success(await svc.saveDraft(req.params.id, req.body, req.user))); }
  catch (e) { next(e); }
};

exports.submit = async (req, res, next) => {
  try { res.json(success(await svc.submit(req.params.id, req.user))); }
  catch (e) { next(e); }
};
