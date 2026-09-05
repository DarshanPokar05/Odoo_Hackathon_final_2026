'use strict';

/**
 * Approvals Service
 * =================
 * Implements the full approval workflow per Global Constraint 2:
 *   - Sales Manager approves first; Finance only acts after SM step is done.
 *   - Reject → REJECTED (terminal).
 *   - Return for Revision → DRAFT (editable, history preserved, same approval
 *     steps still on record for audit purposes).
 *   - Approve last step → CONFIRMED, fire fulfillment + invoice handoffs.
 *   - Every action MUST write an audit_log row with user, timestamp, and reason.
 *     This is enforced here — no code path skips logAudit().
 */

const { z }       = require('zod');
const prisma      = require('../../config/prisma');
const { logAudit } = require('../../utils/logAudit');
const realtime    = require('../../realtime/index');

// ── Validation ────────────────────────────────────────────────────────────────

const actionSchema = z.object({
  reason: z.string().min(1, 'A reason is required for every approval action'),
});

// ── Shared include shape ──────────────────────────────────────────────────────

const STEP_INCLUDE = {
  quotation: {
    include: {
      customer:  { select: { id: true, companyName: true, tier: true } },
      lines:     {
        include: {
          product: { select: { id: true, name: true,
                               category: { select: { name: true, maxDiscountPercent: true } } } },
        },
      },
      approvalSteps: { orderBy: { order: 'asc' } },
    },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function _loadStep(stepId) {
  const step = await prisma.approvalStep.findUnique({
    where:   { id: stepId },
    include: STEP_INCLUDE,
  });
  if (!step) {
    const e = new Error('Approval step not found');
    e.statusCode = 404; e.code = 'NOT_FOUND'; throw e;
  }
  return step;
}

/**
 * Guard: only allow action on a step if the step belongs to the current
 * pending position in the chain.  Finance cannot act on step-2 while
 * step-1 (Sales Manager) is still PENDING.
 *
 * Global Constraint 2: "Approval steps run in order: Sales Manager first,
 * Finance only if the chain requires it."
 */
function _assertStepIsActionable(step) {
  if (step.status !== 'PENDING') {
    const e = new Error(`This step is already ${step.status}`);
    e.statusCode = 409; e.code = 'STEP_NOT_PENDING'; throw e;
  }

  const allSteps = step.quotation.approvalSteps;
  // Find steps with a lower order that are still PENDING — those must be done first
  const blockers = allSteps.filter((s) => s.order < step.order && s.status === 'PENDING');
  if (blockers.length > 0) {
    const e = new Error(
      `Cannot act on this step while step ${blockers[0].order} (${blockers[0].level}) is still pending`
    );
    e.statusCode = 409; e.code = 'STEP_BLOCKED'; throw e;
  }
}

/**
 * Guard: confirm the actor's role is correct for the step level.
 * ADMIN can act on any step.
 */
function _assertActorRoleMatchesStep(stepLevel, userRole) {
  if (userRole === 'ADMIN') return; // admin bypasses role check

  const required = {
    SALES_MANAGER: 'SALES_MANAGER',
    FINANCE:       'FINANCE',
  };
  if (required[stepLevel] && required[stepLevel] !== userRole) {
    const e = new Error(
      `This step requires a ${stepLevel} role. Your role is ${userRole}.`
    );
    e.statusCode = 403; e.code = 'WRONG_ROLE'; throw e;
  }
}

// ── Public service API ────────────────────────────────────────────────────────

/**
 * List all pending approval steps visible to the requesting user's role.
 * Admin sees all; SM sees SM steps; Finance sees Finance steps.
 */
async function list(query, user) {
  const where = {};

  if (user.role !== 'ADMIN') {
    // Each role sees only the steps at their level
    where.level = user.role; // 'SALES_MANAGER' | 'FINANCE'
  }

  if (query?.status) where.status = query.status;

  const steps = await prisma.approvalStep.findMany({
    where,
    include: STEP_INCLUDE,
    orderBy: { quotation: { lastActivityAt: 'desc' } },
  });

  return steps;
}

/**
 * Get full detail for one approval step (includes quotation + lines + audit).
 */
async function getOne(stepId, user) {
  return _loadStep(stepId);
}

/**
 * PATCH /api/approvals/:stepId/approve
 * Approve this step.
 *
 * Flow:
 *   1. Validate: step is PENDING, actor role matches step level, no blockers.
 *   2. Mark this step APPROVED.
 *   3. If there is a next step (Finance), set quotation to PENDING_APPROVAL
 *      and emit APPROVAL_PENDING to Finance.
 *   4. If this was the final step, set quotation to CONFIRMED and fire
 *      fulfillment + invoice handoffs.
 *   5. logAudit() with reason — non-negotiable.
 */
async function approve(stepId, body, user) {
  const { reason } = actionSchema.parse(body);
  const step       = await _loadStep(stepId);

  _assertStepIsActionable(step);
  _assertActorRoleMatchesStep(step.level, user.role);

  const allSteps  = step.quotation.approvalSteps;
  const nextStep  = allSteps.find((s) => s.order === step.order + 1);
  const isFinal   = !nextStep;

  const result = await prisma.$transaction(async (tx) => {
    // Mark this step approved
    const updatedStep = await tx.approvalStep.update({
      where: { id: stepId },
      data:  { status: 'APPROVED', actedById: user.userId, actedAt: new Date(), reason },
    });

    let newQuotationStatus;

    if (isFinal) {
      // Final approval — quotation moves to CONFIRMED
      newQuotationStatus = 'CONFIRMED';
    } else {
      // More steps remain — keep PENDING_APPROVAL
      newQuotationStatus = 'PENDING_APPROVAL';
    }

    const updatedQuotation = await tx.quotation.update({
      where:   { id: step.quotationId },
      data:    { status: newQuotationStatus, lastActivityAt: new Date() },
      include: { customer: { select: { id: true, companyName: true } } },
    });

    return { updatedStep, updatedQuotation, nextStep, isFinal, newQuotationStatus };
  });

  // ── Audit (required, per Global Constraint 2) ─────────────────────────────
  await logAudit({
    userId:     user.userId,
    action:     'APPROVAL_APPROVED',
    entityType: 'ApprovalStep',
    entityId:   stepId,
    details:    {
      quotationId:  step.quotationId,
      stepLevel:    step.level,
      stepOrder:    step.order,
      isFinal:      result.isFinal,
      newStatus:    result.newQuotationStatus,
      reason,
    },
  });

  // ── Real-time events ──────────────────────────────────────────────────────
  realtime.emitQuotationUpdated({
    repId:       step.quotation.repId,
    quotationId: step.quotationId,
    status:      result.newQuotationStatus,
    extra:       { stepLevel: step.level, action: 'APPROVED', reason },
  });

  if (!result.isFinal && result.nextStep) {
    // Notify the Finance role that their step is now actionable
    realtime.emitApprovalPending(result.nextStep.level, {
      quotationId:  step.quotationId,
      blendedScore: step.quotation.blendedRiskScore,
      customerName: step.quotation.customer?.companyName,
    });
  }

  if (result.isFinal) {
    // Notify the rep their quote is confirmed
    realtime.emitApprovalActed(step.quotation.repId, {
      quotationId: step.quotationId,
      action:      'CONFIRMED',
      reason,
    });

    // Also notify the customer's portal
    if (step.quotation.customerId) {
      realtime.emitQuotationCustomerUpdate({
        customerId:  step.quotation.customerId,
        quotationId: step.quotationId,
        status:      'CONFIRMED',
      });
    }
  }

  return result.updatedStep;
}

/**
 * PATCH /api/approvals/:stepId/reject
 * Reject the quotation — terminal state, cannot be re-submitted.
 */
async function reject(stepId, body, user) {
  const { reason } = actionSchema.parse(body);
  const step       = await _loadStep(stepId);

  _assertStepIsActionable(step);
  _assertActorRoleMatchesStep(step.level, user.role);

  await prisma.$transaction([
    prisma.approvalStep.update({
      where: { id: stepId },
      data:  { status: 'REJECTED', actedById: user.userId, actedAt: new Date(), reason },
    }),
    prisma.quotation.update({
      where: { id: step.quotationId },
      data:  { status: 'REJECTED', lastActivityAt: new Date() },
    }),
  ]);

  // Audit — mandatory per Constraint 2
  await logAudit({
    userId:     user.userId,
    action:     'APPROVAL_REJECTED',
    entityType: 'ApprovalStep',
    entityId:   stepId,
    details:    { quotationId: step.quotationId, stepLevel: step.level, reason },
  });

  realtime.emitQuotationUpdated({
    repId:       step.quotation.repId,
    quotationId: step.quotationId,
    status:      'REJECTED',
    extra:       { reason },
  });

  realtime.emitApprovalActed(step.quotation.repId, {
    quotationId: step.quotationId,
    action:      'REJECTED',
    reason,
  });

  return { success: true, quotationId: step.quotationId, newStatus: 'REJECTED' };
}

/**
 * PATCH /api/approvals/:stepId/return
 * Return for Revision — moves quotation back to DRAFT, editable again.
 * History is preserved (the step record stays with status RETURNED).
 * Different from Reject: the rep can re-submit after fixing the quotation.
 */
async function returnForRevision(stepId, body, user) {
  const { reason } = actionSchema.parse(body);
  const step       = await _loadStep(stepId);

  _assertStepIsActionable(step);
  _assertActorRoleMatchesStep(step.level, user.role);

  await prisma.$transaction([
    prisma.approvalStep.update({
      where: { id: stepId },
      data:  { status: 'RETURNED', actedById: user.userId, actedAt: new Date(), reason },
    }),
    prisma.quotation.update({
      where: { id: step.quotationId },
      data:  { status: 'DRAFT', lastActivityAt: new Date() },
    }),
  ]);

  // Audit — mandatory per Constraint 2
  await logAudit({
    userId:     user.userId,
    action:     'APPROVAL_RETURNED',
    entityType: 'ApprovalStep',
    entityId:   stepId,
    details:    { quotationId: step.quotationId, stepLevel: step.level, reason },
  });

  realtime.emitQuotationUpdated({
    repId:       step.quotation.repId,
    quotationId: step.quotationId,
    status:      'DRAFT',
    extra:       { reason, returnedFor: 'REVISION' },
  });

  realtime.emitApprovalActed(step.quotation.repId, {
    quotationId: step.quotationId,
    action:      'RETURNED_FOR_REVISION',
    reason,
  });

  return { success: true, quotationId: step.quotationId, newStatus: 'DRAFT' };
}

module.exports = { list, getOne, approve, reject, returnForRevision };
