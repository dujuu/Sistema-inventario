'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

export default function WarehousesPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadWarehouses() {
    return apiFetch<Warehouse[]>('/warehouses')
      .then(setWarehouses)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error desconocido'));
  }

  useEffect(() => {
    if (!getSession()) {
      router.push('/login');
      return;
    }
    void loadWarehouses();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/warehouses', { method: 'POST', body: JSON.stringify({ code, name }) });
      setCode('');
      setName('');
      await loadWarehouses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Bodegas</h1>
      <p className="page-subtitle">Gestión de ubicaciones de almacenamiento.</p>

      <div className="card p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-on-surface mb-4">Nueva bodega</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="form-field">
            <label className="label">Código</label>
            <input className="input" placeholder="Ej: WH-01" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="label">Nombre</label>
            <input className="input" placeholder="Nombre de la bodega" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-field flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              <span className="material-symbols-outlined text-[16px]">add</span>
              {submitting ? 'Creando…' : 'Crear bodega'}
            </button>
          </div>
        </form>
        {error && <p className="error-msg mt-3">{error}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {warehouses.length === 0 && (
          <p className="text-[13px] text-on-surface-variant col-span-3">Sin bodegas registradas.</p>
        )}
        {warehouses.map((w) => (
          <div key={w.id} className="kpi-card">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">warehouse</span>
              <div>
                <p className="font-geist text-[12px] text-on-surface-variant">{w.code}</p>
                <p className="font-semibold text-[15px] text-on-surface">{w.name}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
