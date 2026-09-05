'use strict';

const prisma = require('../../config/prisma');
// Full implementation in Phase 2

exports.list   = async (query, user) => prisma.product.findMany({ include: { category: true, variants: true } });
exports.getOne = async (id, user)    => prisma.product.findUniqueOrThrow({ where: { id }, include: { category: true, variants: true } });
exports.create = async (body, user)  => prisma.product.create({ data: body });
exports.update = async (id, body, user) => prisma.product.update({ where: { id }, data: body });
exports.remove = async (id, user)    => prisma.product.delete({ where: { id } });
