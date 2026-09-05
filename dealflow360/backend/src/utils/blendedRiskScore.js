'use strict';

/**
 * Blended Risk Score Calculator
 * ─────────────────────────────
 * Implements Global Constraint 1 exactly.
 *
 * RULE:
 *   effectiveCeiling(line) = MIN(customerTierCeiling, line.category.maxDiscountPercent)
 *   pointsOver(line)       = MAX(0, discountPercent - effectiveCeiling)
 *   blendedRiskScore       = SUM(pointsOver across all lines)
 *
 * The score is NOT capped at 100 — it grows with every breaching line.
 * The caller maps the raw score to an approval level via the ApprovalChainRule table.
 *
 * WORKED EXAMPLE (must reproduce exactly):
 *   Gold customer, tierCeiling = 15%
 *   Laptop line:        discount 12%, Hardware category ceiling 15% → effective 15% → 0 pts over
 *   Setup Service line: discount 18%, Service  category ceiling 10% → effective 10% → 8 pts over
 *   blendedRiskScore = 0 + 8 = 8
 *
 * This is a pure function — no DB calls — so it is independently testable.
 *
 * @param {object} params
 * @param {Array}  params.lines    — array of objects:
 *                                     { discountPercent, effectiveCeilingSnapshot }
 *                                   pointsOverSnapshot is computed here and returned per-line.
 * @param {number|string} params.tierCeilingPercent  — customer's tier ceiling (e.g. 15 for Gold)
 * @param {Array}  [params.categoryCeilings]  — array of { productId, maxDiscountPercent }
 *                                              only needed when effectiveCeilingSnapshot is not
 *                                              already pre-computed on each line.
 *
 * TWO CALL MODES:
 *   Mode A — lines already carry effectiveCeilingSnapshot (quotation already saved, lines from DB)
 *             Just pass lines with { discountPercent, effectiveCeilingSnapshot }
 *             tierCeilingPercent and categoryCeilings are ignored.
 *
 *   Mode B — computing fresh (e.g. on submit before saving)
 *             Pass tierCeilingPercent + categoryCeilings[{productId, maxDiscountPercent}]
 *             lines must carry { productId, discountPercent }
 *             Returns enriched lines with effectiveCeilingSnapshot and pointsOverSnapshot set.
 *
 * @returns {{ score: number, lines: Array }}
 *   score — the blended risk score (sum of all pointsOver values)
 *   lines — input lines enriched with effectiveCeilingSnapshot and pointsOverSnapshot
 */
function blendedRiskScore({ lines, tierCeilingPercent, categoryCeilings = [] }) {
  if (!lines || lines.length === 0) return { score: 0, lines: [] };

  // Build a productId → categoryMaxDiscount lookup for Mode B
  const categoryMap = {};
  for (const c of categoryCeilings) {
    categoryMap[c.productId] = Number(c.maxDiscountPercent);
  }

  let totalScore = 0;
  const enriched = [];

  for (const line of lines) {
    const discount = Number(line.discountPercent) || 0;

    let effectiveCeiling;

    if (line.effectiveCeilingSnapshot !== undefined && line.effectiveCeilingSnapshot !== null) {
      // Mode A — use pre-computed snapshot from DB
      effectiveCeiling = Number(line.effectiveCeilingSnapshot);
    } else {
      // Mode B — compute fresh
      const tierCeiling     = Number(tierCeilingPercent) || 0;
      const categoryCeiling = categoryMap[line.productId] ?? tierCeiling;
      effectiveCeiling      = Math.min(tierCeiling, categoryCeiling);
    }

    const pointsOver = Math.max(0, discount - effectiveCeiling);
    totalScore += pointsOver;

    enriched.push({
      ...line,
      effectiveCeilingSnapshot: effectiveCeiling,
      pointsOverSnapshot:       pointsOver,
    });
  }

  // Round to 2 decimal places to avoid floating-point drift
  return {
    score: Math.round(totalScore * 100) / 100,
    lines: enriched,
  };
}

module.exports = { blendedRiskScore };
