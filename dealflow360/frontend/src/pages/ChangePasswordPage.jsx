import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../store/authContext.jsx';
import { Alert } from '../components/ui.jsx';

export default function ChangePasswordPage() {
  const navigate    = useNavigate();
  const { setToken } = useAuth();
  const [form,    setForm]    = useState({ newPassword: '', confirm: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  // userId stored in localStorage during the login redirect
  const userId = localStorage.getItem('df360_temp_userId');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.newPassword !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/change-password', {
        userId,
        newPassword: form.newPassword,
      });
      localStorage.removeItem('df360_temp_userId');
      setToken(data.data.token);
      navigate(data.data.user?.role === 'CUSTOMER' ? '/portal' : '/');
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="surface w-full max-w-md p-8 text-center">
          <p className="text-[var(--text-secondary)]">No pending password change. Please log in.</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 text-sm text-[var(--accent-solid)] hover:underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="surface w-full max-w-md p-8">
        <h1
          className="font-display font-bold text-xl mb-1"
          style={{
            background: 'linear-gradient(90deg, var(--accent-start), var(--accent-end))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          DealFlow360
        </h1>
        <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1">Set Your Password</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          You must choose a new password before accessing the portal.
        </p>

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.newPassword}
              onChange={e => setForm({ ...form, newPassword: e.target.value })}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]"
              placeholder="Min. 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">Confirm Password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={form.confirm}
              onChange={e => setForm({ ...form, confirm: e.target.value })}
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-solid)]"
              placeholder="Repeat password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(90deg, var(--accent-start), var(--accent-end))' }}
          >
            {loading ? 'Saving…' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
