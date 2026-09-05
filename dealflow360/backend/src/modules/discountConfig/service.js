'use strict';
const prisma = require('../../config/prisma');
exports.list   = async () => prisma.tierDiscountCeiling.findMany();
exports.getOne = async (id) => prisma.tierDiscountCeiling.findUniqueOrThrow({ where: { id } });
exports.create = async (body) => prisma.tierDiscountCeiling.create({ data: body });
exports.update = async (id, body) => prisma.tierDiscountCeiling.update({ where: { id }, data: body });
exports.remove = async (id) => prisma.tierDiscountCeiling.delete({ where: { id } });
