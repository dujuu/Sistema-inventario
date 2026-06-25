'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

interface StockRow {
  productId: string;
  warehouseId: string;
  quantityOnHand: string;
  quantityReserved: string;
  product: { sku: string; name: string };
  warehouse: { code: string; name: string };
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

export default function DashboardPage() {
  const router = useRouter();
  const [stock, setStock] = useState<StockRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [type, setType] = useState('IN');
  const [quantity, setQuantity] = useState('1');
  const [reference, setReference] = useState('');

  function loadStock() {
    return apiFetch<StockRow[]>('/stock')
      .then(setStock)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error desconocido'));
  }

  useEffect(() => {
    if (!getSession()) {
      router.push('/login');
      return;
    }
    void loadStock();
    apiFetch<Product[]>('/products').then(setProducts).catch(() => undefined);
    apiFetch<Warehouse[]>('/warehouses').then(setWarehouses).catch(() => undefined);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await apiFetch('/movements', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          warehouseId,
          type,
          quantity: Number(quantity),
          reference: reference || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      setQuantity('1');
      setReference('');
      await loadStock();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <h1>Stock</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>SKU</th>
            <th style={{ textAlign: 'left' }}>Producto</th>
            <th style={{ textAlign: 'left' }}>Bodega</th>
            <th style={{ textAlign: 'right' }}>Disponible</th>
            <th style={{ textAlign: 'right' }}>Reservado</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((row) => (
            <tr key={`${row.productId}-${row.warehouseId}`}>
              <td>{row.product.sku}</td>
              <td>{row.product.name}</td>
              <td>{row.warehouse.name}</td>
              <td style={{ textAlign: 'right' }}>{row.quantityOnHand}</td>
              <td style={{ textAlign: 'right' }}>{row.quantityReserved}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Registrar movimiento</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="IN">Entrada</option>
          <option value="OUT">Salida</option>
          <option value="ADJUSTMENT">Ajuste</option>
        </select>
        <input
          type="number"
          step="0.01"
          placeholder="Cantidad"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <input placeholder="Referencia (opcional)" value={reference} onChange={(e) => setReference(e.target.value)} />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Registrando...' : 'Registrar'}
        </button>
      </form>
      {formError && <p style={{ color: 'red' }}>{formError}</p>}
    </main>
  );
}
