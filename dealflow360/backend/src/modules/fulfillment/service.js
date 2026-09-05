'use strict';

const { z }                       = require('zod');
const prisma                      = require('../../config/prisma');
const { logAudit }                = require('../../utils/logAudit');
const { computeFulfillmentSplit } = require('../../utils/computeFulfillmentSplit');
const realtime                    = require('../../realtime/index');

// ─── Validation schemas ───────────────────────────────────────────────────────

const manualSplitLineSchema = z.object({
  warehouseId: z.string().uuid(),
  productId:   z.string().uuid(),
  qty:         z.coerce.number().int().positive(),
});

const overrideSchema = z.object({
  splits: z.array(manualSplitLineSchema).min(1),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Load an order with its quotation lines and their products.
 * Throws 404 if not found.
 */
async function _loadOrder(orderId) {
  const order = await prisma.order.findUnique({
    where:   { id: orderId },
    include: {
      quotation: {
        include: {
          customer: { select: { id: true, companyName: true } },
          lines:    true,
        },
      },
    },
  });
  if (!order) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  return order;
}

/**
 * Load a stock snapshot for the computeFulfillmentSplit function.
 * Joins StockLevel with its parent Warehouse's shippingCostWeight.
 */
async function _loadStockSnapshot(productIds) {
  const rows = await prisma.stockLevel.findMany({
    where:   { productId: { in: productIds } },
    include: { warehouse: { select: { id: true, shippingCostWeight: true } } },
  });
  return rows.map(r => ({
    warehouseId:        r.warehouseId,
    productId:          r.productId,
    onHand:             r.onHand,
    reserved:           r.reserved,
    shippingCostWeight: Number(r.warehouse.shippingCostWeight),
  }));
}

/**
 * After a commit (accept or override), decrement onHand + increment reserved
 * for each split line, inside a single transaction.
 * Validates that no warehouse is over-allocated at commit time (re-checks
 * live stock, not just the snapshot used at suggest-time).
 */
async function _commitStockChanges(tx, splits) {
  for (const s of splits) {
    const sl = await tx.stockLevel.findUnique({
      where: { warehouseId_productId: { warehouseId: s.warehouseId, productId: s.productId } },
    });
    if (!sl) {
      const err = new Error(
        `No stock record for warehouse ${s.warehouseId} / product ${s.productId}`
      );
      err.statusCode = 422;
      err.code = 'STOCK_NOT_FOUND';
      throw err;
    }
    const available = sl.onHand - sl.reserved;
    if (s.qty > available) {
      const err = new Error(
        `Insufficient available stock: warehouse ${s.warehouseId} has ${available} available, ` +
        `but split requests ${s.qty} for product ${s.productId}`
      );
      err.statusCode = 422;
      err.code = 'INSUFFICIENT_STOCK';
      throw err;
    }
    await tx.stockLevel.update({
      where: { warehouseId_productId: { warehouseId: s.warehouseId, productId: s.productId } },
      data:  { reserved: { increment: s.qty } },
    });
  }
}

// ─── Public service API ───────────────────────────────────────────────────────

/**
 * List orders awaiting fulfillment, with their current splits and backorders.
 */
exports.listOrders = async () => {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ['PENDING_FULFILLMENT', 'SPLIT_PENDING', 'PARTIALLY_FULFILLED', 'BACKORDERED'] },
    },
    include: {
      quotation: {
        include: {
          customer: { select: { id: true, companyName: true } },
        },
      },
      fulfillmentSplits: {
        include: {
          warehouse: { select: { id: true, name: true } },
          product:   { select: { id: true, name: true } },
        },
      },
      backorderItems: { where: { resolvedAt: null } },
    },
    orderBy: { confirmedAt: 'asc' },
  });
  return orders;
};

/**
 * GET /api/fulfillment/:orderId
 * Returns all fulfillment details for one order: split table, backorders,
 * and a pre-computed suggested split against live stock.
 */
exports.getOrderFulfillment = async (orderId) => {
  const order = await _loadOrder(orderId);

  // Pre-compute a fresh suggested split against current live stock
  const productIds    = order.quotation.lines.map(l => l.productId);
  const stockSnapshot = await _loadStockSnapshot(productIds);

  const orderLines = order.quotation.lines.map(l => ({
    productId: l.productId,
    qty:       l.quantity,
  }));

  const { splits: suggested, backorders: suggestedBackorders } =
    computeFulfillmentSplit(orderLines, stockSnapshot);

  // Load committed splits and open backorders from DB
  const [committedSplits, openBackorders] = await Promise.all([
    prisma.fulfillmentSplit.findMany({
      where:   { orderId },
      include: {
        warehouse: { select: { id: true, name: true, shippingCostWeight: true } },
        product:   { select: { id: true, name: true, unit: true } },
      },
    }),
    prisma.backorderItem.findMany({
      where:   { orderId, resolvedAt: null },
      include: { product: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    order: {
      id:          order.id,
      status:      order.status,
      confirmedAt: order.confirmedAt,
      customer:    order.quotation.customer,
      lines:       order.quotation.lines,
    },
    suggestedSplit:     suggested,
    suggestedBackorders,
    committedSplits,
    openBackorders,
  };
};

/**
 * POST /api/fulfillment/:orderId/suggest-split
 * Returns a suggested split without committing anything.
 * Frontend calls this to populate the split table before the user accepts.
 */
exports.suggestSplit = async (orderId) => {
  const order         = await _loadOrder(orderId);
  const productIds    = order.quotation.lines.map(l => l.productId);
  const stockSnapshot = await _loadStockSnapshot(productIds);
  const orderLines    = order.quotation.lines.map(l => ({
    productId: l.productId,
    qty:       l.quantity,
  }));
  return computeFulfillmentSplit(orderLines, stockSnapshot);
};

/**
 * POST /api/fulfillment/:orderId/accept-split
 * Commits the auto-computed suggested split:
 *   - Decrements available stock (increments reserved) per split line
 *   - Creates FulfillmentSplit DB rows
 *   - Creates BackorderItem rows for any shortfall
 *   - Advances order status
 */
exports.acceptSplit = async (orderId, actor) => {
  const order         = await _loadOrder(orderId);
  const productIds    = order.quotation.lines.map(l => l.productId);
  const stockSnapshot = await _loadStockSnapshot(productIds);
  const orderLines    = order.quotation.lines.map(l => ({
    productId: l.productId,
    qty:       l.quantity,
  }));

  const { splits, backorders } = computeFulfillmentSplit(orderLines, stockSnapshot);

  if (splits.length === 0 && backorders.length > 0) {
    // Zero stock across all warehouses — order goes fully into backorder
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Re-validate and reserve stock (live re-check inside tx)
    await _commitStockChanges(tx, splits);

    // 2. Delete any stale suggested splits for this order
    await tx.fulfillmentSplit.deleteMany({ where: { orderId } });

    // 3. Create committed FulfillmentSplit rows
    const createdSplits = await Promise.all(
      splits.map(s =>
        tx.fulfillmentSplit.create({
          data: {
            orderId,
            warehouseId:   s.warehouseId,
            productId:     s.productId,
            qtyFulfilled:  s.qty,
            estimatedCost: s.estimatedCost,
          },
        })
      )
    );

    // 4. Create BackorderItem rows for shortfall lines
    const createdBackorders = await Promise.all(
      backorders.map(b =>
        tx.backorderItem.create({
          data: {
            orderId,
            productId:  b.productId,
            qtyPending: b.qtyPending,
          },
        })
      )
    );

    // 5. Advance order status
    const newStatus = backorders.length > 0 ? 'BACKORDERED' : 'SPLIT_ACCEPTED';
    const updated   = await tx.order.update({
      where: { id: orderId },
      data:  { status: newStatus },
    });

    return { order: updated, splits: createdSplits, backorders: createdBackorders };
  });

  // ── Audit + real-time ──────────────────────────────────────────────────────
  await logAudit({
    userId:     actor.userId,
    action:     'FULFILLMENT_SPLIT_ACCEPTED',
    entityType: 'Order',
    entityId:   orderId,
    details: {
      splitCount:     result.splits.length,
      backorderCount: result.backorders.length,
      newStatus:      result.order.status,
    },
  });

  realtime.emitFulfillmentUpdated({
    orderId,
    status:    result.order.status,
    splits:    result.splits,
    backorders: result.backorders,
  });

  // Emit individual stock-change events so the stock table updates live
  for (const s of splits) {
    // Reload the updated StockLevel to broadcast accurate numbers
    const sl = await prisma.stockLevel.findUnique({
      where: { warehouseId_productId: { warehouseId: s.warehouseId, productId: s.productId } },
    });
    if (sl) {
      realtime.emitStockUpdated({
        warehouseId: sl.warehouseId,
        productId:   sl.productId,
        onHand:      sl.onHand,
        reserved:    sl.reserved,
        available:   sl.onHand - sl.reserved,
      });
    }
  }

  return result;
};

/**
 * POST /api/fulfillment/:orderId/override
 * Finance/Ops submits a manually constructed split.
 * Validated against live stock exactly the same as the auto path.
 *
 * Body: { splits: [{ warehouseId, productId, qty }] }
 */
exports.overrideSplit = async (orderId, body, actor) => {
  const { splits: proposed } = overrideSchema.parse(body);
  const order = await _loadOrder(orderId);

  // Build a per-product required-qty map from the order lines
  const requiredMap = new Map();
  for (const line of order.quotation.lines) {
    requiredMap.set(line.productId, line.quantity);
  }

  // Validate: override cannot request more total qty per product than the order line
  const overrideByProduct = new Map();
  for (const s of proposed) {
    overrideByProduct.set(s.productId, (overrideByProduct.get(s.productId) ?? 0) + s.qty);
  }
  for (const [productId, totalQty] of overrideByProduct.entries()) {
    const required = requiredMap.get(productId);
    if (required === undefined) {
      const err = new Error(`Product ${productId} is not on this order`);
      err.statusCode = 422;
      err.code = 'INVALID_OVERRIDE';
      throw err;
    }
    if (totalQty > required) {
      const err = new Error(
        `Override allocates ${totalQty} for product ${productId} but order only needs ${required}`
      );
      err.statusCode = 422;
      err.code = 'INVALID_OVERRIDE';
      throw err;
    }
  }

  // Compute estimated costs using warehouse shippingCostWeight
  const warehouseIds  = [...new Set(proposed.map(s => s.warehouseId))];
  const warehouses    = await prisma.warehouse.findMany({ where: { id: { in: warehouseIds } } });
  const costWeightMap = new Map(warehouses.map(w => [w.id, Number(w.shippingCostWeight)]));

  const splitsWithCost = proposed.map(s => ({
    ...s,
    estimatedCost: Number(((costWeightMap.get(s.warehouseId) ?? 1) * s.qty).toFixed(4)),
  }));

  // Determine backorders: products whose override qty < required
  const backorders = [];
  for (const [productId, required] of requiredMap.entries()) {
    const allocated = overrideByProduct.get(productId) ?? 0;
    if (allocated < required) {
      backorders.push({ productId, qtyPending: required - allocated });
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // Live stock re-validation inside transaction
    await _commitStockChanges(tx, splitsWithCost);

    // Clear old splits
    await tx.fulfillmentSplit.deleteMany({ where: { orderId } });

    const createdSplits = await Promise.all(
      splitsWithCost.map(s =>
        tx.fulfillmentSplit.create({
          data: {
            orderId,
            warehouseId:   s.warehouseId,
            productId:     s.productId,
            qtyFulfilled:  s.qty,
            estimatedCost: s.estimatedCost,
          },
        })
      )
    );

    // Replace open backorders for this order
    await tx.backorderItem.deleteMany({ where: { orderId, resolvedAt: null } });
    const createdBackorders = await Promise.all(
      backorders.map(b =>
        tx.backorderItem.create({
          data: { orderId, productId: b.productId, qtyPending: b.qtyPending },
        })
      )
    );

    const newStatus = backorders.length > 0 ? 'BACKORDERED' : 'SPLIT_ACCEPTED';
    const updated   = await tx.order.update({
      where: { id: orderId },
      data:  { status: newStatus },
    });

    return { order: updated, splits: createdSplits, backorders: createdBackorders };
  });

  await logAudit({
    userId:     actor.userId,
    action:     'FULFILLMENT_SPLIT_OVERRIDDEN',
    entityType: 'Order',
    entityId:   orderId,
    details: {
      splitCount:     result.splits.length,
      backorderCount: result.backorders.length,
      newStatus:      result.order.status,
      overriddenBy:   actor.userId,
    },
  });

  realtime.emitFulfillmentUpdated({
    orderId,
    status:    result.order.status,
    splits:    result.splits,
    backorders: result.backorders,
  });

  for (const s of splitsWithCost) {
    const sl = await prisma.stockLevel.findUnique({
      where: { warehouseId_productId: { warehouseId: s.warehouseId, productId: s.productId } },
    });
    if (sl) {
      realtime.emitStockUpdated({
        warehouseId: sl.warehouseId,
        productId:   sl.productId,
        onHand:      sl.onHand,
        reserved:    sl.reserved,
        available:   sl.onHand - sl.reserved,
      });
    }
  }

  return result;
};

/**
 * POST /api/fulfillment/backorders/:backorderId/consolidate
 * Called when the user clicks "Consolidate Remaining Backorder" after stock
 * has been restocked.  Runs the auto-split algorithm against only the
 * backorder's remaining qty, commits the new split, and resolves the backorder.
 */
exports.consolidateBackorder = async (backorderId, actor) => {
  const bo = await prisma.backorderItem.findUnique({
    where:   { id: backorderId },
    include: { order: true },
  });
  if (!bo || bo.resolvedAt) {
    const err = new Error('Backorder not found or already resolved');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const stockSnapshot = await _loadStockSnapshot([bo.productId]);
  const { splits, backorders: remaining } = computeFulfillmentSplit(
    [{ productId: bo.productId, qty: bo.qtyPending }],
    stockSnapshot
  );

  if (splits.length === 0) {
    const err = new Error('Still no available stock to consolidate this backorder');
    err.statusCode = 422;
    err.code = 'INSUFFICIENT_STOCK';
    throw err;
  }

  const result = await prisma.$transaction(async (tx) => {
    await _commitStockChanges(tx, splits);

    const createdSplits = await Promise.all(
      splits.map(s =>
        tx.fulfillmentSplit.create({
          data: {
            orderId:       bo.orderId,
            warehouseId:   s.warehouseId,
            productId:     s.productId,
            qtyFulfilled:  s.qty,
            estimatedCost: s.estimatedCost,
          },
        })
      )
    );

    // Mark the backorder resolved
    const resolvedBo = await tx.backorderItem.update({
      where: { id: backorderId },
      data:  { resolvedAt: new Date() },
    });

    // If there is still a partial shortfall, create a new smaller backorder
    let newBackorder = null;
    if (remaining.length > 0) {
      newBackorder = await tx.backorderItem.create({
        data: {
          orderId:    bo.orderId,
          productId:  remaining[0].productId,
          qtyPending: remaining[0].qtyPending,
        },
      });
    }

    // Re-check if any other backorders remain for this order
    const stillOpen = await tx.backorderItem.count({
      where: { orderId: bo.orderId, resolvedAt: null, id: { not: backorderId } },
    });

    // Advance order status if all backorders resolved
    let updatedOrder = null;
    if (stillOpen === 0 && !newBackorder) {
      updatedOrder = await tx.order.update({
        where: { id: bo.orderId },
        data:  { status: 'SPLIT_ACCEPTED' },
      });
    }

    return { resolvedBo, newBackorder, createdSplits, updatedOrder };
  });

  await logAudit({
    userId:     actor.userId,
    action:     'BACKORDER_CONSOLIDATED',
    entityType: 'BackorderItem',
    entityId:   backorderId,
    details: {
      orderId:          bo.orderId,
      productId:        bo.productId,
      qtyConsolidated:  bo.qtyPending - (remaining[0]?.qtyPending ?? 0),
      qtyStillPending:  remaining[0]?.qtyPending ?? 0,
    },
  });

  realtime.emitFulfillmentUpdated({
    orderId:  bo.orderId,
    status:   result.updatedOrder?.status ?? 'BACKORDERED',
    splits:   result.createdSplits,
    backorders: result.newBackorder ? [result.newBackorder] : [],
  });

  return result;
};

// ─── Events ───────────────────────────────────────────────────────────────────

/**
 * processFulfillmentHandoff
 * Handles the webhook event from Track A when an order is confirmed.
 * Payload: { orderId: "..." }
 */
exports.processFulfillmentHandoff = async (payload) => {
  const { orderId } = payload;
  if (!orderId) {
    const err = new Error('Missing orderId in handoff payload');
    err.statusCode = 400;
    throw err;
  }

  // Load the order just like acceptSplit does
  const order = await _loadOrder(orderId);
  if (order.status !== 'PENDING_FULFILLMENT') {
    return { message: 'Order already processed or not in pending state', orderId, status: order.status };
  }

  const productIds    = order.quotation.lines.map(l => l.productId);
  const stockSnapshot = await _loadStockSnapshot(productIds);
  const orderLines    = order.quotation.lines.map(l => ({
    productId: l.productId,
    qty:       l.quantity,
  }));

  const { splits, backorders } = computeFulfillmentSplit(orderLines, stockSnapshot);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Re-validate and reserve stock
    await _commitStockChanges(tx, splits);

    // 2. Clear any stale suggested splits just in case
    await tx.fulfillmentSplit.deleteMany({ where: { orderId } });

    // 3. Create committed FulfillmentSplit rows
    const createdSplits = await Promise.all(
      splits.map(s =>
        tx.fulfillmentSplit.create({
          data: {
            orderId,
            warehouseId:   s.warehouseId,
            productId:     s.productId,
            qtyFulfilled:  s.qty,
            estimatedCost: s.estimatedCost,
          },
        })
      )
    );

    // 4. Create BackorderItem rows for shortfall
    const createdBackorders = await Promise.all(
      backorders.map(b =>
        tx.backorderItem.create({
          data: {
            orderId,
            productId:  b.productId,
            qtyPending: b.qtyPending,
          },
        })
      )
    );

    // 5. Advance order status
    const newStatus = backorders.length > 0 ? 'BACKORDERED' : 'SPLIT_ACCEPTED';
    const updated   = await tx.order.update({
      where: { id: orderId },
      data:  { status: newStatus },
    });

    return { order: updated, splits: createdSplits, backorders: createdBackorders };
  });

  // Audit logging (system actor)
  await logAudit({
    userId:     'SYSTEM', // automated action triggered by event
    action:     'FULFILLMENT_HANDOFF_PROCESSED',
    entityType: 'Order',
    entityId:   orderId,
    details: {
      splitCount:     result.splits.length,
      backorderCount: result.backorders.length,
      newStatus:      result.order.status,
    },
  });

  // Emit real-time updates for frontend (Screen 7/8)
  realtime.emitFulfillmentUpdated({
    orderId,
    status:    result.order.status,
    splits:    result.splits,
    backorders: result.backorders,
  });

  for (const s of splits) {
    const sl = await prisma.stockLevel.findUnique({
      where: { warehouseId_productId: { warehouseId: s.warehouseId, productId: s.productId } },
    });
    if (sl) {
      realtime.emitStockUpdated({
        warehouseId: sl.warehouseId,
        productId:   sl.productId,
        onHand:      sl.onHand,
        reserved:    sl.reserved,
        available:   sl.onHand - sl.reserved,
      });
    }
  }

  return {
    message: 'Fulfillment handoff processed successfully',
    orderId,
    status: result.order.status,
    splits: result.splits.length,
    backorders: result.backorders.length
  };
};

// ─── Legacy skeleton list/getOne kept for the generic GET / route ─────────────
exports.list   = exports.listOrders;
exports.getOne = exports.getOrderFulfillment;
