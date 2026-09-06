'use strict';

const svc         = require('./service');
const { success } = require('../../utils/response');

exports.list   = async (req, res, next) => {
  try { res.json(success(await svc.list(req.query))); } catch (e) { next(e); }
};

exports.getOne = async (req, res, next) => {
  try { res.json(success(await svc.getOne(req.params.id))); } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try { res.status(201).json(success(await svc.create(req.body, req.user.userId))); } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try { res.json(success(await svc.update(req.params.id, req.body, req.user.userId))); } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try { res.json(success(await svc.remove(req.params.id, req.user.userId))); } catch (e) { next(e); }
};

/** GET /api/upsell/suggestions/:quotationId */
exports.getSuggestions = async (req, res, next) => {
  try { res.json(success(await svc.getSuggestions(req.params.quotationId))); } catch (e) { next(e); }
};
