'use strict';

/**
 * Blended Risk Score Calculator
 * ─────────────────────────────
 * Produces a 0–100 score that drives the approval chain.
 * Higher score = more risky → requires higher approval level.
 *
 * Inputs (all from a fully-populated quotation):
 *   lines[]  — array of QuotationLine objects (with effectiveCeilingSnapshot, discountPercent, pointsOverSnapshot, lineType)
 *   customer — Customer object with { tier }
 *   totalValue — pre-tax total of the quotation (Decimal or number)
 *
 * Scoring components (weights sum to 100):
 *   1. Max discount breach (40 pts)   — worst single line's pointsOverSnapshot / ceiling * 40
 *   2. Tier risk (20 pts)             — BRONZE=20, SILVER=10, GOLD=0
 *   3. Revenue concentration (20 pts) — single line > 60% of total value
 *   4. Recurring ratio (20 pts)       — % of total value that is RECURRING (higher = lower risk, inverted)
 *
 * This module is pure (no DB calls) so it is independently testable.
 *
 * @param {{ lines: object[], customer: object, totalValue: number }} params
 * @returns {number} score 0–100, rounded to 2 decimal places
 */
function blendedRiskScore({ lines, customer, totalValue }) {
  if (!lines || lines.length === 0) return 0;

  const total = Number(totalValue) || 0;

  // ── 1. Max discount breach (40 pts) ────────────────────────────────────────
  let maxBreachScore = 0;
  for (const line of lines) {
    const ceiling = Number(line.effectiveCeilingSnapshot);
    const points  = Number(line.pointsOverSnapshot);
    if (ceiling > 0 && points > 0) {
      const ratio = Math.min(points / ceiling, 1); // cap at 1 (100% over ceiling)
      maxBreachScore = Math.max(maxBreachScore, ratio * 40);
    }
  }

  // ── 2. Tier risk (20 pts) ──────────────────────────────────────────────────
  const tierScores = { BRONZE: 20, SILVER: 10, GOLD: 0 };
  const tierScore = tierScores[customer?.tier] ?? 20;

  // ── 3. Revenue concentration (20 pts) ─────────────────────────────────────
  let concentrationScore = 0;
  if (total > 0) {
    for (const line of lines) {
      const lineTotal = Number(line.unitPrice) * Number(line.quantity) * (1 - Number(line.discountPercent) / 100);
      if (lineTotal / total > 0.6) {
        concentrationScore = 20;
        break;
      }
    }
  }

  // ── 4. Recurring ratio (20 pts, inverted — recurring = safer) ─────────────
  let recurringValue = 0;
  for (const line of lines) {
    if (line.lineType === 'RECURRING') {
      recurringValue += Number(line.unitPrice) * Number(line.quantity) * (1 - Number(line.discountPercent) / 100);
    }
  }
  const recurringRatio = total > 0 ? recurringValue / total : 0;
  const recurringScore = (1 - recurringRatio) * 20; // 0% recurring → 20 pts risk

  const raw = maxBreachScore + tierScore + concentrationScore + recurringScore;
  return Math.round(Math.min(raw, 100) * 100) / 100;
}

module.exports = { blendedRiskScore };
