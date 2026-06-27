'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

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
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Error desconocido'),
      );
  }

  function loadStocks() {
    return apiFetch<Stock[]>('/stock')
      .then(setStocks)
      .catch(() => undefined);
  }

  useEffect(() => {
    if (!getSession()) {
      router.push('/login');
      return;
    }
    void loadAlerts();
    void loadStocks();
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
        body: JSON.stringify({
          reorderPoint: val === '' ? null : Number(val),
        }),
      });
      setEditKey(null);
      await loadStocks();
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
    <main style={{ maxWidth: 960, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <h1>Alertas de stock bajo</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <h2>Alertas activas ({activeAlerts.length})</h2>
      {activeAlerts.length === 0 ? (
        <p style={{ color: '#666' }}>Sin alertas activas.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Producto</th>
              <th style={{ textAlign: 'left' }}>Bodega</th>
              <th style={{ textAlign: 'right' }}>Stock actual</th>
              <th style={{ textAlign: 'right' }}>Punto de reorden</th>
              <th style={{ textAlign: 'left' }}>Actualizado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {activeAlerts.map((a) => (
              <tr key={a.id} style={{ background: '#fff3cd' }}>
                <td>{a.product.name} <span style={{ color: '#666', fontSize: 12 }}>({a.product.sku})</span></td>
                <td>{a.warehouse.name}</td>
                <td style={{ textAlign: 'right', color: 'red', fontWeight: 'bold' }}>{a.quantityOnHand}</td>
                <td style={{ textAlign: 'right' }}>{a.reorderPoint}</td>
                <td style={{ fontSize: 12 }}>{new Date(a.updatedAt).toLocaleString()}</td>
                <td>
                  <button
                    onClick={() => handleDismiss(a.id)}
                    disabled={actingId === a.id}
                  >
                    {actingId === a.id ? '...' : 'Ignorar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Puntos de reorden por producto/bodega</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Producto</th>
            <th style={{ textAlign: 'left' }}>Bodega</th>
            <th style={{ textAlign: 'right' }}>Stock actual</th>
            <th style={{ textAlign: 'right' }}>Punto de reorden</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {stocks.map((s) => {
            const key = `${s.productId}:${s.warehouseId}`;
            const isEditing = editKey === key;
            return (
              <tr key={key}>
                <td>{s.product.name} <span style={{ color: '#666', fontSize: 12 }}>({s.product.sku})</span></td>
                <td>{s.warehouse.name}</td>
                <td style={{ textAlign: 'right' }}>{s.quantityOnHand}</td>
                <td style={{ textAlign: 'right' }}>
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="vacío = sin umbral"
                      style={{ width: 120 }}
                    />
                  ) : (
                    s.reorderPoint ?? <span style={{ color: '#999' }}>—</span>
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <>
                      <button onClick={() => handleSaveThreshold(s.productId, s.warehouseId)} disabled={saving}>
                        {saving ? '...' : 'Guardar'}
                      </button>{' '}
                      <button onClick={() => setEditKey(null)}>Cancelar</button>
                    </>
                  ) : (
                    <button onClick={() => { setEditKey(key); setEditValue(s.reorderPoint ?? ''); }}>
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {inactiveAlerts.length > 0 && (
        <>
          <h2>Historial de alertas resueltas</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Producto</th>
                <th style={{ textAlign: 'left' }}>Bodega</th>
                <th style={{ textAlign: 'right' }}>Stock al alertar</th>
                <th style={{ textAlign: 'right' }}>Umbral</th>
                <th style={{ textAlign: 'left' }}>Resuelto</th>
              </tr>
            </thead>
            <tbody>
              {inactiveAlerts.map((a) => (
                <tr key={a.id} style={{ color: '#666' }}>
                  <td>{a.product.name}</td>
                  <td>{a.warehouse.name}</td>
                  <td style={{ textAlign: 'right' }}>{a.quantityOnHand}</td>
                  <td style={{ textAlign: 'right' }}>{a.reorderPoint}</td>
                  <td style={{ fontSize: 12 }}>{new Date(a.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
