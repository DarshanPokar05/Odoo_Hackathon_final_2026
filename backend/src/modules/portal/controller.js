'use strict';

const svc         = require('./service');
const { success } = require('../../utils/response');

exports.provision = async (req, res, next) => {
  try {
    res.status(201).json(success(await svc.provisionPortalAccount(req.params.customerId)));
  } catch (e) { next(e); }
};

exports.changePassword = async (req, res, next) => {
  try { res.json(success(await svc.changePassword(req.body))); } catch (e) { next(e); }
};

exports.listQuotations = async (req, res, next) => {
  try { res.json(success(await svc.listQuotations(req.user))); } catch (e) { next(e); }
};

exports.getQuotation = async (req, res, next) => {
  try { res.json(success(await svc.getQuotation(req.params.id, req.user))); } catch (e) { next(e); }
};

exports.postMessage = async (req, res, next) => {
  try {
    res.status(201).json(success(await svc.postMessage(req.params.id, req.body, req.user)));
  } catch (e) { next(e); }
};

exports.counterDiscount = async (req, res, next) => {
  try { res.json(success(await svc.counterDiscount(req.params.id, req.body, req.user))); } catch (e) { next(e); }
};

exports.confirmQuotation = async (req, res, next) => {
  try { res.json(success(await svc.confirmQuotation(req.params.id, req.user))); } catch (e) { next(e); }
};
