'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

interface Line {
  id: string;
  productId: string;
  systemQuantity: string;
  countedQuantity: string | null;
  difference: string | null;
  product: { sku: string; name: string; unit: string };
}

interface CycleCount {
  id: string;
  status: 'DRAFT' | 'COMMITTED' | 'CANCELLED';
  reference: string | null;
  warehouseId: string;
  createdAt: string;
  committedAt: string | null;
  warehouse: { code: string; name: string };
  createdBy: { name: string };
  committedBy: { name: string } | null;
  lines: Line[];
}

const STATUS_LABEL: Record<CycleCount['status'], string> = {
  DRAFT: 'Borrador',
  COMMITTED: 'Confirmado',
  CANCELLED: 'Cancelado',
};

export default function CycleCountDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [count, setCount] = useState<CycleCount | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingLine, setSavingLine] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const c = await apiFetch<CycleCount>(`/cycle-counts/${id}`);
      setCount(c);
      const initial: Record<string, string> = {};
      c.lines.forEach((l) => {
        initial[l.id] = l.countedQuantity ?? '';
      });
      setEditValues(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  useEffect(() => {
    if (!getSession()) { router.push('/login'); return; }
    void load();
  }, [id, router]);

  async function saveLine(lineId: string) {
    const val = editValues[lineId];
    if (val === '' || val === undefined) return;
    setSavingLine(lineId);
    try {
      await apiFetch(`/cycle-counts/${id}/lines/${lineId}`, {
        method: 'PATCH',
        body: JSON.stringify({ countedQuantity: Number(val) }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSavingLine(null);
    }
  }

  async function handleCommit() {
    if (!count) return;
    setError(null);
    setActing(true);
    try {
      await apiFetch(`/cycle-counts/${id}/commit`, {
        method: 'POST',
        body: JSON.stringify({ warehouseId: count.warehouseId }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    if (!count) return;
    setError(null);
    setActing(true);
    try {
      await apiFetch(`/cycle-counts/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ warehouseId: count.warehouseId }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setActing(false);
    }
  }

  if (!count) return <main style={{ padding: 40 }}><Nav />{error ?? 'Cargando...'}</main>;

  const isDraft = count.status === 'DRAFT';
  const pendingLines = count.lines.filter((l) => l.countedQuantity === null).length;

  return (
    <main style={{ maxWidth: 960, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <h1>Conteo — {count.warehouse.name}</h1>
      <p style={{ color: '#555' }}>
        Estado: <strong>{STATUS_LABEL[count.status]}</strong>
        {count.reference && <> · Ref: {count.reference}</>}
        {' · '}Creado por {count.createdBy.name} el {new Date(count.createdAt).toLocaleString()}
        {count.committedBy && (
          <> · Confirmado por {count.committedBy.name} el {new Date(count.committedAt!).toLocaleString()}</>
        )}
      </p>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {isDraft && (
        <p style={{ color: '#a60' }}>
          {pendingLines > 0
            ? `${pendingLines} línea(s) sin contar. Puedes confirmar de todas formas y solo se ajustarán las líneas con cantidad ingresada.`
            : 'Todas las líneas tienen cantidad. Listo para confirmar.'}
        </p>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc' }}>
            <th style={{ textAlign: 'left' }}>SKU</th>
            <th style={{ textAlign: 'left' }}>Producto</th>
            <th style={{ textAlign: 'right' }}>Sistema</th>
            <th style={{ textAlign: 'right' }}>Contado</th>
            <th style={{ textAlign: 'right' }}>Diferencia</th>
            {isDraft && <th></th>}
          </tr>
        </thead>
        <tbody>
          {count.lines.map((l) => {
            const diff = l.difference !== null
              ? Number(l.difference)
              : l.countedQuantity !== null
                ? Number(l.countedQuantity) - Number(l.systemQuantity)
                : null;
            const diffColor = diff === null ? '#999' : diff > 0 ? '#0a0' : diff < 0 ? '#c00' : '#555';

            return (
              <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{l.product.sku}</td>
                <td>{l.product.name}</td>
                <td style={{ textAlign: 'right' }}>{Number(l.systemQuantity).toFixed(2)} {l.product.unit}</td>
                <td style={{ textAlign: 'right' }}>
                  {isDraft ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editValues[l.id] ?? ''}
                      onChange={(e) => setEditValues((v) => ({ ...v, [l.id]: e.target.value }))}
                      onBlur={() => saveLine(l.id)}
                      disabled={savingLine === l.id}
                      style={{ width: 90, textAlign: 'right' }}
                      placeholder="—"
                    />
                  ) : (
                    l.countedQuantity !== null
                      ? `${Number(l.countedQuantity).toFixed(2)} ${l.product.unit}`
                      : <span style={{ color: '#999' }}>—</span>
                  )}
                </td>
                <td style={{ textAlign: 'right', color: diffColor, fontWeight: diff !== 0 ? 'bold' : 'normal' }}>
                  {diff === null ? '—' : diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                </td>
                {isDraft && (
                  <td>
                    {savingLine === l.id && <span style={{ fontSize: 12, color: '#888' }}>guardando...</span>}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {isDraft && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleCommit} disabled={acting}>
            {acting ? '...' : 'Confirmar y aplicar ajustes'}
          </button>
          <button onClick={handleCancel} disabled={acting} style={{ color: '#c00' }}>
            {acting ? '...' : 'Cancelar conteo'}
          </button>
        </div>
      )}
    </main>
  );
}
