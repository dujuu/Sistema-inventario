'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

interface Transfer {
  id: string;
  quantity: string;
  status: 'IN_TRANSIT' | 'RECEIVED';
  product: { sku: string; name: string };
  fromWarehouse: { id: string; code: string; name: string };
  toWarehouse: { id: string; code: string; name: string };
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
    if (!getSession()) {
      router.push('/login');
      return;
    }
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
        body: JSON.stringify({
          productId,
          fromWarehouseId,
          toWarehouseId,
          quantity: Number(quantity),
          idempotencyKey: crypto.randomUUID(),
        }),
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
    <main style={{ maxWidth: 820, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <h1>Transferencias</h1>
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
        <select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)} required>
          <option value="" disabled>
            Bodega origen
          </option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.code} — {w.name}
            </option>
          ))}
        </select>
        <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)} required>
          <option value="" disabled>
            Bodega destino
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
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creando...' : 'Crear transferencia'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Producto</th>
            <th style={{ textAlign: 'left' }}>Origen</th>
            <th style={{ textAlign: 'left' }}>Destino</th>
            <th style={{ textAlign: 'right' }}>Cantidad</th>
            <th style={{ textAlign: 'left' }}>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t) => (
            <tr key={t.id}>
              <td>{t.product.name}</td>
              <td>{t.fromWarehouse.name}</td>
              <td>{t.toWarehouse.name}</td>
              <td style={{ textAlign: 'right' }}>{t.quantity}</td>
              <td>{t.status === 'IN_TRANSIT' ? 'En tránsito' : 'Recibida'}</td>
              <td>
                {t.status === 'IN_TRANSIT' && (
                  <button onClick={() => handleReceive(t)} disabled={receivingId === t.id}>
                    {receivingId === t.id ? 'Recibiendo...' : 'Recibir'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
