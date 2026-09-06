import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../api/invoices.js';
import {
  PageHeader, Btn, Card, Alert, Spinner, Badge, FlowMeter, toast,
} from '../components/ui.jsx';

function fmt(n) { return Number(n ?? 0).toFixed(2); }

const INVOICE_STEPS = ['Order Confirmed', 'Shipped', 'Invoiced', 'Paid'];

function statusToStep(status) {
  if (status === 'PAID')    return 'Paid';
  if (status === 'PARTIAL') return 'Invoiced';
  return 'Invoiced';
}

// ── Minimal Razorpay checkout ──────────────────────────────────────────────────
function openRazorpay({ razorpayOrderId, amount, currency, keyId, invoiceId, onSuccess, onError }) {
  if (!window.Razorpay) {
    onError('Razorpay SDK not loaded. Check your network connection.');
    return;
  }
  const rzp = new window.Razorpay({
    key:         keyId,
    order_id:    razorpayOrderId,
    amount,
    currency,
    name:        'DealFlow360',
    description: `Invoice #${invoiceId.slice(0, 8).toUpperCase()}`,
    handler: (response) => {
      onSuccess({
        razorpayOrderId,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
        invoiceId,
      });
    },
    modal: { ondismiss: () => {} },
  });
  rzp.open();
}

export default function InvoiceDetailPage() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const [paying,    setPaying]    = useState(false);
  const [actionError, setActionError] = useState('');

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn:  () => invoicesApi.getOne(id),
  });

  const verifyMutation = useMutation({
    mutationFn: body => invoicesApi.verifyPayment(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setPaying(false);
      toast('Payment verified — invoice marked Paid!', 'success');
    },
    onError: e => {
      setPaying(false);
      setActionError(e.response?.data?.error?.message ?? 'Payment verification failed');
    },
  });

  const handlePay = async () => {
    setPaying(true);
    setActionError('');
    try {
      const order = await invoicesApi.createOrder({ invoiceId: id });
      openRazorpay({
        ...order,
        onSuccess: body => verifyMutation.mutate(body),
        onError:   msg  => { setPaying(false); setActionError(msg); },
      });
    } catch (e) {
      setPaying(false);
      setActionError(e.response?.data?.error?.message ?? 'Failed to initiate payment');
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error)     return <Alert variant="error">Invoice not found or access denied.</Alert>;

  const customer   = invoice.order?.quotation?.customer;
  const lines      = invoice.order?.quotation?.lines?.filter(l =>
    invoice.type === 'ONE_TIME' ? l.lineType === 'ONE_TIME' : l.lineType === 'RECURRING'
  ) ?? [];
  const isPaid     = invoice.status === 'PAID';
  const activeStep = statusToStep(invoice.status);

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Invoice Detail" breadcrumb="Invoices / Detail">
        <Btn variant="secondary" size="sm" onClick={() => navigate('/invoices')}>← Back</Btn>
      </PageHeader>

      {actionError && <Alert variant="error" className="mb-4">{actionError}</Alert>}

      {/* Status stepper */}
      <Card className="p-5 mb-4">
        <FlowMeter steps={INVOICE_STEPS} activeStep={activeStep} />
      </Card>

      {/* Invoice meta */}
      <Card className="p-5 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Invoice #</p>
            <p className="font-mono-df font-bold text-lg text-[var(--text-primary)]">
              #{id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Status</p>
            <Badge
              label={invoice.status}
              color={isPaid ? 'green' : invoice.status === 'PARTIAL' ? 'blue' : 'yellow'}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm mb-4">
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Customer</p>
            <p className="font-medium text-[var(--text-primary)]">{customer?.companyName ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Type</p>
            <p className="font-medium text-[var(--text-primary)]">{invoice.type?.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">Due Date</p>
            <p className="font-medium text-[var(--text-primary)]">
              {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>

        {/* Line items */}
        {lines.length > 0 && (
          <div className="overflow-x-auto border border-[var(--border)] rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-alt)]">
                <tr>
                  {['Product', 'Qty', 'Unit Price', 'Discount', 'Total'].map(h => (
                    <th key={h} className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map(l => {
                  const lineTotal = Number(l.unitPrice) * l.quantity * (1 - Number(l.discountPercent) / 100);
                  return (
                    <tr key={l.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2.5">{l.product?.name ?? '—'}</td>
                      <td className="px-3 py-2.5 tabular-nums">{l.quantity}</td>
                      <td className="px-3 py-2.5 font-mono-df tabular-nums">${fmt(l.unitPrice)}</td>
                      <td className="px-3 py-2.5 font-mono-df tabular-nums">{fmt(l.discountPercent)}%</td>
                      <td className="px-3 py-2.5 font-mono-df tabular-nums font-semibold">${fmt(lineTotal)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-[var(--surface-alt)] border-t border-[var(--border)]">
                  <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase">Total</td>
                  <td className="px-3 py-2.5 font-mono-df font-bold text-[var(--text-primary)] text-base">${fmt(invoice.amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Footnote per wireframe */}
        <p className="text-xs text-[var(--text-secondary)] italic mt-3">
          Partial invoicing stays recorded with partial delivery — nothing is billed before it ships.
        </p>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {!isPaid && (
          <Btn
            onClick={handlePay}
            disabled={paying || verifyMutation.isPending}
          >
            {paying ? 'Opening payment…' : '💳 Pay with Razorpay'}
          </Btn>
        )}
        {isPaid && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-medium">
            ✓ Paid
          </div>
        )}
        {invoice.pdfPath && (
          <Btn
            variant="secondary"
            onClick={() => window.open(`/invoices-pdf/invoice-${invoice.id}.pdf`, '_blank')}
          >
            Download PDF
          </Btn>
        )}
      </div>

      {/* Razorpay setup hint */}
      {!isPaid && (
        <p className="text-xs text-[var(--text-secondary)] mt-2">
          Add <code className="bg-[var(--surface-alt)] px-1 rounded">RAZORPAY_KEY_ID</code> and{' '}
          <code className="bg-[var(--surface-alt)] px-1 rounded">RAZORPAY_KEY_SECRET</code> to{' '}
          <code className="bg-[var(--surface-alt)] px-1 rounded">backend/.env</code> to enable live payments.
          Test keys start with <code className="bg-[var(--surface-alt)] px-1 rounded">rzp_test_</code>.
        </p>
      )}
    </div>
  );
}
