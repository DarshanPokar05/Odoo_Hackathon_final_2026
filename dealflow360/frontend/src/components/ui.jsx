/**
 * DealFlow360 — Shared UI primitives
 * All components use CSS variable–based theming so they work in both light and dark mode.
 * Import from this file everywhere; don't inline design tokens in page files.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Toast context (simple global state, no external lib needed) ───────────────
let _toastListeners = [];
let _toastId = 0;

export function toast(message, type = 'info', duration = 3500) {
  const id = ++_toastId;
  _toastListeners.forEach((fn) => fn({ id, message, type }));
  if (duration > 0) {
    setTimeout(() => _toastListeners.forEach((fn) => fn({ id, remove: true })), duration);
  }
}

/** Mount once at app root — <ToastContainer /> */
export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const listener = (t) => {
      if (t.remove) {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      } else {
        setToasts((prev) => [...prev, t]);
      }
    };
    _toastListeners.push(listener);
    return () => { _toastListeners = _toastListeners.filter((l) => l !== listener); };
  }, []);

  if (!toasts.length) return null;

  const styles = {
    success: 'bg-green-600 text-white',
    error:   'bg-red-600 text-white',
    info:    'bg-[var(--accent-solid)] text-white',
    warning: 'bg-amber-500 text-white',
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in-up flex items-center gap-2 ${styles[t.type] ?? styles.info}`}
        >
          {t.type === 'success' && <span aria-hidden>✓</span>}
          {t.type === 'error'   && <span aria-hidden>✗</span>}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Confirmation Modal ────────────────────────────────────────────────────────
/**
 * ConfirmModal — wraps a destructive action with a confirmation step.
 *
 * Usage:
 *   const { openConfirm, ConfirmModal } = useConfirm();
 *   openConfirm('Delete this quotation?', () => deleteMutation.mutate(id));
 */
export function useConfirm() {
  const [state, setState] = useState({ open: false, message: '', onConfirm: null });

  const openConfirm = useCallback((message, onConfirm) => {
    setState({ open: true, message, onConfirm });
  }, []);

  const close = useCallback(() => setState({ open: false, message: '', onConfirm: null }), []);

  const ConfirmModal = state.open ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="surface w-full max-w-sm p-6 space-y-4 animate-fade-in-up">
        <h2 id="confirm-title" className="font-display font-semibold text-[var(--text-primary)]">
          Confirm Action
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">{state.message}</p>
        <div className="flex gap-3 justify-end pt-2">
          <Btn variant="secondary" onClick={close}>Cancel</Btn>
          <Btn variant="danger" onClick={() => { state.onConfirm?.(); close(); }}>Confirm</Btn>
        </div>
      </div>
    </div>
  ) : null;

  return { openConfirm, ConfirmModal };
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }) {
  return (
    <div className={`surface hover:shadow-md transition-shadow ${className}`}>
      {children}
    </div>
  );
}

// ── KPI Summary Card ──────────────────────────────────────────────────────────
/**
 * KpiCard — large number with a gradient underline accent.
 * Pass `isPulsing` from useLivePulse to enable the live-update animation.
 */
export function KpiCard({ label, value, sub, isPulsing = false }) {
  return (
    <Card className="p-5 flex flex-col gap-1 relative overflow-hidden">
      {/* Gradient underline accent */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 gradient-accent" />
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">{label}</span>
      <span
        className={`text-3xl font-display font-bold text-[var(--text-primary)] tabular-nums transition-all ${
          isPulsing ? 'animate-count-flash rounded px-1' : ''
        }`}
      >
        {value ?? '—'}
      </span>
      {sub && <span className="text-xs text-[var(--text-secondary)]">{sub}</span>}
    </Card>
  );
}

// ── Page Header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, children, breadcrumb }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        {breadcrumb && (
          <p className="text-xs text-[var(--text-secondary)] mb-0.5">{breadcrumb}</p>
        )}
        <h1 className="text-xl font-display font-bold text-[var(--text-primary)]">{title}</h1>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, type = 'button', variant = 'primary', disabled = false, className = '', size = 'md' }) {
  const base   = 'inline-flex items-center gap-1.5 rounded font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2';
  const sizes  = { sm: 'px-2.5 py-1 text-xs', md: 'px-3 py-1.5 text-sm', lg: 'px-4 py-2 text-sm' };
  const styles = {
    primary:   'bg-[var(--accent-solid)] text-white hover:opacity-90',
    secondary: 'bg-[var(--surface-alt)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--border)]',
    danger:    'bg-red-600 text-white hover:bg-red-700',
    ghost:     'text-[var(--accent-solid)] hover:bg-[var(--surface-alt)]',
    outline:   'border border-[var(--accent-solid)] text-[var(--accent-solid)] hover:bg-[var(--surface-alt)]',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

// ── Form Field ────────────────────────────────────────────────────────────────
export function Field({ label, error, children, required }) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
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
      className={`w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)] transition-shadow ${className}`}
    />
  );
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ children, className = '', ...props }) {
  return (
    <select
      {...props}
      className={`w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)] ${className}`}
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
      className={`w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)] resize-y ${className}`}
    />
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      {label && <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-150 ${checked ? 'bg-[var(--accent-solid)]' : 'bg-[var(--border)]'}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-150 mt-0.5 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
      <span className="text-xs text-[var(--text-secondary)]">{checked ? 'Yes' : 'No'}</span>
    </label>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ columns, rows, onRowClick, emptyText = 'No data', className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-[var(--text-secondary)] text-sm">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-[var(--border)] ${onRowClick ? 'cursor-pointer hover:bg-[var(--surface-alt)]' : ''} transition-colors`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 text-[var(--text-primary)]">
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
    <svg className={`animate-spin h-5 w-5 text-[var(--accent-solid)] ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-label="Loading">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
export function Alert({ variant = 'error', children, className = '' }) {
  const styles = {
    error:   'bg-red-50   dark:bg-red-950   border-red-200   dark:border-red-800   text-red-700   dark:text-red-300',
    success: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300',
    info:    'bg-blue-50  dark:bg-blue-950  border-blue-200  dark:border-blue-800  text-blue-700  dark:text-blue-300',
    warning: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
  };
  return (
    <div className={`border rounded-lg px-4 py-3 text-sm ${styles[variant]} ${className}`} role="alert">
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ label, color = 'gray' }) {
  const colors = {
    gray:   'bg-[var(--surface-alt)] text-[var(--text-secondary)] border border-[var(--border)]',
    blue:   'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
    green:  'bg-green-100  dark:bg-green-900/40  text-green-700  dark:text-green-300',
    yellow: 'bg-amber-100  dark:bg-amber-900/40  text-amber-700  dark:text-amber-300',
    red:    'bg-red-100    dark:bg-red-900/40    text-red-700    dark:text-red-300',
    violet: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    teal:   'bg-teal-100   dark:bg-teal-900/40   text-teal-700   dark:text-teal-300',
  };
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${colors[color]}`}>
      {label}
    </span>
  );
}

// ── StageBadge — status colours per stage name ───────────────────────────────
const STAGE_BADGE_STYLES = {
  DRAFT:            'bg-slate-100  dark:bg-slate-800  text-slate-600  dark:text-slate-300',
  PENDING_APPROVAL: 'bg-amber-100  dark:bg-amber-900/40  text-amber-700  dark:text-amber-300',
  APPROVED:         'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
  UNDER_NEGOTIATION:'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  CONFIRMED:        'bg-green-100  dark:bg-green-900/40  text-green-700  dark:text-green-300',
  REJECTED:         'bg-red-100    dark:bg-red-900/40    text-red-700    dark:text-red-300',
  FULFILLMENT:      'bg-teal-100   dark:bg-teal-900/40   text-teal-700   dark:text-teal-300',
  INVOICED:         'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
  CLOSED:           'bg-gray-100   dark:bg-gray-800      text-gray-600   dark:text-gray-400',
};

export function StageBadge({ status }) {
  const cls   = STAGE_BADGE_STYLES[status] ?? STAGE_BADGE_STYLES.DRAFT;
  const label = status?.replace(/_/g, ' ') ?? '—';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${cls}`} aria-label={`Status: ${label}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" aria-hidden="true" />
      {label}
    </span>
  );
}

// ── FlowMeter ─────────────────────────────────────────────────────────────────
/**
 * FlowMeter — signature gradient progress bar.
 * Used for: quotation pipeline stage, approval tracker, blended-risk score.
 *
 * For stage pipelines, pass `steps` and `activeStep`.
 * For a simple fill bar, pass `percent` (0-100).
 *
 * The fill animates via CSS transition (400ms ease-out) — never jump-cuts.
 * A soft glow trails the leading edge.
 *
 * @param {string[]} [steps]       — ordered step labels
 * @param {string}   [activeStep]  — which step is current
 * @param {number}   [percent]     — 0–100 for a bare progress bar
 * @param {boolean}  [danger]      — shifts fill to red (for risk scores near threshold)
 * @param {string}   [className]
 */
export function FlowMeter({ steps, activeStep, percent, danger = false, className = '' }) {
  // ── Step-based mode ───────────────────────────────────────────────────────
  if (steps && activeStep !== undefined) {
    const idx = steps.indexOf(activeStep);
    // percent = how far through the step list we are (0% at first step, 100% at last)
    const pct = steps.length <= 1 ? 100 : Math.round((idx / (steps.length - 1)) * 100);

    return (
      <div className={`w-full ${className}`}>
        {/* Track */}
        <div className="relative h-2 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] overflow-hidden">
          {/* Fill */}
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out ${danger ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'gradient-accent'}`}
            style={{ width: `${pct}%` }}
          >
            {/* Glow at leading edge */}
            <div className={`absolute right-0 top-0 h-full w-4 rounded-full ${danger ? 'shadow-[0_0_10px_2px_rgba(220,38,38,0.4)]' : 'shadow-flow-glow'}`} />
          </div>
        </div>

        {/* Step labels */}
        <div className="flex justify-between mt-1.5">
          {steps.map((step, i) => {
            const done    = i <= idx;
            const current = i === idx;
            return (
              <div key={step} className="flex flex-col items-center gap-0.5 text-center" style={{ width: `${100 / steps.length}%` }}>
                {/* Dot */}
                <div
                  className={`w-2.5 h-2.5 rounded-full border-2 transition-colors duration-300 ${
                    done
                      ? 'border-[var(--accent-solid)] bg-[var(--accent-solid)]'
                      : 'border-[var(--border)] bg-[var(--surface)]'
                  } ${current ? 'ring-2 ring-[var(--accent-solid)] ring-offset-1 ring-offset-[var(--bg)]' : ''}`}
                  aria-current={current ? 'step' : undefined}
                />
                <span className={`text-[10px] font-medium leading-tight ${done ? 'text-[var(--accent-solid)]' : 'text-[var(--text-secondary)]'}`}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Bare percentage mode ───────────────────────────────────────────────────
  const pct = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <div className={`relative h-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] overflow-hidden ${className}`}>
      <div
        className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out ${danger ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'gradient-accent'}`}
        style={{ width: `${pct}%` }}
      >
        <div className={`absolute right-0 top-0 h-full w-4 rounded-full ${danger ? 'shadow-[0_0_10px_2px_rgba(220,38,38,0.4)]' : 'shadow-flow-glow'}`} />
      </div>
    </div>
  );
}

// ── ThemeToggle ───────────────────────────────────────────────────────────────
/**
 * ThemeToggle — sun/moon button. Used in topbar on every screen.
 * Reads/writes from useTheme hook.
 */
export function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] transition-colors"
    >
      {isDark ? (
        /* Sun icon */
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        /* Moon icon */
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}

// ── NotificationBell ──────────────────────────────────────────────────────────
export function NotificationBell({ count = 0, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
      className="relative p-1.5 rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] transition-colors"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
      {count > 0 && (
        <span className="absolute top-0 right-0 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white animate-pulse">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-[var(--border)] mb-6" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-[var(--accent-solid)] text-[var(--accent-solid)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── CountBadge — pill badge with a number ────────────────────────────────────
export function CountBadge({ label, count, color = 'gray' }) {
  const colors = {
    gray:   'bg-[var(--surface-alt)] text-[var(--text-secondary)]',
    amber:  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    green:  'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    blue:   'bg-blue-100  dark:bg-blue-900/40  text-blue-700  dark:text-blue-300',
    red:    'bg-red-100   dark:bg-red-900/40   text-red-700   dark:text-red-300',
  };
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] ${colors[color]}`}>
      <span className="text-sm font-semibold font-mono-df">{count ?? 0}</span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

// ── RiskScore badge ───────────────────────────────────────────────────────────
export function RiskScoreBadge({ score }) {
  const s   = Number(score ?? 0);
  const cls = s === 0
    ? 'bg-green-100 text-green-700'
    : s < 10
    ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full font-mono-df ${cls}`}>
      Risk: {s}
    </span>
  );
}

// ── LiveDot ───────────────────────────────────────────────────────────────────
export function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
      Live
    </span>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`surface w-full ${width} mx-4 p-6 space-y-4 animate-fade-in-up`}>
        <div className="flex items-center justify-between">
          <h2 id="modal-title" className="text-base font-display font-semibold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
