'use strict';

const svc         = require('./service');
const { success } = require('../../utils/response');

exports.list     = async (req, res, next) => { try { res.json(success(await svc.list(req.query, req.user))); } catch (e) { next(e); } };
exports.getOne   = async (req, res, next) => { try { res.json(success(await svc.getOne(req.params.id, req.user))); } catch (e) { next(e); } };
exports.resolve  = async (req, res, next) => { try { res.json(success(await svc.resolve(req.params.id, req.user))); } catch (e) { next(e); } };
exports.escalate = async (req, res, next) => { try { res.json(success(await svc.escalate(req.params.id, req.body, req.user))); } catch (e) { next(e); } };
