'use strict';

const { z }        = require('zod');
const prisma       = require('../../config/prisma');
const { logAudit } = require('../../utils/logAudit');

// ── Schemas ───────────────────────────────────────────────────────────────────

const tierCeilingUpdateSchema = z.object({
  maxDiscountPercent: z.number().min(0).max(100),
});

const approvalRuleSchema = z.object({
  minScore:      z.coerce.number().min(0),
  maxScore:      z.union([z.coerce.number().positive(), z.null()]).optional().default(null),
  requiredLevel: z.enum(['NONE', 'SALES_MANAGER', 'SALES_MANAGER_THEN_FINANCE']),
});

const bulkApprovalRulesSchema = z.array(approvalRuleSchema).min(1);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Validate a set of approval chain rules for overlaps and gaps.
 * Rules must:
 *   1. Cover from 0 continuously (no gap between rules).
 *   2. Not overlap (maxScore of rule N must equal minScore of rule N+1).
 *   3. Exactly one rule must have maxScore = null (the unbounded upper rule).
 *
 * @param {Array} rules  — sorted by minScore ascending
 * @throws {Error} with statusCode 422 if invalid
 */
function validateApprovalRanges(rules) {
  if (!rules || rules.length === 0) {
    const e = new Error('At least one approval chain rule is required');
    e.statusCode = 422; throw e;
  }

  // Sort by minScore
  const sorted = [...rules].sort((a, b) => Number(a.minScore) - Number(b.minScore));

  // Must start at 0
  if (Number(sorted[0].minScore) !== 0) {
    const e = new Error('Approval chain rules must start at minScore = 0');
    e.statusCode = 422; throw e;
  }

  // Count unbounded rules (maxScore null)
  const unboundedCount = sorted.filter((r) => r.maxScore === null || r.maxScore === undefined).length;
  if (unboundedCount !== 1) {
    const e = new Error('Exactly one approval chain rule must have maxScore = null (the unbounded upper rule)');
    e.statusCode = 422; throw e;
  }

  // The unbounded rule must be last
  const lastRule = sorted[sorted.length - 1];
  if (lastRule.maxScore !== null && lastRule.maxScore !== undefined) {
    const e = new Error('The unbounded rule (maxScore = null) must be the last range');
    e.statusCode = 422; throw e;
  }

  // Check for gaps and overlaps between adjacent rules
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next    = sorted[i + 1];
    const currentMax = Number(current.maxScore);
    const nextMin    = Number(next.minScore);

    if (currentMax !== nextMin) {
      const e = new Error(
        `Gap or overlap detected between rules: rule ending at ${currentMax} and next rule starting at ${nextMin}. ` +
        `maxScore of each rule must equal minScore of the next.`
      );
      e.statusCode = 422; throw e;
    }
  }
}

// ── TierDiscountCeiling ───────────────────────────────────────────────────────

async function listCeilings() {
  return prisma.tierDiscountCeiling.findMany({ orderBy: { tier: 'asc' } });
}

async function updateCeiling(tier, body, userId) {
  const { maxDiscountPercent } = tierCeilingUpdateSchema.parse(body);
  const ceiling = await prisma.tierDiscountCeiling.upsert({
    where:  { tier },
    update: { maxDiscountPercent },
    create: { tier, maxDiscountPercent },
  });
  await logAudit({
    userId, action: 'TIER_CEILING_UPDATED', entityType: 'TierDiscountCeiling',
    entityId: ceiling.id, details: { tier, maxDiscountPercent },
  });
  return ceiling;
}

/**
 * Get the ceiling % for a specific tier (used by quotation service).
 */
async function getCeilingForTier(tier) {
  const record = await prisma.tierDiscountCeiling.findUniqueOrThrow({ where: { tier } });
  return Number(record.maxDiscountPercent);
}

// ── ApprovalChainRule ─────────────────────────────────────────────────────────

async function listApprovalRules() {
  return prisma.approvalChainRule.findMany({ orderBy: { minScore: 'asc' } });
}

/**
 * Replace the entire approval chain rule set atomically.
 * Validates for gaps and overlaps before committing.
 */
async function saveApprovalRules(rules, userId) {
  const parsed = bulkApprovalRulesSchema.parse(rules);
  validateApprovalRanges(parsed);

  const saved = await prisma.$transaction(async (tx) => {
    await tx.approvalChainRule.deleteMany();
    return tx.approvalChainRule.createMany({ data: parsed });
  });

  await logAudit({
    userId, action: 'APPROVAL_CHAIN_RULES_SAVED', entityType: 'ApprovalChainRule',
    entityId: 'bulk', details: { ruleCount: parsed.length },
  });
  return listApprovalRules();
}

/**
 * Determine the required approval level for a given blended risk score.
 * Returns 'NONE' | 'SALES_MANAGER' | 'SALES_MANAGER_THEN_FINANCE'
 *
 * @param {number} score
 * @returns {Promise<string>}
 */
async function resolveApprovalLevel(score) {
  const rules = await prisma.approvalChainRule.findMany({ orderBy: { minScore: 'asc' } });

  for (const rule of rules) {
    const min = Number(rule.minScore);
    const max = rule.maxScore !== null && rule.maxScore !== undefined ? Number(rule.maxScore) : Infinity;
    if (score >= min && score < max) return rule.requiredLevel;
    // Handle the unbounded rule: score >= min and max is null
    if (rule.maxScore === null && score >= min) return rule.requiredLevel;
  }

  // Fallback — should not happen if rules are well-formed
  return 'SALES_MANAGER_THEN_FINANCE';
}

module.exports = {
  listCeilings,
  updateCeiling,
  getCeilingForTier,
  listApprovalRules,
  saveApprovalRules,
  resolveApprovalLevel,
};
