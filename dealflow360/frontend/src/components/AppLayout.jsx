import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/authContext.jsx';

const NAV_ITEMS = [
  { to: '/',              label: 'Dashboard'     },
  { to: '/quotations',    label: 'Quotations'    },
  { to: '/approvals',     label: 'Approvals'     },
  { to: '/fulfillment',   label: 'Fulfillment'   },
  { to: '/subscriptions', label: 'Subscriptions' },
  { to: '/invoices',      label: 'Invoices'      },
  { to: '/deal-health',   label: 'Deal Health'   },
  { to: '/reports',       label: 'Reports'       },
  { to: '/products',      label: 'Product'       },
];

const PORTAL_ITEMS = [
  { to: '/portal/quotations', label: 'My Quotations' },
  { to: '/portal/messages',   label: 'Messages'      },
  { to: '/profile',           label: 'Profile'       },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const isCustomer = user?.role === 'CUSTOMER';
  const items = isCustomer ? PORTAL_ITEMS : NAV_ITEMS;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ── Top Nav ─────────────────────────────────────────────────────── */}
      <header className="bg-brand-700 text-white shadow z-10">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between px-4 h-14">
          {/* Logo */}
          <span className="font-bold text-lg tracking-tight select-none">DealFlow360</span>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
            {items.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors
                   ${isActive
                     ? 'bg-white/20 text-white'
                     : 'text-blue-100 hover:bg-white/10 hover:text-white'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User + logout */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-blue-200 hidden sm:block">
              {user?.email} <span className="ml-1 text-xs opacity-60">({user?.role})</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded transition-colors"
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
    </div>
  );
}
