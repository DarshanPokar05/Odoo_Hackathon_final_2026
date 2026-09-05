'use strict';
const prisma = require('../../config/prisma');
exports.list   = async () => prisma.warehouse.findMany({ include: { stockLevels: true } });
exports.getOne = async (id) => prisma.warehouse.findUniqueOrThrow({ where: { id }, include: { stockLevels: true } });
exports.create = async (body) => prisma.warehouse.create({ data: body });
exports.update = async (id, body) => prisma.warehouse.update({ where: { id }, data: body });
exports.remove = async (id) => prisma.warehouse.delete({ where: { id } });
