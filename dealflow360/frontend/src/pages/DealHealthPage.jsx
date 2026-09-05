import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealHealthApi }  from '../api/dealHealth.js';
import { useSocket }      from '../hooks/useSocket.js';
import { useLivePulse }   from '../hooks/useLivePulse.js';
import {
  PageHeader, Card, KpiCard, Table, Spinner, Alert, Btn, Badge,
  Field, Textarea, Modal, toast, useConfirm, LiveDot,
} from '../components/ui.jsx';

const FLAG_BADGE = {
  STALLED:          { label: 'Stalled',           color: 'red'    },
  DISCOUNT_ANOMALY: { label: 'Discount Anomaly',  color: 'yellow' },
  DELIVERY_SLIPPAGE:{ label: 'Delivery Slippage', color: 'blue'   },
};

export default function DealHealthPage() {
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const socketRef   = useSocket();

  const [escalateTarget, setEscalateTarget] = useState(null);
  const [escalateNote,   setEscalateNote]   = useState('');
  const { openConfirm, ConfirmModal } = useConfirm();

  const { data: flags = [], isLoading, error } = useQuery({
    queryKey: ['deal-health'],
    queryFn:  () => dealHealthApi.list(),
  });

  const stalled   = flags.filter(f => f.type === 'STALLED'           && !f.resolved).length;
  const anomalies = flags.filter(f => f.type === 'DISCOUNT_ANOMALY'  && !f.resolved).length;
  const slippage  = flags.filter(f => f.type === 'DELIVERY_SLIPPAGE' && !f.resolved).length;

  // Live pulse on counts
  const stalledPulse   = useLivePulse(stalled);
  const anomalyPulse   = useLivePulse(anomalies);
  const slippagePulse  = useLivePulse(slippage);

  useEffect(() => { stalledPulse.trigger(stalled); },   [stalled]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { anomalyPulse.trigger(anomalies); }, [anomalies]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { slippagePulse.trigger(slippage); }, [slippage]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time: add new flag to list without refresh
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const onFlag = () => qc.invalidateQueries({ queryKey: ['deal-health'] });
    socket.on('DEAL_HEALTH_FLAGGED', onFlag);
    return () => socket.off('DEAL_HEALTH_FLAGGED', onFlag);
  }, [socketRef, qc]);

  const resolveMutation = useMutation({
    mutationFn: id => dealHealthApi.resolve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal-health'] });
      toast('Flag resolved', 'success');
    },
    onError: e => toast(e.response?.data?.error?.message ?? 'Failed', 'error'),
  });

  const escalateMutation = useMutation({
    mutationFn: ({ id, note }) => dealHealthApi.escalate(id, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deal-health'] });
      setEscalateTarget(null);
      setEscalateNote('');
      toast('Escalated to managers', 'info');
    },
    onError: e => toast(e.response?.data?.error?.message ?? 'Failed', 'error'),
  });

  const activeFlags = flags.filter(f => !f.resolved);

  const columns = [
    {
      key: 'deal', label: 'Deal',
      render: f => (
        <button
          className="text-sm font-medium text-[var(--accent-solid)] hover:underline text-left"
          onClick={() => navigate(`/quotations/${f.quotationId}`)}
        >
          {f.quotation?.customer?.companyName ?? f.quotationId.slice(0, 8) + '…'}
        </button>
      ),
    },
    {
      key: 'issue', label: 'Issue',
      render: f => {
        const b = FLAG_BADGE[f.type] ?? { label: f.type, color: 'gray' };
        return (
          <div>
            <Badge label={b.label} color={b.color} />
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs truncate">{f.detail}</p>
          </div>
        );
      },
    },
    {
      key: 'flagged', label: 'Flagged',
      render: f => (
        <span className="text-xs text-[var(--text-secondary)]">
          {new Date(f.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions', label: 'Action',
      render: f => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Btn
            size="sm" variant="ghost"
            onClick={() => setEscalateTarget(f)}
          >
            Escalate
          </Btn>
          {!f.resolved && (
            <Btn
              size="sm" variant="secondary"
              onClick={() => openConfirm('Mark this flag as resolved?', () => resolveMutation.mutate(f.id))}
              disabled={resolveMutation.isPending}
            >
              Resolve
            </Btn>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error)     return <Alert variant="error">Failed to load deal health data: {error.message}</Alert>;

  return (
    <div>
      <PageHeader title="Deal Health" breadcrumb="Monitoring">
        <LiveDot />
      </PageHeader>

      {/* KPI cards with live pulse */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Stalled Deals"
          value={stalledPulse.displayValue ?? stalled}
          isPulsing={stalledPulse.isPulsing}
          sub="no activity 48h+"
        />
        <KpiCard
          label="Discount Anomalies"
          value={anomalyPulse.displayValue ?? anomalies}
          isPulsing={anomalyPulse.isPulsing}
          sub="above rep average"
        />
        <KpiCard
          label="Delivery Slippage"
          value={slippagePulse.displayValue ?? slippage}
          isPulsing={slippagePulse.isPulsing}
          sub="confirmed not shipped"
        />
      </div>

      {/* Flagged deals table */}
      <Card>
        <Table
          columns={columns}
          rows={activeFlags}
          emptyText="No active deal health flags. All deals are on track."
        />
      </Card>

      {/* Escalate modal */}
      <Modal
        open={!!escalateTarget}
        onClose={() => { setEscalateTarget(null); setEscalateNote(''); }}
        title="Escalate Flag"
      >
        <p className="text-sm text-[var(--text-secondary)] mb-3">
          Add a note and notify managers via the deal health channel.
        </p>
        <Field label="Note" required>
          <Textarea
            rows={3}
            value={escalateNote}
            onChange={e => setEscalateNote(e.target.value)}
            placeholder="Describe the urgency or context…"
          />
        </Field>
        <div className="flex justify-end gap-2 mt-4">
          <Btn variant="secondary" onClick={() => { setEscalateTarget(null); setEscalateNote(''); }}>Cancel</Btn>
          <Btn
            disabled={!escalateNote.trim() || escalateMutation.isPending}
            onClick={() => escalateMutation.mutate({ id: escalateTarget.id, note: escalateNote })}
          >
            {escalateMutation.isPending ? 'Escalating…' : 'Escalate'}
          </Btn>
        </div>
      </Modal>

      {ConfirmModal}
    </div>
  );
}
