import { useNavigate } from 'react-router-dom';
import { useQuery }    from '@tanstack/react-query';
import { subscriptionsApi } from '../api/subscriptions.js';
import {
  PageHeader, Card, Table, CountBadge, Spinner, Alert, StageBadge, Btn,
} from '../components/ui.jsx';

const STATUS_BADGE = {
  ACTIVE:    'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300',
  PAUSED:    'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
  CANCELLED: 'bg-slate-100  text-slate-600  dark:bg-slate-800     dark:text-slate-400',
};

function SubStatusBadge({ status }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[status] ?? STATUS_BADGE.ACTIVE}`}>
      {status}
    </span>
  );
}

export default function SubscriptionsListPage() {
  const navigate = useNavigate();

  const { data: subs = [], isLoading, error } = useQuery({
    queryKey: ['subscriptions'],
    queryFn:  () => subscriptionsApi.list(),
  });

  const active    = subs.filter(s => s.status === 'ACTIVE').length;
  const paused    = subs.filter(s => s.status === 'PAUSED').length;
  const cancelled = subs.filter(s => s.status === 'CANCELLED').length;

  const columns = [
    {
      key: 'customer', label: 'Customer',
      render: s => (
        <span className="font-medium text-[var(--text-primary)]">
          {s.order?.quotation?.customer?.companyName ?? '—'}
        </span>
      ),
    },
    {
      key: 'plan', label: 'Plan',
      render: s => s.plan?.name ?? '—',
    },
    {
      key: 'cycle', label: 'Cycle',
      render: s => (
        <span className="text-sm text-[var(--text-secondary)]">{s.plan?.interval ?? '—'}</span>
      ),
    },
    {
      key: 'qty', label: 'Qty',
      render: s => <span className="font-mono-df">{s.quantity}</span>,
    },
    {
      key: 'nextBill', label: 'Next Bill',
      render: s => (
        <span className="text-sm font-mono-df">
          {s.nextBillDate ? new Date(s.nextBillDate).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: s => <SubStatusBadge status={s.status} />,
    },
  ];

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error)     return <Alert variant="error">Failed to load subscriptions: {error.message}</Alert>;

  return (
    <div>
      <PageHeader title="Subscriptions" breadcrumb="Recurring Plans">
        {/* Admin can create plans via Product config — no standalone create here */}
      </PageHeader>

      <div className="flex flex-wrap gap-3 mb-6">
        <CountBadge label="Active"    count={active}    color="green" />
        <CountBadge label="Paused"    count={paused}    color="amber" />
        <CountBadge label="Cancelled" count={cancelled} color="gray"  />
      </div>

      <Card>
        <Table
          columns={columns}
          rows={subs}
          onRowClick={s => navigate(`/subscriptions/${s.id}`)}
          emptyText="No subscriptions found."
        />
      </Card>
    </div>
  );
}
