'use strict';

const svc         = require('./service');
const { success } = require('../../utils/response');

exports.list   = async (req, res, next) => {
  try { res.json(success(await svc.list(req.query, req.user))); } catch (e) { next(e); }
};

exports.getOne = async (req, res, next) => {
  try { res.json(success(await svc.getOne(req.params.id, req.user))); } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try { res.status(201).json(success(await svc.create(req.body, req.user))); } catch (e) { next(e); }
};

exports.modify = async (req, res, next) => {
  try { res.json(success(await svc.modify(req.params.id, req.body, req.user))); } catch (e) { next(e); }
};

exports.cancel = async (req, res, next) => {
  try { res.json(success(await svc.cancel(req.params.id, req.body, req.user))); } catch (e) { next(e); }
};

// ── Subscription Plans ────────────────────────────────────────────────────────
exports.listPlans  = async (req, res, next) => { try { res.json(success(await svc.listPlans())); } catch (e) { next(e); } };
exports.getPlan    = async (req, res, next) => { try { res.json(success(await svc.getPlan(req.params.id))); } catch (e) { next(e); } };
exports.createPlan = async (req, res, next) => { try { res.status(201).json(success(await svc.createPlan(req.body, req.user))); } catch (e) { next(e); } };
exports.updatePlan = async (req, res, next) => { try { res.json(success(await svc.updatePlan(req.params.id, req.body, req.user))); } catch (e) { next(e); } };
exports.deletePlan = async (req, res, next) => { try { res.json(success(await svc.deletePlan(req.params.id, req.user))); } catch (e) { next(e); } };
