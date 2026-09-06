import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { quotationsApi } from '../api/quotations.js';
import { useSocket } from '../hooks/useSocket.js';
import {
  PageHeader, Btn, Card, StageBadge, Spinner, Alert,
  KpiCard, Badge,
} from '../components/ui.jsx';

// Stage pipeline order (per Screen 3 wireframe)
const PIPELINE_STAGES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'UNDER_NEGOTIATION',
  'CONFIRMED',
];

// Stage left-edge stripe colour for kanban cards
const STAGE_STRIPE = {
  DRAFT:             'border-slate-400',
  PENDING_APPROVAL:  'border-amber-400',
  APPROVED:          'border-blue-400',
  UNDER_NEGOTIATION: 'border-violet-400',
  CONFIRMED:         'border-green-400',
  REJECTED:          'border-red-400',
  FULFILLMENT:       'border-teal-400',
  INVOICED:          'border-blue-300',
  CLOSED:            'border-gray-300',
};

// Human-friendly column labels
const STAGE_LABELS = {
  DRAFT:             'Draft',
  PENDING_APPROVAL:  'Pending Approval',
  APPROVED:          'Approved',
  UNDER_NEGOTIATION: 'Under Negotiation',
  CONFIRMED:         'Confirmed',
};

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount));
}

function quoteTotal(q) {
  return q.lines?.reduce((sum, l) => {
    const base = Number(l.unitPrice) * l.quantity;
    const disc = base * (Number(l.discountPercent) / 100);
    return sum + (base - disc);
  }, 0) ?? 0;
}

// ── Kanban card ───────────────────────────────────────────────────────────────
function QuoteCard({ q, onClick }) {
  const stripe = STAGE_STRIPE[q.status] ?? 'border-gray-300';
  const total  = quoteTotal(q);
  const score  = Number(q.blendedRiskScore ?? 0);

  return (
    <div
      onClick={onClick}
      className={`surface border-l-4 ${stripe} p-3 cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.01]`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-sm text-[var(--text-primary)] leading-tight line-clamp-1">
          {q.customer?.companyName ?? '—'}
        </span>
        {score > 0 && (
          <span className="shrink-0 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
            ⚠ Risk {score}
          </span>
        )}
      </div>
      <p className="font-mono-df text-base font-bold text-[var(--accent-solid)]">
        {formatCurrency(total)}
      </p>
      <p className="text-xs text-[var(--text-secondary)] mt-1">
        {q.lines?.length ?? 0} line{q.lines?.length !== 1 ? 's' : ''}
        {' · '}
        {new Date(q.lastActivityAt).toLocaleDateString()}
      </p>
    </div>
  );
}

// ── Table row ─────────────────────────────────────────────────────────────────
function QuoteRow({ q, onClick }) {
  const total = quoteTotal(q);
  const score = Number(q.blendedRiskScore ?? 0);
  return (
    <tr
      className="border-b border-[var(--border)] hover:bg-[var(--surface-alt)] cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
        {q.customer?.companyName ?? '—'}
      </td>
      <td className="px-4 py-3">
        <StageBadge status={q.status} />
      </td>
      <td className="px-4 py-3 font-mono-df text-sm text-right">{formatCurrency(total)}</td>
      <td className="px-4 py-3 text-sm text-center">
        {score > 0 ? (
          <span className="text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
            {score}
          </span>
        ) : (
          <span className="text-xs text-green-600">✓</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
        {new Date(q.lastActivityAt).toLocaleDateString()}
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function QuotationsListPage() {
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const socketRef     = useSocket();
  const [tableView, setTableView] = useState(false);

  const { data: quotes = [], isLoading, error } = useQuery({
    queryKey: ['quotations'],
    queryFn:  () => quotationsApi.list(),
  });

  // ── Real-time: refresh list when any quotation updates ────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onUpdate = () => queryClient.invalidateQueries({ queryKey: ['quotations'] });

    socket.on('QUOTATION_UPDATED', onUpdate);
    socket.on('APPROVAL_PENDING',  onUpdate);

    return () => {
      socket.off('QUOTATION_UPDATED', onUpdate);
      socket.off('APPROVAL_PENDING',  onUpdate);
    };
  }, [socketRef, queryClient]);

  // ── KPI counts ────────────────────────────────────────────────────────────
  const kpiDraft    = quotes.filter((q) => q.status === 'DRAFT').length;
  const kpiPending  = quotes.filter((q) => q.status === 'PENDING_APPROVAL').length;
  const kpiConfirmed = quotes.filter((q) => q.status === 'CONFIRMED').length;
  const kpiNeg      = quotes.filter((q) => q.status === 'UNDER_NEGOTIATION').length;

  // Group by stage for kanban view
  const byStage = {};
  for (const stage of PIPELINE_STAGES) {
    byStage[stage] = quotes.filter((q) => q.status === stage);
  }

  const handleClick = (q) => navigate(`/quotations/${q.id}`);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error)     return <Alert variant="error">Failed to load quotations: {error.message}</Alert>;

  return (
    <div>
      <PageHeader title="Quotations" breadcrumb="Sales Pipeline">
        <Btn variant="secondary" size="sm" onClick={() => setTableView((v) => !v)}>
          {tableView ? '⊟ Kanban' : '☰ Table'}
        </Btn>
        <Btn onClick={() => navigate('/quotations/new')}>+ New Quotation</Btn>
      </PageHeader>

      {/* KPI summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Draft"             value={kpiDraft}    />
        <KpiCard label="Pending Approval"  value={kpiPending}  />
        <KpiCard label="Negotiation"       value={kpiNeg}      />
        <KpiCard label="Confirmed"         value={kpiConfirmed} />
      </div>

      {/* ── Kanban view ─────────────────────────────────────────────────────── */}
      {!tableView && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const cards = byStage[stage] ?? [];
            return (
              <div key={stage} className="min-w-[220px] w-56 flex-shrink-0">
                {/* Column header */}
                <div className="surface-alt rounded-lg px-3 py-2 mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className="text-xs font-mono-df text-[var(--text-secondary)] bg-[var(--border)] rounded px-1.5 py-0.5">
                    {cards.length}
                  </span>
                </div>
                {/* Cards */}
                <div className="flex flex-col gap-2">
                  {cards.length === 0 ? (
                    <div className="surface rounded-lg px-3 py-6 text-center text-xs text-[var(--text-secondary)]">
                      No {STAGE_LABELS[stage].toLowerCase()} quotes
                    </div>
                  ) : (
                    cards.map((q) => (
                      <QuoteCard key={q.id} q={q} onClick={() => handleClick(q)} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Table view ──────────────────────────────────────────────────────── */}
      {tableView && (
        <Card>
          {quotes.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-secondary)] text-sm">
              No quotations found. Create one to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
                    {['Customer', 'Stage', 'Amount', 'Risk', 'Last Activity'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <QuoteRow key={q.id} q={q} onClick={() => handleClick(q)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
