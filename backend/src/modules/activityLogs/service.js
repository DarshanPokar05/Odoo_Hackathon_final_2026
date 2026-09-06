'use strict';

const prisma = require('../../config/prisma');

exports.list = async (query, user) => {
  const limit = Math.min(parseInt(query?.limit ?? '50', 10), 200);
  return prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take:    limit,
  });
};

exports.getOne = async (id, user) => {
  return prisma.activityLog.findUniqueOrThrow({ where: { id } });
};
