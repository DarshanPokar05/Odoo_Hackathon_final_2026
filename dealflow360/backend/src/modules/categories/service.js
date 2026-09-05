'use strict';
const prisma = require('../../config/prisma');
exports.list   = async () => prisma.productCategory.findMany({ include: { products: true } });
exports.getOne = async (id) => prisma.productCategory.findUniqueOrThrow({ where: { id } });
exports.create = async (body) => prisma.productCategory.create({ data: body });
exports.update = async (id, body) => prisma.productCategory.update({ where: { id }, data: body });
exports.remove = async (id) => prisma.productCategory.delete({ where: { id } });
