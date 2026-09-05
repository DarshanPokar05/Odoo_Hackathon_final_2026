'use strict';

const svc         = require('./service');
const { success } = require('../../utils/response');

// ─── Warehouse CRUD ───────────────────────────────────────────────────────────
exports.list   = async (req, res, next) => { try { res.json(success(await svc.list())); } catch (e) { next(e); } };
exports.getOne = async (req, res, next) => { try { res.json(success(await svc.getOne(req.params.id))); } catch (e) { next(e); } };
exports.create = async (req, res, next) => { try { res.status(201).json(success(await svc.create(req.body, req.user))); } catch (e) { next(e); } };
exports.update = async (req, res, next) => { try { res.json(success(await svc.update(req.params.id, req.body, req.user))); } catch (e) { next(e); } };
exports.remove = async (req, res, next) => { try { res.json(success(await svc.remove(req.params.id, req.user))); } catch (e) { next(e); } };

// ─── StockLevel sub-routes ────────────────────────────────────────────────────

/** GET /api/warehouses/:id/stock — list all stock levels for one warehouse */
exports.listStock = async (req, res, next) => {
  try {
    res.json(success(await svc.listStock(req.params.id)));
  } catch (e) { next(e); }
};

/** PUT /api/warehouses/:id/stock — upsert (set absolute) stock for a product */
exports.setStock = async (req, res, next) => {
  try {
    res.json(success(await svc.setStock(req.params.id, req.body, req.user)));
  } catch (e) { next(e); }
};

/** POST /api/warehouses/:id/stock/adjust — apply a signed delta to onHand */
exports.adjustStock = async (req, res, next) => {
  try {
    res.json(success(await svc.adjustStock(req.params.id, req.body, req.user)));
  } catch (e) { next(e); }
};
