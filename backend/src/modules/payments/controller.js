'use strict';

const svc         = require('./service');
const { success } = require('../../utils/response');

exports.createOrder = async (req, res, next) => {
  try { res.status(201).json(success(await svc.createOrder(req.body, req.user))); } catch (e) { next(e); }
};

exports.verify = async (req, res, next) => {
  try { res.json(success(await svc.verify(req.body, req.user))); } catch (e) { next(e); }
};

/**
 * Webhook — must read the raw body (configured in server.js before json parser).
 * The webhook endpoint is intentionally unauthenticated (Razorpay signs it).
 */
exports.webhook = async (req, res, next) => {
  try {
    const sig    = req.headers['x-razorpay-signature'] ?? '';
    const result = await svc.webhook(req.rawBody ?? JSON.stringify(req.body), sig);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
};
