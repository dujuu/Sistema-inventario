'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

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
    <div>
      <h1 className="page-title">Productos</h1>
      <p className="page-subtitle">Catálogo de productos del sistema.</p>

      <div className="card p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-on-surface mb-4">Nuevo producto</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="form-field">
            <label className="label">SKU</label>
            <input className="input" placeholder="Ej: PROD-001" value={sku} onChange={(e) => setSku(e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="label">Nombre</label>
            <input className="input" placeholder="Nombre del producto" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="label">Unidad</label>
            <input className="input" placeholder="unidad, kg, litro…" value={unit} onChange={(e) => setUnit(e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="label">Costo</label>
            <input className="input" type="number" step="0.01" placeholder="0.00" value={cost} onChange={(e) => setCost(e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="label">Código de barras (opcional)</label>
            <input className="input" placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </div>
          <div className="form-field flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              <span className="material-symbols-outlined text-[16px]">add</span>
              {submitting ? 'Creando…' : 'Crear producto'}
            </button>
          </div>
        </form>
        {error && <p className="error-msg mt-3">{error}</p>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="th">SKU</th>
              <th className="th">Nombre</th>
              <th className="th">Unidad</th>
              <th className="th text-right">Costo</th>
              <th className="th">Barcode</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px] text-on-surface-variant">Sin productos</td></tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="td font-geist text-[12px] text-on-surface-variant">{p.sku}</td>
                <td className="td font-medium">{p.name}</td>
                <td className="td text-on-surface-variant">{p.unit}</td>
                <td className="td text-right font-geist">{Number(p.cost).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</td>
                <td className="td font-geist text-[12px] text-on-surface-variant">{p.barcode ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
