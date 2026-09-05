import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/authContext.jsx';
import { useTheme } from '../hooks/useTheme.js';
import { ThemeToggle, NotificationBell, ToastContainer } from './ui.jsx';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios.js';

// ── Nav item definitions ──────────────────────────────────────────────────────
const INTERNAL_NAV = [
  { to: '/',              label: 'Dashboard',     icon: '⊡' },
  { to: '/quotations',    label: 'Quotations',    icon: '📋' },
  { to: '/approvals',     label: 'Approvals',     icon: '✓' },
  { to: '/fulfillment',   label: 'Fulfillment',   icon: '📦' },
  { to: '/subscriptions', label: 'Subscriptions', icon: '↻' },
  { to: '/invoices',      label: 'Invoices',      icon: '💳' },
  { to: '/deal-health',   label: 'Deal Health',   icon: '❤' },
  { to: '/reports',       label: 'Reports',       icon: '📊' },
  { to: '/products',      label: 'Products',      icon: '🏷' },
];

const PORTAL_NAV = [
  { to: '/portal',          label: 'My Quotations', icon: '📋' },
  { to: '/portal/messages', label: 'Messages',      icon: '💬' },
  { to: '/profile',         label: 'Profile',       icon: '👤' },
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

  // Fetch unread notification count
  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn:  () => api.get('/notifications?unreadOnly=true').then(r => r.data.data),
    refetchInterval: 30_000,
    enabled: !!user && user.role !== 'CUSTOMER',
  });
  const unreadCount = Array.isArray(notifData) ? notifData.length : 0;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isCustomer = user?.role === 'CUSTOMER';
  const navItems   = isCustomer ? PORTAL_NAV : INTERNAL_NAV;
  const roleBadge  = ROLE_BADGE[user?.role] ?? ROLE_BADGE.SALES_REP;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* ── Top Nav ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 border-b border-[var(--border)]"
        style={{ background: 'var(--surface)' }}
      >
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-4 h-14 gap-4">
          {/* Logo / wordmark */}
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
          <nav className="hidden md:flex items-center gap-0.5 overflow-x-auto flex-1 px-2" role="navigation" aria-label="Main navigation">
            {navItems.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/' || to === '/portal'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-[var(--surface-alt)] text-[var(--accent-solid)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] hover:text-[var(--text-primary)]'
                  }`
                }
              >
                <span aria-hidden="true">{icon}</span>
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side: theme, notifications, role badge, logout */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
            {!isCustomer && (
              <NotificationBell count={unreadCount} onClick={() => {}} />
            )}
            {/* Role badge */}
            <span className={`hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadge}`}>
              {user?.role?.replace(/_/g, ' ') ?? 'USER'}
            </span>
            {/* User email (truncated) */}
            <span className="hidden lg:block text-xs text-[var(--text-secondary)] max-w-[140px] truncate" title={user?.email}>
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

      {/* Global toast container */}
      <ToastContainer />
    </div>
  );
}
