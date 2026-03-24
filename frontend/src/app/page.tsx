'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { apiClient } from '@/lib/api';

export default function AuthPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    email: '', password: '', nickname: '', language: 'ru',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : form;
      const data = await apiClient.post(endpoint, payload);
      setAuth(data.user, data.profile, data.accessToken, data.refreshToken);
      router.push('/game');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Ошибка. Попробуй снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      {/* Background texture */}
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.04,
        backgroundImage: 'repeating-linear-gradient(45deg, #B8922A 0, #B8922A 1px, transparent 0, transparent 50%)',
        backgroundSize: '20px 20px',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontFamily: 'Cinzel, serif', fontSize: '28px', color: 'var(--gold-light)',
            letterSpacing: '4px', marginBottom: '6px',
          }}>
            ⚜ DOMINION
          </div>
          <div style={{
            fontFamily: 'Cinzel, serif', fontSize: '11px', color: 'rgba(255,255,255,0.3)',
            letterSpacing: '6px',
          }}>
            REALMS
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(184,146,42,0.25)',
          borderRadius: '4px', padding: '32px',
          backdropFilter: 'blur(10px)',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {(['login', 'register'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1, padding: '10px', background: 'none', border: 'none',
                  fontFamily: 'Cinzel, serif', fontSize: '11px', letterSpacing: '1.5px',
                  cursor: 'pointer',
                  color: mode === m ? 'var(--gold-light)' : 'rgba(255,255,255,0.3)',
                  borderBottom: mode === m ? '2px solid var(--gold)' : '2px solid transparent',
                  marginBottom: '-1px', transition: 'all 0.2s',
                }}>
                {m === 'login' ? 'ВОЙТИ' : 'СОЗДАТЬ АККАУНТ'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontFamily: 'Cinzel, serif', fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', marginBottom: '6px' }}>
                EMAIL
              </label>
              <input
                type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@email.com"
                style={inputStyle}
              />
            </div>

            {/* Nickname (register only) */}
            {mode === 'register' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>НИКНЕЙМ</label>
                <input
                  type="text" required value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  placeholder="LordVaron"
                  minLength={3} maxLength={32}
                  style={inputStyle}
                />
              </div>
            )}

            {/* Password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>ПАРОЛЬ</label>
              <input
                type="password" required value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                minLength={8}
                style={inputStyle}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(139,32,32,0.2)', border: '1px solid rgba(139,32,32,0.4)',
                borderRadius: '3px', padding: '10px 14px', marginBottom: '16px',
                color: '#F5A0A0', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px',
              background: loading ? 'rgba(184,146,42,0.3)' : 'var(--gold)',
              border: 'none', borderRadius: '3px',
              fontFamily: 'Cinzel, serif', fontSize: '12px', letterSpacing: '2px',
              color: loading ? 'rgba(255,255,255,0.5)' : 'var(--ink)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontWeight: 600,
            }}>
              {loading ? '...' : mode === 'login' ? 'ВОЙТИ В КОРОЛЕВСТВО' : 'ОСНОВАТЬ ВЛАДЕНИЕ'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontFamily: 'Cinzel, serif', fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '2px' }}>
          DOMINION REALMS · SEASON 1 · ARCADIA
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(184,146,42,0.2)',
  borderRadius: '3px',
  color: '#fff', fontSize: '14px',
  fontFamily: 'Crimson Pro, serif',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'Cinzel, serif', fontSize: '10px',
  color: 'rgba(255,255,255,0.4)', letterSpacing: '1px',
  marginBottom: '6px',
};
