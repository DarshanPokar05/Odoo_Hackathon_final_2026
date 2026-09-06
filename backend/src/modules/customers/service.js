'use strict';

const { z }       = require('zod');
const prisma      = require('../../config/prisma');
const { logAudit } = require('../../utils/logAudit');

const createSchema = z.object({
  companyName: z.string().min(1).max(200).trim(),
  tier:        z.enum(['BRONZE', 'SILVER', 'GOLD']).default('BRONZE'),
  realEmail:   z.string().email(),
});

const updateSchema = createSchema.partial();

exports.list = async (query, user) => {
  const where = {};
  if (query?.tier) where.tier = query.tier;
  return prisma.customer.findMany({
    where,
    orderBy:  { companyName: 'asc' },
    include: { portalUser: { select: { id: true, email: true, mustChangePassword: true } } },
  });
};

exports.getOne = async (id, user) => {
  return prisma.customer.findUniqueOrThrow({
    where:   { id },
    include: { portalUser: { select: { id: true, email: true, mustChangePassword: true } } },
  });
};

exports.create = async (body, user) => {
  const data = createSchema.parse(body);
  const customer = await prisma.customer.create({ data });
  await logAudit({
    userId: user.userId, action: 'CUSTOMER_CREATED', entityType: 'Customer',
    entityId: customer.id, details: { companyName: customer.companyName },
  });
  return customer;
};

exports.update = async (id, body, user) => {
  const data = updateSchema.parse(body);
  const customer = await prisma.customer.update({ where: { id }, data });
  await logAudit({
    userId: user.userId, action: 'CUSTOMER_UPDATED', entityType: 'Customer',
    entityId: id, details: data,
  });
  return customer;
};

exports.remove = async (id, user) => {
  const customer = await prisma.customer.delete({ where: { id } });
  await logAudit({
    userId: user.userId, action: 'CUSTOMER_DELETED', entityType: 'Customer', entityId: id,
  });
  return customer;
};
