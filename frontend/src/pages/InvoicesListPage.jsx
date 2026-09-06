import { useNavigate } from 'react-router-dom';
import { useQuery }    from '@tanstack/react-query';
import { invoicesApi } from '../api/invoices.js';
import { PageHeader, Card, Table, CountBadge, Spinner, Alert, Badge } from '../components/ui.jsx';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n ?? 0));
}

const STATUS_BADGE = {
  UNPAID:  { label: 'Unpaid',  color: 'yellow' },
  PAID:    { label: 'Paid',    color: 'green'  },
  PARTIAL: { label: 'Partial', color: 'blue'   },
};

export default function InvoicesListPage() {
  const navigate = useNavigate();

  const { data: invoices = [], isLoading, error } = useQuery({
    queryKey: ['invoices'],
    queryFn:  () => invoicesApi.list(),
  });

  const unpaid = invoices.filter(i => i.status === 'UNPAID').length;
  const paid   = invoices.filter(i => i.status === 'PAID').length;

  const columns = [
    {
      key: 'id', label: 'Invoice #',
      render: i => <span className="font-mono-df text-xs text-[var(--text-secondary)]">#{i.id.slice(0, 8).toUpperCase()}</span>,
    },
    {
      key: 'customer', label: 'Customer',
      render: i => (
        <span className="font-medium text-[var(--text-primary)]">
          {i.order?.quotation?.customer?.companyName ?? '—'}
        </span>
      ),
    },
    {
      key: 'amount', label: 'Amount',
      render: i => <span className="font-mono-df tabular-nums">{fmt(i.amount)}</span>,
    },
    {
      key: 'type', label: 'Type',
      render: i => <Badge label={i.type?.replace('_', ' ')} color={i.type === 'RECURRING' ? 'violet' : 'gray'} />,
    },
    {
      key: 'status', label: 'Status',
      render: i => {
        const b = STATUS_BADGE[i.status] ?? { label: i.status, color: 'gray' };
        return <Badge label={b.label} color={b.color} />;
      },
    },
    {
      key: 'dueDate', label: 'Due Date',
      render: i => (
        <span className="text-sm text-[var(--text-secondary)]">
          {i.dueDate ? new Date(i.dueDate).toLocaleDateString() : '—'}
        </span>
      ),
    },
  ];

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error)     return <Alert variant="error">Failed to load invoices: {error.message}</Alert>;

  return (
    <div>
      <PageHeader title="Invoices" breadcrumb="Billing" />

      <div className="flex flex-wrap gap-3 mb-6">
        <CountBadge label="Unpaid" count={unpaid} color="amber" />
        <CountBadge label="Paid"   count={paid}   color="green" />
      </div>

      <Card>
        <Table
          columns={columns}
          rows={invoices}
          onRowClick={i => navigate(`/invoices/${i.id}`)}
          emptyText="No invoices found."
        />
      </Card>
    </div>
  );
}
