'use strict';

const svc         = require('./service');
const { success } = require('../../utils/response');

exports.list = async (req, res, next) => {
  try { res.json(success(await svc.list(req.query, req.user))); }
  catch (e) { next(e); }
};

exports.getOne = async (req, res, next) => {
  try { res.json(success(await svc.getOne(req.params.id, req.user))); }
  catch (e) { next(e); }
};

exports.approve = async (req, res, next) => {
  try { res.json(success(await svc.approve(req.params.id, req.body, req.user))); }
  catch (e) { next(e); }
};

exports.reject = async (req, res, next) => {
  try { res.json(success(await svc.reject(req.params.id, req.body, req.user))); }
  catch (e) { next(e); }
};

exports.returnForRevision = async (req, res, next) => {
  try { res.json(success(await svc.returnForRevision(req.params.id, req.body, req.user))); }
  catch (e) { next(e); }
};
