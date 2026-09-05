'use strict';
const prisma = require('../../config/prisma');
// Full implementation (blendedRiskScore, discount ceiling check, approval chain) in Phase 3

exports.list = async (query, user) => {
  const where = user.role === 'CUSTOMER' ? { customerId: user.customerId } : {};
  return prisma.quotation.findMany({ where, include: { customer: true, lines: true, approvalSteps: true } });
};

exports.getOne = async (id, user) => {
  return prisma.quotation.findUniqueOrThrow({
    where: { id },
    include: { customer: true, lines: true, approvalSteps: true, negotiationMessages: true },
  });
};

exports.create = async (body, user) => {
  return prisma.quotation.create({ data: { ...body, repId: user.userId } });
};

exports.update = async (id, body, user) => {
  return prisma.quotation.update({ where: { id }, data: body });
};

exports.remove = async (id, user) => {
  return prisma.quotation.delete({ where: { id } });
};
