'use strict';

const { z }        = require('zod');
const prisma       = require('../../config/prisma');
const { logAudit } = require('../../utils/logAudit');

// ── Validation schemas ────────────────────────────────────────────────────────

const variantSchema = z.object({
  id:            z.string().uuid().optional(),  // present on update
  attributeName: z.string().min(1).max(100),
  value:         z.string().min(1).max(100),
  extraPrice:    z.number().min(0).default(0),
});

const createSchema = z.object({
  name:           z.string().min(1).max(200).trim(),
  categoryId:     z.string().uuid(),
  price:          z.number().positive(),
  unit:           z.string().min(1).max(50),
  taxPercent:     z.number().min(0).max(100).default(0),
  description:    z.string().max(2000).optional(),
  isSubscription: z.boolean().default(false),
  variants:       z.array(variantSchema).optional().default([]),
});

const updateSchema = createSchema.partial();

// ── Shared include shape ──────────────────────────────────────────────────────
const PRODUCT_INCLUDE = {
  category: { select: { id: true, name: true, maxDiscountPercent: true } },
  variants:  true,
};

// ── Service methods ───────────────────────────────────────────────────────────

async function list(query) {
  const where = {};
  if (query?.categoryId) where.categoryId = query.categoryId;
  if (query?.isSubscription !== undefined) where.isSubscription = query.isSubscription === 'true';

  return prisma.product.findMany({
    where,
    orderBy: { name: 'asc' },
    include: PRODUCT_INCLUDE,
  });
}

async function getOne(id) {
  return prisma.product.findUniqueOrThrow({ where: { id }, include: PRODUCT_INCLUDE });
}

async function create(body, userId) {
  const { variants, ...rest } = createSchema.parse(body);

  const product = await prisma.product.create({
    data: {
      ...rest,
      variants: {
        create: variants.map(({ id: _id, ...v }) => v),
      },
    },
    include: PRODUCT_INCLUDE,
  });

  await logAudit({ userId, action: 'PRODUCT_CREATED', entityType: 'Product', entityId: product.id, details: { name: product.name } });
  return product;
}

async function update(id, body, userId) {
  const { variants, ...rest } = updateSchema.parse(body);

  // Fetch existing to confirm it exists
  await prisma.product.findUniqueOrThrow({ where: { id } });

  // Run everything in a transaction so variant replace is atomic
  const product = await prisma.$transaction(async (tx) => {
    // If variants were supplied, replace them entirely
    if (variants !== undefined) {
      await tx.productVariant.deleteMany({ where: { productId: id } });
      await tx.productVariant.createMany({
        data: variants.map(({ id: _id, ...v }) => ({ ...v, productId: id })),
      });
    }

    return tx.product.update({
      where:   { id },
      data:    Object.keys(rest).length ? rest : {},
      include: PRODUCT_INCLUDE,
    });
  });

  await logAudit({ userId, action: 'PRODUCT_UPDATED', entityType: 'Product', entityId: id, details: rest });
  return product;
}

async function remove(id, userId) {
  // Cascade: delete variants first (no cascadeDelete in schema)
  await prisma.$transaction([
    prisma.productVariant.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);
  await logAudit({ userId, action: 'PRODUCT_DELETED', entityType: 'Product', entityId: id });
  return { id };
}

/**
 * Compute the effective ceiling for a product given its category and a customer tier ceiling.
 * Used by quotation service to snapshot ceilings at line-entry time.
 */
async function getEffectiveCeiling(productId, tierCeilingPercent) {
  const product = await prisma.product.findUniqueOrThrow({
    where:   { id: productId },
    include: { category: { select: { maxDiscountPercent: true } } },
  });
  const categoryCeiling = Number(product.category.maxDiscountPercent);
  const tierCeiling     = Number(tierCeilingPercent);
  return Math.min(categoryCeiling, tierCeiling);
}

module.exports = { list, getOne, create, update, remove, getEffectiveCeiling };
