'use strict';

const svc         = require('./service');
const { success } = require('../../utils/response');

exports.getSummary = async (req, res, next) => {
  try { res.json(success(await svc.getSummary(req.query, req.user))); } catch (e) { next(e); }
};

exports.exportPdf = async (req, res, next) => {
  try {
    const buffer = await svc.exportPdf(req.query, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="dealflow360-report.pdf"');
    res.send(buffer);
  } catch (e) { next(e); }
};

exports.exportCsv = async (req, res, next) => {
  try {
    const csv = await svc.exportCsv(req.query, req.user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="dealflow360-report.csv"');
    res.send(csv);
  } catch (e) { next(e); }
};
