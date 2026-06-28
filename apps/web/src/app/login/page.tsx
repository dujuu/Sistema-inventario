'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, saveSession, type Session } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@inventario.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await apiFetch<Session>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      saveSession(session);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
              inventory_2
            </span>
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-primary leading-tight">StockFlow</h1>
            <p className="text-[11px] text-on-surface-variant font-geist">Sistema de Inventario</p>
          </div>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="text-[20px] font-semibold text-on-surface mb-1">Iniciar sesión</h2>
          <p className="text-[13px] text-on-surface-variant mb-6">Ingresa tus credenciales para continuar.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-field">
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="usuario@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-field">
              <label className="label">Contraseña</label>
              <input
                className="input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="error-msg">{error}</p>}

            <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
