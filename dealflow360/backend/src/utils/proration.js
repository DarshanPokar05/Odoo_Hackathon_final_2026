'use strict';

/**
 * Proration Calculator
 * =====================
 * Pure, side-effect-free functions for mid-cycle billing changes.
 *
 * BUSINESS RULE (Global Constraint 4):
 *   Mid-cycle quantity/plan change proration =
 *     (newValue - oldValue) × (daysRemainingInCycle / totalDaysInCycle)
 *
 *   Where:
 *     newValue  = the new monthly billing amount (unitPrice × newQty)
 *     oldValue  = the old monthly billing amount (unitPrice × oldQty)
 *     daysRemainingInCycle = cycleEnd - changeDate  (inclusive of change day)
 *     totalDaysInCycle     = cycleEnd - cycleStart
 *
 * WORKED EXAMPLES:
 *   Cycle: Jan 1 → Jan 31 (31 days). Change on Jan 16 (16 days remaining incl.).
 *   Old: 5 seats × $299 = $1495/mo. New: 8 seats × $299 = $2392/mo.
 *   Delta = (2392 - 1495) × (16/31) = $897 × 0.516 = ~$463.10  (increase)
 *
 *   For a decrease (downgrade):
 *   Old: 8 seats × $299 = $2392. New: 3 seats × $299 = $897.
 *   Delta = (897 - 2392) × (16/31) = -$1495 × 0.516 = ~-$771.61  (credit)
 */

/**
 * Compute the proration amount for a mid-cycle change.
 *
 * @param {object} params
 * @param {number} params.oldMonthlyAmount  — current period charge (qty × unitPrice)
 * @param {number} params.newMonthlyAmount  — new period charge after change
 * @param {Date}   params.changeDate        — the date the change takes effect
 * @param {Date}   params.cycleStart        — start of the current billing cycle
 * @param {Date}   params.cycleEnd          — end of the current billing cycle (exclusive)
 *
 * @returns {{
 *   prorationAmount:    number,   — positive = charge extra, negative = credit back
 *   daysRemaining:      number,
 *   totalDays:          number,
 *   prorationFraction:  number,
 * }}
 */
function computeProration({ oldMonthlyAmount, newMonthlyAmount, changeDate, cycleStart, cycleEnd }) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const totalDays     = Math.round((cycleEnd - cycleStart) / MS_PER_DAY);
  const daysRemaining = Math.max(0, Math.round((cycleEnd - changeDate) / MS_PER_DAY));

  if (totalDays <= 0) {
    return { prorationAmount: 0, daysRemaining: 0, totalDays: 0, prorationFraction: 0 };
  }

  const prorationFraction = daysRemaining / totalDays;
  const delta             = Number(newMonthlyAmount) - Number(oldMonthlyAmount);
  const prorationAmount   = Math.round(delta * prorationFraction * 100) / 100;

  return { prorationAmount, daysRemaining, totalDays, prorationFraction };
}

/**
 * Advance a date by one billing interval.
 * Exported here so the billing job and subscription service share the same logic.
 *
 * @param {Date}   date
 * @param {string} interval — "MONTHLY" | "QUARTERLY" | "YEARLY"
 * @returns {Date}
 */
function advanceByInterval(date, interval) {
  const d = new Date(date);
  switch (interval) {
    case 'QUARTERLY': d.setMonth(d.getMonth() + 3);    break;
    case 'YEARLY':    d.setFullYear(d.getFullYear() + 1); break;
    case 'MONTHLY':
    default:          d.setMonth(d.getMonth() + 1);
  }
  return d;
}

module.exports = { computeProration, advanceByInterval };
