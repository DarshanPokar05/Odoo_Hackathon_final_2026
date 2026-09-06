'use strict';

const prisma = require('../../config/prisma');

// TODO: add Zod validation, business logic, and emitToRoom calls in the relevant phase.

const MODEL = 'Notification';
const field = MODEL.charAt(0).toLowerCase() + MODEL.slice(1);

exports.list = async (query, user) => {
  const where = { userId: user.userId };
  if (query?.unreadOnly === 'true') where.isRead = false;
  return prisma[field].findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
};

exports.getOne = async (id, user) => {
  return prisma[field].findUniqueOrThrow({ where: { id } });
};

exports.create = async (body, user) => {
  return prisma[field].create({ data: body });
};

exports.update = async (id, body, user) => {
  return prisma[field].update({ where: { id }, data: body });
};

exports.remove = async (id, user) => {
  return prisma[field].delete({ where: { id } });
};
