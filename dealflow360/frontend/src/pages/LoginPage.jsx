import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../store/authContext.jsx';
import { useTheme } from '../hooks/useTheme.js';
import { ThemeToggle, Alert } from '../components/ui.jsx';

const ROLES = ['SALES_REP', 'SALES_MANAGER', 'FINANCE', 'ADMIN'];

export default function LoginPage() {
  const navigate    = useNavigate();
  const { setToken } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [tab,     setTab]     = useState('login');   // 'login' | 'signup'
  const [form,    setForm]    = useState({ email: '', password: '', name: '', role: 'SALES_REP' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: form.email, password: form.password });
      if (data.data.mustChangePassword) {
        localStorage.setItem('df360_temp_userId', data.data.userId);
        navigate('/change-password');
      } else {
        setToken(data.data.token);
        // Redirect: customers → portal, everyone else → dashboard
        navigate(data.data.user?.role === 'CUSTOMER' ? '/portal' : '/');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Login failed. Check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/signup', {
        name:     form.name,
        email:    form.email,
        password: form.password,
        role:     form.role,
      });
      setToken(data.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      {/* Theme toggle — top-right corner */}
      <div className="fixed top-4 right-4">
        <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
      </div>

      <div className="surface w-full max-w-md p-8">
        {/* Logo */}
        <div className="mb-6 text-center">
          <h1
            className="font-display font-bold text-2xl"
            style={{
              background: 'linear-gradient(90deg, var(--accent-start), var(--accent-end))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            DealFlow360
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Sales pipeline & customer portal</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--border)] mb-6" role="tablist">
          {[{ id: 'login', label: 'Log In' }, { id: 'signup', label: 'Sign Up' }].map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => { setTab(t.id); setError(''); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? 'border-[var(--accent-solid)] text-[var(--accent-solid)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        {/* Log In form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]"
                placeholder="you@dealflow360.com"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-[var(--text-primary)]">Password</label>
                <Link to="/change-password" className="text-xs text-[var(--accent-solid)] hover:underline">
                  Forgot Password?
                </Link>
              </div>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: 'linear-gradient(90deg, var(--accent-start), var(--accent-end))' }}
            >
              {loading ? 'Signing in…' : 'Log In'}
            </button>
          </form>
        )}

        {/* Sign Up form */}
        {tab === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Full Name</label>
              <input
                type="text"
                required
                autoComplete="name"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]"
                placeholder="Alice Sales"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]"
                placeholder="Min. 8 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Role</label>
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]"
              >
                {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ background: 'linear-gradient(90deg, var(--accent-start), var(--accent-end))' }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Footnotes per wireframe */}
        <div className="mt-6 pt-4 border-t border-[var(--border)] space-y-1.5">
          <p className="text-xs text-[var(--text-secondary)] text-center">
            After login, internal users land on the Sales Dashboard. Customers land on their Quotation Portal.
          </p>
          <p className="text-xs text-[var(--text-secondary)] text-center italic">
            Customer accounts are auto-provisioned when a quotation is created — not self-signed-up.
          </p>
        </div>
      </div>
    </div>
  );
}
