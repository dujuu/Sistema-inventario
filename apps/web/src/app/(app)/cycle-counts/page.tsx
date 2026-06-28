'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

interface CycleCount {
  id: string;
  status: 'DRAFT' | 'COMMITTED' | 'CANCELLED';
  reference: string | null;
  createdAt: string;
  warehouse: { code: string; name: string };
  createdBy: { name: string };
  _count: { lines: number };
}

interface Warehouse { id: string; code: string; name: string; }

const STATUS_LABEL: Record<CycleCount['status'], string> = {
  DRAFT: 'Borrador', COMMITTED: 'Confirmado', CANCELLED: 'Cancelado',
};
const STATUS_BADGE: Record<CycleCount['status'], string> = {
  DRAFT: 'badge-warning', COMMITTED: 'badge-success', CANCELLED: 'badge-neutral',
};

export default function CycleCountsPage() {
  const router = useRouter();
  const [counts, setCounts] = useState<CycleCount[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadCounts() {
    return apiFetch<CycleCount[]>('/cycle-counts')
      .then(setCounts)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error desconocido'));
  }

  useEffect(() => {
    if (!getSession()) { router.push('/login'); return; }
    void loadCounts();
    apiFetch<Warehouse[]>('/warehouses').then(setWarehouses).catch(() => undefined);
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await apiFetch<{ id: string }>('/cycle-counts', {
        method: 'POST',
        body: JSON.stringify({ warehouseId, reference: reference || undefined }),
      });
      router.push(`/cycle-counts/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Conteos cíclicos</h1>
      <p className="page-subtitle">Verificación periódica del inventario físico vs. sistema.</p>

      <div className="card p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-on-surface mb-4">Nuevo conteo</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="form-field">
            <label className="label">Bodega *</label>
            <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
              <option value="" disabled>Selecciona…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="label">Referencia (opcional)</label>
            <input className="input" placeholder="Conteo mensual, auditoría…" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="form-field flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={submitting || !warehouseId}>
              <span className="material-symbols-outlined text-[16px]">fact_check</span>
              {submitting ? 'Creando…' : 'Iniciar conteo'}
            </button>
          </div>
        </form>
        {error && <p className="error-msg mt-3">{error}</p>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="th">Bodega</th>
              <th className="th">Referencia</th>
              <th className="th text-right">Líneas</th>
              <th className="th">Estado</th>
              <th className="th">Creado</th>
              <th className="th">Creado por</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {counts.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[13px] text-on-surface-variant">Sin conteos</td></tr>
            )}
            {counts.map((c) => (
              <tr key={c.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="td font-medium">{c.warehouse.name}</td>
                <td className="td font-geist text-[12px] text-on-surface-variant">{c.reference ?? '—'}</td>
                <td className="td text-right font-geist">{c._count.lines}</td>
                <td className="td"><span className={STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</span></td>
                <td className="td font-geist text-[11px] text-on-surface-variant">
                  {new Date(c.createdAt).toLocaleString('es-CL')}
                </td>
                <td className="td text-[12px] text-on-surface-variant">{c.createdBy.name}</td>
                <td className="td">
                  <button
                    className={`btn-sm ${c.status === 'DRAFT' ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                    onClick={() => router.push(`/cycle-counts/${c.id}`)}
                  >
                    {c.status === 'DRAFT' ? 'Continuar' : 'Ver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
