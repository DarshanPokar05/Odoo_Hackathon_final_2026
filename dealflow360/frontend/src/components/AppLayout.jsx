import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/authContext.jsx';
import { useTheme } from '../hooks/useTheme.js';
import { ThemeToggle, ToastContainer } from './ui.jsx';

// ── Role-based nav item definitions ──────────────────────────────────────────
// Each item has an optional `roles` array — if present, only those roles see it.
// Items without `roles` are visible to all internal users.
const ALL_INTERNAL_NAV = [
  { to: '/',              label: 'Dashboard',     roles: null },
  { to: '/quotations',    label: 'Quotations',    roles: ['ADMIN','SALES_REP','SALES_MANAGER','FINANCE'] },
  { to: '/approvals',     label: 'Approvals',     roles: ['ADMIN','SALES_MANAGER','FINANCE'] },
  { to: '/fulfillment',   label: 'Fulfillment',   roles: ['ADMIN','FINANCE','SALES_MANAGER'] },
  { to: '/subscriptions', label: 'Subscriptions', roles: ['ADMIN','FINANCE','SALES_MANAGER','SALES_REP'] },
  { to: '/invoices',      label: 'Invoices',      roles: ['ADMIN','FINANCE','SALES_MANAGER','SALES_REP'] },
  { to: '/deal-health',   label: 'Deal Health',   roles: ['ADMIN','SALES_MANAGER','FINANCE'] },
  { to: '/reports',       label: 'Reports',       roles: ['ADMIN','SALES_MANAGER','FINANCE','SALES_REP'] },
  { to: '/products',      label: 'Products',      roles: ['ADMIN','SALES_MANAGER','SALES_REP','FINANCE'] },
];

const PORTAL_NAV = [
  { to: '/portal', label: 'My Quotations' },
];

// Role label colours
const ROLE_BADGE = {
  ADMIN:         'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  SALES_REP:     'bg-blue-100   text-blue-700   dark:bg-blue-900/40   dark:text-blue-300',
  SALES_MANAGER: 'bg-teal-100   text-teal-700   dark:bg-teal-900/40   dark:text-teal-300',
  FINANCE:       'bg-green-100  text-green-700  dark:bg-green-900/40  dark:text-green-300',
  CUSTOMER:      'bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300',
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isCustomer = user?.role === 'CUSTOMER';
  const roleBadge  = ROLE_BADGE[user?.role] ?? ROLE_BADGE.SALES_REP;

  // Filter nav items by role
  const navItems = isCustomer
    ? PORTAL_NAV
    : ALL_INTERNAL_NAV.filter(item =>
        !item.roles || item.roles.includes(user?.role)
      );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* ── Top Nav ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b border-[var(--border)]"
        style={{ background: 'var(--surface)' }}
      >
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-4 h-14 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span
              className="font-display font-bold text-base tracking-tight select-none"
              style={{
                background: 'linear-gradient(90deg, var(--accent-start), var(--accent-end))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              DealFlow360
            </span>
          </Link>

          {/* Nav links */}
          <nav
            className="hidden md:flex items-center gap-0.5 overflow-x-auto flex-1 px-2"
            role="navigation"
            aria-label="Main navigation"
          >
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/' || to === '/portal'}
                className={({ isActive }) =>
                  `px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-[var(--surface-alt)] text-[var(--accent-solid)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side: theme toggle, role badge, email, logout */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />

            {/* Role badge */}
            <span className={`hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadge}`}>
              {user?.role?.replace(/_/g, ' ') ?? 'USER'}
            </span>

            {/* Email (truncated) */}
            <span
              className="hidden lg:block text-xs text-[var(--text-secondary)] max-w-[140px] truncate"
              title={user?.email}
            >
              {user?.email}
            </span>

            <button
              onClick={handleLogout}
              className="text-xs border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-alt)] px-2.5 py-1.5 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      <ToastContainer />
    </div>
  );
}
