'use strict';

/**
 * Deal Health Service
 * ===================
 * Provides list/resolve/escalate for DealHealthFlags.
 * The flag *creation* happens in the stalledDealDetection job.
 * This service handles reading + acting on existing flags.
 */

const { z }       = require('zod');
const prisma      = require('../../config/prisma');
const { logAudit } = require('../../utils/logAudit');
const realtime    = require('../../realtime/index');

const FLAG_INCLUDE = {
  include: {
    quotation: {
      include: { customer: { select: { id: true, companyName: true } } },
    },
  },
};

async function list(query, user) {
  const where = {};
  if (query?.type)     where.type     = query.type;
  if (query?.resolved !== undefined)
    where.resolved = query.resolved === 'true';

  return prisma.dealHealthFlag.findMany({
    where,
    ...FLAG_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

async function getOne(id, user) {
  return prisma.dealHealthFlag.findUniqueOrThrow({ where: { id }, ...FLAG_INCLUDE });
}

async function resolve(id, user) {
  const flag = await prisma.dealHealthFlag.update({
    where: { id },
    data:  { resolved: true },
    ...FLAG_INCLUDE,
  });

  await logAudit({
    userId: user.userId, action: 'DEAL_HEALTH_FLAG_RESOLVED',
    entityType: 'DealHealthFlag', entityId: id,
  });

  return flag;
}

async function escalate(id, body, user) {
  const { note } = z.object({ note: z.string().min(1) }).parse(body);
  const flag = await prisma.dealHealthFlag.findUniqueOrThrow({ where: { id }, ...FLAG_INCLUDE });

  await logAudit({
    userId: user.userId, action: 'DEAL_HEALTH_FLAG_ESCALATED',
    entityType: 'DealHealthFlag', entityId: id,
    details: { note, flagType: flag.type, quotationId: flag.quotationId },
  });

  // Notify admin + managers
  realtime.emitDealHealthFlag({ ...flag, escalated: true, escalatedNote: note });

  return { id, escalated: true };
}

module.exports = { list, getOne, resolve, escalate };
