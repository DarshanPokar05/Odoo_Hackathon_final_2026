import { useNavigate } from 'react-router-dom';
import { useQuery }    from '@tanstack/react-query';
import { portalApi }   from '../../api/portal.js';
import { PageHeader, Card, StageBadge, Spinner, Alert, Btn } from '../../components/ui.jsx';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n ?? 0));
}

function quoteTotal(lines = []) {
  return lines.reduce(
    (s, l) => s + Number(l.unitPrice) * l.quantity * (1 - Number(l.discountPercent) / 100),
    0
  );
}

export default function PortalQuotationsPage() {
  const navigate = useNavigate();

  const { data: quotations = [], isLoading, error } = useQuery({
    queryKey: ['portal-quotations'],
    queryFn:  () => portalApi.listQuotations(),
  });

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error)     return <Alert variant="error">Failed to load your quotations: {error.message}</Alert>;

  return (
    <div>
      <PageHeader title="My Quotations" breadcrumb="Customer Portal" />

      {quotations.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-[var(--text-secondary)]">
            No quotations yet. Your sales representative will share one with you soon.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {quotations.map(q => {
            const total = quoteTotal(q.lines);
            return (
              <div
                key={q.id}
                className="surface rounded-xl p-4 flex items-center justify-between gap-4 cursor-pointer hover:shadow-md transition-all"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/portal/${q.id}`)}
                onKeyDown={e => e.key === 'Enter' && navigate(`/portal/${q.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StageBadge status={q.status} />
                    <span className="text-xs text-[var(--text-secondary)] font-mono-df">
                      #{q.id.slice(0, 8)}…
                    </span>
                  </div>
                  <p className="font-mono-df font-bold text-[var(--accent-solid)] text-lg mt-1">
                    {fmt(total)}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {q.lines?.length ?? 0} line{q.lines?.length !== 1 ? 's' : ''} ·
                    Last updated {new Date(q.lastActivityAt).toLocaleDateString()}
                  </p>
                </div>
                {/* Explicit navigate on Btn to ensure click always works */}
                <Btn
                  size="sm"
                  variant="outline"
                  onClick={e => { e.stopPropagation(); navigate(`/portal/${q.id}`); }}
                >
                  View →
                </Btn>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
