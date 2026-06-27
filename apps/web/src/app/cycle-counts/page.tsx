'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

interface CycleCount {
  id: string;
  status: 'DRAFT' | 'COMMITTED' | 'CANCELLED';
  reference: string | null;
  createdAt: string;
  warehouse: { code: string; name: string };
  createdBy: { name: string };
  _count: { lines: number };
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

const STATUS_LABEL: Record<CycleCount['status'], string> = {
  DRAFT: 'Borrador',
  COMMITTED: 'Confirmado',
  CANCELLED: 'Cancelado',
};

const STATUS_COLOR: Record<CycleCount['status'], string> = {
  DRAFT: '#a60',
  COMMITTED: '#0a0',
  CANCELLED: '#999',
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
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Error desconocido'),
      );
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
        body: JSON.stringify({
          warehouseId,
          reference: reference || undefined,
        }),
      });
      router.push(`/cycle-counts/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <h1>Conteos cíclicos</h1>

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
          <option value="" disabled>Bodega *</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
          ))}
        </select>
        <input
          placeholder="Referencia (opcional)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <button type="submit" disabled={submitting || !warehouseId}>
          {submitting ? 'Creando...' : 'Nuevo conteo'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc' }}>
            <th style={{ textAlign: 'left' }}>Bodega</th>
            <th style={{ textAlign: 'left' }}>Referencia</th>
            <th style={{ textAlign: 'right' }}>Líneas</th>
            <th style={{ textAlign: 'left' }}>Estado</th>
            <th style={{ textAlign: 'left' }}>Creado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {counts.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{c.warehouse.name}</td>
              <td style={{ color: '#555' }}>{c.reference ?? '—'}</td>
              <td style={{ textAlign: 'right' }}>{c._count.lines}</td>
              <td style={{ color: STATUS_COLOR[c.status], fontWeight: 'bold' }}>
                {STATUS_LABEL[c.status]}
              </td>
              <td style={{ fontSize: 12 }}>{new Date(c.createdAt).toLocaleString()}</td>
              <td>
                <button onClick={() => router.push(`/cycle-counts/${c.id}`)}>
                  {c.status === 'DRAFT' ? 'Continuar' : 'Ver'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
