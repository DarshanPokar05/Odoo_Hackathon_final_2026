'use strict';
const prisma = require('../../config/prisma');
exports.list   = async () => prisma.fulfillmentSplit.findMany();
exports.getOne = async (id) => prisma.fulfillmentSplit.findUniqueOrThrow({ where: { id } });
exports.create = async (body) => prisma.fulfillmentSplit.create({ data: body });
exports.update = async (id, body) => prisma.fulfillmentSplit.update({ where: { id }, data: body });
exports.remove = async (id) => prisma.fulfillmentSplit.delete({ where: { id } });
