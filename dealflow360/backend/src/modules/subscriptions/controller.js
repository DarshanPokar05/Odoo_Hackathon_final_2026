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
