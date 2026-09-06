import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '../api/subscriptions.js';
import {
  PageHeader, Btn, Card, Field, Textarea, Alert, Spinner,
  Badge, Modal, Input, toast, useConfirm,
} from '../components/ui.jsx';

function fmt(n) { return Number(n ?? 0).toFixed(2); }

const STATUS_BADGE = {
  ACTIVE:    'bg-green-100  text-green-700',
  PAUSED:    'bg-amber-100  text-amber-700',
  CANCELLED: 'bg-slate-100  text-slate-600',
};

export default function BillingDetailPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const { openConfirm, ConfirmModal } = useConfirm();

  const [showModify,   setShowModify]   = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [modifyForm,   setModifyForm]   = useState({ quantity: '', planId: '' });
  const [actionError,  setActionError]  = useState('');

  const { data: sub, isLoading, error } = useQuery({
    queryKey: ['subscription', id],
    queryFn:  () => subscriptionsApi.getOne(id),
  });

  const modifyMutation = useMutation({
    mutationFn: body => subscriptionsApi.modify(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', id] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setShowModify(false);
      toast('Subscription modified — proration applied', 'success');
    },
    onError: e => setActionError(e.response?.data?.error?.message ?? e.message),
  });

  const cancelMutation = useMutation({
    mutationFn: body => subscriptionsApi.cancel(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', id] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast('Subscription cancelled', 'info');
      navigate('/subscriptions');
    },
    onError: e => setActionError(e.response?.data?.error?.message ?? e.message),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error)     return <Alert variant="error">Failed to load: {error.message}</Alert>;

  const customer   = sub.order?.quotation?.customer;
  const product    = sub.plan?.product;
  const monthly    = Number(product?.price ?? 0) * sub.quantity;
  const isActive   = sub.status === 'ACTIVE';

  // Split the order's quotation lines into one-time vs recurring
  // (loaded separately; for this page we show what we have from the sub)

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Billing Detail" breadcrumb="Subscriptions / Detail">
        <Btn variant="secondary" size="sm" onClick={() => navigate('/subscriptions')}>← Back</Btn>
      </PageHeader>

      {actionError && <Alert variant="error" className="mb-4">{actionError}</Alert>}

      {/* Sub summary */}
      <Card className="p-5 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-lg font-display font-semibold text-[var(--text-primary)]">
              {sub.plan?.name ?? '—'}
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {customer?.companyName ?? '—'}
            </p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_BADGE[sub.status] ?? ''}`}>
            {sub.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Product</p>
            <p className="font-medium text-[var(--text-primary)]">{product?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Interval</p>
            <p className="font-medium text-[var(--text-primary)]">{sub.plan?.interval ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Quantity</p>
            <p className="font-mono-df font-bold text-[var(--text-primary)]">{sub.quantity}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Monthly</p>
            <p className="font-mono-df font-bold text-[var(--accent-solid)]">${fmt(monthly)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Cycle Start</p>
            <p className="font-medium text-[var(--text-primary)]">
              {sub.cycleStartDate ? new Date(sub.cycleStartDate).toLocaleDateString() : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Next Bill</p>
            <p className="font-medium text-[var(--text-primary)]">
              {sub.nextBillDate ? new Date(sub.nextBillDate).toLocaleDateString() : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Cancellation Rule</p>
            <p className="text-sm text-[var(--text-secondary)]">
              {sub.plan?.cancellationRule?.replace(/_/g, ' ') ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Proration Rule</p>
            <p className="text-sm text-[var(--text-secondary)]">
              {sub.plan?.prorationRule?.replace(/_/g, ' ') ?? '—'}
            </p>
          </div>
        </div>
      </Card>

      {/* Actions */}
      {isActive && (
        <div className="flex gap-2 mb-4">
          <Btn onClick={() => setShowModify(true)}>Modify Subscription</Btn>
          <Btn
            variant="danger"
            onClick={() => {
              if (!cancelReason.trim()) {
                toast('Enter a cancellation reason below first', 'warning');
                return;
              }
              openConfirm(
                `Cancel this subscription? The plan's cancellation rule (${sub.plan?.cancellationRule}) will be applied.`,
                () => cancelMutation.mutate({ reason: cancelReason })
              );
            }}
            disabled={cancelMutation.isPending}
          >
            Cancel Subscription
          </Btn>
        </div>
      )}

      {/* Cancel reason field (always visible if active) */}
      {isActive && (
        <Card className="p-4 mb-4">
          <Field label="Cancellation reason (required before cancelling)">
            <Textarea
              rows={2}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation…"
            />
          </Field>
        </Card>
      )}

      {/* Modify modal */}
      <Modal open={showModify} onClose={() => setShowModify(false)} title="Modify Subscription">
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Mid-cycle changes are prorated automatically.
          A positive proration creates an additional invoice; a decrease creates a credit note.
        </p>
        <div className="space-y-3">
          <Field label="New Quantity">
            <Input
              type="number" min="1"
              value={modifyForm.quantity}
              placeholder={`Current: ${sub.quantity}`}
              onChange={e => setModifyForm(f => ({ ...f, quantity: e.target.value }))}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="secondary" onClick={() => setShowModify(false)}>Cancel</Btn>
          <Btn
            disabled={modifyMutation.isPending || !modifyForm.quantity}
            onClick={() => modifyMutation.mutate({ quantity: parseInt(modifyForm.quantity, 10) })}
          >
            {modifyMutation.isPending ? 'Applying…' : 'Apply & Prorate'}
          </Btn>
        </div>
      </Modal>

      {ConfirmModal}
    </div>
  );
}
