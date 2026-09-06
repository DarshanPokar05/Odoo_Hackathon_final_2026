import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationsApi } from '../api/quotations.js';
import { customersApi }  from '../api/customers.js';
import { productsApi }   from '../api/products.js';
import { useSocket }     from '../hooks/useSocket.js';
import { toast, useConfirm, PageHeader, Btn, Card, Field, Input, Select, StageBadge,
         RiskScoreBadge, Alert, Spinner, FlowMeter, Badge, Modal } from '../components/ui.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n, decimals = 2) {
  return typeof n === 'number' || (n !== undefined && n !== null)
    ? Number(n).toFixed(decimals)
    : '0.00';
}

function lineTotal(l) {
  const base = Number(l.unitPrice) * l.quantity;
  return base * (1 - Number(l.discountPercent) / 100);
}

function quoteTotal(lines = []) {
  return lines.reduce((s, l) => s + lineTotal(l), 0);
}

const PIPELINE_STEPS = ['Draft', 'Submitted', 'Approval', 'Confirmed'];

const STAGE_TO_STEP = {
  DRAFT:             'Draft',
  PENDING_APPROVAL:  'Approval',
  APPROVED:          'Approval',
  UNDER_NEGOTIATION: 'Approval',
  CONFIRMED:         'Confirmed',
  REJECTED:          'Confirmed',
};

// ── Line row ──────────────────────────────────────────────────────────────────
function LineRow({ line, onUpdate, onRemove, tierCeiling, editable }) {
  const [discount, setDiscount] = useState(String(line.discountPercent));

  // Compute live ceiling/OVER status from the snapshot (always from server)
  const effectiveCeiling = Number(line.effectiveCeilingSnapshot ?? 0);
  const ptsOver          = Number(line.pointsOverSnapshot ?? 0);
  const isOver           = ptsOver > 0;

  // Allow local preview before server round-trip
  const liveDiscount     = parseFloat(discount) || 0;
  const localCeiling     = effectiveCeiling;
  const localOver        = Math.max(0, liveDiscount - localCeiling);

  // Use local preview for UI feedback, server snapshot for submitted values
  const displayOver  = localOver > 0;
  const displayOk    = !displayOver;

  const handleDiscountBlur = () => {
    if (!editable) return;
    const d = parseFloat(discount) || 0;
    if (d !== Number(line.discountPercent)) {
      onUpdate(line.id, { discountPercent: d });
    }
  };

  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--surface-alt)] transition-colors">
      <td className="px-3 py-2.5 text-sm font-medium text-[var(--text-primary)]">
        <div>{line.product?.name ?? line.productId}</div>
        <div className="text-xs text-[var(--text-secondary)]">{line.product?.category?.name}</div>
      </td>
      <td className="px-3 py-2.5 text-sm text-right tabular-nums">{line.quantity}</td>
      <td className="px-3 py-2.5 text-sm text-right tabular-nums font-mono-df">${fmt(line.unitPrice)}</td>
      <td className="px-3 py-2.5 w-28">
        {editable ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              onBlur={handleDiscountBlur}
              className="!w-16 text-right py-1"
            />
            <span className="text-xs text-[var(--text-secondary)]">%</span>
          </div>
        ) : (
          <span className="text-sm tabular-nums font-mono-df">{fmt(line.discountPercent)}%</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)] text-center">
        {fmt(effectiveCeiling)}%
      </td>
      <td className="px-3 py-2.5 text-center">
        {/* Live OVER/OK status — updates as the rep types, before submit */}
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${
            displayOver
              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
              : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
          }`}
          aria-label={displayOver ? `Discount exceeds limit by ${localOver.toFixed(1)}%` : 'Within discount limit'}
        >
          {displayOver ? `OVER +${localOver.toFixed(1)}%` : 'OK'}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums font-mono-df text-sm">
        ${fmt(lineTotal(line))}
      </td>
      {editable && (
        <td className="px-3 py-2.5 text-center">
          <button
            onClick={() => onRemove(line.id)}
            className="text-red-400 hover:text-red-600 text-base leading-none"
            aria-label="Remove line"
          >
            ×
          </button>
        </td>
      )}
    </tr>
  );
}

// ── Upsell Panel ──────────────────────────────────────────────────────────────
function UpsellPanel({ quotationId, onAddToQuote, disabled }) {
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['upsell', quotationId],
    queryFn:  () => quotationsApi.getSuggestions(quotationId),
    enabled:  !!quotationId,
  });

  const [dismissed, setDismissed] = useState(new Set());

  const visible = suggestions.filter((s) => !dismissed.has(s.productId));

  if (isLoading) return <div className="py-4 text-center text-xs text-[var(--text-secondary)]">Loading suggestions…</div>;
  if (!visible.length) return (
    <div className="py-6 text-center text-xs text-[var(--text-secondary)]">
      No upsell suggestions for current cart items.
    </div>
  );

  return (
    <div className="space-y-2">
      {visible.map((s) => (
        <div
          key={s.productId}
          className="surface rounded-lg p-3 flex items-center justify-between gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium text-[var(--text-primary)] line-clamp-1">{s.productName}</span>
              {s.isPromoted && (
                <span className="shrink-0 text-xs font-semibold bg-[var(--accent-solid)] text-white px-1.5 py-0.5 rounded-full">
                  ★ Promoted
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              +${Number(s.marginDelta).toFixed(2)} margin · {s.category?.name}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Btn
              size="sm"
              disabled={disabled}
              onClick={() => onAddToQuote(s)}
            >
              Add
            </Btn>
            <Btn
              size="sm"
              variant="ghost"
              onClick={() => setDismissed((d) => new Set([...d, s.productId]))}
            >
              ✕
            </Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Add Line Modal ────────────────────────────────────────────────────────────
function AddLineModal({ open, onClose, onAdd, products, loading }) {
  const [form, setForm] = useState({
    productId: '', quantity: '1', unitPrice: '', discountPercent: '0', lineType: 'ONE_TIME',
  });

  const selectedProduct = products.find((p) => p.id === form.productId);

  // Auto-fill unit price when product changes
  useEffect(() => {
    if (selectedProduct) {
      setForm((f) => ({ ...f, unitPrice: String(selectedProduct.price) }));
    }
  }, [selectedProduct]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd({
      productId:       form.productId,
      quantity:        parseInt(form.quantity, 10),
      unitPrice:       parseFloat(form.unitPrice),
      discountPercent: parseFloat(form.discountPercent) || 0,
      lineType:        form.lineType,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Product Line" width="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Product" required>
          <Select
            required
            value={form.productId}
            onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
          >
            <option value="">Select a product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — ${Number(p.price).toFixed(2)}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" required>
            <Input
              type="number" min="1" required value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
          </Field>
          <Field label="Unit Price ($)" required>
            <Input
              type="number" min="0" step="0.01" required value={form.unitPrice}
              onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
            />
          </Field>
          <Field label="Discount %">
            <Input
              type="number" min="0" max="100" step="0.1" value={form.discountPercent}
              onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
            />
          </Field>
          <Field label="Type">
            <Select
              value={form.lineType}
              onChange={(e) => setForm((f) => ({ ...f, lineType: e.target.value }))}
            >
              <option value="ONE_TIME">One-time</option>
              <option value="RECURRING">Recurring</option>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Btn variant="secondary" type="button" onClick={onClose}>Cancel</Btn>
          <Btn type="submit" disabled={loading || !form.productId}>
            {loading ? 'Adding…' : 'Add Line'}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QuotationDetailPage() {
  const { id }          = useParams();
  const isNew           = id === 'new';
  const navigate        = useNavigate();
  const queryClient     = useQueryClient();
  const socketRef       = useSocket();
  const { openConfirm, ConfirmModal } = useConfirm();

  const [showAddLine, setShowAddLine] = useState(false);
  const [actionError, setActionError] = useState('');

  // Create quotation state (for the new-quotation form)
  const [createForm, setCreateForm] = useState({ customerId: '' });

  // ── Data queries ─────────────────────────────────────────────────────────
  const { data: quotation, isLoading, error } = useQuery({
    queryKey: ['quotation', id],
    queryFn:  () => quotationsApi.getOne(id),
    enabled:  !isNew,   // never fire for id === 'new'
    retry:    false,    // don't retry 404s
    refetchOnWindowFocus: false,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn:  () => customersApi.list(),
    enabled:  isNew,
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn:  () => productsApi.list(),
  });

  // ── Real-time: refresh quotation detail on socket event ───────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || isNew) return;

    const onUpdate = (payload) => {
      if (payload.quotationId === id) {
        queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      }
    };

    socket.on('QUOTATION_UPDATED',   onUpdate);
    socket.on('NEGOTIATION_MESSAGE', onUpdate);

    return () => {
      socket.off('QUOTATION_UPDATED',   onUpdate);
      socket.off('NEGOTIATION_MESSAGE', onUpdate);
    };
  }, [socketRef, id, isNew, queryClient]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (body) => quotationsApi.create(body),
    onSuccess:  (q) => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast('Quotation created', 'success');
      navigate(`/quotations/${q.id}`, { replace: true });
    },
    onError: (e) => setActionError(e.response?.data?.error?.message ?? e.message),
  });

  const addLineMutation = useMutation({
    mutationFn: (body) => quotationsApi.addLine(id, body),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['upsell', id] });
      setShowAddLine(false);
      toast('Line added', 'success');
    },
    onError: (e) => toast(e.response?.data?.error?.message ?? 'Failed to add line', 'error'),
  });

  const updateLineMutation = useMutation({
    mutationFn: ({ lineId, body }) => quotationsApi.updateLine(id, lineId, body),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['quotation', id] }),
    onError:    (e) => toast(e.response?.data?.error?.message ?? 'Failed to update line', 'error'),
  });

  const removeLineMutation = useMutation({
    mutationFn: (lineId) => quotationsApi.removeLine(id, lineId),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['upsell', id] });
      toast('Line removed', 'info');
    },
    onError: (e) => toast(e.response?.data?.error?.message ?? 'Failed to remove line', 'error'),
  });

  const submitMutation = useMutation({
    mutationFn: () => quotationsApi.submit(id),
    onSuccess:  (q) => {
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast(
        q.status === 'CONFIRMED'
          ? 'Quotation auto-confirmed — no approval required!'
          : 'Quotation submitted for approval',
        'success',
      );
    },
    onError: (e) => setActionError(e.response?.data?.error?.message ?? 'Submit failed'),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleAddLine    = (body) => addLineMutation.mutate(body);
  const handleUpdateLine = (lineId, body) => updateLineMutation.mutate({ lineId, body });
  const handleRemoveLine = (lineId) => {
    openConfirm('Remove this line from the quotation?', () => removeLineMutation.mutate(lineId));
  };

  // Add upsell suggestion to cart (same path as manual add — triggers score recompute)
  const handleAddUpsell  = (suggestion) => {
    addLineMutation.mutate({
      productId:       suggestion.productId,
      quantity:        1,
      unitPrice:       suggestion.basePrice,
      discountPercent: 0,
      lineType:        suggestion.isSubscription ? 'RECURRING' : 'ONE_TIME',
    });
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const lines       = quotation?.lines ?? [];
  const total       = quoteTotal(lines);
  const score       = Number(quotation?.blendedRiskScore ?? 0);
  const editable    = !isNew && quotation?.status === 'DRAFT';
  const activeStep  = STAGE_TO_STEP[quotation?.status] ?? 'Draft';

  // ── New quotation form — rendered FIRST before any isLoading/error checks ─
  if (isNew) {
    return (
      <div className="max-w-lg mx-auto">
        <PageHeader title="New Quotation" breadcrumb="Quotations / New">
          <Btn variant="secondary" onClick={() => navigate('/quotations')}>← Back</Btn>
        </PageHeader>
        {actionError && <Alert variant="error" className="mb-4">{actionError}</Alert>}
        <Card className="p-5">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(createForm); }} className="space-y-4">
            <Field label="Customer" required>
              <Select
                required
                value={createForm.customerId}
                onChange={(e) => setCreateForm({ ...createForm, customerId: e.target.value })}
              >
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName} ({c.tier})</option>
                ))}
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <Btn variant="secondary" type="button" onClick={() => navigate('/quotations')}>Cancel</Btn>
              <Btn type="submit" disabled={createMutation.isPending || !createForm.customerId}>
                {createMutation.isPending ? 'Creating…' : 'Create Draft'}
              </Btn>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  if (!isNew && isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!isNew && error)     return <Alert variant="error">Failed to load quotation: {error.message}</Alert>;

  return (
    <div>
      <PageHeader
        title={`Quotation — ${quotation.customer?.companyName ?? '…'}`}
        breadcrumb="Quotations / Detail"
      >
        <StageBadge status={quotation.status} />
        <RiskScoreBadge score={score} />
        <Btn variant="secondary" size="sm" onClick={() => navigate('/quotations')}>← Back</Btn>
      </PageHeader>

      {actionError && <Alert variant="error" className="mb-4">{actionError}</Alert>}

      {/* Pipeline stepper */}
      <Card className="p-4 mb-4">
        <FlowMeter
          steps={PIPELINE_STEPS}
          activeStep={activeStep}
          danger={score > 0}
        />
      </Card>

      <div className="flex flex-col xl:flex-row gap-4">
        {/* ── Main builder column ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <Card className="p-5">
            {/* Customer + tier info */}
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div>
                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Customer</p>
                <p className="font-semibold text-[var(--text-primary)]">{quotation.customer?.companyName}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Tier</p>
                <p className="font-semibold text-[var(--text-primary)]">{quotation.customer?.tier}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Rep</p>
                <p className="font-semibold text-[var(--text-primary)]">{quotation.repId?.slice(0, 8)}…</p>
              </div>
            </div>

            {/* Line table */}
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
                    {['Product', 'Qty', 'Unit Price', 'Discount', 'Limit', 'Status', 'Total', editable ? '' : null]
                      .filter(Boolean)
                      .map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-[var(--text-secondary)] text-sm">
                        No lines yet. Add a product to get started.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line) => (
                      <LineRow
                        key={line.id}
                        line={line}
                        editable={editable}
                        onUpdate={handleUpdateLine}
                        onRemove={handleRemoveLine}
                      />
                    ))
                  )}
                </tbody>
                {lines.length > 0 && (
                  <tfoot className="bg-[var(--surface-alt)] border-t border-[var(--border)]">
                    <tr>
                      <td colSpan={editable ? 6 : 5} className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase">
                        Quotation Total
                      </td>
                      <td className="px-3 py-3 text-right font-mono-df font-bold text-[var(--text-primary)]">
                        ${fmt(total)}
                      </td>
                      {editable && <td />}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Footnote (per wireframe) */}
            <p className="text-xs text-[var(--text-secondary)] italic mt-3">
              Discount is checked against the line&apos;s own limit as soon as it is entered, not only at submit time.
            </p>

            {/* Action buttons */}
            {editable && (
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                <Btn variant="secondary" onClick={() => setShowAddLine(true)}>+ Add Product</Btn>
                <div className="ml-auto flex gap-2">
                  <Btn
                    variant="secondary"
                    disabled={submitMutation.isPending}
                    onClick={() => quotationsApi.saveDraft(id, {}).then(() => toast('Draft saved', 'success'))}
                  >
                    Save Draft
                  </Btn>
                  <Btn
                    disabled={lines.length === 0 || submitMutation.isPending}
                    onClick={() => openConfirm('Submit this quotation for approval? This will lock the lines.', () => submitMutation.mutate())}
                  >
                    {submitMutation.isPending ? 'Submitting…' : 'Submit for Approval'}
                  </Btn>
                </div>
              </div>
            )}

            {/* Submitted/confirmed state CTA */}
            {quotation.status === 'PENDING_APPROVAL' && (
              <Alert variant="info" className="mt-4">
                This quotation is awaiting approval. The approval team has been notified.
              </Alert>
            )}
            {quotation.status === 'CONFIRMED' && (
              <Alert variant="success" className="mt-4">
                Quotation confirmed. Fulfillment has been initiated.
              </Alert>
            )}
            {quotation.status === 'REJECTED' && (
              <Alert variant="error" className="mt-4">
                This quotation was rejected. Check the approval trail for details.
              </Alert>
            )}
          </Card>

          {/* Approval steps (if any) */}
          {quotation.approvalSteps?.length > 0 && (
            <Card className="p-5 mt-4">
              <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
                Approval Chain
              </h2>
              <div className="space-y-2">
                {quotation.approvalSteps.map((step) => (
                  <div key={step.id} className="flex items-center gap-3 text-sm">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      step.status === 'APPROVED'  ? 'bg-green-500 text-white' :
                      step.status === 'REJECTED'  ? 'bg-red-500 text-white' :
                      step.status === 'RETURNED'  ? 'bg-amber-500 text-white' :
                      'bg-[var(--border)] text-[var(--text-secondary)]'
                    }`}>{step.order}</span>
                    <span className="text-[var(--text-primary)] font-medium">
                      {step.level.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      step.status === 'APPROVED'  ? 'bg-green-100 text-green-700' :
                      step.status === 'REJECTED'  ? 'bg-red-100 text-red-700' :
                      step.status === 'RETURNED'  ? 'bg-amber-100 text-amber-700' :
                      'bg-[var(--surface-alt)] text-[var(--text-secondary)]'
                    }`}>{step.status}</span>
                    {step.reason && (
                      <span className="text-xs text-[var(--text-secondary)] truncate max-w-xs">
                        "{step.reason}"
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* ── Upsell/Cross-sell panel ──────────────────────────────────── */}
        <div className="w-full xl:w-72 shrink-0">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
              Upsell & Cross-Sell
            </h2>
            <UpsellPanel
              quotationId={!isNew ? id : null}
              onAddToQuote={handleAddUpsell}
              disabled={!editable || addLineMutation.isPending}
            />
          </Card>
        </div>
      </div>

      {/* Modals */}
      <AddLineModal
        open={showAddLine}
        onClose={() => setShowAddLine(false)}
        onAdd={handleAddLine}
        products={products}
        loading={addLineMutation.isPending}
      />

      {ConfirmModal}
    </div>
  );
}
