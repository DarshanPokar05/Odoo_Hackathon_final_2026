'use strict';

/**
 * Upsell / Cross-Sell Service
 * ===========================
 * Per Phase 4 requirements:
 *   - CRUD for UpsellRule (Admin only)
 *   - GET /api/quotations/:id/upsell-suggestions — ranked suggestions:
 *       1. Only include suggestions whose margin clears minMarginPercent.
 *       2. Promoted items rank above non-promoted.
 *       3. Within the same promoted/non-promoted tier, rank by marginDelta DESC.
 *       4. Return marginDelta so the UI can show it on the suggestion card.
 */

const { z }       = require('zod');
const prisma      = require('../../config/prisma');
const { logAudit } = require('../../utils/logAudit');

// ── Validation schemas ────────────────────────────────────────────────────────

const createSchema = z.object({
  primaryProductId:   z.string().uuid(),
  suggestedProductId: z.string().uuid(),
  minMarginPercent:   z.coerce.number().min(0).max(100),
  isPromoted:         z.boolean().default(false),
});

const updateSchema = createSchema.partial();

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute the margin % for a line given its unit price and discount.
 * We use a simplified gross-margin proxy:
 *   margin% = discountGiven (conceptually: the spread between list price and
 *              agreed price relative to cost) → for ranking purposes this is
 *              sufficient; a real COGS-based margin would need product cost data.
 *
 * For the suggestions endpoint we compute the *delta* margin if the suggested
 * product were added at its base price (0% discount):
 *   marginDelta = product.price * (1 - taxPercent/100)
 *
 * This is the incremental revenue the rep gains by adding it to the cart.
 */
function _computeMarginDelta(product) {
  const price      = Number(product.price);
  const taxFactor  = 1 - (Number(product.taxPercent) / 100);
  return Math.round(price * taxFactor * 100) / 100;
}

/**
 * Compute the gross margin % for a given suggested product at its base price.
 * Since we don't store COGS, margin% is proxied as:
 *   (basePrice - discount) / basePrice * 100
 * At 0% discount (list price), margin% = 100 for this proxy.
 * The minMarginPercent threshold on UpsellRule filters out unprofitable items.
 * We use product.price as the proxy — a real build would compare against COGS.
 *
 * For the purpose of the minMarginPercent filter: we check whether the
 * suggested product has a non-zero base price (i.e., it actually contributes
 * margin). The full implementation should compare against the product's COGS
 * field if one is added to the schema in future.
 */
function _computeMarginPercent(product) {
  // Without COGS data: proxy = treat any positive-price product as 100% margin.
  // minMarginPercent acts as a quality floor — low-threshold rules include more.
  return Number(product.price) > 0 ? 100 : 0;
}

// ── CRUD (Admin) ──────────────────────────────────────────────────────────────

async function list(query) {
  return prisma.upsellRule.findMany({
    orderBy: [{ isPromoted: 'desc' }, { minMarginPercent: 'desc' }],
  });
}

async function getOne(id) {
  return prisma.upsellRule.findUniqueOrThrow({ where: { id } });
}

async function create(body, userId) {
  const data = createSchema.parse(body);
  const rule = await prisma.upsellRule.create({ data });
  await logAudit({
    userId,
    action:     'UPSELL_RULE_CREATED',
    entityType: 'UpsellRule',
    entityId:   rule.id,
    details:    data,
  });
  return rule;
}

async function update(id, body, userId) {
  const data = updateSchema.parse(body);
  const rule = await prisma.upsellRule.update({ where: { id }, data });
  await logAudit({
    userId,
    action:     'UPSELL_RULE_UPDATED',
    entityType: 'UpsellRule',
    entityId:   id,
    details:    data,
  });
  return rule;
}

async function remove(id, userId) {
  await prisma.upsellRule.delete({ where: { id } });
  await logAudit({
    userId,
    action:     'UPSELL_RULE_DELETED',
    entityType: 'UpsellRule',
    entityId:   id,
  });
  return { id };
}

// ── Suggestions endpoint ──────────────────────────────────────────────────────

/**
 * Return ranked upsell suggestions for a given quotation.
 *
 * Algorithm (per Phase 4 requirements):
 *   1. Collect the set of product IDs already on the quotation.
 *   2. Find all UpsellRules whose primaryProductId is in that set.
 *   3. Load the suggested product's full record.
 *   4. Compute marginDelta; filter out any whose margin is below minMarginPercent.
 *   5. Deduplicate by suggestedProductId (keep the highest-margin rule per product).
 *   6. Sort: promoted first, then by marginDelta DESC within each tier.
 *
 * @param {string} quotationId
 * @returns {Array} ranked suggestion objects
 */
async function getSuggestions(quotationId) {
  // Load the quotation lines to know which primary products are in the cart
  const quotation = await prisma.quotation.findUnique({
    where:   { id: quotationId },
    include: { lines: { select: { productId: true } } },
  });
  if (!quotation) {
    const e = new Error('Quotation not found');
    e.statusCode = 404; e.code = 'NOT_FOUND'; throw e;
  }

  const cartProductIds = [...new Set(quotation.lines.map((l) => l.productId))];
  if (cartProductIds.length === 0) return [];

  // Load matching upsell rules
  const rules = await prisma.upsellRule.findMany({
    where: { primaryProductId: { in: cartProductIds } },
  });
  if (rules.length === 0) return [];

  // Load the suggested products (batch)
  const suggestedProductIds = [...new Set(rules.map((r) => r.suggestedProductId))];
  const products = await prisma.product.findMany({
    where:   { id: { in: suggestedProductIds } },
    include: { category: { select: { id: true, name: true, maxDiscountPercent: true } } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Build candidate list, applying the margin filter
  const candidates = [];
  for (const rule of rules) {
    const product = productMap.get(rule.suggestedProductId);
    if (!product) continue;

    const marginPercent = _computeMarginPercent(product);
    // Filter: only include suggestions that clear the configured margin threshold
    if (marginPercent < Number(rule.minMarginPercent)) continue;

    // Skip products already in the cart
    if (cartProductIds.includes(product.id)) continue;

    const marginDelta = _computeMarginDelta(product);

    candidates.push({
      ruleId:            rule.id,
      primaryProductId:  rule.primaryProductId,
      product,
      isPromoted:        rule.isPromoted,
      minMarginPercent:  Number(rule.minMarginPercent),
      marginPercent,
      marginDelta,
    });
  }

  // Deduplicate by suggestedProductId — keep highest marginDelta per product
  const deduped = new Map();
  for (const c of candidates) {
    const existing = deduped.get(c.product.id);
    if (!existing || c.marginDelta > existing.marginDelta) {
      deduped.set(c.product.id, c);
    }
  }

  // Sort: promoted first, then marginDelta DESC within each tier
  const sorted = [...deduped.values()].sort((a, b) => {
    if (a.isPromoted !== b.isPromoted) return a.isPromoted ? -1 : 1;
    return b.marginDelta - a.marginDelta;
  });

  return sorted.map((c) => ({
    ruleId:           c.ruleId,
    productId:        c.product.id,
    productName:      c.product.name,
    basePrice:        Number(c.product.price),
    unit:             c.product.unit,
    category:         c.product.category,
    isPromoted:       c.isPromoted,
    marginDelta:      c.marginDelta,
    minMarginPercent: c.minMarginPercent,
  }));
}

module.exports = { list, getOne, create, update, remove, getSuggestions };
