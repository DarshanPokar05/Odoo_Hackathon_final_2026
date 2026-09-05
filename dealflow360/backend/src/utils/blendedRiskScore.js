'use strict';

/**
 * blendedRiskScore.js
 * ====================
 * Pure, side-effect-free calculator for the Blended Discount Risk Score.
 *
 * BUSINESS RULE (Global Constraint 1):
 *   a. Each product category has its own maxDiscountPercent ceiling.
 *      Each customer tier has its own TierDiscountCeiling.
 *   b. EFFECTIVE CEILING for a line =
 *        MIN(customerTierCeiling, line.categoryCeiling)
 *      A Gold customer's 15% tier ceiling does NOT override a stricter
 *      10% category ceiling — the STRICTER of the two always wins.
 *   c. POINTS OVER for a line =
 *        MAX(0, discountGiven - effectiveCeiling)
 *      A line within its effective ceiling contributes 0 points.
 *   d. BLENDED RISK SCORE for the quotation =
 *        SUM(pointsOver across all lines)
 *
 * REFERENCE EXAMPLE (must return exactly 8):
 *   Customer tier: GOLD — tierCeiling = 15%
 *   Line 1: Hardware product, categoryCeiling = 15%, discountGiven = 12%
 *     → effectiveCeiling = MIN(15, 15) = 15
 *     → pointsOver       = MAX(0, 12 - 15) = 0
 *   Line 2: Service product, categoryCeiling = 10%, discountGiven = 18%
 *     → effectiveCeiling = MIN(15, 10) = 10   ← category is STRICTER
 *     → pointsOver       = MAX(0, 18 - 10) = 8
 *   blendedScore = 0 + 8 = 8  ✓
 */

/**
 * Compute the effective ceiling for a single line.
 *
 * @param {number} tierCeilingPercent     — the customer's tier max discount %
 * @param {number} categoryCeilingPercent — the product category's max discount %
 * @returns {number} effectiveCeiling
 */
function effectiveCeiling(tierCeilingPercent, categoryCeilingPercent) {
  // Rule 1b: take the stricter (lower) of the two ceilings
  return Math.min(Number(tierCeilingPercent), Number(categoryCeilingPercent));
}

/**
 * Compute points-over for a single line.
 *
 * @param {number} discountGiven  — the actual discount % entered on the line
 * @param {number} ceiling        — effectiveCeiling for this line
 * @returns {number} pointsOver   — always >= 0
 */
function pointsOver(discountGiven, ceiling) {
  // Rule 1c: only positive exceedance counts
  return Math.max(0, Number(discountGiven) - Number(ceiling));
}

/**
 * Compute the full blended risk score for a quotation.
 *
 * @param {Array<{
 *   discountPercent:    number,
 *   categoryCeiling:    number,   // ProductCategory.maxDiscountPercent
 * }>} lines
 *   Each line carries the discount the rep entered and the category ceiling.
 *   The tier ceiling is passed separately (it is the same for all lines on
 *   a given quotation because it comes from the customer's tier).
 *
 * @param {number} tierCeilingPercent
 *   The customer's tier discount ceiling (TierDiscountCeiling.maxDiscountPercent).
 *
 * @returns {{
 *   blendedScore: number,
 *   lineDetails: Array<{
 *     index:            number,
 *     discountGiven:    number,
 *     categoryCeiling:  number,
 *     tierCeiling:      number,
 *     effectiveCeiling: number,
 *     pointsOver:       number,
 *   }>
 * }}
 *   Returns both the aggregate score AND per-line breakdown for the
 *   "Why This Quote Was Flagged" table on the Approval Detail screen.
 */
function computeBlendedRiskScore(lines, tierCeilingPercent) {
  let blendedScore = 0;
  const lineDetails = [];

  for (let i = 0; i < lines.length; i++) {
    const line     = lines[i];
    const ec       = effectiveCeiling(tierCeilingPercent, line.categoryCeiling);
    const pts      = pointsOver(line.discountPercent, ec);
    blendedScore  += pts;

    lineDetails.push({
      index:            i,
      discountGiven:    Number(line.discountPercent),
      categoryCeiling:  Number(line.categoryCeiling),
      tierCeiling:      Number(tierCeilingPercent),
      effectiveCeiling: ec,
      pointsOver:       pts,
    });
  }

  return { blendedScore, lineDetails };
}

// ── Validation helper used in tests and service layer ─────────────────────────

/**
 * Self-test: verify the reference example from Global Constraint 1f returns 8.
 * Call this at module load in dev to catch accidental regressions.
 * Throws if the result is wrong.
 */
function assertReferenceExample() {
  // Gold customer: tierCeiling = 15%
  // Hardware line: categoryCeiling = 15%, discount = 12% → 0 pts over
  // Service line:  categoryCeiling = 10%, discount = 18% → 8 pts over
  // Expected blendedScore = 8
  const lines = [
    { discountPercent: 12, categoryCeiling: 15 },   // Hardware
    { discountPercent: 18, categoryCeiling: 10 },   // Professional Services
  ];
  const { blendedScore } = computeBlendedRiskScore(lines, 15); // Gold tier = 15%

  if (blendedScore !== 8) {
    throw new Error(
      `[blendedRiskScore] Reference example FAILED: expected 8, got ${blendedScore}`
    );
  }
  return true;
}

// Run self-test at module load (only in non-production to not slow hot paths)
if (process.env.NODE_ENV !== 'production') {
  assertReferenceExample();
}

module.exports = {
  effectiveCeiling,
  pointsOver,
  computeBlendedRiskScore,
  assertReferenceExample,
};
