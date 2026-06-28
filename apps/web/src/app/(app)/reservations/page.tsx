'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

interface Reservation {
  id: string;
  quantity: string;
  status: 'ACTIVE' | 'DISPATCHED' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string | null;
  product: { sku: string; name: string };
  warehouse: { id: string; code: string; name: string };
}
interface Product { id: string; sku: string; name: string; }
interface Warehouse { id: string; code: string; name: string; }

const STATUS_LABEL: Record<Reservation['status'], string> = {
  ACTIVE: 'Activa', DISPATCHED: 'Despachada', CANCELLED: 'Cancelada', EXPIRED: 'Expirada',
};
const STATUS_BADGE: Record<Reservation['status'], string> = {
  ACTIVE: 'badge-info', DISPATCHED: 'badge-success', CANCELLED: 'badge-error', EXPIRED: 'badge-neutral',
};

export default function ReservationsPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reference, setReference] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  function loadReservations() {
    return apiFetch<Reservation[]>('/reservations')
      .then(setReservations)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error desconocido'));
  }

  useEffect(() => {
    if (!getSession()) { router.push('/login'); return; }
    void loadReservations();
    apiFetch<Product[]>('/products').then(setProducts).catch(() => undefined);
    apiFetch<Warehouse[]>('/warehouses').then(setWarehouses).catch(() => undefined);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          productId, warehouseId, quantity: Number(quantity),
          reference: reference || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      setQuantity('1'); setReference(''); setExpiresAt('');
      await loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(reservation: Reservation, action: 'dispatch' | 'cancel') {
    setError(null);
    setActingId(reservation.id);
    try {
      await apiFetch(`/reservations/${reservation.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ warehouseId: reservation.warehouse.id }),
      });
      await loadReservations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">Reservas</h1>
      <p className="page-subtitle">Reserva de stock sin movimiento físico inmediato.</p>

      <div className="card p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-on-surface mb-4">Nueva reserva</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="form-field">
            <label className="label">Producto</label>
            <select className="select" value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="" disabled>Selecciona…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="label">Bodega</label>
            <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
              <option value="" disabled>Selecciona…</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="label">Cantidad</label>
            <input className="input" type="number" step="0.01" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="label">Referencia (opcional)</label>
            <input className="input" placeholder="Pedido, cliente…" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="label">Expira (opcional)</label>
            <input className="input" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
          <div className="form-field flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
              {submitting ? 'Reservando…' : 'Crear reserva'}
            </button>
          </div>
        </form>
        {error && <p className="error-msg mt-3">{error}</p>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="th">Producto</th>
              <th className="th">Bodega</th>
              <th className="th text-right">Cantidad</th>
              <th className="th">Estado</th>
              <th className="th">Expira</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-on-surface-variant">Sin reservas</td></tr>
            )}
            {reservations.map((r) => (
              <tr key={r.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="td font-medium">{r.product.name}</td>
                <td className="td text-on-surface-variant">{r.warehouse.name}</td>
                <td className="td text-right font-geist">{r.quantity}</td>
                <td className="td"><span className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</span></td>
                <td className="td font-geist text-[12px] text-on-surface-variant">
                  {r.expiresAt ? new Date(r.expiresAt).toLocaleString('es-CL') : '—'}
                </td>
                <td className="td">
                  {r.status === 'ACTIVE' && (
                    <div className="flex gap-2">
                      <button className="btn-sm bg-secondary/10 text-secondary hover:bg-secondary/20" onClick={() => handleAction(r, 'dispatch')} disabled={actingId === r.id}>
                        Despachar
                      </button>
                      <button className="btn-sm bg-error/10 text-error hover:bg-error/20" onClick={() => handleAction(r, 'cancel')} disabled={actingId === r.id}>
                        Cancelar
                      </button>
                    </div>
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
