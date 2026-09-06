import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../api/products.js';
import { categoriesApi } from '../api/categories.js';
import { priceListsApi } from '../api/priceLists.js';
import {
  PageHeader, Btn, KpiCard, Table, Card,
  Spinner, Alert, Badge,
} from '../components/ui.jsx';

export default function ProductDashboardPage() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const [catFilter, setCatFilter] = useState('');
  const [search,    setSearch]    = useState('');

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: products = [], isLoading: pLoading, error: pError } =
    useQuery({ queryKey: ['products'], queryFn: () => productsApi.list() });

  const { data: categories = [] } =
    useQuery({ queryKey: ['categories'], queryFn: () => categoriesApi.list() });

  const { data: priceLists = [] } =
    useQuery({ queryKey: ['priceLists'], queryFn: () => priceListsApi.list() });

  const deleteMutation = useMutation({
    mutationFn: (id) => productsApi.remove(id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['products'] }),
    onError:    (e) => alert(e.response?.data?.error?.message ?? 'Failed to delete product'),
  });

  // ── Derived KPIs ──────────────────────────────────────────────────────────
  const totalVariants  = products.reduce((s, p) => s + (p.variants?.length ?? 0), 0);
  const totalPriceLists = priceLists.length;

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const visible = products.filter((p) => {
    const matchCat    = !catFilter || p.categoryId === catFilter;
    const matchSearch = !search    || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = [
    { key: 'name',     label: 'Product Name', render: (p) => (
      <span className="font-medium text-brand-700">{p.name}</span>
    )},
    { key: 'category', label: 'Category', render: (p) => p.category?.name ?? '—' },
    { key: 'price',    label: 'Base Price', render: (p) => `$${Number(p.price).toFixed(2)}` },
    { key: 'unit',     label: 'Unit' },
    { key: 'taxPercent', label: 'Tax %', render: (p) => `${Number(p.taxPercent).toFixed(1)}%` },
    { key: 'variants', label: 'Variants', render: (p) => p.variants?.length ?? 0 },
    { key: 'type',     label: 'Type', render: (p) => (
      p.isSubscription
        ? <Badge label="Recurring" color="blue" />
        : <Badge label="One-time"  color="gray" />
    )},
    { key: 'actions',  label: '', render: (p) => (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Btn variant="ghost" onClick={() => navigate(`/products/${p.id}`)}>Edit</Btn>
        <Btn
          variant="danger"
          onClick={() => { if (window.confirm(`Delete "${p.name}"?`)) deleteMutation.mutate(p.id); }}
        >
          Delete
        </Btn>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Product Catalog">
        <Btn onClick={() => navigate('/products/new')}>+ New Product</Btn>
        <Btn variant="secondary" onClick={() => navigate('/discount-config')}>Manage Price Fields</Btn>
      </PageHeader>

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Products"  value={products.length}  sub="across all categories" />
        <KpiCard label="Price List Rules" value={totalPriceLists} sub="tier & currency rules" />
        <KpiCard label="Total Variants"  value={totalVariants}    sub="attribute combinations" />
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <Card className="mb-4 p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Card>

      {/* ── Catalog table ─────────────────────────────────────────────────── */}
      <Card>
        {pLoading && (
          <div className="flex justify-center py-12"><Spinner /></div>
        )}
        {pError && (
          <div className="p-4">
            <Alert variant="error">Failed to load products: {pError.message}</Alert>
          </div>
        )}
        {!pLoading && !pError && (
          <Table
            columns={columns}
            rows={visible}
            onRowClick={(p) => navigate(`/products/${p.id}`)}
            emptyText="No products found. Create one to get started."
          />
        )}
      </Card>
    </div>
  );
}
