import { useState, useEffect } from 'react';
import { useNavigate }        from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalsApi }  from '../api/approvals.js';
import { useSocket }     from '../hooks/useSocket.js';
import {
  PageHeader, Card, Table, CountBadge, StageBadge,
  RiskScoreBadge, Spinner, Alert, Btn,
} from '../components/ui.jsx';

export default function ApprovalsListPage() {
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const socketRef     = useSocket();
  const [pendingOnly, setPendingOnly] = useState(false);

  const { data: steps = [], isLoading, error } = useQuery({
    queryKey: ['approvals', pendingOnly ? 'pending' : 'all'],
    queryFn:  () => approvalsApi.list(pendingOnly ? { status: 'PENDING' } : {}),
  });

  // Real-time: refresh approvals list when quotation updates
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    };

    socket.on('APPROVAL_PENDING', refresh);
    socket.on('QUOTATION_UPDATED', refresh);

    return () => {
      socket.off('APPROVAL_PENDING', refresh);
      socket.off('QUOTATION_UPDATED', refresh);
    };
  }, [socketRef, queryClient]);

  const pending  = steps.filter((s) => s.status === 'PENDING').length;
  const returned = steps.filter((s) => s.status === 'RETURNED').length;
  const approved = steps.filter((s) => s.status === 'APPROVED').length;

  const columns = [
    {
      key: 'quotation',
      label: 'Quotation / Customer',
      render: (s) => (
        <div>
          <p className="font-medium text-sm text-[var(--text-primary)]">
            {s.quotation?.customer?.companyName ?? '—'}
          </p>
          <p className="text-xs text-[var(--text-secondary)] font-mono-df">
            {s.quotationId?.slice(0, 8)}…
          </p>
        </div>
      ),
    },
    {
      key: 'blendedRisk',
      label: 'Blended Risk',
      render: (s) => <RiskScoreBadge score={s.quotation?.blendedRiskScore ?? 0} />,
    },
    {
      key: 'stage',
      label: 'Stage',
      render: (s) => <StageBadge status={s.quotation?.status} />,
    },
    {
      key: 'level',
      label: 'Assigned To',
      render: (s) => (
        <span className="text-sm text-[var(--text-primary)]">
          {s.level?.replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (s) => {
        const styles = {
          PENDING:  'bg-amber-100 text-amber-700',
          APPROVED: 'bg-green-100 text-green-700',
          REJECTED: 'bg-red-100 text-red-700',
          RETURNED: 'bg-blue-100 text-blue-700',
        };
        return (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {s.status}
          </span>
        );
      },
    },
  ];

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error)     return <Alert variant="error">Failed to load approvals: {error.message}</Alert>;

  return (
    <div>
      <PageHeader title="Approvals" breadcrumb="Approval Queue">
        <Btn
          variant={pendingOnly ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setPendingOnly((v) => !v)}
        >
          {pendingOnly ? '✓ Pending Only' : 'Filter: Pending Only'}
        </Btn>
      </PageHeader>

      {/* Count badges */}
      <div className="flex flex-wrap gap-3 mb-6">
        <CountBadge label="Pending"  count={pending}  color="amber" />
        <CountBadge label="Returned" count={returned} color="blue"  />
        <CountBadge label="Approved" count={approved} color="green" />
      </div>

      <Card>
        <Table
          columns={columns}
          rows={steps}
          onRowClick={(s) => navigate(`/approvals/${s.id}`)}
          emptyText={pendingOnly ? 'No pending approvals.' : 'No approval steps found.'}
        />
      </Card>
    </div>
  );
}
