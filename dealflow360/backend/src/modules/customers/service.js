'use strict';

const prisma = require('../../config/prisma');
// Full implementation in Phase 2

exports.list   = async (query, user) => prisma.customer.findMany();
exports.getOne = async (id, user)    => prisma.customer.findUniqueOrThrow({ where: { id } });
exports.create = async (body, user)  => prisma.customer.create({ data: body });
exports.update = async (id, body, user) => prisma.customer.update({ where: { id }, data: body });
exports.remove = async (id, user)    => prisma.customer.delete({ where: { id } });
