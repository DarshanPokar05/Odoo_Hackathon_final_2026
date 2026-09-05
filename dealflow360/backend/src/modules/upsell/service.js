'use strict';
const prisma = require('../../config/prisma');
exports.list   = async () => prisma.upsellRule.findMany();
exports.getOne = async (id) => prisma.upsellRule.findUniqueOrThrow({ where: { id } });
exports.create = async (body) => prisma.upsellRule.create({ data: body });
exports.update = async (id, body) => prisma.upsellRule.update({ where: { id }, data: body });
exports.remove = async (id) => prisma.upsellRule.delete({ where: { id } });
