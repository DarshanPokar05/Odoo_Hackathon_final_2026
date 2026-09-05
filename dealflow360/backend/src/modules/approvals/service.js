'use strict';
const prisma = require('../../config/prisma');
exports.list   = async () => prisma.approvalStep.findMany({ include: { quotation: true } });
exports.getOne = async (id) => prisma.approvalStep.findUniqueOrThrow({ where: { id } });
exports.create = async (body) => prisma.approvalStep.create({ data: body });
exports.update = async (id, body) => prisma.approvalStep.update({ where: { id }, data: body });
exports.remove = async (id) => prisma.approvalStep.delete({ where: { id } });
