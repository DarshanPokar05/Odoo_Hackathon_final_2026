'use strict';

/**
 * computeFulfillmentSplit
 * =======================
 * Pure, side-effect-free function.  No DB calls — all inputs are passed in as
 * plain data so this can be unit-tested in isolation.
 *
 * Algorithm (per GLOBAL CONSTRAINT 3):
 *   For each order line, greedily allocate stock across warehouses:
 *     1. Sort warehouses by shippingCostWeight ASC (prefer cheaper to ship).
 *     2. For each warehouse in that order, take as much available stock as
 *        needed (min of what's needed vs what's available).
 *     3. Any quantity still unmet after exhausting all warehouses becomes a
 *        BackorderItem remainder.
 *   "Fewer distinct warehouses" wins over raw cost: we first try to satisfy a
 *   line from a SINGLE warehouse (full-coverage candidate).  If one or more
 *   full-coverage warehouses exist, we pick the one with the lowest
 *   shippingCostWeight.  Only if no single warehouse can cover the full
 *   quantity do we fall back to a multi-warehouse greedy fill.
 *
 * @param {Array<{ productId: string, qty: number }>} orderLines
 *   The items on the order that need fulfillment.
 *
 * @param {Array<{
 *   warehouseId:         string,
 *   productId:           string,
 *   onHand:              number,
 *   reserved:            number,
 *   shippingCostWeight:  number   // from the Warehouse record
 * }>} stockSnapshot
 *   A flat snapshot of StockLevel rows (joined with their warehouse's
 *   shippingCostWeight).  Pass prisma results directly after joining.
 *
 * @returns {{
 *   splits:    Array<{ warehouseId: string, productId: string, qty: number, estimatedCost: number }>,
 *   backorders: Array<{ productId: string, qtyPending: number }>
 * }}
 */
function computeFulfillmentSplit(orderLines, stockSnapshot) {
  // ── Build a mutable available-stock map keyed by warehouseId+productId ─────
  // available = onHand - reserved  (the "free" stock we can allocate)
  const availMap = new Map(); // key: `${warehouseId}:${productId}` → { warehouseId, shippingCostWeight, available }

  for (const row of stockSnapshot) {
    const available = row.onHand - row.reserved;
    if (available < 0) continue; // should never happen but guard defensively
    const key = `${row.warehouseId}:${row.productId}`;
    availMap.set(key, {
      warehouseId:        row.warehouseId,
      productId:          row.productId,
      shippingCostWeight: Number(row.shippingCostWeight),
      available,
    });
  }

  const splits    = []; // { warehouseId, productId, qty, estimatedCost }
  const backorders = []; // { productId, qtyPending }

  for (const line of orderLines) {
    const { productId, qty } = line;
    let remaining = qty;

    // All warehouse rows that carry this product, available > 0
    const candidates = [...availMap.values()]
      .filter(r => r.productId === productId && r.available > 0)
      .sort((a, b) => a.shippingCostWeight - b.shippingCostWeight); // cheapest first

    // ── Strategy 1: single-warehouse full-coverage ───────────────────────────
    // Find the cheapest single warehouse that can cover the entire line qty.
    // Because we sorted by cost ASC the first match IS the cheapest full-cover.
    const fullCover = candidates.find(c => c.available >= remaining);

    if (fullCover) {
      splits.push({
        warehouseId:   fullCover.warehouseId,
        productId,
        qty:           remaining,
        estimatedCost: _cost(fullCover.shippingCostWeight, remaining),
      });
      // Decrement the mutable map so subsequent lines see updated availability
      _deductAvail(availMap, fullCover.warehouseId, productId, remaining);
      remaining = 0;
    } else {
      // ── Strategy 2: multi-warehouse greedy fill ─────────────────────────────
      for (const wh of candidates) {
        if (remaining <= 0) break;
        const take = Math.min(wh.available, remaining);
        splits.push({
          warehouseId:   wh.warehouseId,
          productId,
          qty:           take,
          estimatedCost: _cost(wh.shippingCostWeight, take),
        });
        _deductAvail(availMap, wh.warehouseId, productId, take);
        remaining -= take;
      }
    }

    // ── Backorder remainder ──────────────────────────────────────────────────
    if (remaining > 0) {
      backorders.push({ productId, qtyPending: remaining });
    }
  }

  return { splits, backorders };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Estimate shipping cost for allocating `qty` units from a warehouse.
 * Cost is proportional to shippingCostWeight × qty.  The exact unit (dollars,
 * points, etc.) is determined by how Admin configures shippingCostWeight; the
 * algorithm only needs the relative ordering to be correct.
 */
function _cost(shippingCostWeight, qty) {
  return Number((shippingCostWeight * qty).toFixed(4));
}

/**
 * Deduct `qty` from the mutable availability map entry.
 * Removes the entry when available hits zero to keep candidates lean.
 */
function _deductAvail(availMap, warehouseId, productId, qty) {
  const key   = `${warehouseId}:${productId}`;
  const entry = availMap.get(key);
  if (!entry) return;
  entry.available -= qty;
  if (entry.available <= 0) availMap.delete(key);
}

module.exports = { computeFulfillmentSplit };
