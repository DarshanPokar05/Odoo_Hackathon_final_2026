import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listWarehouses, setStock, adjustStock } from '../api/warehouses.js';
import { productsApi } from '../api/products.js';
import {
  PageHeader, Card, Btn, Field, Input, Select, Modal, Alert, Spinner, toast,
} from '../components/ui.jsx';

export default function StockManagementPage() {
  const qc = useQueryClient();
  const [showSetModal,    setShowSetModal]    = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedWh,      setSelectedWh]      = useState(null);
  const [actionError,     setActionError]     = useState('');

  const [setForm,    setSetForm]    = useState({ productId: '', onHand: '', reorderPoint: '5', reorderQty: '20' });
  const [adjForm,    setAdjForm]    = useState({ productId: '', delta: '', reason: '' });

  const { data: warehouses = [], isLoading: whLoad } = useQuery({
    queryKey: ['warehouses'],
    queryFn:  listWarehouses,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn:  () => productsApi.list(),
  });

  const physicalProducts = products.filter(p => !p.isSubscription);

  const setStockMutation = useMutation({
    mutationFn: (body) => setStock(selectedWh.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      setShowSetModal(false);
      setSetForm({ productId: '', onHand: '', reorderPoint: '5', reorderQty: '20' });
      toast('Stock set successfully', 'success');
    },
    onError: e => setActionError(e.response?.data?.error?.message ?? e.message),
  });

  const adjustMutation = useMutation({
    mutationFn: (body) => adjustStock(selectedWh.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      setShowAdjustModal(false);
      setAdjForm({ productId: '', delta: '', reason: '' });
      toast('Stock adjusted', 'success');
    },
    onError: e => setActionError(e.response?.data?.error?.message ?? e.message),
  });

  if (whLoad) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div>
      <PageHeader title="Stock Management" breadcrumb="Fulfillment / Stock" />

      {warehouses.map(wh => {
        const stocks = wh.stockLevels ?? [];
        return (
          <Card key={wh.id} className="p-5 mb-4">
            {/* Warehouse header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-[var(--text-primary)]">{wh.name}</h2>
                <p className="text-xs text-[var(--text-secondary)]">{wh.location ?? '—'} · Shipping weight: {Number(wh.shippingCostWeight).toFixed(1)}</p>
              </div>
              <div className="flex gap-2">
                <Btn
                  size="sm"
                  onClick={() => { setSelectedWh(wh); setActionError(''); setShowSetModal(true); }}
                >
                  Set Stock
                </Btn>
                <Btn
                  size="sm"
                  variant="secondary"
                  onClick={() => { setSelectedWh(wh); setActionError(''); setShowAdjustModal(true); }}
                >
                  + / − Adjust
                </Btn>
              </div>
            </div>

            {/* Stock table */}
            {stocks.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-4 text-center">
                No stock records for this warehouse. Use "Set Stock" to add inventory.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
                      {['Product', 'On Hand', 'Reserved', 'Available', 'Reorder Point', 'Reorder Qty'].map(h => (
                        <th key={h} className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stocks.map(sl => {
                      const available = sl.onHand - sl.reserved;
                      const low = available <= sl.reorderPoint && sl.reorderPoint > 0;
                      return (
                        <tr key={sl.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-alt)]">
                          <td className="px-3 py-2.5 font-medium text-[var(--text-primary)]">
                            {sl.product?.name ?? sl.productId}
                          </td>
                          <td className="px-3 py-2.5 font-mono-df tabular-nums">{sl.onHand}</td>
                          <td className="px-3 py-2.5 font-mono-df tabular-nums text-[var(--text-secondary)]">{sl.reserved}</td>
                          <td className={`px-3 py-2.5 font-mono-df tabular-nums font-semibold ${low ? 'text-red-600' : 'text-green-600'}`}>
                            {available}
                            {low && <span className="ml-1 text-xs">⚠ Low</span>}
                          </td>
                          <td className="px-3 py-2.5 font-mono-df tabular-nums text-[var(--text-secondary)]">{sl.reorderPoint}</td>
                          <td className="px-3 py-2.5 font-mono-df tabular-nums text-[var(--text-secondary)]">{sl.reorderQty}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}

      {/* Set Stock Modal */}
      <Modal open={showSetModal} onClose={() => setShowSetModal(false)} title={`Set Stock — ${selectedWh?.name}`}>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Set the absolute stock level for a product in this warehouse.
          This overwrites the current on-hand quantity.
        </p>
        {actionError && <Alert variant="error" className="mb-3">{actionError}</Alert>}
        <div className="space-y-3">
          <Field label="Product" required>
            <Select
              value={setForm.productId}
              onChange={e => setSetForm(f => ({ ...f, productId: e.target.value }))}
            >
              <option value="">Select a product…</option>
              {physicalProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="On Hand (units)" required>
              <Input
                type="number" min="0" value={setForm.onHand}
                onChange={e => setSetForm(f => ({ ...f, onHand: e.target.value }))}
                placeholder="e.g. 50"
              />
            </Field>
            <Field label="Reorder Point">
              <Input
                type="number" min="0" value={setForm.reorderPoint}
                onChange={e => setSetForm(f => ({ ...f, reorderPoint: e.target.value }))}
              />
            </Field>
            <Field label="Reorder Qty">
              <Input
                type="number" min="0" value={setForm.reorderQty}
                onChange={e => setSetForm(f => ({ ...f, reorderQty: e.target.value }))}
              />
            </Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="secondary" onClick={() => setShowSetModal(false)}>Cancel</Btn>
          <Btn
            disabled={setStockMutation.isPending || !setForm.productId || !setForm.onHand}
            onClick={() => setStockMutation.mutate({
              productId:    setForm.productId,
              onHand:       parseInt(setForm.onHand, 10),
              reorderPoint: parseInt(setForm.reorderPoint || '5', 10),
              reorderQty:   parseInt(setForm.reorderQty || '20', 10),
            })}
          >
            {setStockMutation.isPending ? 'Saving…' : 'Set Stock'}
          </Btn>
        </div>
      </Modal>

      {/* Adjust Stock Modal */}
      <Modal open={showAdjustModal} onClose={() => setShowAdjustModal(false)} title={`Adjust Stock — ${selectedWh?.name}`}>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Add or remove units. Use a positive number to add stock (restock/receipt),
          negative to remove (write-off/damage). Cannot go below reserved quantity.
        </p>
        {actionError && <Alert variant="error" className="mb-3">{actionError}</Alert>}
        <div className="space-y-3">
          <Field label="Product" required>
            <Select
              value={adjForm.productId}
              onChange={e => setAdjForm(f => ({ ...f, productId: e.target.value }))}
            >
              <option value="">Select a product…</option>
              {physicalProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Quantity Change" required>
            <Input
              type="number"
              value={adjForm.delta}
              onChange={e => setAdjForm(f => ({ ...f, delta: e.target.value }))}
              placeholder="e.g. +20 to add, -5 to remove"
            />
          </Field>
          <Field label="Reason" required>
            <Input
              value={adjForm.reason}
              onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Stock receipt, Damaged units written off"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="secondary" onClick={() => setShowAdjustModal(false)}>Cancel</Btn>
          <Btn
            disabled={adjustMutation.isPending || !adjForm.productId || !adjForm.delta || !adjForm.reason}
            onClick={() => adjustMutation.mutate({
              productId: adjForm.productId,
              delta:     parseInt(adjForm.delta, 10),
              reason:    adjForm.reason,
            })}
          >
            {adjustMutation.isPending ? 'Saving…' : 'Adjust Stock'}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
