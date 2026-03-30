'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminFetch, setAdminToken } from '@/lib/admin-fetch';

export default function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const verify = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/stats');
      if (res.ok) {
        setAuthed(true);
      }
    } catch { /* not authed */ }
    setChecking(false);
  }, []);

  useEffect(() => { verify(); }, [verify]);

  const handleLogin = async () => {
    setError('');
    setAdminToken(input);
    const res = await adminFetch('/api/admin/stats');
    if (res.ok) {
      setAuthed(true);
    } else if (res.status === 401) {
      setError('Token 无效');
      setAdminToken('');
    } else {
      setError(`登录校验通过，但接口异常（HTTP ${res.status}）。多为数据库结构过旧，请在服务器执行：node scripts/init-db.mjs`);
    }
  };

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-primary-500" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="w-80 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white mb-1">管理后台</h2>
          <p className="text-sm text-slate-400 mb-4">请输入管理员 Token</p>
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Admin Token"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-500 focus:outline-none"
            aria-label="Admin Token"
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <button
            onClick={handleLogin}
            className="btn-primary mt-3 w-full"
          >
            登录
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
