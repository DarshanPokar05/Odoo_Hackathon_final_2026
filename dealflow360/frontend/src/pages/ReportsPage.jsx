import { useState } from 'react';
import { useQuery }  from '@tanstack/react-query';
import { reportsApi } from '../api/reports.js';
import {
  PageHeader, Card, KpiCard, Table, Spinner, Alert, Btn, Field, Input, Select,
  StageBadge, Badge, toast,
} from '../components/ui.jsx';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n ?? 0));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [filters, setFilters] = useState({
    from:   '',
    to:     '',
    status: '',
    repId:  '',
  });
  const [appliedFilters, setAppliedFilters] = useState({});
  const [exporting, setExporting] = useState(null);

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['reports', appliedFilters],
    queryFn:  () => reportsApi.getSummary(appliedFilters),
  });

  const handleApply = () => setAppliedFilters({ ...filters });

  const handleExport = async (type) => {
    setExporting(type);
    try {
      const res = type === 'pdf'
        ? await reportsApi.exportPdf(appliedFilters)
        : await reportsApi.exportCsv(appliedFilters);
      downloadBlob(res.data, `dealflow360-report.${type === 'pdf' ? 'pdf' : 'csv'}`);
      toast(`${type.toUpperCase()} downloaded`, 'success');
    } catch (e) {
      toast('Export failed: ' + (e.message ?? 'Unknown error'), 'error');
    } finally {
      setExporting(null);
    }
  };

  const quotations = summary?.quotations ?? [];

  const columns = [
    {
      key: 'customer', label: 'Customer',
      render: q => <span className="font-medium text-[var(--text-primary)]">{q.customer?.companyName ?? '—'}</span>,
    },
    { key: 'status',  label: 'Status', render: q => <StageBadge status={q.status} /> },
    {
      key: 'score', label: 'Risk',
      render: q => {
        const s = Number(q.blendedRiskScore ?? 0);
        return (
          <span className={`text-xs font-semibold font-mono-df px-2 py-0.5 rounded-full ${
            s === 0 ? 'bg-green-100 text-green-700' : s < 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}>{s}</span>
        );
      },
    },
    {
      key: 'amount', label: 'Amount',
      render: q => (
        <span className="font-mono-df tabular-nums">
          {fmt(q.lines?.reduce((s, l) => s + Number(l.unitPrice)*l.quantity*(1-Number(l.discountPercent)/100), 0))}
        </span>
      ),
    },
    {
      key: 'lines', label: 'Lines',
      render: q => <span className="font-mono-df">{q.lines?.length ?? 0}</span>,
    },
    {
      key: 'created', label: 'Created',
      render: q => <span className="text-xs text-[var(--text-secondary)]">{new Date(q.createdAt).toLocaleDateString()}</span>,
    },
  ];

  return (
    <div>
      <PageHeader title="Reports" breadcrumb="Admin / Reporting">
        <Btn
          variant="secondary"
          disabled={exporting === 'pdf'}
          onClick={() => handleExport('pdf')}
        >
          {exporting === 'pdf' ? 'Generating…' : 'Export PDF'}
        </Btn>
        <Btn
          variant="secondary"
          disabled={exporting === 'csv'}
          onClick={() => handleExport('csv')}
        >
          {exporting === 'csv' ? 'Generating…' : 'Export XLS/CSV'}
        </Btn>
      </PageHeader>

      {/* Filter row */}
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Field label="From">
            <Input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          </Field>
          <Field label="To">
            <Input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
          </Field>
          <Field label="Approval Status">
            <Select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REJECTED">Rejected</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Btn className="w-full" onClick={handleApply}>Apply Filters</Btn>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : error ? (
        <Alert variant="error">Failed to load reports: {error.message}</Alert>
      ) : (
        <>
          {/* Summary KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <KpiCard
              label="Quotes Created"
              value={summary?.quotationsCreated ?? 0}
              sub="in selected period"
            />
            <KpiCard
              label="Avg Approval Time"
              value={summary?.avgApprovalTimeHours != null ? `${summary.avgApprovalTimeHours}h` : '—'}
              sub="from submit to approval"
            />
            <KpiCard
              label="Top Upsold Product"
              value={summary?.topUpsoldProduct ?? '—'}
              sub="most added from suggestions"
            />
          </div>

          {/* Quotations table */}
          <Card>
            <Table
              columns={columns}
              rows={quotations}
              emptyText="No quotations match the selected filters."
            />
          </Card>
        </>
      )}
    </div>
  );
}
