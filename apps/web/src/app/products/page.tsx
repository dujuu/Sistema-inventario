'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

interface Product {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  cost: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('unidad');
  const [cost, setCost] = useState('0');
  const [barcode, setBarcode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadProducts() {
    return apiFetch<Product[]>('/products')
      .then(setProducts)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error desconocido'));
  }

  useEffect(() => {
    if (!getSession()) {
      router.push('/login');
      return;
    }
    void loadProducts();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({ sku, name, unit, cost: Number(cost), barcode: barcode || undefined }),
      });
      setSku('');
      setName('');
      setUnit('unidad');
      setCost('0');
      setBarcode('');
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <h1>Productos</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} required />
        <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Unidad" value={unit} onChange={(e) => setUnit(e.target.value)} required />
        <input
          type="number"
          step="0.01"
          placeholder="Costo"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          required
        />
        <input placeholder="Código de barras (opcional)" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creando...' : 'Crear producto'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>SKU</th>
            <th style={{ textAlign: 'left' }}>Nombre</th>
            <th style={{ textAlign: 'left' }}>Unidad</th>
            <th style={{ textAlign: 'right' }}>Costo</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.sku}</td>
              <td>{p.name}</td>
              <td>{p.unit}</td>
              <td style={{ textAlign: 'right' }}>{p.cost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
