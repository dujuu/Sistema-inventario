'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

interface Reservation {
  id: string;
  quantity: string;
  status: 'ACTIVE' | 'DISPATCHED' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string | null;
  product: { sku: string; name: string };
  warehouse: { id: string; code: string; name: string };
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

const STATUS_LABEL: Record<Reservation['status'], string> = {
  ACTIVE: 'Activa',
  DISPATCHED: 'Despachada',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Expirada',
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
    if (!getSession()) {
      router.push('/login');
      return;
    }
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
          productId,
          warehouseId,
          quantity: Number(quantity),
          reference: reference || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      setQuantity('1');
      setReference('');
      setExpiresAt('');
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
    <main style={{ maxWidth: 880, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <h1>Reservas</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
          <option value="" disabled>
            Producto
          </option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.name}
            </option>
          ))}
        </select>
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
          <option value="" disabled>
            Bodega
          </option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Cantidad"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <input
          placeholder="Referencia (opcional)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <input
          type="datetime-local"
          title="Expira (opcional)"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Reservando...' : 'Crear reserva'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Producto</th>
            <th style={{ textAlign: 'left' }}>Bodega</th>
            <th style={{ textAlign: 'right' }}>Cantidad</th>
            <th style={{ textAlign: 'left' }}>Estado</th>
            <th style={{ textAlign: 'left' }}>Expira</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reservations.map((r) => (
            <tr key={r.id}>
              <td>{r.product.name}</td>
              <td>{r.warehouse.name}</td>
              <td style={{ textAlign: 'right' }}>{r.quantity}</td>
              <td>{STATUS_LABEL[r.status]}</td>
              <td>{r.expiresAt ? new Date(r.expiresAt).toLocaleString() : '—'}</td>
              <td>
                {r.status === 'ACTIVE' && (
                  <>
                    <button onClick={() => handleAction(r, 'dispatch')} disabled={actingId === r.id}>
                      {actingId === r.id ? '...' : 'Despachar'}
                    </button>{' '}
                    <button onClick={() => handleAction(r, 'cancel')} disabled={actingId === r.id}>
                      {actingId === r.id ? '...' : 'Cancelar'}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
