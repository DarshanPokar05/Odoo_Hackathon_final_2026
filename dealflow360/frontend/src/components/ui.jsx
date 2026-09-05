/**
 * Shared UI primitives — keeps page files clean.
 * All components are unstyled enough to customise per page.
 */

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  );
}

// ── KPI Summary Card ──────────────────────────────────────────────────────────
export function KpiCard({ label, value, sub }) {
  return (
    <Card className="p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      <span className="text-3xl font-bold text-brand-700">{value ?? '—'}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </Card>
  );
}

// ── Page Header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, children }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-xl font-bold text-gray-800">{title}</h1>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, type = 'button', variant = 'primary', disabled = false, className = '' }) {
  const base   = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const styles = {
    primary:   'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger:    'bg-red-500 text-white hover:bg-red-600',
    ghost:     'text-brand-600 hover:bg-brand-50',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

// ── Form Field ────────────────────────────────────────────────────────────────
export function Field({ label, error, children }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${className}`}
    />
  );
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ children, className = '', ...props }) {
  return (
    <select
      {...props}
      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white ${className}`}
    >
      {children}
    </select>
  );
}

// ── Textarea ──────────────────────────────────────────────────────────────────
export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      {...props}
      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y ${className}`}
    />
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-gray-300'}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
      <span className="text-xs text-gray-500">{checked ? 'Yes' : 'No'}</span>
    </label>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ columns, rows, onRowClick, emptyText = 'No data' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-gray-50 ${onRowClick ? 'cursor-pointer hover:bg-brand-50' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 text-gray-700">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ className = '' }) {
  return (
    <svg className={`animate-spin h-5 w-5 text-brand-600 ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
export function Alert({ variant = 'error', children }) {
  const styles = {
    error:   'bg-red-50 border-red-200 text-red-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    info:    'bg-blue-50 border-blue-200 text-blue-700',
  };
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm ${styles[variant]}`} role="alert">
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ label, color = 'gray' }) {
  const colors = {
    gray:   'bg-gray-100 text-gray-600',
    blue:   'bg-blue-100 text-blue-700',
    green:  'bg-green-100 text-green-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    red:    'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${colors[color]}`}>
      {label}
    </span>
  );
}
