'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

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

  const totalUnits = stock.reduce((s, r) => s + Number(r.quantityOnHand), 0);
  const totalReserved = stock.reduce((s, r) => s + Number(r.quantityReserved), 0);

  return (
    <div>
      <h1 className="page-title">Stock General</h1>
      <p className="page-subtitle">Niveles de inventario en tiempo real por producto y bodega.</p>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-3">
            <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">inventory_2</span>
          </div>
          <p className="text-[12px] text-on-surface-variant font-geist uppercase tracking-wide mb-1">Ítems en stock</p>
          <p className="text-2xl font-bold text-on-surface">{stock.length}</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-3">
            <span className="material-symbols-outlined text-secondary bg-secondary/10 p-2 rounded-lg">check_circle</span>
          </div>
          <p className="text-[12px] text-on-surface-variant font-geist uppercase tracking-wide mb-1">Unidades disponibles</p>
          <p className="text-2xl font-bold text-on-surface">{totalUnits.toLocaleString()}</p>
        </div>
        <div className="kpi-card">
          <div className="flex items-center justify-between mb-3">
            <span className="material-symbols-outlined text-amber-600 bg-amber-500/10 p-2 rounded-lg">bookmark</span>
          </div>
          <p className="text-[12px] text-on-surface-variant font-geist uppercase tracking-wide mb-1">Unidades reservadas</p>
          <p className="text-2xl font-bold text-on-surface">{totalReserved.toLocaleString()}</p>
        </div>
      </div>

      {/* Movement form */}
      <div className="card p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-on-surface mb-4">Registrar movimiento</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="form-field">
            <label className="label">Producto</label>
            <select className="select" value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="" disabled>Selecciona…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="label">Bodega</label>
            <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
              <option value="" disabled>Selecciona…</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="label">Tipo</label>
            <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="IN">Entrada</option>
              <option value="OUT">Salida</option>
              <option value="ADJUSTMENT">Ajuste</option>
            </select>
          </div>
          <div className="form-field">
            <label className="label">Cantidad</label>
            <input className="input" type="number" step="0.01" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="label">Referencia (opcional)</label>
            <input className="input" placeholder="Nota o referencia" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="form-field flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              <span className="material-symbols-outlined text-[16px]">add</span>
              {submitting ? 'Registrando…' : 'Registrar'}
            </button>
          </div>
        </form>
        {formError && <p className="error-msg mt-3">{formError}</p>}
      </div>

      {/* Stock table */}
      <div className="card overflow-hidden">
        {error && <p className="error-msg m-4">{error}</p>}
        <table className="w-full">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="th">SKU</th>
              <th className="th">Producto</th>
              <th className="th">Bodega</th>
              <th className="th text-right">Disponible</th>
              <th className="th text-right">Reservado</th>
            </tr>
          </thead>
          <tbody>
            {stock.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-[13px] text-on-surface-variant">Sin datos de stock</td></tr>
            )}
            {stock.map((row) => (
              <tr key={`${row.productId}-${row.warehouseId}`} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="td font-geist text-[12px] text-on-surface-variant">{row.product.sku}</td>
                <td className="td font-medium">{row.product.name}</td>
                <td className="td">{row.warehouse.name}</td>
                <td className="td text-right font-geist font-medium">{row.quantityOnHand}</td>
                <td className="td text-right font-geist text-on-surface-variant">{row.quantityReserved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
