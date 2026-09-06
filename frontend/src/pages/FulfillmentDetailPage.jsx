import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFulfillmentDetail,
  acceptSplit,
  overrideSplit,
  consolidateBackorder,
} from '../api/fulfillment';
import { listWarehouses } from '../api/warehouses';
import { useSocket } from '../hooks/useSocket';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  PENDING_FULFILLMENT: 'bg-yellow-100 text-yellow-800',
  SPLIT_PENDING:       'bg-blue-100   text-blue-800',
  SPLIT_ACCEPTED:      'bg-green-100  text-green-800',
  BACKORDERED:         'bg-red-100    text-red-800',
  PARTIALLY_FULFILLED: 'bg-orange-100 text-orange-800',
};

function StatusBadge({ status }) {
  const cls   = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700';
  const label = status?.replace(/_/g, ' ') ?? '—';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function fmt(n) {
  return typeof n === 'number' ? n.toFixed(2) : parseFloat(n ?? 0).toFixed(2);
}

// ─── Override modal ───────────────────────────────────────────────────────────
/**
 * Lets Finance/Ops key in a manual split line-by-line.
 * Pre-populates from the suggested split so they only need to edit differences.
 */
function OverrideModal({ suggested, warehouses, orderLines, onConfirm, onClose, loading }) {
  // rows: [{ warehouseId, productId, qty }]
  const [rows, setRows] = useState(() =>
    suggested.map(s => ({ warehouseId: s.warehouseId, productId: s.productId, qty: s.qty }))
  );

  const addRow = () => setRows(r => [...r, { warehouseId: '', productId: '', qty: 1 }]);

  const removeRow = (i) => setRows(r => r.filter((_, idx) => idx !== i));

  const update = (i, field, val) =>
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));

  // product options from orderLines
  const productOptions = orderLines.map(l => ({
    id:   l.productId,
    name: l.product?.name ?? l.productId,
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const valid = rows.filter(r => r.warehouseId && r.productId && r.qty > 0);
    if (!valid.length) return;
    onConfirm({ splits: valid.map(r => ({ ...r, qty: Number(r.qty) })) });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-modal-title"
    >
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 id="override-modal-title" className="text-base font-semibold text-gray-900">
            Manual Override — Fulfillment Split
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close override modal"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-gray-500">
          Edit the allocation below. Stock is validated server-side on submit — you cannot allocate
          more than each warehouse's available quantity.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b">
                <th className="pb-2 pr-3">Warehouse</th>
                <th className="pb-2 pr-3">Product</th>
                <th className="pb-2 pr-3 w-24">Qty</th>
                <th className="pb-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="py-2 pr-3">
                    <select
                      required
                      value={row.warehouseId}
                      onChange={e => update(i, 'warehouseId', e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Select…</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <select
                      required
                      value={row.productId}
                      onChange={e => update(i, 'productId', e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Select…</option>
                      {productOptions.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      required
                      min={1}
                      value={row.qty}
                      onChange={e => update(i, 'qty', e.target.value)}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </td>
                  <td className="py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-red-400 hover:text-red-600 text-base leading-none"
                      aria-label="Remove row"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            onClick={addRow}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            + Add row
          </button>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? 'Submitting…' : 'Commit Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FulfillmentDetailPage() {
  const { orderId } = useParams();
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const socketRef   = useSocket();

  const [showOverride,   setShowOverride]   = useState(false);
  const [consolidatable, setConsolidatable] = useState([]); // backorder ids that are now coverable
  const [error,          setError]          = useState(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['fulfillment-detail', orderId],
    queryFn:  () => getFulfillmentDetail(orderId),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn:  listWarehouses,
  });

  // ── Socket.io — real-time consolidation banner + status refresh ───────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onBackorderCoverable = (payload) => {
      if (payload.orderId === orderId) {
        setConsolidatable(prev =>
          prev.includes(payload.backorderId) ? prev : [...prev, payload.backorderId]
        );
      }
    };

    const onFulfillmentUpdated = (payload) => {
      if (payload.orderId === orderId) {
        refetch();
        setConsolidatable([]);  // banner clears after a commit
      }
    };

    socket.on('BACKORDER_COVERABLE',  onBackorderCoverable);
    socket.on('FULFILLMENT_UPDATED',  onFulfillmentUpdated);

    return () => {
      socket.off('BACKORDER_COVERABLE', onBackorderCoverable);
      socket.off('FULFILLMENT_UPDATED', onFulfillmentUpdated);
    };
  }, [socketRef, orderId, refetch]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const acceptMut = useMutation({
    mutationFn: () => acceptSplit(orderId),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['fulfillment-detail', orderId] }); setError(null); },
    onError:    (e) => setError(e.response?.data?.error?.message ?? 'Accept split failed'),
  });

  const overrideMut = useMutation({
    mutationFn: (body) => overrideSplit(orderId, body),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['fulfillment-detail', orderId] });
      setShowOverride(false);
      setError(null);
    },
    onError: (e) => setError(e.response?.data?.error?.message ?? 'Override failed'),
  });

  const consolidateMut = useMutation({
    mutationFn: (backorderId) => consolidateBackorder(backorderId),
    onSuccess:  (_, backorderId) => {
      setConsolidatable(prev => prev.filter(id => id !== backorderId));
      qc.invalidateQueries({ queryKey: ['fulfillment-detail', orderId] });
      setError(null);
    },
    onError: (e) => setError(e.response?.data?.error?.message ?? 'Consolidation failed'),
  });

  // ── Derived state ─────────────────────────────────────────────────────────
  const orderInfo       = data?.order;
  const suggestedSplit  = data?.suggestedSplit       ?? [];
  const committedSplits = data?.committedSplits       ?? [];
  const openBackorders  = data?.openBackorders        ?? [];
  const lines           = data?.order?.lines          ?? [];
  const displaySplits   = committedSplits.length > 0 ? committedSplits : suggestedSplit;
  const isCommitted     = committedSplits.length > 0;
  const isSplitDone     = ['SPLIT_ACCEPTED', 'INVOICED', 'CLOSED'].includes(orderInfo?.status);

  // banner shows if: socket said coverable OR there are open backorders AND is committed
  const showConsolidationBanner =
    consolidatable.length > 0 ||
    (isCommitted && openBackorders.length > 0);

  const totalCost = displaySplits.reduce((sum, s) => sum + parseFloat(s.estimatedCost ?? 0), 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">
        Loading fulfillment detail…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-600">Failed to load order. It may not exist.</p>
          <button onClick={() => navigate('/fulfillment')} className="text-sm text-brand-600 hover:underline">
            ← Back to Fulfillment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3 max-w-6xl mx-auto">
          <button
            onClick={() => navigate('/fulfillment')}
            className="text-sm text-gray-500 hover:text-gray-700"
            aria-label="Back to fulfillment list"
          >
            ←
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-brand-700">
              Order <span className="font-mono text-base">{orderId.slice(0, 8)}…</span>
            </h1>
            <StatusBadge status={orderInfo?.status} />
          </div>
          <span className="ml-auto text-sm text-gray-400">
            {orderInfo?.customer?.companyName}
            {orderInfo?.confirmedAt && ` · confirmed ${new Date(orderInfo.confirmedAt).toLocaleDateString()}`}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Error banner ── */}
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600 text-base leading-none">×</button>
          </div>
        )}

        {/* ── Consolidation banner — real-time, not a manual refresh ── */}
        {showConsolidationBanner && (
          <div
            className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 flex items-start gap-4"
            role="alert"
          >
            <span className="mt-0.5 text-amber-500 text-lg" aria-hidden="true">📦</span>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-amber-800">
                Consolidate Remaining Backorder
              </p>
              <p className="text-sm text-amber-700">
                Restocked inventory is now sufficient to fulfil the backordered items below.
                Click to commit the split and resolve each backorder.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {openBackorders
                  .filter(bo => !bo.resolvedAt)
                  .map(bo => (
                    <button
                      key={bo.id}
                      onClick={() => consolidateMut.mutate(bo.id)}
                      disabled={consolidateMut.isPending}
                      className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {consolidateMut.isPending ? 'Working…' : `Consolidate — ${bo.product?.name ?? bo.productId} (${bo.qtyPending} units)`}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Split table ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">
              {isCommitted ? 'Committed Split' : 'Suggested Split (not yet committed)'}
            </h2>
            {!isSplitDone && (
              <div className="flex gap-2">
                <button
                  onClick={() => acceptMut.mutate()}
                  disabled={acceptMut.isPending || isCommitted}
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-40"
                >
                  {acceptMut.isPending ? 'Accepting…' : 'Accept Suggested Split'}
                </button>
                <button
                  onClick={() => setShowOverride(true)}
                  disabled={overrideMut.isPending}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
                >
                  Manual Override
                </button>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            {displaySplits.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-400">
                No stock available to suggest a split. All quantities will be backordered.
              </div>
            ) : (
              <>
                <table className="min-w-full divide-y divide-gray-200 text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Warehouse', 'Product', 'Qty Fulfilled', 'Est. Shipments', 'Cost'].map(h => (
                        <th
                          key={h}
                          className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
                            ['Qty Fulfilled','Est. Shipments','Cost'].includes(h) ? 'text-right' : ''
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {displaySplits.map((s, i) => (
                      <tr key={s.id ?? i} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                          {s.warehouse?.name ?? s.warehouseId?.slice(0, 8) ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                          {s.product?.name ?? s.productId?.slice(0, 8) ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right tabular-nums font-semibold">
                          {s.qtyFulfilled ?? s.qty}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right tabular-nums text-gray-500">
                          1
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-right tabular-nums">
                          {fmt(s.estimatedCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-500 text-right uppercase">
                        Total Estimated Cost
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-right tabular-nums font-bold text-gray-900">
                        {fmt(totalCost)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}
          </div>
        </section>

        {/* ── Open backorders ── */}
        {openBackorders.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Open Backorders</h2>
            <div className="overflow-hidden rounded-lg border border-red-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-left">
                <thead className="bg-red-50">
                  <tr>
                    {['Product', 'Qty Pending', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-red-600">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {openBackorders.map(bo => (
                    <tr key={bo.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                        {bo.product?.name ?? bo.productId}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-right tabular-nums font-semibold text-red-600">
                        {bo.qtyPending}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                          Awaiting Stock
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Order lines summary ── */}
        {lines.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Order Lines</h2>
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-left">
                <thead className="bg-gray-50">
                  <tr>
                    {['Product', 'Qty', 'Unit Price', 'Discount', 'Type'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                        {l.product?.name ?? l.productId}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums">{l.quantity}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums">{fmt(l.unitPrice)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums">{fmt(l.discountPercent)}%</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          l.lineType === 'RECURRING' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {l.lineType}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* ── Override modal ── */}
      {showOverride && (
        <OverrideModal
          suggested={suggestedSplit}
          warehouses={warehouses}
          orderLines={lines}
          loading={overrideMut.isPending}
          onConfirm={(body) => overrideMut.mutate(body)}
          onClose={() => setShowOverride(false)}
        />
      )}
    </div>
  );
}
