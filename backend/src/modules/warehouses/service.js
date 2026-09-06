'use strict';

const { z }       = require('zod');
const prisma      = require('../../config/prisma');
const { logAudit } = require('../../utils/logAudit');
const realtime    = require('../../realtime/index');

// ─── Validation schemas ───────────────────────────────────────────────────────

const warehouseSchema = z.object({
  name:               z.string().min(1),
  location:           z.string().optional(),
  shippingCostWeight: z.coerce.number().positive().default(1),
});

const stockSetSchema = z.object({
  productId:    z.string().uuid(),
  onHand:       z.coerce.number().int().min(0),
  reserved:     z.coerce.number().int().min(0).optional(),
  reorderPoint: z.coerce.number().int().min(0).optional(),
  reorderQty:   z.coerce.number().int().min(0).optional(),
});

const stockAdjustSchema = z.object({
  productId: z.string().uuid(),
  delta:     z.coerce.number().int(), // positive = add stock, negative = remove stock
  reason:    z.string().min(1),
});

// ─── Warehouse CRUD ───────────────────────────────────────────────────────────

exports.list = async () =>
  prisma.warehouse.findMany({
    include: { stockLevels: { include: { product: { select: { id: true, name: true, unit: true } } } } },
    orderBy: { name: 'asc' },
  });

exports.getOne = async (id) =>
  prisma.warehouse.findUniqueOrThrow({
    where:   { id },
    include: { stockLevels: { include: { product: { select: { id: true, name: true, unit: true } } } } },
  });

exports.create = async (body, actor) => {
  const data = warehouseSchema.parse(body);
  const wh   = await prisma.warehouse.create({ data });
  await logAudit({
    userId:     actor.userId,
    action:     'WAREHOUSE_CREATED',
    entityType: 'Warehouse',
    entityId:   wh.id,
    details:    { name: wh.name },
  });
  return wh;
};

exports.update = async (id, body, actor) => {
  const data = warehouseSchema.partial().parse(body);
  const wh   = await prisma.warehouse.update({ where: { id }, data });
  await logAudit({
    userId:     actor.userId,
    action:     'WAREHOUSE_UPDATED',
    entityType: 'Warehouse',
    entityId:   wh.id,
    details:    data,
  });
  return wh;
};

exports.remove = async (id, actor) => {
  const wh = await prisma.warehouse.delete({ where: { id } });
  await logAudit({
    userId:     actor.userId,
    action:     'WAREHOUSE_DELETED',
    entityType: 'Warehouse',
    entityId:   id,
    details:    { name: wh.name },
  });
  return wh;
};

// ─── Stock-level management ───────────────────────────────────────────────────

/**
 * List all StockLevel rows for a given warehouse.
 */
exports.listStock = async (warehouseId) =>
  prisma.stockLevel.findMany({
    where:   { warehouseId },
    include: { product: { select: { id: true, name: true, unit: true } } },
  });

/**
 * Upsert (set absolute values for) a warehouse+product stock record.
 * This is the Admin "set initial stock" / full-override path.
 * For day-to-day adjustments (receipts, shipments) use adjustStock().
 */
exports.setStock = async (warehouseId, body, actor) => {
  const data = stockSetSchema.parse(body);
  const sl   = await prisma.stockLevel.upsert({
    where:  { warehouseId_productId: { warehouseId, productId: data.productId } },
    create: {
      warehouseId,
      productId:    data.productId,
      onHand:       data.onHand,
      reserved:     data.reserved     ?? 0,
      reorderPoint: data.reorderPoint ?? 0,
      reorderQty:   data.reorderQty   ?? 0,
    },
    update: {
      onHand:       data.onHand,
      ...(data.reserved     !== undefined && { reserved:     data.reserved }),
      ...(data.reorderPoint !== undefined && { reorderPoint: data.reorderPoint }),
      ...(data.reorderQty   !== undefined && { reorderQty:   data.reorderQty }),
    },
    include: { product: { select: { id: true, name: true, unit: true } } },
  });

  await _afterStockChange(sl, actor, 'STOCK_SET', { onHand: data.onHand });
  return sl;
};

/**
 * Adjust onHand by a signed delta (positive = restock, negative = drawdown).
 * Validates that onHand never goes below reserved.
 * After update, checks open BackorderItems for this product and, if any are
 * now coverable, emits a real-time consolidation prompt.
 */
exports.adjustStock = async (warehouseId, body, actor) => {
  const { productId, delta, reason } = stockAdjustSchema.parse(body);

  const sl = await prisma.$transaction(async (tx) => {
    const existing = await tx.stockLevel.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
    });

    if (!existing) {
      const err = new Error('No stock record found for this warehouse+product');
      err.statusCode = 404;
      err.code       = 'NOT_FOUND';
      throw err;
    }

    const newOnHand = existing.onHand + delta;
    if (newOnHand < 0) {
      const err = new Error(`Adjustment would make onHand negative (${newOnHand})`);
      err.statusCode = 422;
      err.code       = 'INVALID_ADJUSTMENT';
      throw err;
    }
    if (newOnHand < existing.reserved) {
      const err = new Error(
        `Adjustment would make onHand (${newOnHand}) less than reserved (${existing.reserved})`
      );
      err.statusCode = 422;
      err.code       = 'INVALID_ADJUSTMENT';
      throw err;
    }

    return tx.stockLevel.update({
      where:   { warehouseId_productId: { warehouseId, productId } },
      data:    { onHand: newOnHand },
      include: { product: { select: { id: true, name: true, unit: true } } },
    });
  });

  await _afterStockChange(sl, actor, 'STOCK_ADJUSTED', { delta, reason });
  return sl;
};

// ─── Private helper ───────────────────────────────────────────────────────────

/**
 * Called after any stock change.
 * 1. Emits STOCK_UPDATED real-time event.
 * 2. Checks open BackorderItems for the product across ALL warehouses.
 *    If total available stock now covers a backorder, emits BACKORDER_COVERABLE.
 */
async function _afterStockChange(sl, actor, action, extra) {
  await logAudit({
    userId:     actor?.userId ?? null,
    action,
    entityType: 'StockLevel',
    entityId:   sl.id,
    details:    {
      warehouseId: sl.warehouseId,
      productId:   sl.productId,
      onHand:      sl.onHand,
      reserved:    sl.reserved,
      available:   sl.onHand - sl.reserved,
      ...extra,
    },
  });

  // Broadcast updated stock to internal roles
  realtime.emitStockUpdated({
    warehouseId: sl.warehouseId,
    productId:   sl.productId,
    onHand:      sl.onHand,
    reserved:    sl.reserved,
    available:   sl.onHand - sl.reserved,
  });

  // ── Backorder consolidation check ────────────────────────────────────────
  // Total available across all warehouses for this product
  const allStock = await prisma.stockLevel.findMany({
    where: { productId: sl.productId },
  });
  const totalAvailable = allStock.reduce((sum, s) => sum + (s.onHand - s.reserved), 0);

  // Open (unresolved) backorders for this product
  const openBackorders = await prisma.backorderItem.findMany({
    where:   { productId: sl.productId, resolvedAt: null },
    include: { order: true },
  });

  for (const bo of openBackorders) {
    if (totalAvailable >= bo.qtyPending) {
      // Stock now sufficient — notify fulfillment operators
      realtime.emitBackorderCoverable({
        orderId:     bo.orderId,
        backorderId: bo.id,
        productId:   bo.productId,
        qtyPending:  bo.qtyPending,
        totalAvailable,
      });
    }
  }
}
