import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import { useAuth } from '../store/authContext.jsx';

export default function ChangePasswordPage() {
  const navigate    = useNavigate();
  const { setToken } = useAuth();
  const [form, setForm]     = useState({ newPassword: '', confirm: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const userId = localStorage.getItem('df360_temp_userId');
      const { data } = await api.post('/auth/change-password', {
        userId,
        newPassword: form.newPassword,
      });
      localStorage.removeItem('df360_temp_userId');
      setToken(data.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white shadow-md rounded-xl p-8 w-full max-w-md">
        <h1 className="text-xl font-bold text-brand-700 mb-2">Set your password</h1>
        <p className="text-sm text-gray-500 mb-6">
          You must set a new password before continuing.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password" required minLength={8}
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password" required
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-brand-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? 'Saving…' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
