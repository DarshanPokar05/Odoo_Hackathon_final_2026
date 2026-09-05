import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { approvalsApi } from '../api/approvals.js';
import { useSocket }    from '../hooks/useSocket.js';
import {
  PageHeader, Btn, Card, Field, Textarea, Alert, Spinner,
  FlowMeter, RiskScoreBadge, Badge, StageBadge, toast, useConfirm, Table,
} from '../components/ui.jsx';

// Approval chain steps (for the FlowMeter step tracker)
const APPROVAL_STEPS = ['Submitted', 'Sales Manager', 'Finance', 'Confirmed'];

function stepLabel(level) {
  if (level === 'SALES_MANAGER') return 'Sales Manager';
  if (level === 'FINANCE')       return 'Finance';
  return level;
}

function activeStepFromStep(step) {
  // Map the step's level and status to the FlowMeter step label
  if (!step) return 'Submitted';
  if (step.status === 'APPROVED' && step.level === 'SALES_MANAGER') {
    // SM approved — did Finance step exist?
    const all = step.quotation?.approvalSteps ?? [];
    const financeStep = all.find((s) => s.level === 'FINANCE');
    if (financeStep) return 'Finance';
    return 'Confirmed';
  }
  if (step.status === 'APPROVED' && step.level === 'FINANCE') return 'Confirmed';
  if (step.level === 'SALES_MANAGER') return 'Sales Manager';
  if (step.level === 'FINANCE')       return 'Finance';
  return 'Submitted';
}

// Audit log columns (from ActivityLog)
const AUDIT_COLS = [
  { key: 'user',    label: 'User',   render: (r) => <span className="font-mono-df text-xs">{r.userId?.slice(0, 8) ?? 'SYSTEM'}…</span> },
  { key: 'action',  label: 'Action', render: (r) => <span className="text-xs font-medium">{r.action?.replace(/_/g, ' ')}</span> },
  { key: 'date',    label: 'Date',   render: (r) => <span className="text-xs text-[var(--text-secondary)]">{new Date(r.createdAt).toLocaleString()}</span> },
  { key: 'details', label: 'Note',   render: (r) => (
    <span className="text-xs text-[var(--text-secondary)] truncate max-w-xs block">
      {r.details?.reason ?? JSON.stringify(r.details ?? '') }
    </span>
  )},
];

export default function ApprovalDetailPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const socketRef    = useSocket();
  const { openConfirm, ConfirmModal } = useConfirm();

  const [reason, setReason]       = useState('');
  const [reasonError, setReasonError] = useState('');
  const [actionError, setActionError] = useState('');

  const { data: step, isLoading, error } = useQuery({
    queryKey: ['approval', id],
    queryFn:  () => approvalsApi.getOne(id),
    refetchOnWindowFocus: false,
  });

  // Real-time: reload when quotation status changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['approval', id] });
    socket.on('QUOTATION_UPDATED', refresh);
    return () => socket.off('QUOTATION_UPDATED', refresh);
  }, [socketRef, id, queryClient]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const makeAction = (fn, successMsg) =>
    useMutation({
      mutationFn: (body) => fn(id, body),
      onSuccess:  () => {
        queryClient.invalidateQueries({ queryKey: ['approval', id] });
        queryClient.invalidateQueries({ queryKey: ['approvals'] });
        queryClient.invalidateQueries({ queryKey: ['quotations'] });
        toast(successMsg, 'success');
        navigate('/approvals');
      },
      onError: (e) => {
        setActionError(e.response?.data?.error?.message ?? e.message);
      },
    });

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const approveMutation = makeAction(approvalsApi.approve,           'Quotation approved');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const rejectMutation  = makeAction(approvalsApi.reject,            'Quotation rejected');
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const returnMutation  = makeAction(approvalsApi.returnForRevision, 'Returned for revision');

  const validateAndAct = (fn, confirmMessage) => {
    if (!reason.trim()) {
      setReasonError('A reason is required for every approval action.');
      return;
    }
    setReasonError('');
    openConfirm(confirmMessage, () => fn.mutate({ reason }));
  };

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error)     return <Alert variant="error">Failed to load approval step: {error.message}</Alert>;

  const quotation   = step.quotation;
  const lines       = quotation?.lines ?? [];
  const allSteps    = quotation?.approvalSteps ?? [];
  const blended     = Number(quotation?.blendedRiskScore ?? 0);
  const tier        = quotation?.customer?.tier ?? '—';
  const activeStep  = activeStepFromStep(step);
  const isPending   = step.status === 'PENDING';

  // "Why This Quote Was Flagged" table — lines with pointsOver > 0
  const flaggedLines = lines.filter((l) => Number(l.pointsOverSnapshot ?? 0) > 0);
  const flaggedCols = [
    { key: 'product',  label: 'Line',          render: (l) => l.product?.name ?? l.productId },
    { key: 'discount', label: 'Discount Given', render: (l) => `${Number(l.discountPercent).toFixed(1)}%` },
    { key: 'limit',    label: 'Limit Allowed',  render: (l) => `${Number(l.effectiveCeilingSnapshot).toFixed(1)}%` },
    { key: 'over',     label: 'Over By',        render: (l) => (
      <span className="font-semibold text-red-600">+{Number(l.pointsOverSnapshot).toFixed(1)}%</span>
    )},
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Approval Detail" breadcrumb="Approvals / Detail">
        <Btn variant="secondary" size="sm" onClick={() => navigate('/approvals')}>← Back</Btn>
      </PageHeader>

      {actionError && <Alert variant="error" className="mb-4">{actionError}</Alert>}

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <RiskScoreBadge score={blended} />
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          tier === 'GOLD'   ? 'bg-amber-100 text-amber-700' :
          tier === 'SILVER' ? 'bg-slate-100 text-slate-600' :
          'bg-orange-100 text-orange-700'
        }`}>
          {tier} Tier
        </span>
        <StageBadge status={quotation?.status} />
        <span className="text-sm text-[var(--text-secondary)]">
          {quotation?.customer?.companyName}
        </span>
      </div>

      {/* FlowMeter step tracker */}
      <Card className="p-5 mb-4">
        <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
          Approval Progress
        </h2>
        <FlowMeter
          steps={APPROVAL_STEPS}
          activeStep={activeStep}
          danger={blended > 0}
        />
      </Card>

      {/* Why this quote was flagged */}
      {flaggedLines.length > 0 && (
        <Card className="p-5 mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
            Why This Quote Was Flagged
          </h2>
          <Table
            columns={flaggedCols}
            rows={flaggedLines}
            emptyText="No lines exceeded their limits."
          />
          <p className="text-xs text-[var(--text-secondary)] mt-3 italic">
            Blended Risk Score = {blended} (sum of all points-over across lines).
            Effective ceiling = MIN(tier ceiling, category ceiling) per line.
          </p>
        </Card>
      )}

      {/* All lines for context */}
      {lines.length > 0 && (
        <Card className="p-5 mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">All Lines</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
                  {['Product', 'Qty', 'Unit Price', 'Discount', 'Type', 'Status'].map((h) => (
                    <th key={h} className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const over = Number(l.pointsOverSnapshot ?? 0) > 0;
                  return (
                    <tr key={l.id} className="border-b border-[var(--border)]">
                      <td className="px-3 py-2.5 text-[var(--text-primary)] text-sm">{l.product?.name}</td>
                      <td className="px-3 py-2.5 tabular-nums">{l.quantity}</td>
                      <td className="px-3 py-2.5 font-mono-df tabular-nums">${Number(l.unitPrice).toFixed(2)}</td>
                      <td className="px-3 py-2.5 font-mono-df tabular-nums">{Number(l.discountPercent).toFixed(1)}%</td>
                      <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">{l.lineType}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          over ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {over ? `OVER` : 'OK'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Audit trail */}
      {allSteps.length > 0 && (
        <Card className="p-5 mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
            Approval Trail
          </h2>
          <div className="space-y-2">
            {allSteps.map((s) => (
              <div key={s.id} className="flex items-start gap-3 text-sm">
                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  s.status === 'APPROVED'  ? 'bg-green-500 text-white' :
                  s.status === 'REJECTED'  ? 'bg-red-500 text-white' :
                  s.status === 'RETURNED'  ? 'bg-amber-500 text-white' :
                  'bg-[var(--border)] text-[var(--text-secondary)]'
                }`}>{s.order}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[var(--text-primary)]">{stepLabel(s.level)}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                      s.status === 'APPROVED'  ? 'bg-green-100 text-green-700' :
                      s.status === 'REJECTED'  ? 'bg-red-100 text-red-700' :
                      s.status === 'RETURNED'  ? 'bg-amber-100 text-amber-700' :
                      'bg-[var(--surface-alt)] text-[var(--text-secondary)]'
                    }`}>{s.status}</span>
                    {s.actedAt && (
                      <span className="text-xs text-[var(--text-secondary)]">
                        {new Date(s.actedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {s.reason && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 italic">
                      "{s.reason}"
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Action panel — only shown while this step is PENDING */}
      {isPending && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
            Action — {stepLabel(step.level)} Review
          </h2>
          <Field label="Reason" required error={reasonError}>
            <Textarea
              rows={3}
              placeholder="Enter your reason for this action (required)…"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setReasonError(''); }}
            />
          </Field>
          <div className="flex gap-2 mt-4 flex-wrap">
            <Btn
              onClick={() => validateAndAct(approveMutation, 'Approve this quotation and advance it to the next step?')}
              disabled={approveMutation.isPending || rejectMutation.isPending || returnMutation.isPending}
            >
              ✓ Approve
            </Btn>
            <Btn
              variant="secondary"
              onClick={() => validateAndAct(returnMutation, 'Return this quotation to Draft for revision?')}
              disabled={approveMutation.isPending || rejectMutation.isPending || returnMutation.isPending}
            >
              ↩ Return for Revision
            </Btn>
            <Btn
              variant="danger"
              onClick={() => validateAndAct(rejectMutation, 'Reject this quotation? This is a terminal action and cannot be undone.')}
              disabled={approveMutation.isPending || rejectMutation.isPending || returnMutation.isPending}
            >
              ✗ Reject
            </Btn>
          </div>
        </Card>
      )}

      {/* Already actioned state */}
      {!isPending && (
        <Card className="p-5">
          <Alert variant={step.status === 'APPROVED' ? 'success' : step.status === 'RETURNED' ? 'warning' : 'error'}>
            This step has already been {step.status.toLowerCase()}.
            {step.reason && ` Reason: "${step.reason}"`}
          </Alert>
        </Card>
      )}

      {ConfirmModal}
    </div>
  );
}
