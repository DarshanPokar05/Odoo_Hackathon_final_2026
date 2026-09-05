'use strict';

/**
 * Proration Calculator
 * ────────────────────
 * Handles daily proration and cancellation credit/refund amounts for subscriptions.
 *
 * All Decimal inputs are accepted as numbers or strings (compatible with Prisma Decimal).
 */

/**
 * Calculate the prorated amount for a partial billing cycle.
 *
 * @param {object} params
 * @param {number|string} params.monthlyAmount  — full cycle amount
 * @param {Date}          params.cycleStart     — start of the billing cycle
 * @param {Date}          params.cycleEnd       — end of the billing cycle
 * @param {Date}          params.activationDate — date the subscription became active (or was changed)
 * @returns {number} prorated amount, rounded to 2 decimal places
 */
function dailyProrate({ monthlyAmount, cycleStart, cycleEnd, activationDate }) {
  const totalDays = daysBetween(cycleStart, cycleEnd);
  const activeDays = daysBetween(activationDate, cycleEnd);
  if (totalDays <= 0) return 0;
  const ratio = Math.min(Math.max(activeDays, 0), totalDays) / totalDays;
  return round2(Number(monthlyAmount) * ratio);
}

/**
 * Calculate the refund amount for unused days on cancellation.
 *
 * @param {object} params
 * @param {number|string} params.monthlyAmount  — full cycle amount already paid
 * @param {Date}          params.cycleStart
 * @param {Date}          params.cycleEnd
 * @param {Date}          params.cancelDate     — date of cancellation
 * @param {string}        params.rule           — "REFUND_UNUSED_DAYS" | "NO_REFUND" | "CREDIT_NOTE"
 * @returns {{ refundAmount: number, creditNoteAmount: number }}
 */
function cancellationAmount({ monthlyAmount, cycleStart, cycleEnd, cancelDate, rule }) {
  if (rule === 'NO_REFUND') return { refundAmount: 0, creditNoteAmount: 0 };

  const totalDays   = daysBetween(cycleStart, cycleEnd);
  const unusedDays  = daysBetween(cancelDate, cycleEnd);
  if (totalDays <= 0 || unusedDays <= 0) return { refundAmount: 0, creditNoteAmount: 0 };

  const ratio  = Math.min(unusedDays, totalDays) / totalDays;
  const amount = round2(Number(monthlyAmount) * ratio);

  if (rule === 'CREDIT_NOTE') return { refundAmount: 0, creditNoteAmount: amount };
  return { refundAmount: amount, creditNoteAmount: 0 }; // REFUND_UNUSED_DAYS
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a, b) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(b) - new Date(a)) / msPerDay);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { dailyProrate, cancellationAmount };
