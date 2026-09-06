'use strict';

const svc         = require('./service');
const { success } = require('../../utils/response');
const prisma      = require('../../config/prisma');
const { logAudit }  = require('../../utils/logAudit');
const realtime      = require('../../realtime/index');

// ── List / get ────────────────────────────────────────────────────────────────
exports.list = async (req, res, next) => {
  try { res.json(success(await svc.list(req.query, req.user))); } catch (e) { next(e); }
};

exports.getOne = async (req, res, next) => {
  try { res.json(success(await svc.getOne(req.params.id, req.user))); } catch (e) { next(e); }
};

// ── Create quotation ──────────────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try { res.status(201).json(success(await svc.create(req.body, req.user))); } catch (e) { next(e); }
};

// ── Line management ───────────────────────────────────────────────────────────
exports.addLine = async (req, res, next) => {
  try { res.status(201).json(success(await svc.addLine(req.params.id, req.body, req.user))); } catch (e) { next(e); }
};

exports.updateLine = async (req, res, next) => {
  try { res.json(success(await svc.updateLine(req.params.id, req.params.lineId, req.body, req.user))); } catch (e) { next(e); }
};

exports.removeLine = async (req, res, next) => {
  try { res.json(success(await svc.removeLine(req.params.id, req.params.lineId, req.user))); } catch (e) { next(e); }
};

// ── Workflow ──────────────────────────────────────────────────────────────────
exports.saveDraft = async (req, res, next) => {
  try { res.json(success(await svc.saveDraft(req.params.id, req.body, req.user))); } catch (e) { next(e); }
};

exports.submit = async (req, res, next) => {
  try { res.json(success(await svc.submit(req.params.id, req.user))); } catch (e) { next(e); }
};

// ── Status override ───────────────────────────────────────────────────────────
exports.updateStatus = async (req, res, next) => {
  try {
    const { newStatus } = req.body;
    if (!newStatus) {
      return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'newStatus is required' } });
    }
    res.json(success(await svc.updateStatus(req.params.id, newStatus, req.user)));
  } catch (e) { next(e); }
};

// ── Negotiation messages (rep side) ──────────────────────────────────────────
/**
 * POST /api/quotations/:id/messages
 * Reps send a message reply to the customer negotiation thread.
 * The message is stored as senderType = 'REP'.
 */
exports.postMessage = async (req, res, next) => {
  try {
    const { message, lineId } = req.body;
    if (!message?.trim()) {
      return res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'message is required' } });
    }

    const q = await prisma.quotation.findUnique({
      where: { id: req.params.id },
      select: { id: true, customerId: true, repId: true, status: true },
    });
    if (!q) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Quotation not found' } });

    const msg = await prisma.negotiationMessage.create({
      data: {
        quotationId: q.id,
        senderType: 'REP',
        message: message.trim(),
        lineId: lineId ?? null,
      },
    });

    // Update lastActivityAt
    await prisma.quotation.update({
      where: { id: q.id },
      data: { lastActivityAt: new Date() },
    });

    // Real-time: notify the customer portal
    realtime.emitNegotiationMessage({
      repId:      q.repId,
      customerId: q.customerId,
      message:    msg,
    });

    await logAudit({
      userId:     req.user.userId,
      action:     'NEGOTIATION_MESSAGE_SENT',
      entityType: 'Quotation',
      entityId:   q.id,
      details:    { senderType: 'REP' },
    });

    res.status(201).json(success(msg));
  } catch (e) { next(e); }
};
