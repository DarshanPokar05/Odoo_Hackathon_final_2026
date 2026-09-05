import { useEffect, useState } from 'react';
import { useNavigate }        from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalsApi }  from '../api/approvals.js';
import { quotationsApi } from '../api/quotations.js';
import { dealHealthApi } from '../api/dealHealth.js';
import api               from '../api/axios.js';
import { useSocket }     from '../hooks/useSocket.js';
import { useLivePulse }  from '../hooks/useLivePulse.js';
import {
  PageHeader, KpiCard, Card, Btn, StageBadge, Spinner, Alert, LiveDot,
} from '../components/ui.jsx';

// ── Activity feed item ────────────────────────────────────────────────────────
function ActivityItem({ entry }) {
  const ACTION_ICON = {
    QUOTATION_CREATED:   '📋',
    QUOTATION_SUBMITTED: '↑',
    QUOTATION_APPROVED:  '✓',
    DEAL_STALLED_FLAGGED:'⚠',
    APPROVAL_REJECTED:   '✗',
    RECURRING_INVOICE_CREATED: '💳',
    PAYMENT_VERIFIED:    '💰',
  };
  const icon = ACTION_ICON[entry.action] ?? '•';

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
      <span className="w-7 h-7 rounded-full bg-[var(--surface-alt)] flex items-center justify-center text-sm shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)]">
          {entry.action?.replace(/_/g, ' ')}
          {entry.details?.customer ? ` — ${entry.details.customer}` : ''}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          {new Date(entry.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const socketRef   = useSocket();

  // Live pulse state for KPI cards
  const [pendingCount,  setPendingCount]  = useState(null);
  const [openCount,     setOpenCount]     = useState(null);
  const [atRiskCount,   setAtRiskCount]   = useState(null);

  const pendingPulse  = useLivePulse(pendingCount);
  const openPulse     = useLivePulse(openCount);
  const atRiskPulse   = useLivePulse(atRiskCount);

  const { data: pendingApprovals = [], isLoading: pLoad } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn:  () => approvalsApi.list({ status: 'PENDING' }),
  });

  const { data: openQuotations = [], isLoading: qLoad } = useQuery({
    queryKey: ['quotations', 'open'],
    queryFn:  () => quotationsApi.list({ status: 'DRAFT' }),
  });

  const { data: atRiskFlags = [], isLoading: dhLoad } = useQuery({
    queryKey: ['deal-health', 'unresolved'],
    queryFn:  () => dealHealthApi.list({ resolved: 'false' }),
  });

  const { data: activityLog = [], isLoading: actLoad } = useQuery({
    queryKey: ['activity-log'],
    queryFn:  () => api.get('/activity-logs?limit=20').then(r => r.data.data ?? []),
  });

  // Sync derived counts with live-pulse hooks
  useEffect(() => {
    if (pendingApprovals.length !== pendingCount) pendingPulse.trigger(pendingApprovals.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingApprovals.length]);

  useEffect(() => {
    if (openQuotations.length !== openCount) openPulse.trigger(openQuotations.length);
  }, [openQuotations.length]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (atRiskFlags.length !== atRiskCount) atRiskPulse.trigger(atRiskFlags.length);
  }, [atRiskFlags.length]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time: refresh on any relevant event
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['quotations', 'open'] });
      qc.invalidateQueries({ queryKey: ['deal-health'] });
      qc.invalidateQueries({ queryKey: ['activity-log'] });
    };

    socket.on('QUOTATION_UPDATED',   refresh);
    socket.on('APPROVAL_PENDING',    refresh);
    socket.on('DEAL_HEALTH_FLAGGED', refresh);

    return () => {
      socket.off('QUOTATION_UPDATED',   refresh);
      socket.off('APPROVAL_PENDING',    refresh);
      socket.off('DEAL_HEALTH_FLAGGED', refresh);
    };
  }, [socketRef, qc]);

  const isLoading = pLoad || qLoad || dhLoad;

  return (
    <div>
      <PageHeader title="Sales Dashboard" breadcrumb="Home">
        <Btn onClick={() => navigate('/quotations/new')}>+ New Quotation</Btn>
        <Btn variant="secondary" onClick={() => navigate('/approvals')}>View Approvals</Btn>
      </PageHeader>

      {/* KPI cards — live pulse on Socket.io updates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Pending Approvals"
          value={pendingPulse.displayValue ?? pendingApprovals.length}
          isPulsing={pendingPulse.isPulsing}
          sub="awaiting your action"
        />
        <KpiCard
          label="Open Quotations"
          value={openPulse.displayValue ?? openQuotations.length}
          isPulsing={openPulse.isPulsing}
          sub="in Draft stage"
        />
        <KpiCard
          label="At Risk Deals"
          value={atRiskPulse.displayValue ?? atRiskFlags.length}
          isPulsing={atRiskPulse.isPulsing}
          sub="unresolved health flags"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending approvals list */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Pending Approvals
            </h2>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/approvals')}>View all →</Btn>
          </div>
          {isLoading ? <Spinner className="mx-auto" /> : (
            pendingApprovals.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-4 text-center">No pending approvals.</p>
            ) : (
              <div className="space-y-2">
                {pendingApprovals.slice(0, 5).map(s => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0 cursor-pointer hover:bg-[var(--surface-alt)] px-2 rounded transition-colors"
                    onClick={() => navigate(`/approvals/${s.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {s.quotation?.customer?.companyName ?? '—'}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Risk: {Number(s.quotation?.blendedRiskScore ?? 0)} · {s.level}
                      </p>
                    </div>
                    <StageBadge status={s.quotation?.status} />
                  </div>
                ))}
              </div>
            )
          )}
        </Card>

        {/* Recent activity feed — live */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Recent Activity
            </h2>
            <LiveDot />
          </div>
          {actLoad ? <Spinner className="mx-auto" /> : (
            activityLog.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)] py-4 text-center">No recent activity.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {activityLog.slice(0, 15).map((e, i) => (
                  <ActivityItem key={e.id ?? i} entry={e} />
                ))}
              </div>
            )
          )}
        </Card>
      </div>
    </div>
  );
}
