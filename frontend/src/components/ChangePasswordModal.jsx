import { useState } from 'react';
import { api } from '../api';

export default function ChangePasswordModal({ onClose }) {
  const [form, setForm]       = useState({ current: '', next: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.next !== form.confirm) { setError('Passwords do not match'); return; }
    setError(''); setLoading(true);
    try {
      await api.changePassword(form.current, form.next);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-5">Change Password</h2>

        {success ? (
          <div>
            <p className="text-green-600 text-sm mb-4">Password changed successfully!</p>
            <button onClick={onClose}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}
            {[
              { key: 'current', label: 'Current Password' },
              { key: 'next',    label: 'New Password' },
              { key: 'confirm', label: 'Confirm New Password' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="password" value={form[key]} onChange={e => set(key, e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="••••••••" />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
