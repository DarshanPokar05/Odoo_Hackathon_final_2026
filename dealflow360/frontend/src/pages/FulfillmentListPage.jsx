import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listWarehouses }       from '../api/warehouses';
import { listFulfillmentOrders } from '../api/fulfillment';
import { useSocket }            from '../hooks/useSocket';
import { PageHeader, Card, LiveDot, Spinner, Alert } from '../components/ui.jsx';

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  PENDING_FULFILLMENT: 'bg-yellow-100 text-yellow-800',
  SPLIT_PENDING:       'bg-blue-100   text-blue-800',
  SPLIT_ACCEPTED:      'bg-green-100  text-green-800',
  BACKORDERED:         'bg-red-100    text-red-800',
  PARTIALLY_FULFILLED: 'bg-orange-100 text-orange-800',
};

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700';
  const label = status === 'PENDING_FULFILLMENT' ? 'Split Pending'
              : status === 'BACKORDERED'          ? 'Backorder'
              : status?.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ── Stock row with live pulse ─────────────────────────────────────────────────
function StockRow({ row, liveOverrides }) {
  const live      = liveOverrides[`${row.warehouseId}:${row.productId}`];
  const onHand    = live?.onHand    ?? row.onHand;
  const reserved  = live?.reserved  ?? row.reserved;
  const available = live?.available ?? (onHand - reserved);
  const lowStock  = available <= row.reorderPoint && row.reorderPoint > 0;

  return (
    <tr className="hover:bg-[var(--surface-alt)]">
      <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-primary)]">{row.warehouse?.name ?? '—'}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-[var(--text-primary)]">{row.product?.name  ?? '—'}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-right tabular-nums font-mono-df">{onHand}</td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-right tabular-nums font-mono-df text-[var(--text-secondary)]">{reserved}</td>
      <td className={`whitespace-nowrap px-4 py-3 text-sm text-right tabular-nums font-mono-df font-semibold ${lowStock ? 'text-red-600' : 'text-green-600'}`}>
        {available}
        {lowStock && <span className="ml-1 text-xs text-red-400" title="Below reorder point">⚠</span>}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FulfillmentListPage() {
  const navigate   = useNavigate();
  const qc         = useQueryClient();
  const socketRef  = useSocket();
  const [liveStock, setLiveStock] = useState({});

  const { data: warehouses = [], isLoading: whLoading, isError: whError } =
    useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });

  const { data: orders = [], isLoading: ordLoading, isError: ordError } =
    useQuery({ queryKey: ['fulfillment-orders'], queryFn: listFulfillmentOrders });

  // Socket.io live stock updates
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onStockUpdated = payload => {
      setLiveStock(prev => ({
        ...prev,
        [`${payload.warehouseId}:${payload.productId}`]: {
          onHand: payload.onHand, reserved: payload.reserved, available: payload.available,
        },
      }));
    };
    const onFulfillmentUpdated = () => {
      qc.invalidateQueries({ queryKey: ['fulfillment-orders'] });
    };

    socket.on('STOCK_UPDATED',       onStockUpdated);
    socket.on('FULFILLMENT_UPDATED', onFulfillmentUpdated);
    return () => {
      socket.off('STOCK_UPDATED',       onStockUpdated);
      socket.off('FULFILLMENT_UPDATED', onFulfillmentUpdated);
    };
  }, [socketRef, qc]);

  const stockRows = warehouses.flatMap(wh =>
    (wh.stockLevels ?? []).map(sl => ({
      ...sl,
      warehouseId: wh.id,
      warehouse:   { name: wh.name },
    }))
  );

  const isLoading = whLoading || ordLoading;
  const isError   = whError   || ordError;

  return (
    <div>
      <PageHeader title="Fulfillment" breadcrumb="Warehouse &amp; Orders">
        <Btn variant="secondary" size="sm" onClick={() => navigate('/fulfillment/stock')}>
          Manage Stock
        </Btn>
        <LiveDot />
      </PageHeader>

      {isError && (
        <Alert variant="error" className="mb-4">Failed to load fulfillment data. Please refresh.</Alert>
      )}

      {/* Per-warehouse live stock table */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
          Warehouse Stock
        </h2>
        <Card>
          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : stockRows.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-[var(--text-secondary)]">
              No stock records found. Add warehouses and set stock levels.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
                    {['Warehouse', 'Product', 'In Stock', 'Reserved', 'Available'].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] ${
                        ['In Stock','Reserved','Available'].includes(h) ? 'text-right' : 'text-left'
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {stockRows.map(row => (
                    <StockRow
                      key={`${row.warehouseId}:${row.productId}`}
                      row={row}
                      liveOverrides={liveStock}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* Orders awaiting fulfillment */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
          Orders Awaiting Fulfillment
        </h2>
        <Card>
          {isLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : orders.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-[var(--text-secondary)]">
              No orders awaiting fulfillment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
                    {['Order', 'Customer', 'Status', 'Warehouse(s)', 'Confirmed'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {orders.map(order => {
                    const whNames = [...new Set(
                      (order.fulfillmentSplits ?? []).map(s => s.warehouse?.name).filter(Boolean)
                    )].join(', ') || '—';
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-[var(--surface-alt)] cursor-pointer"
                        onClick={() => navigate(`/fulfillment/${order.id}`)}
                      >
                        <td className="px-4 py-3 font-mono-df text-xs text-[var(--accent-solid)]">
                          {order.id.slice(0, 8)}…
                        </td>
                        <td className="px-4 py-3 text-[var(--text-primary)]">
                          {order.quotation?.customer?.companyName ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)] text-sm">{whNames}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)] text-sm">
                          {new Date(order.confirmedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
