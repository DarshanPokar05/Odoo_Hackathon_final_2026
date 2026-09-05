'use strict';
const prisma = require('../../config/prisma');
exports.list   = async () => prisma.subscription.findMany();
exports.getOne = async (id) => prisma.subscription.findUniqueOrThrow({ where: { id } });
exports.create = async (body) => prisma.subscription.create({ data: body });
exports.update = async (id, body) => prisma.subscription.update({ where: { id }, data: body });
exports.remove = async (id) => prisma.subscription.delete({ where: { id } });
