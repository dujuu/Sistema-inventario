'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

interface Transfer {
  id: string;
  quantity: string;
  status: 'IN_TRANSIT' | 'RECEIVED';
  product: { sku: string; name: string };
  fromWarehouse: { id: string; code: string; name: string };
  toWarehouse: { id: string; code: string; name: string };
}

interface Product { id: string; sku: string; name: string; }
interface Warehouse { id: string; code: string; name: string; }

export default function TransfersPage() {
  const router = useRouter();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  const [productId, setProductId] = useState('');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('1');

  function loadTransfers() {
    return apiFetch<Transfer[]>('/transfers')
      .then(setTransfers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error desconocido'));
  }

  useEffect(() => {
    if (!getSession()) { router.push('/login'); return; }
    void loadTransfers();
    apiFetch<Product[]>('/products').then(setProducts).catch(() => undefined);
    apiFetch<Warehouse[]>('/warehouses').then(setWarehouses).catch(() => undefined);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/transfers', {
        method: 'POST',
        body: JSON.stringify({ productId, fromWarehouseId, toWarehouseId, quantity: Number(quantity), idempotencyKey: crypto.randomUUID() }),
      });
      setQuantity('1');
      await loadTransfers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReceive(transfer: Transfer) {
    setError(null);
    setReceivingId(transfer.id);
    try {
      await apiFetch(`/transfers/${transfer.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({ toWarehouseId: transfer.toWarehouse.id }),
      });
      await loadTransfers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setReceivingId(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">Transferencias</h1>
      <p className="page-subtitle">Movimientos de stock entre bodegas.</p>

      <div className="card p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-on-surface mb-4">Nueva transferencia</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="form-field">
            <label className="label">Producto</label>
            <select className="select" value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="" disabled>Selecciona…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="label">Bodega origen</label>
            <select className="select" value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)} required>
              <option value="" disabled>Selecciona…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="label">Bodega destino</label>
            <select className="select" value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} required>
              <option value="" disabled>Selecciona…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="label">Cantidad</label>
            <div className="flex gap-2">
              <input className="input" type="number" step="0.01" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              <button type="submit" className="btn-primary flex-shrink-0" disabled={submitting}>
                {submitting ? '…' : <span className="material-symbols-outlined text-[16px]">move_up</span>}
              </button>
            </div>
          </div>
        </form>
        {error && <p className="error-msg mt-3">{error}</p>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="th">Producto</th>
              <th className="th">Origen</th>
              <th className="th">Destino</th>
              <th className="th text-right">Cantidad</th>
              <th className="th">Estado</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-on-surface-variant">Sin transferencias</td></tr>
            )}
            {transfers.map((t) => (
              <tr key={t.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="td font-medium">{t.product.name}</td>
                <td className="td text-on-surface-variant">{t.fromWarehouse.name}</td>
                <td className="td text-on-surface-variant">{t.toWarehouse.name}</td>
                <td className="td text-right font-geist">{t.quantity}</td>
                <td className="td">
                  {t.status === 'IN_TRANSIT'
                    ? <span className="badge-warning">En tránsito</span>
                    : <span className="badge-success">Recibida</span>}
                </td>
                <td className="td">
                  {t.status === 'IN_TRANSIT' && (
                    <button
                      className="btn-sm bg-secondary/10 text-secondary hover:bg-secondary/20"
                      onClick={() => handleReceive(t)}
                      disabled={receivingId === t.id}
                    >
                      {receivingId === t.id ? '…' : 'Recibir'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
