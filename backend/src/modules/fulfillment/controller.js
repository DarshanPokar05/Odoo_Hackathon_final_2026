'use strict';

const svc         = require('./service');
const { success } = require('../../utils/response');

// ─── Order fulfillment views ──────────────────────────────────────────────────

/** GET /api/fulfillment — list all orders awaiting fulfillment */
exports.list = async (req, res, next) => {
  try {
    res.json(success(await svc.listOrders()));
  } catch (e) { next(e); }
};

/** GET /api/fulfillment/:orderId — fulfillment detail for one order */
exports.getOne = async (req, res, next) => {
  try {
    res.json(success(await svc.getOrderFulfillment(req.params.orderId)));
  } catch (e) { next(e); }
};

// ─── Split actions ────────────────────────────────────────────────────────────

/** POST /api/fulfillment/:orderId/suggest-split — preview auto-computed split */
exports.suggestSplit = async (req, res, next) => {
  try {
    res.json(success(await svc.suggestSplit(req.params.orderId)));
  } catch (e) { next(e); }
};

/** POST /api/fulfillment/:orderId/accept-split — commit the auto-computed split */
exports.acceptSplit = async (req, res, next) => {
  try {
    res.json(success(await svc.acceptSplit(req.params.orderId, req.user)));
  } catch (e) { next(e); }
};

/** POST /api/fulfillment/:orderId/override — commit a manually supplied split */
exports.overrideSplit = async (req, res, next) => {
  try {
    res.json(success(await svc.overrideSplit(req.params.orderId, req.body, req.user)));
  } catch (e) { next(e); }
};

// ─── Backorder consolidation ──────────────────────────────────────────────────

/** POST /api/fulfillment/backorders/:backorderId/consolidate */
exports.consolidate = async (req, res, next) => {
  try {
    res.json(success(await svc.consolidateBackorder(req.params.backorderId, req.user)));
  } catch (e) { next(e); }
};

// ─── Events ───────────────────────────────────────────────────────────────────

/** POST /api/fulfillment/events/handoff */
exports.handleHandoff = async (req, res, next) => {
  try {
    // This webhook is triggered by Track A, might not have req.user context
    const result = await svc.processFulfillmentHandoff(req.body);
    res.status(200).json(success(result));
  } catch (e) { next(e); }
};
