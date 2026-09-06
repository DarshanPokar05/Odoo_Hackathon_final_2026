'use strict';

/**
 * Quotations Service
 * ==================
 * Implements the full quotation lifecycle per Global Constraints 1, 2, and 6:
 *   - Draft creation (customer + rep)
 *   - Add/edit/remove lines with live ceiling + risk snapshots
 *   - Save draft
 *   - Submit → server decides auto-confirm vs. approval routing based on
 *     the server-computed blended score alone (never trust client-supplied values)
 *
 * Import hierarchy:
 *   quotations/service ← utils/blendedRiskScore (pure calculation)
 *   quotations/service ← discountConfig/service  (tier + approval chain lookup)
 *   quotations/service ← products/service        (effective ceiling helper)
 *   quotations/service ← realtime/index          (socket.io event emission)
 */

const { z }                        = require('zod');
const prisma                       = require('../../config/prisma');
const { logAudit }                 = require('../../utils/logAudit');
const { computeBlendedRiskScore }  = require('../../utils/blendedRiskScore');
const discountSvc                  = require('../discountConfig/service');
const productSvc                   = require('../products/service');
const realtime                     = require('../../realtime/index');

// ── Validation schemas ────────────────────────────────────────────────────────

const createSchema = z.object({
  customerId:  z.string().uuid(),
  priceListTier: z.enum(['BRONZE', 'SILVER', 'GOLD']).optional(),
  notes:       z.string().max(2000).optional(),
});

const addLineSchema = z.object({
  productId:         z.string().uuid(),
  quantity:          z.coerce.number().int().positive(),
  unitPrice:         z.coerce.number().min(0),
  discountPercent:   z.coerce.number().min(0).max(100).default(0),
  lineType:          z.enum(['ONE_TIME', 'RECURRING']).default('ONE_TIME'),
  subscriptionPlanId: z.string().uuid().optional().nullable(),
});

const updateLineSchema = addLineSchema.partial();

const saveDraftSchema = z.object({
  notes: z.string().max(2000).optional(),
});

// ── Include shape for full quotation responses ────────────────────────────────
const QUOTATION_INCLUDE = {
  customer:      { select: { id: true, companyName: true, tier: true, realEmail: true } },
  lines:         {
    include: {
      product: { select: { id: true, name: true, unit: true, taxPercent: true,
                           category: { select: { id: true, name: true, maxDiscountPercent: true } } } },
    },
  },
  approvalSteps: { orderBy: { order: 'asc' } },
  negotiationMessages: { orderBy: { createdAt: 'asc' } },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Load a quotation and confirm it exists + is editable by the given user.
 * DRAFT and returned quotations are editable; any other status is frozen.
 *
 * @param {string} id
 * @param {object} user — req.user
 * @param {boolean} [requireEditable=false]
 */
async function _loadQuotation(id, user, requireEditable = false) {
  const q = await prisma.quotation.findUnique({
    where: { id },
    include: QUOTATION_INCLUDE,
  });

  if (!q) {
    const e = new Error('Quotation not found');
    e.statusCode = 404; e.code = 'NOT_FOUND'; throw e;
  }

  // CUSTOMER role: may only see their own quotation
  if (user.role === 'CUSTOMER' && q.customerId !== user.customerId) {
    const e = new Error('Access denied to this quotation');
    e.statusCode = 403; e.code = 'FORBIDDEN'; throw e;
  }

  if (requireEditable && !['DRAFT'].includes(q.status)) {
    const e = new Error(`Quotation cannot be edited in status "${q.status}"`);
    e.statusCode = 409; e.code = 'NOT_EDITABLE'; throw e;
  }

  return q;
}

/**
 * After any line change, recompute and persist:
 *   - effectiveCeilingSnapshot and pointsOverSnapshot on each line
 *   - blendedRiskScore on the quotation itself
 *
 * This keeps DB snapshots in sync so the Approval Detail "Why Flagged" table
 * always shows the values that were live at the time of the last line edit.
 *
 * @param {string} quotationId
 * @param {object} tx — Prisma transaction client (or the global prisma client)
 * @returns {{ blendedScore: number, lineDetails: Array }}
 */
async function _recomputeAndPersistScore(quotationId, tx = prisma) {
  const q = await tx.quotation.findUniqueOrThrow({
    where:   { id: quotationId },
    include: {
      customer: { select: { tier: true } },
      lines:    {
        include: {
          product: {
            include: { category: { select: { maxDiscountPercent: true } } },
          },
        },
      },
    },
  });

  // Fetch the tier ceiling for this customer's tier
  const tierCeiling = await discountSvc.getCeilingForTier(q.customer.tier);

  // Build input for the pure calculator
  const calcLines = q.lines.map((l) => ({
    discountPercent:  Number(l.discountPercent),
    categoryCeiling:  Number(l.product.category.maxDiscountPercent),
  }));

  const { blendedScore, lineDetails } = computeBlendedRiskScore(calcLines, tierCeiling);

  // Persist line-level snapshots
  for (let i = 0; i < q.lines.length; i++) {
    const line   = q.lines[i];
    const detail = lineDetails[i];
    await tx.quotationLine.update({
      where: { id: line.id },
      data:  {
        effectiveCeilingSnapshot: detail.effectiveCeiling,
        pointsOverSnapshot:       detail.pointsOver,
      },
    });
  }

  // Persist the blended score on the quotation
  await tx.quotation.update({
    where: { id: quotationId },
    data:  {
      blendedRiskScore: blendedScore,
      lastActivityAt:   new Date(),
    },
  });

  return { blendedScore, lineDetails };
}

/**
 * Create ApprovalStep rows for a quotation based on the required approval level.
 * Rule:
 *   NONE                      → no steps, quotation moves straight to CONFIRMED
 *   SALES_MANAGER             → one step at order 1
 *   SALES_MANAGER_THEN_FINANCE → two steps: SM at order 1, Finance at order 2
 *
 * @param {string} quotationId
 * @param {string} requiredLevel
 * @param {object} tx — transaction client
 * @returns {Promise<Array>} created steps
 */
async function _createApprovalSteps(quotationId, requiredLevel, tx) {
  if (requiredLevel === 'NONE') return [];

  const steps = [];
  if (requiredLevel === 'SALES_MANAGER' || requiredLevel === 'SALES_MANAGER_THEN_FINANCE') {
    steps.push({ quotationId, level: 'SALES_MANAGER', status: 'PENDING', order: 1 });
  }
  if (requiredLevel === 'SALES_MANAGER_THEN_FINANCE') {
    steps.push({ quotationId, level: 'FINANCE', status: 'PENDING', order: 2 });
  }

  return tx.approvalStep.createManyAndReturn({ data: steps });
}

// ── Public service API ────────────────────────────────────────────────────────

/**
 * List quotations.
 * CUSTOMER role → only their own customer's quotations (enforced via WHERE, not frontend filter).
 * Internal roles → all quotations (with optional status/rep filters).
 */
async function list(query, user) {
  const where = {};

  // Global Constraint 5: CUSTOMER role sees ONLY their own customer's quotations
  if (user.role === 'CUSTOMER') {
    where.customerId = user.customerId;
  } else {
    if (query?.status)     where.status     = query.status;
    if (query?.repId)      where.repId      = query.repId;
    if (query?.customerId) where.customerId = query.customerId;
  }

  return prisma.quotation.findMany({
    where,
    include: QUOTATION_INCLUDE,
    orderBy: { lastActivityAt: 'desc' },
  });
}

/**
 * Get a single quotation with all lines, steps, and messages.
 */
async function getOne(id, user) {
  return _loadQuotation(id, user);
}

/**
 * POST /api/quotations
 * Create a new draft quotation for a customer.
 * The rep is taken from the JWT (req.user.userId), never from the body.
 */
async function create(body, user) {
  const { customerId, priceListTier, notes } = createSchema.parse(body);

  // Confirm customer exists
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    const e = new Error('Customer not found');
    e.statusCode = 404; e.code = 'NOT_FOUND'; throw e;
  }

  const quotation = await prisma.quotation.create({
    data: {
      customerId,
      repId:           user.userId,
      status:          'DRAFT',
      blendedRiskScore: 0,
      lastActivityAt:  new Date(),
    },
    include: QUOTATION_INCLUDE,
  });

  await logAudit({
    userId:     user.userId,
    action:     'QUOTATION_CREATED',
    entityType: 'Quotation',
    entityId:   quotation.id,
    details:    { customerId, customer: customer.companyName },
  });

  return quotation;
}

/**
 * POST /api/quotations/:id/lines
 * Add a line to a DRAFT quotation.
 *
 * After adding, immediately recompute effectiveCeilingSnapshot,
 * pointsOverSnapshot, and the overall blendedRiskScore — so the UI can show
 * live OVER/OK status without waiting for submit.
 */
async function addLine(id, body, user) {
  // Only DRAFT quotations may be edited
  await _loadQuotation(id, user, true);

  const data = addLineSchema.parse(body);

  // Snapshot the effective ceiling for this line right now so the record is
  // self-contained for the "Why Flagged" audit trail even if ceilings change later
  const q = await prisma.quotation.findUniqueOrThrow({
    where:   { id },
    include: { customer: { select: { tier: true } } },
  });
  const tierCeiling = await discountSvc.getCeilingForTier(q.customer.tier);
  const ec          = await productSvc.getEffectiveCeiling(data.productId, tierCeiling);
  const pts         = Math.max(0, data.discountPercent - ec);

  const line = await prisma.quotationLine.create({
    data: {
      quotationId:              id,
      productId:                data.productId,
      quantity:                 data.quantity,
      unitPrice:                data.unitPrice,
      discountPercent:          data.discountPercent,
      lineType:                 data.lineType,
      subscriptionPlanId:       data.subscriptionPlanId ?? null,
      effectiveCeilingSnapshot: ec,
      pointsOverSnapshot:       pts,
    },
    include: {
      product: { select: { id: true, name: true, unit: true, taxPercent: true,
                           category: { select: { name: true, maxDiscountPercent: true } } } },
    },
  });

  // Recompute the full quotation score after adding the line
  const { blendedScore, lineDetails } = await _recomputeAndPersistScore(id);

  await logAudit({
    userId:     user.userId,
    action:     'QUOTATION_LINE_ADDED',
    entityType: 'Quotation',
    entityId:   id,
    details:    { productId: data.productId, discountPercent: data.discountPercent, blendedScore },
  });

  return { line, blendedScore, lineDetails };
}

/**
 * PATCH /api/quotations/:id/lines/:lineId
 * Edit a line on a DRAFT quotation.
 * Triggers full score recompute just like addLine.
 */
async function updateLine(quotationId, lineId, body, user) {
  await _loadQuotation(quotationId, user, true);

  const data = updateLineSchema.parse(body);

  // If discount or product changed, recompute the ceiling snapshot
  let ceilingUpdate = {};
  if (data.discountPercent !== undefined || data.productId !== undefined) {
    const q = await prisma.quotation.findUniqueOrThrow({
      where:   { id: quotationId },
      include: { customer: { select: { tier: true } } },
    });
    const line = await prisma.quotationLine.findUniqueOrThrow({ where: { id: lineId } });
    const productId  = data.productId ?? line.productId;
    const discount   = data.discountPercent ?? Number(line.discountPercent);
    const tierCeiling = await discountSvc.getCeilingForTier(q.customer.tier);
    const ec = await productSvc.getEffectiveCeiling(productId, tierCeiling);
    const pts = Math.max(0, discount - ec);
    ceilingUpdate = { effectiveCeilingSnapshot: ec, pointsOverSnapshot: pts };
  }

  const line = await prisma.quotationLine.update({
    where: { id: lineId },
    data:  { ...data, ...ceilingUpdate },
    include: {
      product: { select: { id: true, name: true, unit: true, taxPercent: true,
                           category: { select: { name: true, maxDiscountPercent: true } } } },
    },
  });

  const { blendedScore, lineDetails } = await _recomputeAndPersistScore(quotationId);

  await logAudit({
    userId: user.userId, action: 'QUOTATION_LINE_UPDATED',
    entityType: 'Quotation', entityId: quotationId,
    details: { lineId, changes: data, blendedScore },
  });

  return { line, blendedScore, lineDetails };
}

/**
 * DELETE /api/quotations/:id/lines/:lineId
 */
async function removeLine(quotationId, lineId, user) {
  await _loadQuotation(quotationId, user, true);
  await prisma.quotationLine.delete({ where: { id: lineId } });
  const { blendedScore, lineDetails } = await _recomputeAndPersistScore(quotationId);

  await logAudit({
    userId: user.userId, action: 'QUOTATION_LINE_REMOVED',
    entityType: 'Quotation', entityId: quotationId,
    details: { lineId, blendedScore },
  });

  return { blendedScore, lineDetails };
}

/**
 * PATCH /api/quotations/:id/save-draft
 * Save notes/metadata without changing status.
 */
async function saveDraft(id, body, user) {
  await _loadQuotation(id, user, true);
  const data = saveDraftSchema.parse(body);

  const q = await prisma.quotation.update({
    where:   { id },
    data:    { ...data, lastActivityAt: new Date() },
    include: QUOTATION_INCLUDE,
  });

  await logAudit({
    userId: user.userId, action: 'QUOTATION_DRAFT_SAVED',
    entityType: 'Quotation', entityId: id, details: data,
  });

  return q;
}

/**
 * POST /api/quotations/:id/submit
 * Submit a DRAFT quotation for approval or direct confirmation.
 *
 * GLOBAL CONSTRAINT 2 — the server decides the path:
 *   1. Recompute the blended score server-side (never trust any client value).
 *   2. Look up the required approval level from ApprovalChainRule.
 *   3. If requiredLevel = 'NONE' → status = CONFIRMED, create Order, fire fulfillment.
 *   4. Otherwise → status = PENDING_APPROVAL, create ApprovalStep row(s) in order.
 *
 * The client has NO input into whether approval is required.
 */
async function submit(id, user) {
  const q = await _loadQuotation(id, user, true);

  if (q.lines.length === 0) {
    const e = new Error('Cannot submit a quotation with no lines');
    e.statusCode = 422; e.code = 'NO_LINES'; throw e;
  }

  // ── 1. Authoritative server-side score recompute ─────────────────────────
  const tierCeiling = await discountSvc.getCeilingForTier(q.customer.tier);
  const calcLines   = q.lines.map((l) => ({
    discountPercent: Number(l.discountPercent),
    categoryCeiling: Number(l.product.category.maxDiscountPercent),
  }));
  const { blendedScore, lineDetails } = computeBlendedRiskScore(calcLines, tierCeiling);

  // ── 2. Determine required approval level ─────────────────────────────────
  const requiredLevel = await discountSvc.resolveApprovalLevel(blendedScore);

  // ── 3. Commit the submission inside a transaction ─────────────────────────
  const result = await prisma.$transaction(async (tx) => {
    // Persist updated snapshots on all lines
    for (let i = 0; i < q.lines.length; i++) {
      await tx.quotationLine.update({
        where: { id: q.lines[i].id },
        data:  {
          effectiveCeilingSnapshot: lineDetails[i].effectiveCeiling,
          pointsOverSnapshot:       lineDetails[i].pointsOver,
        },
      });
    }

    let newStatus;
    let approvalSteps = [];

    if (requiredLevel === 'NONE') {
      // ── Auto-confirm path ─────────────────────────────────────────────────
      newStatus = 'CONFIRMED';
    } else {
      // ── Approval-required path ────────────────────────────────────────────
      newStatus = 'PENDING_APPROVAL';
      approvalSteps = await _createApprovalSteps(id, requiredLevel, tx);
    }

    const updated = await tx.quotation.update({
      where: { id },
      data:  {
        status:           newStatus,
        blendedRiskScore: blendedScore,
        lastActivityAt:   new Date(),
      },
      include: QUOTATION_INCLUDE,
    });

    return { quotation: updated, approvalSteps, newStatus };
  });

  // ── 4. Post-transaction side effects ─────────────────────────────────────

  // Audit
  await logAudit({
    userId: user.userId, action: 'QUOTATION_SUBMITTED',
    entityType: 'Quotation', entityId: id,
    details: { blendedScore, requiredLevel, newStatus: result.newStatus },
  });

  // Real-time events
  realtime.emitQuotationUpdated({
    repId:       user.userId,
    quotationId: id,
    status:      result.newStatus,
    extra:       { blendedScore, requiredLevel },
  });

  if (result.newStatus === 'PENDING_APPROVAL') {
    // Notify the first approver role
    const firstLevel = result.approvalSteps[0]?.level ?? 'SALES_MANAGER';
    realtime.emitApprovalPending(firstLevel, {
      quotationId:  id,
      blendedScore,
      customerId:   q.customerId,
      customerName: q.customer.companyName,
    });
  }

  return result.quotation;
}

/**
 * PATCH /api/quotations/:id/status
 * Internal status override for admin use or post-approval transitions.
 * This is NOT the approval action — approvals module handles that.
 */
async function updateStatus(id, newStatus, user) {
  const q = await prisma.quotation.update({
    where:   { id },
    data:    { status: newStatus, lastActivityAt: new Date() },
    include: QUOTATION_INCLUDE,
  });

  await logAudit({
    userId: user.userId, action: 'QUOTATION_STATUS_CHANGED',
    entityType: 'Quotation', entityId: id,
    details: { newStatus },
  });

  return q;
}

module.exports = {
  list,
  getOne,
  create,
  addLine,
  updateLine,
  removeLine,
  saveDraft,
  submit,
  updateStatus,
};
