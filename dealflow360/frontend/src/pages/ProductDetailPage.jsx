import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi }   from '../api/products.js';
import { categoriesApi } from '../api/categories.js';
import { priceListsApi } from '../api/priceLists.js';
import {
  PageHeader, Btn, Card, Field, Input, Select,
  Textarea, Toggle, Table, Spinner, Alert,
} from '../components/ui.jsx';

// ── Empty-row factories ───────────────────────────────────────────────────────
const emptyVariant    = () => ({ _key: crypto.randomUUID(), attributeName: '', value: '', extraPrice: 0 });
const emptyPriceRule  = () => ({ _key: crypto.randomUUID(), tier: 'BRONZE', currency: 'USD', ruleType: 'FIXED', value: '', productId: null });

const TIERS     = ['BRONZE', 'SILVER', 'GOLD'];
const INTERVALS = ['MONTHLY', 'QUARTERLY', 'YEARLY'];

export default function ProductDetailPage() {
  const params       = useParams();
  const id           = params.id || 'new';
  const isNew        = id === 'new';
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();

  // ── Remote data ──────────────────────────────────────────────────────────
  const { data: categories = [] } =
    useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list() });

  const { data: existing, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn:  () => productsApi.getOne(id),
    enabled:  !isNew,
  });

  const { data: allRules } = useQuery({
    queryKey: ['priceLists', id],
    queryFn:  () => priceListsApi.list({ productId: isNew ? undefined : id }),
    enabled:  !isNew,
  });

  // ── Local form state ─────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: '', categoryId: '', price: '', unit: '',
    taxPercent: '0', description: '', isSubscription: false,
    subscriptionInterval: 'MONTHLY',
  });
  const [variants,   setVariants]   = useState([emptyVariant()]);
  const [priceRules, setPriceRules] = useState([]);
  const [error, setError]   = useState('');
  const [success, setSucc]  = useState('');

  // Hydrate on load
  useEffect(() => {
    if (existing) {
      setForm({
        name:                 existing.name,
        categoryId:           existing.categoryId,
        price:                String(existing.price),
        unit:                 existing.unit,
        taxPercent:           String(existing.taxPercent),
        description:          existing.description ?? '',
        isSubscription:       existing.isSubscription,
        subscriptionInterval: 'MONTHLY',
      });
      setVariants(
        existing.variants.length
          ? existing.variants.map((v) => ({ ...v, _key: v.id }))
          : [emptyVariant()]
      );
    }
  }, [existing]);

  useEffect(() => {
    if (allRules) {
      setPriceRules(allRules.map((r) => ({ ...r, _key: r.id })));
    }
  }, [allRules]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (payload) =>
      isNew ? productsApi.create(payload) : productsApi.update(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setSucc(isNew ? 'Product created.' : 'Product updated.');
      if (isNew) navigate(`/products/${data.id}`, { replace: true });
    },
    onError: (e) => setError(e.response?.data?.error?.message ?? e.message),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId) => priceListsApi.remove(ruleId),
    onSuccess:  ()       => queryClient.invalidateQueries({ queryKey: ['priceLists', id] }),
  });

  const saveRuleMutation = useMutation({
    mutationFn: (rule) =>
      rule.id
        ? priceListsApi.update(rule.id, rule)
        : priceListsApi.create({ ...rule, productId: id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['priceLists', id] }),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    setError(''); setSucc('');
    const cleanVariants = variants
      .filter((v) => v.attributeName.trim() && v.value.trim())
      .map(({ _key, id: vid, extraPrice, ...rest }) => ({
        ...rest,
        extraPrice: parseFloat(extraPrice || 0),
        ...(vid ? { id: vid } : {})
      }));

    saveMutation.mutate({
      ...form,
      price:      parseFloat(form.price),
      taxPercent: parseFloat(form.taxPercent),
      variants:   cleanVariants,
    });
  };

  // Variant row helpers
  const setVariantField = (key, field, val) =>
    setVariants((prev) => prev.map((v) => v._key === key ? { ...v, [field]: val } : v));
  const addVariant    = ()    => setVariants((prev) => [...prev, emptyVariant()]);
  const removeVariant = (key) => setVariants((prev) => prev.filter((v) => v._key !== key));

  // Price rule helpers
  const setPriceField  = (key, field, val) =>
    setPriceRules((prev) => prev.map((r) => r._key === key ? { ...r, [field]: val } : r));
  const addPriceRule   = ()    => setPriceRules((prev) => [...prev, emptyPriceRule()]);
  const removePriceRule = (rule) => {
    if (rule.id) { deleteRuleMutation.mutate(rule.id); return; }
    setPriceRules((prev) => prev.filter((r) => r._key !== rule._key));
  };
  const savePriceRule  = (rule) => {
    if (!rule.value || !rule.tier) return;
    saveRuleMutation.mutate({ ...rule, value: parseFloat(rule.value) });
  };

  if (!isNew && isLoading) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  // ── Variant table columns ─────────────────────────────────────────────────
  const variantCols = [
    { key: 'attributeName', label: 'Attribute', render: (v) => (
      <Input value={v.attributeName} placeholder="e.g. RAM"
        onChange={(e) => setVariantField(v._key, 'attributeName', e.target.value)} />
    )},
    { key: 'value', label: 'Values', render: (v) => (
      <Input value={v.value} placeholder="e.g. 16GB"
        onChange={(e) => setVariantField(v._key, 'value', e.target.value)} />
    )},
    { key: 'extraPrice', label: 'Extra Price ($)', render: (v) => (
      <Input type="number" min="0" step="0.01" value={v.extraPrice}
        onChange={(e) => setVariantField(v._key, 'extraPrice', parseFloat(e.target.value) || 0)} />
    )},
    { key: 'displayPrice', label: 'Displayed Price', render: (v) => (
      <span className="text-gray-500 text-sm">
        ${(parseFloat(form.price || 0) + parseFloat(v.extraPrice || 0)).toFixed(2)}
      </span>
    )},
    { key: 'del', label: '', render: (v) => (
      <Btn variant="danger" onClick={() => removeVariant(v._key)}>×</Btn>
    )},
  ];

  // ── Price list table columns ──────────────────────────────────────────────
  const priceCols = [
    { key: 'tier', label: 'Tier', render: (r) => (
      <Select value={r.tier} onChange={(e) => setPriceField(r._key, 'tier', e.target.value)}>
        {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
      </Select>
    )},
    { key: 'currency', label: 'Currency', render: (r) => (
      <Input value={r.currency} maxLength={3} style={{ width: 70 }}
        onChange={(e) => setPriceField(r._key, 'currency', e.target.value.toUpperCase())} />
    )},
    { key: 'ruleType', label: 'Price Rule', render: (r) => (
      <Select value={r.ruleType} onChange={(e) => setPriceField(r._key, 'ruleType', e.target.value)}>
        <option value="FIXED">Fixed Price</option>
        <option value="PERCENT_OFF_BASE">% Off Base</option>
      </Select>
    )},
    { key: 'value', label: 'Value', render: (r) => (
      <Input type="number" min="0" step="0.01" value={r.value}
        placeholder={r.ruleType === 'FIXED' ? 'e.g. 999.00' : 'e.g. 10'}
        onChange={(e) => setPriceField(r._key, 'value', e.target.value)} />
    )},
    { key: 'actions', label: '', render: (r) => (
      <div className="flex gap-1">
        <Btn variant="ghost" onClick={() => savePriceRule(r)}>Save</Btn>
        <Btn variant="danger" onClick={() => removePriceRule(r)}>×</Btn>
      </div>
    )},
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title={isNew ? 'New Product' : (existing?.name ?? 'Product Detail')}>
        <Btn variant="secondary" onClick={() => navigate('/products')}>← Back</Btn>
      </PageHeader>

      {error   && <Alert variant="error"   className="mb-4">{error}</Alert>}
      {success && <Alert variant="success" className="mb-4">{success}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── General Info ──────────────────────────────────────────────── */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">General Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Product Name">
              <Input required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Category">
              <Select required value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Select category…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Base Price ($)">
              <Input required type="number" min="0" step="0.01" value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field label="Unit">
              <Input required value={form.unit} placeholder="e.g. each, license, seat"
                onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </Field>
            <Field label="Tax %">
              <Input required type="number" min="0" max="100" step="0.1" value={form.taxPercent}
                onChange={(e) => setForm({ ...form, taxPercent: e.target.value })} />
            </Field>
            <div className="flex items-end pb-1">
              <Toggle
                label="Subscription product?"
                checked={form.isSubscription}
                onChange={(v) => setForm({ ...form, isSubscription: v })}
              />
            </div>
            {form.isSubscription && (
              <Field label="Recurring Interval">
                <Select value={form.subscriptionInterval}
                  onChange={(e) => setForm({ ...form, subscriptionInterval: e.target.value })}>
                  {INTERVALS.map((i) => <option key={i} value={i}>{i.charAt(0) + i.slice(1).toLowerCase()}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Description" className="sm:col-span-2">
              <Textarea rows={3} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
        </Card>

        {/* ── Variants ──────────────────────────────────────────────────── */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Variants</h2>
            <Btn variant="secondary" type="button" onClick={addVariant}>+ Add Variant</Btn>
          </div>
          <Table columns={variantCols} rows={variants} emptyText="No variants. Click + Add Variant." />
          <p className="mt-2 text-xs text-gray-400">Extra Price adds to the base price when this variant is selected on a quotation line.</p>
        </Card>

        {/* ── Save general info ─────────────────────────────────────────── */}
        <div className="flex justify-end gap-2">
          <Btn variant="secondary" type="button" onClick={() => navigate('/products')}>Cancel</Btn>
          <Btn type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : isNew ? 'Create Product' : 'Save Changes'}
          </Btn>
        </div>
      </form>

      {/* ── Price List (only shown after product exists) ──────────────── */}
      {!isNew && (
        <Card className="p-5 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Price List Rules</h2>
            <Btn variant="secondary" type="button" onClick={addPriceRule}>+ Add Rule</Btn>
          </div>
          <Table
            columns={priceCols}
            rows={priceRules}
            emptyText="No price rules. Add one per tier/currency."
          />
          <p className="mt-2 text-xs text-gray-400">
            Rules here override the tier-level blanket price. FIXED = absolute price; % Off Base = percentage discount off the product's base price.
          </p>
        </Card>
      )}
    </div>
  );
}
