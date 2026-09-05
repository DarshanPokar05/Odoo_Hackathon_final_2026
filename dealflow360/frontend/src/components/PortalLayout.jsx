import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authContext.jsx';
import { useTheme } from '../hooks/useTheme.js';
import { ThemeToggle, ToastContainer } from './ui.jsx';

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Customer portal topbar — intentionally different from internal nav */}
      <header
        className="sticky top-0 z-40 border-b border-[var(--border)]"
        style={{ background: 'var(--surface)' }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <span
              className="font-display font-bold text-base"
              style={{
                background: 'linear-gradient(90deg, var(--accent-start), var(--accent-end))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              DealFlow360
            </span>
            <span className="text-xs font-medium text-[var(--text-secondary)] border border-[var(--border)] px-2 py-0.5 rounded-full">
              Customer Portal
            </span>
          </div>

          <nav className="flex items-center gap-1">
            <NavLink
              to="/portal"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive ? 'bg-[var(--surface-alt)] text-[var(--accent-solid)]' : 'text-[var(--text-secondary)] hover:bg-[var(--surface-alt)]'
                }`
              }
            >
              My Quotations
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
            <span className="text-xs text-[var(--text-secondary)] hidden sm:block">{user?.email}</span>
            <button
              onClick={() => { logout(); navigate('/login', { replace: true }); }}
              className="text-xs border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-alt)] px-2.5 py-1.5 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      <ToastContainer />
    </div>
  );
}
