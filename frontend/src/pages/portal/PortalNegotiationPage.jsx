import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portalApi }   from '../../api/portal.js';
import { useSocket }   from '../../hooks/useSocket.js';
import {
  PageHeader, Btn, Card, Field, Input, Textarea, Alert, Spinner,
  StageBadge, Badge, toast, useConfirm, Modal,
} from '../../components/ui.jsx';

function fmt(n) { return Number(n ?? 0).toFixed(2); }

// Status pill colours
const STATUS_PILL = {
  DRAFT:             'bg-slate-100  text-slate-600',
  PENDING_APPROVAL:  'bg-amber-100  text-amber-700',
  APPROVED:          'bg-blue-100   text-blue-700',
  UNDER_NEGOTIATION: 'bg-violet-100 text-violet-700',
  CONFIRMED:         'bg-green-100  text-green-700',
  REJECTED:          'bg-red-100    text-red-700',
};

export default function PortalNegotiationPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const qc           = useQueryClient();
  const socketRef    = useSocket();
  const { openConfirm, ConfirmModal } = useConfirm();

  const [msgText,   setMsgText]   = useState('');
  const [showCounter, setShowCounter] = useState(false);
  const [counterForm, setCounterForm] = useState({ lineId: '', requestedDiscount: '', message: '' });
  const [actionError, setActionError] = useState('');
  const msgEndRef = useRef(null);

  const { data: q, isLoading, error } = useQuery({
    queryKey: ['portal-quotation', id],
    queryFn:  () => portalApi.getQuotation(id),
    refetchOnWindowFocus: false,
  });

  // Auto-scroll messages
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [q?.negotiationMessages]);

  // Real-time: refresh when rep responds
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const refresh = payload => {
      if (payload.quotationId === id || payload.id === id) {
        qc.invalidateQueries({ queryKey: ['portal-quotation', id] });
        qc.invalidateQueries({ queryKey: ['portal-quotations'] });
      }
    };
    socket.on('QUOTATION_UPDATED',   refresh);
    socket.on('NEGOTIATION_MESSAGE', refresh);
    return () => {
      socket.off('QUOTATION_UPDATED',   refresh);
      socket.off('NEGOTIATION_MESSAGE', refresh);
    };
  }, [socketRef, id, qc]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const sendMsgMutation = useMutation({
    mutationFn: body => portalApi.postMessage(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-quotation', id] });
      setMsgText('');
    },
    onError: e => toast(e.response?.data?.error?.message ?? 'Failed to send', 'error'),
  });

  const counterMutation = useMutation({
    mutationFn: body => portalApi.counterDiscount(id, body),
    onSuccess: res => {
      qc.invalidateQueries({ queryKey: ['portal-quotation', id] });
      qc.invalidateQueries({ queryKey: ['portal-quotations'] });
      setShowCounter(false);
      const msg = res.needsNewApproval
        ? 'Counter-proposal submitted. The quotation has been sent back for approval.'
        : 'Counter-proposal submitted. Your representative will review it.';
      toast(msg, 'info');
    },
    onError: e => setActionError(e.response?.data?.error?.message ?? 'Counter-discount failed'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => portalApi.confirm(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-quotation', id] });
      qc.invalidateQueries({ queryKey: ['portal-quotations'] });
      toast('Quotation confirmed! Your order is being processed.', 'success');
    },
    onError: e => setActionError(e.response?.data?.error?.message ?? 'Confirmation failed'),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error)     return <Alert variant="error">Quotation not found or access denied.</Alert>;

  const lines    = q.lines ?? [];
  const messages = q.negotiationMessages ?? [];
  const total    = lines.reduce((s, l) => s + Number(l.unitPrice) * l.quantity * (1 - Number(l.discountPercent) / 100), 0);
  const canAct   = ['APPROVED', 'UNDER_NEGOTIATION'].includes(q.status);
  const isConfirmed = q.status === 'CONFIRMED';

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Quotation" breadcrumb="My Quotations / Detail">
        <Btn variant="secondary" size="sm" onClick={() => navigate('/portal')}>← Back</Btn>
      </PageHeader>

      {actionError && <Alert variant="error" className="mb-4">{actionError}</Alert>}

      {/* Status pill */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${STATUS_PILL[q.status] ?? ''}`}>
          {q.status?.replace(/_/g, ' ')}
        </span>
        <span className="text-sm text-[var(--text-secondary)] font-mono-df">#{id.slice(0, 8)}…</span>
        <span className="font-mono-df font-bold text-[var(--accent-solid)] text-lg ml-auto">${fmt(total)}</span>
      </div>

      {/* Footnote per wireframe */}
      {!isConfirmed && q.status === 'PENDING_APPROVAL' && (
        <Alert variant="info" className="mb-4">
          This quotation is currently under review. You will be notified once it is approved.
          If final terms exceed thresholds, the quote automatically re-enters approval.
        </Alert>
      )}
      {isConfirmed && (
        <Alert variant="success" className="mb-4">
          Your order is confirmed. Check your email for your invoice.
        </Alert>
      )}

      {/* Lines table */}
      <Card className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">Line Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
                {['Product', 'Qty', 'Unit Price', 'Discount', 'Total'].map(h => (
                  <th key={h} className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map(l => {
                const lineTotal = Number(l.unitPrice) * l.quantity * (1 - Number(l.discountPercent) / 100);
                return (
                  <tr key={l.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2.5 font-medium text-[var(--text-primary)]">{l.product?.name}</td>
                    <td className="px-3 py-2.5 tabular-nums">{l.quantity}</td>
                    <td className="px-3 py-2.5 font-mono-df tabular-nums">${fmt(l.unitPrice)}</td>
                    <td className="px-3 py-2.5 font-mono-df tabular-nums">{fmt(l.discountPercent)}%</td>
                    <td className="px-3 py-2.5 font-mono-df tabular-nums font-semibold">${fmt(lineTotal)}</td>
                  </tr>
                );
              })}
              <tr className="bg-[var(--surface-alt)] border-t border-[var(--border)]">
                <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase">Total</td>
                <td className="px-3 py-2.5 font-mono-df font-bold text-[var(--text-primary)]">${fmt(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Message thread */}
      <Card className="p-5 mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">Messages</h2>
        <div className="space-y-3 max-h-72 overflow-y-auto mb-3 pr-1">
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] italic">No messages yet. Use the field below to send a note to your representative.</p>
          ) : (
            messages.map(m => {
              const isCustomer = m.senderType === 'CUSTOMER';
              return (
                <div key={m.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    isCustomer
                      ? 'bg-[var(--accent-solid)] text-white rounded-br-none'
                      : 'bg-[var(--surface-alt)] text-[var(--text-primary)] rounded-bl-none'
                  }`}>
                    <p>{m.message}</p>
                    <p className={`text-[10px] mt-1 ${isCustomer ? 'text-white/70' : 'text-[var(--text-secondary)]'}`}>
                      {isCustomer ? 'You' : 'Rep'} · {new Date(m.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={msgEndRef} />
        </div>

        {/* Message input */}
        <div className="flex gap-2">
          <Textarea
            rows={2}
            value={msgText}
            onChange={e => setMsgText(e.target.value)}
            placeholder="Type a message to your rep…"
            className="flex-1"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && msgText.trim()) {
                e.preventDefault();
                sendMsgMutation.mutate({ message: msgText });
              }
            }}
          />
          <Btn
            className="self-end"
            disabled={sendMsgMutation.isPending || !msgText.trim()}
            onClick={() => sendMsgMutation.mutate({ message: msgText })}
          >
            Send
          </Btn>
        </div>
      </Card>

      {/* Action buttons — only when quotation is actionable */}
      {canAct && !isConfirmed && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">Your Actions</h2>
          <div className="flex gap-2 flex-wrap">
            <Btn variant="outline" onClick={() => setShowCounter(true)}>
              Override Discount %
            </Btn>
            <Btn
              onClick={() => openConfirm(
                'Confirm this quotation? This will lock the terms and initiate your order.',
                () => confirmMutation.mutate()
              )}
              disabled={confirmMutation.isPending}
            >
              {confirmMutation.isPending ? 'Confirming…' : 'Confirm Quotation'}
            </Btn>
          </div>
          <p className="text-xs text-[var(--text-secondary)] italic mt-3">
            If final terms exceed approval thresholds, the quote automatically re-enters approval.
          </p>
        </Card>
      )}

      {/* Counter-discount modal */}
      <Modal open={showCounter} onClose={() => setShowCounter(false)} title="Request Discount Override">
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Propose a different discount on a specific line. If the resulting risk score requires additional approval,
          the quotation will automatically re-enter the approval workflow.
        </p>
        <div className="space-y-3">
          <Field label="Line" required>
            <select
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]"
              value={counterForm.lineId}
              onChange={e => setCounterForm(f => ({ ...f, lineId: e.target.value }))}
            >
              <option value="">Select a product line…</option>
              {lines.map(l => (
                <option key={l.id} value={l.id}>
                  {l.product?.name} (current: {fmt(l.discountPercent)}%)
                </option>
              ))}
            </select>
          </Field>
          <Field label="Requested Discount %" required>
            <Input
              type="number" min="0" max="100" step="0.1"
              value={counterForm.requestedDiscount}
              onChange={e => setCounterForm(f => ({ ...f, requestedDiscount: e.target.value }))}
              placeholder="e.g. 20"
            />
          </Field>
          <Field label="Message (optional)">
            <Textarea
              rows={2}
              value={counterForm.message}
              onChange={e => setCounterForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Reason for the discount request…"
            />
          </Field>
        </div>
        {actionError && <Alert variant="error" className="mt-3">{actionError}</Alert>}
        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="secondary" onClick={() => setShowCounter(false)}>Cancel</Btn>
          <Btn
            disabled={counterMutation.isPending || !counterForm.lineId || !counterForm.requestedDiscount}
            onClick={() => counterMutation.mutate({
              lineId:            counterForm.lineId,
              requestedDiscount: parseFloat(counterForm.requestedDiscount),
              message:           counterForm.message || undefined,
            })}
          >
            {counterMutation.isPending ? 'Submitting…' : 'Submit Request'}
          </Btn>
        </div>
      </Modal>

      {ConfirmModal}
    </div>
  );
}
