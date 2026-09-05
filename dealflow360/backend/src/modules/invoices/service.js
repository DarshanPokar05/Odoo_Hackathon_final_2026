'use strict';
const prisma = require('../../config/prisma');
exports.list   = async () => prisma.invoice.findMany();
exports.getOne = async (id) => prisma.invoice.findUniqueOrThrow({ where: { id } });
exports.create = async (body) => prisma.invoice.create({ data: body });
exports.update = async (id, body) => prisma.invoice.update({ where: { id }, data: body });
exports.remove = async (id) => prisma.invoice.delete({ where: { id } });
