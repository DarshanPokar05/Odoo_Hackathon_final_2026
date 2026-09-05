'use strict';

const { z }        = require('zod');
const prisma       = require('../../config/prisma');
const { logAudit } = require('../../utils/logAudit');

// ── Validation schemas ────────────────────────────────────────────────────────

const createSchema = z.object({
  tier:      z.enum(['BRONZE', 'SILVER', 'GOLD']),
  currency:  z.string().length(3).toUpperCase().default('USD'),
  ruleType:  z.enum(['FIXED', 'PERCENT_OFF_BASE']),
  value:     z.number().positive(),
  productId: z.string().uuid().optional().nullable(),
});

const updateSchema = createSchema.partial();

// ── Service methods ───────────────────────────────────────────────────────────

async function list(query) {
  const where = {};
  if (query?.tier)      where.tier      = query.tier;
  if (query?.productId) where.productId = query.productId;
  return prisma.priceListRule.findMany({ where, orderBy: [{ tier: 'asc' }, { ruleType: 'asc' }] });
}

async function getOne(id) {
  return prisma.priceListRule.findUniqueOrThrow({ where: { id } });
}

async function create(body, userId) {
  const data = createSchema.parse(body);
  const rule = await prisma.priceListRule.create({ data });
  await logAudit({ userId, action: 'PRICE_LIST_RULE_CREATED', entityType: 'PriceListRule', entityId: rule.id, details: data });
  return rule;
}

async function update(id, body, userId) {
  const data = updateSchema.parse(body);
  const rule = await prisma.priceListRule.update({ where: { id }, data });
  await logAudit({ userId, action: 'PRICE_LIST_RULE_UPDATED', entityType: 'PriceListRule', entityId: id, details: data });
  return rule;
}

async function remove(id, userId) {
  const rule = await prisma.priceListRule.delete({ where: { id } });
  await logAudit({ userId, action: 'PRICE_LIST_RULE_DELETED', entityType: 'PriceListRule', entityId: id });
  return rule;
}

/**
 * Resolve the effective unit price for a product + tier + currency.
 * FIXED rule → returns that fixed price.
 * PERCENT_OFF_BASE rule → returns base price * (1 - value/100).
 * Falls back to base price if no rule found.
 */
async function resolvePrice(productId, tier, currency = 'USD') {
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });

  // Product-specific rule takes precedence over blanket tier rule
  const rule = await prisma.priceListRule.findFirst({
    where: {
      tier,
      currency,
      OR: [{ productId }, { productId: null }],
    },
    orderBy: { productId: 'desc' }, // non-null productId sorts first
  });

  if (!rule) return Number(product.price);

  if (rule.ruleType === 'FIXED') return Number(rule.value);
  if (rule.ruleType === 'PERCENT_OFF_BASE') {
    return Math.round(Number(product.price) * (1 - Number(rule.value) / 100) * 100) / 100;
  }
  return Number(product.price);
}

module.exports = { list, getOne, create, update, remove, resolvePrice };
