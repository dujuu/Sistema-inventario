'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

interface StockAlert {
  id: string;
  quantityOnHand: string;
  reorderPoint: string;
  active: boolean;
  updatedAt: string;
  product: { sku: string; name: string };
  warehouse: { code: string; name: string };
}

interface Stock {
  productId: string;
  warehouseId: string;
  quantityOnHand: string;
  reorderPoint: string | null;
  product: { sku: string; name: string };
  warehouse: { code: string; name: string };
}

export default function StockAlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  function loadAlerts() {
    return apiFetch<StockAlert[]>('/stock-alerts')
      .then(setAlerts)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error desconocido'));
  }

  useEffect(() => {
    if (!getSession()) { router.push('/login'); return; }
    void loadAlerts();
    apiFetch<Stock[]>('/stock').then(setStocks).catch(() => undefined);
  }, [router]);

  async function handleDismiss(id: string) {
    setError(null);
    setActingId(id);
    try {
      await apiFetch(`/stock-alerts/${id}/dismiss`, { method: 'POST' });
      await loadAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setActingId(null);
    }
  }

  async function handleSaveThreshold(productId: string, warehouseId: string) {
    setError(null);
    setSaving(true);
    try {
      const val = editValue.trim();
      await apiFetch(`/stock/${productId}/${warehouseId}/reorder-point`, {
        method: 'PATCH',
        body: JSON.stringify({ reorderPoint: val === '' ? null : Number(val) }),
      });
      setEditKey(null);
      await apiFetch<Stock[]>('/stock').then(setStocks).catch(() => undefined);
      await loadAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSaving(false);
    }
  }

  const activeAlerts = alerts.filter((a) => a.active);
  const inactiveAlerts = alerts.filter((a) => !a.active);

  return (
    <div>
      <h1 className="page-title">Alertas de stock bajo</h1>
      <p className="page-subtitle">Monitoreo de productos bajo su punto de reorden.</p>

      {error && <p className="error-msg mb-4">{error}</p>}

      {/* Active alerts */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[15px] font-semibold text-on-surface">Alertas activas</h2>
          {activeAlerts.length > 0 && (
            <span className="badge-error">{activeAlerts.length}</span>
          )}
        </div>
        {activeAlerts.length === 0 ? (
          <div className="card p-6 flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary">check_circle</span>
            <p className="text-[13px] text-on-surface-variant">Sin alertas activas. Todo en orden.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-amber-50">
                <tr>
                  <th className="th">Producto</th>
                  <th className="th">Bodega</th>
                  <th className="th text-right">Stock actual</th>
                  <th className="th text-right">Punto reorden</th>
                  <th className="th">Actualizado</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {activeAlerts.map((a) => (
                  <tr key={a.id} className="bg-amber-50/40 hover:bg-amber-50 transition-colors">
                    <td className="td">
                      <p className="font-medium">{a.product.name}</p>
                      <p className="text-[11px] font-geist text-on-surface-variant">{a.product.sku}</p>
                    </td>
                    <td className="td text-on-surface-variant">{a.warehouse.name}</td>
                    <td className="td text-right font-geist font-bold text-error">{a.quantityOnHand}</td>
                    <td className="td text-right font-geist">{a.reorderPoint}</td>
                    <td className="td font-geist text-[11px] text-on-surface-variant">
                      {new Date(a.updatedAt).toLocaleString('es-CL')}
                    </td>
                    <td className="td">
                      <button
                        className="btn-sm bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
                        onClick={() => handleDismiss(a.id)}
                        disabled={actingId === a.id}
                      >
                        {actingId === a.id ? '…' : 'Ignorar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reorder thresholds */}
      <div className="mb-6">
        <h2 className="text-[15px] font-semibold text-on-surface mb-3">Puntos de reorden</h2>
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="th">Producto</th>
                <th className="th">Bodega</th>
                <th className="th text-right">Stock actual</th>
                <th className="th text-right">Punto reorden</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {stocks.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-[13px] text-on-surface-variant">Sin datos</td></tr>
              )}
              {stocks.map((s) => {
                const key = `${s.productId}:${s.warehouseId}`;
                const isEditing = editKey === key;
                return (
                  <tr key={key} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="td">
                      <p className="font-medium">{s.product.name}</p>
                      <p className="text-[11px] font-geist text-on-surface-variant">{s.product.sku}</p>
                    </td>
                    <td className="td text-on-surface-variant">{s.warehouse.name}</td>
                    <td className="td text-right font-geist">{s.quantityOnHand}</td>
                    <td className="td text-right">
                      {isEditing ? (
                        <input
                          className="input w-28 text-right"
                          type="number"
                          step="0.01"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="vacío = sin umbral"
                        />
                      ) : (
                        <span className="font-geist">{s.reorderPoint ?? <span className="text-on-surface-variant/50">—</span>}</span>
                      )}
                    </td>
                    <td className="td">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button className="btn-sm bg-primary text-white hover:bg-[#0038b6]" onClick={() => handleSaveThreshold(s.productId, s.warehouseId)} disabled={saving}>
                            {saving ? '…' : 'Guardar'}
                          </button>
                          <button className="btn-sm bg-surface-container text-on-surface-variant hover:bg-surface-container-high" onClick={() => setEditKey(null)}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button className="btn-sm bg-surface-container text-on-surface-variant hover:bg-surface-container-high" onClick={() => { setEditKey(key); setEditValue(s.reorderPoint ?? ''); }}>
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolved history */}
      {inactiveAlerts.length > 0 && (
        <div>
          <h2 className="text-[15px] font-semibold text-on-surface mb-3">Historial resuelto</h2>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="th">Producto</th>
                  <th className="th">Bodega</th>
                  <th className="th text-right">Stock al alertar</th>
                  <th className="th text-right">Umbral</th>
                  <th className="th">Resuelto</th>
                </tr>
              </thead>
              <tbody>
                {inactiveAlerts.map((a) => (
                  <tr key={a.id} className="opacity-60 hover:opacity-80 transition-opacity">
                    <td className="td">{a.product.name}</td>
                    <td className="td text-on-surface-variant">{a.warehouse.name}</td>
                    <td className="td text-right font-geist">{a.quantityOnHand}</td>
                    <td className="td text-right font-geist">{a.reorderPoint}</td>
                    <td className="td font-geist text-[11px] text-on-surface-variant">
                      {new Date(a.updatedAt).toLocaleString('es-CL')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
