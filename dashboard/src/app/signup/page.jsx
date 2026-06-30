'use client';
import { useState, useEffect } from 'react';
import { post } from '../../lib/api';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('warmdm_token')) {
      window.location.href = '/';
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password || !confirmPassword) return setError('Please fill in all fields');
    if (password !== confirmPassword) return setError('Passwords do not match');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    setError('');
    setLoading(true);
    try {
      const data = await post('/auth/signup', { email, password });
      localStorage.setItem('warmdm_token', data.token);
      localStorage.setItem('warmdm_user', JSON.stringify(data.user));
      window.postMessage({ lcrm: true, payload: { type: 'SAVE_TOKEN', token: data.token } }, '*');
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 select-none">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="mb-8 text-center relative z-10">
          <h1 className="text-2xl font-bold tracking-tight text-white uppercase flex items-center justify-center gap-2">
            <span>WarmDM</span>
            <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider">CRM</span>
          </h1>
          <p className="text-slate-400 text-xs mt-2 font-medium">B2B LinkedIn Cold Outreach &amp; Intent Automation</p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors font-medium"
              placeholder="name@company.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors font-medium"
              placeholder="Min. 8 characters"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition-colors font-medium"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Get Started'}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500 relative z-10 font-medium">
          Already have an account?{' '}
          <a href="/login" className="text-blue-400 hover:underline">
            Sign In
          </a>
        </div>

        <div className="mt-6 border-t border-slate-800/60 pt-4 text-center text-[10px] text-slate-500 relative z-10 flex justify-center gap-3">
          <a href="/privacy" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
          <span>•</span>
          <a href="/terms" className="hover:text-slate-400 transition-colors">Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
