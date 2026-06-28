'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

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

const STATUS_BADGE: Record<CycleCount['status'], string> = {
  DRAFT: 'badge-warning', COMMITTED: 'badge-success', CANCELLED: 'badge-neutral',
};
const STATUS_LABEL: Record<CycleCount['status'], string> = {
  DRAFT: 'Borrador', COMMITTED: 'Confirmado', CANCELLED: 'Cancelado',
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
      c.lines.forEach((l) => { initial[l.id] = l.countedQuantity ?? ''; });
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

  if (!count) {
    return (
      <div className="flex items-center justify-center py-20">
        {error
          ? <p className="error-msg">{error}</p>
          : <p className="text-[13px] text-on-surface-variant">Cargando…</p>}
      </div>
    );
  }

  const isDraft = count.status === 'DRAFT';
  const pendingLines = count.lines.filter((l) => l.countedQuantity === null).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button className="text-on-surface-variant hover:text-on-surface transition-colors" onClick={() => router.push('/cycle-counts')}>
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <h1 className="page-title m-0">Conteo — {count.warehouse.name}</h1>
            <span className={STATUS_BADGE[count.status]}>{STATUS_LABEL[count.status]}</span>
          </div>
          <p className="text-[12px] text-on-surface-variant ml-9 font-geist">
            Creado por {count.createdBy.name} · {new Date(count.createdAt).toLocaleString('es-CL')}
            {count.reference && ` · ${count.reference}`}
            {count.committedBy && ` · Confirmado por ${count.committedBy.name}`}
          </p>
        </div>
        {isDraft && (
          <div className="flex gap-3">
            <button className="btn-danger" onClick={handleCancel} disabled={acting}>
              <span className="material-symbols-outlined text-[16px]">cancel</span>
              Cancelar
            </button>
            <button className="btn-primary" onClick={handleCommit} disabled={acting}>
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              {acting ? 'Confirmando…' : 'Confirmar y aplicar'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="error-msg mb-4">{error}</p>}

      {isDraft && pendingLines > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
          <span className="material-symbols-outlined text-amber-600 flex-shrink-0">info</span>
          <p className="text-[13px] text-amber-800">
            {pendingLines} línea(s) sin contar. Solo se ajustarán las que tengan cantidad ingresada.
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="th">SKU</th>
              <th className="th">Producto</th>
              <th className="th text-right">Sistema</th>
              <th className="th text-right">Contado</th>
              <th className="th text-right">Diferencia</th>
              {isDraft && <th className="th w-24"></th>}
            </tr>
          </thead>
          <tbody>
            {count.lines.map((l) => {
              const diff = l.difference !== null
                ? Number(l.difference)
                : l.countedQuantity !== null
                  ? Number(l.countedQuantity) - Number(l.systemQuantity)
                  : null;

              return (
                <tr key={l.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="td font-geist text-[12px] text-on-surface-variant">{l.product.sku}</td>
                  <td className="td font-medium">{l.product.name}</td>
                  <td className="td text-right font-geist">{Number(l.systemQuantity).toFixed(2)} {l.product.unit}</td>
                  <td className="td text-right">
                    {isDraft ? (
                      <input
                        className="input w-24 text-right"
                        type="number"
                        step="0.01"
                        min="0"
                        value={editValues[l.id] ?? ''}
                        onChange={(e) => setEditValues((v) => ({ ...v, [l.id]: e.target.value }))}
                        onBlur={() => saveLine(l.id)}
                        disabled={savingLine === l.id}
                        placeholder="—"
                      />
                    ) : (
                      <span className="font-geist">
                        {l.countedQuantity !== null ? `${Number(l.countedQuantity).toFixed(2)} ${l.product.unit}` : <span className="text-on-surface-variant/50">—</span>}
                      </span>
                    )}
                  </td>
                  <td className={`td text-right font-geist font-medium ${diff === null ? 'text-on-surface-variant/40' : diff > 0 ? 'text-secondary' : diff < 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                    {diff === null ? '—' : diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)}
                  </td>
                  {isDraft && (
                    <td className="td text-center">
                      {savingLine === l.id && (
                        <span className="text-[11px] text-on-surface-variant font-geist">guardando…</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
