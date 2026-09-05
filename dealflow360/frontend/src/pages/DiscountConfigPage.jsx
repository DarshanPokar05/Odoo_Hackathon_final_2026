import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { discountConfigApi } from '../api/discountConfig.js';
import { categoriesApi }     from '../api/categories.js';
import {
  PageHeader, Btn, Card, Field, Input, Select,
  Table, Spinner, Alert,
} from '../components/ui.jsx';

const TIERS         = ['BRONZE', 'SILVER', 'GOLD'];
const APPROVAL_LEVELS = [
  { value: 'NONE',                        label: 'No approval needed' },
  { value: 'SALES_MANAGER',               label: 'Sales Manager' },
  { value: 'SALES_MANAGER_THEN_FINANCE',  label: 'Sales Manager then Finance' },
];

const emptyRule = () => ({
  _key:          crypto.randomUUID(),
  minScore:      '',
  maxScore:      '',
  requiredLevel: 'NONE',
});

export default function DiscountConfigPage() {
  const queryClient = useQueryClient();

  // ── Remote data ──────────────────────────────────────────────────────────
  const { data: ceilings = [],     isLoading: cLoad } =
    useQuery({ queryKey: ['ceilings'],      queryFn: discountConfigApi.listCeilings });

  const { data: approvalRules = [], isLoading: aLoad } =
    useQuery({ queryKey: ['approvalRules'], queryFn: discountConfigApi.listApprovalRules });

  const { data: categories = [],   isLoading: catLoad } =
    useQuery({ queryKey: ['categories'],    queryFn: categoriesApi.list });

  // ── Local state ───────────────────────────────────────────────────────────
  // Tier ceilings — keyed by tier name
  const [tierForm, setTierForm]   = useState({ BRONZE: '5', SILVER: '10', GOLD: '20' });
  const [rules,    setRules]      = useState([]);
  const [error,    setError]      = useState('');
  const [saveOk,   setSaveOk]     = useState('');

  // Hydrate tier form from server
  useEffect(() => {
    if (ceilings.length) {
      const map = {};
      ceilings.forEach((c) => { map[c.tier] = String(c.maxDiscountPercent); });
      setTierForm((prev) => ({ ...prev, ...map }));
    }
  }, [ceilings]);

  // Hydrate approval rules
  useEffect(() => {
    if (approvalRules.length) {
      setRules(approvalRules.map((r) => ({
        ...r,
        _key:     r.id,
        maxScore: r.maxScore === null ? '' : String(r.maxScore),
        minScore: String(r.minScore),
      })));
    }
  }, [approvalRules]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveCeilingsMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        TIERS.map((tier) =>
          discountConfigApi.updateCeiling(tier, {
            maxDiscountPercent: parseFloat(tierForm[tier]),
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ceilings'] });
    },
    onError: (e) => setError(e.response?.data?.error?.message ?? e.message),
  });

  const saveRulesMutation = useMutation({
    mutationFn: (rulePayload) => discountConfigApi.saveApprovalRules(rulePayload),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['approvalRules'] }),
    onError:    (e) => setError(e.response?.data?.error?.message ?? e.message),
  });

  // ── Save all ──────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setError(''); setSaveOk('');

    // Build rule payload — empty maxScore → null (unbounded)
    const rulePayload = rules
      .filter((r) => r.minScore !== '')
      .map(({ _key, id, minScore, maxScore, requiredLevel }) => ({
        ...(id && !id.startsWith('tmp') ? { id } : {}),
        minScore:      parseFloat(minScore) || 0,
        maxScore:      maxScore === '' ? null : parseFloat(maxScore),
        requiredLevel,
      }));

    try {
      await saveCeilingsMutation.mutateAsync();
      await saveRulesMutation.mutateAsync(rulePayload);
      setSaveOk('Configuration saved successfully.');
    } catch { /* errors set inside mutations */ }
  };

  // ── Rule row helpers ──────────────────────────────────────────────────────
  const setRuleField = (key, field, val) =>
    setRules((prev) => prev.map((r) => r._key === key ? { ...r, [field]: val } : r));
  const addRule    = ()    => setRules((prev) => [...prev, emptyRule()]);
  const removeRule = (key) => setRules((prev) => prev.filter((r) => r._key !== key));

  const isLoading = cLoad || aLoad || catLoad;

  // ── Category ceiling table columns ────────────────────────────────────────
  const catCols = [
    { key: 'name',               label: 'Category' },
    { key: 'maxDiscountPercent', label: 'Max Discount %',
      render: (c) => `${Number(c.maxDiscountPercent).toFixed(1)}%` },
    { key: 'productCount',       label: 'Products',
      render: (c) => c._count?.products ?? 0 },
  ];

  // ── Approval rule table columns ───────────────────────────────────────────
  const ruleCols = [
    { key: 'minScore', label: 'Min Score', render: (r) => (
      <Input type="number" min="0" step="0.01" value={r.minScore}
        placeholder="0"
        onChange={(e) => setRuleField(r._key, 'minScore', e.target.value)} />
    )},
    { key: 'maxScore', label: 'Max Score (blank = unbounded)', render: (r) => (
      <Input type="number" min="0" step="0.01" value={r.maxScore}
        placeholder="leave blank for ∞"
        onChange={(e) => setRuleField(r._key, 'maxScore', e.target.value)} />
    )},
    { key: 'requiredLevel', label: 'Required Approval', render: (r) => (
      <Select value={r.requiredLevel}
        onChange={(e) => setRuleField(r._key, 'requiredLevel', e.target.value)}>
        {APPROVAL_LEVELS.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </Select>
    )},
    { key: 'del', label: '', render: (r) => (
      <Btn variant="danger" type="button" onClick={() => removeRule(r._key)}>×</Btn>
    )},
  ];

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="Discount Tiers & Approval Chains" />

      {error  && <Alert variant="error"   className="mb-4">{error}</Alert>}
      {saveOk && <Alert variant="success" className="mb-4">{saveOk}</Alert>}

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── Tier Discount Ceilings ────────────────────────────────────── */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
            Tier Discount Ceilings
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tier</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Max Discount %</th>
                </tr>
              </thead>
              <tbody>
                {TIERS.map((tier) => (
                  <tr key={tier} className="border-b border-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-700">{tier}</td>
                    <td className="px-4 py-3 w-40">
                      <Field>
                        <Input
                          type="number" min="0" max="100" step="0.1"
                          value={tierForm[tier]}
                          onChange={(e) => setTierForm((prev) => ({ ...prev, [tier]: e.target.value }))}
                        />
                      </Field>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── Category Discount Ceilings (read-only — edited per category) ─ */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">
            Category Discount Ceilings
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Set per-category in the category configuration. Shown here for reference. The effective ceiling for any line = MIN(tier ceiling, category ceiling).
          </p>
          <Table columns={catCols} rows={categories} emptyText="No categories configured yet." />
        </Card>

        {/* ── Discount Range → Approval Level ──────────────────────────── */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                Discount Range → Approval Level
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Map a blended risk score range to the required approval chain. Ranges must be contiguous, start at 0, and end with one unbounded rule (leave Max Score blank).
              </p>
            </div>
            <Btn variant="secondary" type="button" onClick={addRule}>+ Add Range</Btn>
          </div>
          <Table
            columns={ruleCols}
            rows={rules}
            emptyText="No approval rules configured."
          />
        </Card>

        {/* ── Footnote ─────────────────────────────────────────────────── */}
        <p className="text-xs text-gray-500 italic">
          When a quote mixes categories with different ceilings, the system must compute a blended
          risk score and route to the highest required level. All approvals, rejections, and edits
          must be logged with user, timestamp, and reason.
        </p>

        {/* ── Save ─────────────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <Btn type="submit" disabled={saveCeilingsMutation.isPending || saveRulesMutation.isPending}>
            {saveCeilingsMutation.isPending || saveRulesMutation.isPending
              ? 'Saving…'
              : 'Save Configuration'}
          </Btn>
        </div>
      </form>
    </div>
  );
}
