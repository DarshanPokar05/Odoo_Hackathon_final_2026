'use strict';

const { z }   = require('zod');
const prisma  = require('../../config/prisma');
const { logAudit } = require('../../utils/logAudit');

// ── Validation schemas ────────────────────────────────────────────────────────

const createSchema = z.object({
  name:                 z.string().min(1).max(100).trim(),
  maxDiscountPercent:   z.number().min(0).max(100),
});

const updateSchema = createSchema.partial();

// ── Service methods ───────────────────────────────────────────────────────────

async function list() {
  return prisma.productCategory.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
}

async function getOne(id) {
  return prisma.productCategory.findUniqueOrThrow({
    where: { id },
    include: { products: { select: { id: true, name: true, price: true } } },
  });
}

async function create(body, userId) {
  const data = createSchema.parse(body);
  const category = await prisma.productCategory.create({ data });
  await logAudit({ userId, action: 'CATEGORY_CREATED', entityType: 'ProductCategory', entityId: category.id, details: data });
  return category;
}

async function update(id, body, userId) {
  const data = updateSchema.parse(body);
  const category = await prisma.productCategory.update({ where: { id }, data });
  await logAudit({ userId, action: 'CATEGORY_UPDATED', entityType: 'ProductCategory', entityId: id, details: data });
  return category;
}

async function remove(id, userId) {
  const category = await prisma.productCategory.delete({ where: { id } });
  await logAudit({ userId, action: 'CATEGORY_DELETED', entityType: 'ProductCategory', entityId: id });
  return category;
}

module.exports = { list, getOne, create, update, remove };
