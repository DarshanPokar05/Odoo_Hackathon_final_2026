import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth }       from '../store/authContext.jsx';
import { approvalsApi }  from '../api/approvals.js';
import { quotationsApi } from '../api/quotations.js';
import { dealHealthApi } from '../api/dealHealth.js';
import { invoicesApi }   from '../api/invoices.js';
import api               from '../api/axios.js';
import { useSocket }     from '../hooks/useSocket.js';
import { useLivePulse }  from '../hooks/useLivePulse.js';
import {
  PageHeader, KpiCard, Card, Btn, StageBadge, Spinner, LiveDot, Badge,
} from '../components/ui.jsx';

// ── Activity feed item ────────────────────────────────────────────────────────
function ActivityItem({ entry }) {
  const ACTION_ICON = {
    QUOTATION_CREATED:         '📋',
    QUOTATION_SUBMITTED:       '↑',
    QUOTATION_APPROVED:        '✓',
    DEAL_STALLED_FLAGGED:      '⚠',
    APPROVAL_REJECTED:         '✗',
    RECURRING_INVOICE_CREATED: '💳',
    PAYMENT_VERIFIED:          '💰',
    SUBSCRIPTION_CREATED:      '↻',
    SUBSCRIPTION_CANCELLED:    '⊗',
  };
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
      <span className="w-7 h-7 rounded-full bg-[var(--surface-alt)] flex items-center justify-center text-sm shrink-0">
        {ACTION_ICON[entry.action] ?? '•'}
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

// ── SALES REP Dashboard ───────────────────────────────────────────────────────
function SalesRepDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const socketRef = useSocket();

  const { data: myQuotes = [], isLoading: qLoad } = useQuery({
    queryKey: ['quotations', 'my-drafts'],
    queryFn:  () => quotationsApi.list(),
  });

  const { data: activityLog = [], isLoading: aLoad } = useQuery({
    queryKey: ['activity-log'],
    queryFn:  () => api.get('/activity-logs?limit=15').then(r => r.data.data ?? []),
  });

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['quotations', 'my-drafts'] });
      qc.invalidateQueries({ queryKey: ['activity-log'] });
    };
    socket.on('QUOTATION_UPDATED', refresh);
    return () => socket.off('QUOTATION_UPDATED', refresh);
  }, [socketRef, qc]);

  const drafts     = myQuotes.filter(q => q.status === 'DRAFT').length;
  const pending    = myQuotes.filter(q => q.status === 'PENDING_APPROVAL').length;
  const confirmed  = myQuotes.filter(q => q.status === 'CONFIRMED').length;
  const rejected   = myQuotes.filter(q => q.status === 'REJECTED').length;

  return (
    <div>
      <PageHeader title="My Sales Dashboard" breadcrumb="Home">
        <Btn onClick={() => navigate('/quotations/new')}>+ New Quotation</Btn>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <KpiCard label="My Drafts"       value={drafts}    sub="in progress" />
        <KpiCard label="Pending Approval" value={pending}  sub="awaiting decision" />
        <KpiCard label="Confirmed"       value={confirmed} sub="this period" />
        <KpiCard label="Rejected"        value={rejected}  sub="need revision" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* My recent quotations */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              My Recent Quotations
            </h2>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/quotations')}>View all →</Btn>
          </div>
          {qLoad ? <Spinner className="mx-auto" /> : myQuotes.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-4 text-center">No quotations yet.</p>
          ) : (
            <div className="space-y-1.5">
              {myQuotes.slice(0, 6).map(q => (
                <div
                  key={q.id}
                  className="flex items-center justify-between py-2 px-2 rounded hover:bg-[var(--surface-alt)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/quotations/${q.id}`)}
                >
                  <span className="text-sm text-[var(--text-primary)] truncate max-w-[150px]">
                    {q.customer?.companyName ?? '—'}
                  </span>
                  <StageBadge status={q.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent activity */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Recent Activity
            </h2>
            <LiveDot />
          </div>
          {aLoad ? <Spinner className="mx-auto" /> : (
            <div className="max-h-72 overflow-y-auto">
              {activityLog.map((e, i) => <ActivityItem key={e.id ?? i} entry={e} />)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── SALES MANAGER Dashboard ───────────────────────────────────────────────────
function SalesManagerDashboard() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const socketRef = useSocket();

  const pendingPulse = useLivePulse(0);
  const riskPulse    = useLivePulse(0);

  const { data: pendingApprovals = [], isLoading: pLoad } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn:  () => approvalsApi.list({ status: 'PENDING' }),
  });

  const { data: atRiskFlags = [], isLoading: dhLoad } = useQuery({
    queryKey: ['deal-health', 'unresolved'],
    queryFn:  () => dealHealthApi.list({ resolved: 'false' }),
  });

  const { data: allQuotes = [], isLoading: qLoad } = useQuery({
    queryKey: ['quotations', 'all'],
    queryFn:  () => quotationsApi.list(),
  });

  const { data: activityLog = [], isLoading: aLoad } = useQuery({
    queryKey: ['activity-log'],
    queryFn:  () => api.get('/activity-logs?limit=15').then(r => r.data.data ?? []),
  });

  useEffect(() => { pendingPulse.trigger(pendingApprovals.length); }, [pendingApprovals.length]);  // eslint-disable-line
  useEffect(() => { riskPulse.trigger(atRiskFlags.length); }, [atRiskFlags.length]);               // eslint-disable-line

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['deal-health'] });
      qc.invalidateQueries({ queryKey: ['quotations', 'all'] });
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

  const openQ = allQuotes.filter(q => ['DRAFT','PENDING_APPROVAL','UNDER_NEGOTIATION'].includes(q.status)).length;

  return (
    <div>
      <PageHeader title="Manager Dashboard" breadcrumb="Home">
        <Btn onClick={() => navigate('/approvals')}>View Approvals</Btn>
        <Btn variant="secondary" onClick={() => navigate('/deal-health')}>Deal Health</Btn>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Pending Approvals"
          value={pendingPulse.displayValue ?? pendingApprovals.length}
          isPulsing={pendingPulse.isPulsing}
          sub="need your action"
        />
        <KpiCard
          label="Open Deals (Team)"
          value={openQ}
          sub="active pipeline"
        />
        <KpiCard
          label="At Risk Flags"
          value={riskPulse.displayValue ?? atRiskFlags.length}
          isPulsing={riskPulse.isPulsing}
          sub="unresolved health flags"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending approvals */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Pending Approvals
            </h2>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/approvals')}>View all →</Btn>
          </div>
          {pLoad ? <Spinner className="mx-auto" /> : pendingApprovals.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-4 text-center">No pending approvals.</p>
          ) : (
            <div className="space-y-1.5">
              {pendingApprovals.slice(0, 5).map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2 px-2 rounded hover:bg-[var(--surface-alt)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/approvals/${s.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {s.quotation?.customer?.companyName ?? '—'}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Risk: {Number(s.quotation?.blendedRiskScore ?? 0)}
                    </p>
                  </div>
                  <StageBadge status={s.quotation?.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent activity */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Recent Activity
            </h2>
            <LiveDot />
          </div>
          {aLoad ? <Spinner className="mx-auto" /> : (
            <div className="max-h-72 overflow-y-auto">
              {activityLog.map((e, i) => <ActivityItem key={e.id ?? i} entry={e} />)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── FINANCE Dashboard ─────────────────────────────────────────────────────────
function FinanceDashboard() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const socketRef = useSocket();

  const { data: pendingApprovals = [], isLoading: pLoad } = useQuery({
    queryKey: ['approvals', 'pending-finance'],
    queryFn:  () => approvalsApi.list({ status: 'PENDING' }),
  });

  const { data: invoices = [], isLoading: iLoad } = useQuery({
    queryKey: ['invoices', 'unpaid'],
    queryFn:  () => invoicesApi.list({ status: 'UNPAID' }),
  });

  const { data: activityLog = [], isLoading: aLoad } = useQuery({
    queryKey: ['activity-log'],
    queryFn:  () => api.get('/activity-logs?limit=15').then(r => r.data.data ?? []),
  });

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['invoices', 'unpaid'] });
    };
    socket.on('APPROVAL_PENDING', refresh);
    socket.on('QUOTATION_UPDATED', refresh);
    return () => {
      socket.off('APPROVAL_PENDING', refresh);
      socket.off('QUOTATION_UPDATED', refresh);
    };
  }, [socketRef, qc]);

  const unpaidAmount = invoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);

  return (
    <div>
      <PageHeader title="Finance Dashboard" breadcrumb="Home">
        <Btn onClick={() => navigate('/invoices')}>View Invoices</Btn>
        <Btn variant="secondary" onClick={() => navigate('/approvals')}>Approvals</Btn>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Pending Approvals"
          value={pendingApprovals.length}
          sub="awaiting Finance review"
        />
        <KpiCard
          label="Unpaid Invoices"
          value={invoices.length}
          sub="outstanding"
        />
        <KpiCard
          label="Outstanding Amount"
          value={`$${unpaidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="total unpaid"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending finance approvals */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Pending Finance Approvals
            </h2>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/approvals')}>View all →</Btn>
          </div>
          {pLoad ? <Spinner className="mx-auto" /> : pendingApprovals.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-4 text-center">No pending approvals.</p>
          ) : (
            <div className="space-y-1.5">
              {pendingApprovals.slice(0, 5).map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2 px-2 rounded hover:bg-[var(--surface-alt)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/approvals/${s.id}`)}
                >
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {s.quotation?.customer?.companyName ?? '—'}
                  </p>
                  <Badge label={`Risk: ${Number(s.quotation?.blendedRiskScore ?? 0)}`} color="red" />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent unpaid invoices */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Unpaid Invoices
            </h2>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/invoices')}>View all →</Btn>
          </div>
          {iLoad ? <Spinner className="mx-auto" /> : invoices.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-4 text-center">No unpaid invoices.</p>
          ) : (
            <div className="space-y-1.5">
              {invoices.slice(0, 6).map(inv => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between py-2 px-2 rounded hover:bg-[var(--surface-alt)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <span className="text-sm text-[var(--text-primary)] font-mono-df">
                    #{inv.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span className="text-sm font-semibold font-mono-df text-[var(--accent-solid)]">
                    ${Number(inv.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── ADMIN Dashboard ───────────────────────────────────────────────────────────
function AdminDashboard() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const socketRef = useSocket();

  const pendingPulse = useLivePulse(0);
  const riskPulse    = useLivePulse(0);
  const openPulse    = useLivePulse(0);

  const { data: pendingApprovals = [], isLoading: pLoad } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn:  () => approvalsApi.list({ status: 'PENDING' }),
  });

  const { data: openQuotations = [] } = useQuery({
    queryKey: ['quotations', 'open'],
    queryFn:  () => quotationsApi.list(),
  });

  const { data: atRiskFlags = [] } = useQuery({
    queryKey: ['deal-health', 'unresolved'],
    queryFn:  () => dealHealthApi.list({ resolved: 'false' }),
  });

  const { data: activityLog = [], isLoading: aLoad } = useQuery({
    queryKey: ['activity-log'],
    queryFn:  () => api.get('/activity-logs?limit=20').then(r => r.data.data ?? []),
  });

  useEffect(() => { pendingPulse.trigger(pendingApprovals.length); }, [pendingApprovals.length]); // eslint-disable-line
  useEffect(() => { riskPulse.trigger(atRiskFlags.length); }, [atRiskFlags.length]);              // eslint-disable-line
  useEffect(() => { openPulse.trigger(openQuotations.length); }, [openQuotations.length]);        // eslint-disable-line

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['quotations', 'open'] });
      qc.invalidateQueries({ queryKey: ['deal-health'] });
      qc.invalidateQueries({ queryKey: ['activity-log'] });
    };
    socket.on('QUOTATION_UPDATED', refresh);
    socket.on('APPROVAL_PENDING', refresh);
    socket.on('DEAL_HEALTH_FLAGGED', refresh);
    return () => {
      socket.off('QUOTATION_UPDATED', refresh);
      socket.off('APPROVAL_PENDING', refresh);
      socket.off('DEAL_HEALTH_FLAGGED', refresh);
    };
  }, [socketRef, qc]);

  return (
    <div>
      <PageHeader title="Admin Dashboard" breadcrumb="Home">
        <Btn onClick={() => navigate('/quotations/new')}>+ New Quotation</Btn>
        <Btn variant="secondary" onClick={() => navigate('/approvals')}>View Approvals</Btn>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Pending Approvals"
          value={pendingPulse.displayValue ?? pendingApprovals.length}
          isPulsing={pendingPulse.isPulsing}
          sub="awaiting action"
        />
        <KpiCard
          label="Open Quotations"
          value={openPulse.displayValue ?? openQuotations.length}
          isPulsing={openPulse.isPulsing}
          sub="total pipeline"
        />
        <KpiCard
          label="At Risk Deals"
          value={riskPulse.displayValue ?? atRiskFlags.length}
          isPulsing={riskPulse.isPulsing}
          sub="unresolved flags"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Pending Approvals
            </h2>
            <Btn variant="ghost" size="sm" onClick={() => navigate('/approvals')}>View all →</Btn>
          </div>
          {pLoad ? <Spinner className="mx-auto" /> : pendingApprovals.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-4 text-center">No pending approvals.</p>
          ) : (
            <div className="space-y-1.5">
              {pendingApprovals.slice(0, 5).map(s => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2 px-2 rounded hover:bg-[var(--surface-alt)] cursor-pointer transition-colors"
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
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              Recent Activity
            </h2>
            <LiveDot />
          </div>
          {aLoad ? <Spinner className="mx-auto" /> : (
            <div className="max-h-72 overflow-y-auto">
              {activityLog.map((e, i) => <ActivityItem key={e.id ?? i} entry={e} />)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Router — picks the right dashboard by role ────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();

  switch (user?.role) {
    case 'SALES_REP':     return <SalesRepDashboard />;
    case 'SALES_MANAGER': return <SalesManagerDashboard />;
    case 'FINANCE':       return <FinanceDashboard />;
    case 'ADMIN':
    default:              return <AdminDashboard />;
  }
}
