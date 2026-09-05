'use strict';
const prisma = require('../../config/prisma');
exports.list   = async () => prisma.priceListRule.findMany();
exports.getOne = async (id) => prisma.priceListRule.findUniqueOrThrow({ where: { id } });
exports.create = async (body) => prisma.priceListRule.create({ data: body });
exports.update = async (id, body) => prisma.priceListRule.update({ where: { id }, data: body });
exports.remove = async (id) => prisma.priceListRule.delete({ where: { id } });
