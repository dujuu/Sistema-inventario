'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

interface KardexLine {
  id: string;
  date: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  warehouseCode: string;
  warehouseName: string;
  quantity: string;
  balance: string;
  reference: string | null;
  createdBy: string;
}

interface KardexReport {
  product: { sku: string; name: string; unit: string } | null;
  lines: KardexLine[];
}

interface Product { id: string; sku: string; name: string; }
interface Warehouse { id: string; code: string; name: string; }

const TYPE_BADGE: Record<KardexLine['type'], string> = {
  IN: 'badge-success',
  OUT: 'badge-error',
  ADJUSTMENT: 'badge-info',
};

const TYPE_LABEL: Record<KardexLine['type'], string> = {
  IN: 'Entrada', OUT: 'Salida', ADJUSTMENT: 'Ajuste',
};

export default function KardexPage() {
  const router = useRouter();
  const [report, setReport] = useState<KardexReport | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getSession()) { router.push('/login'); return; }
    apiFetch<Product[]>('/products').then(setProducts).catch(() => undefined);
    apiFetch<Warehouse[]>('/warehouses').then(setWarehouses).catch(() => undefined);
  }, [router]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ productId });
      if (warehouseId) params.set('warehouseId', warehouseId);
      if (from) params.set('from', new Date(from).toISOString());
      if (to) params.set('to', new Date(to).toISOString());
      setReport(await apiFetch<KardexReport>(`/reports/kardex?${params.toString()}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: string | number) =>
    Number(n).toLocaleString('es-CL', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  return (
    <div>
      <h1 className="page-title">Kardex de producto</h1>
      <p className="page-subtitle">Historial de movimientos con saldo acumulado.</p>

      <div className="card p-6 mb-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="form-field">
            <label className="label">Producto *</label>
            <select className="select" value={productId} onChange={(e) => setProductId(e.target.value)} required>
              <option value="" disabled>Selecciona…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="label">Bodega</label>
            <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Todas las bodegas</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="label">Desde</label>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="label">Hasta</label>
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="form-field flex items-end">
            <button type="submit" className="btn-primary w-full" disabled={loading || !productId}>
              <span className="material-symbols-outlined text-[16px]">search</span>
              {loading ? 'Buscando…' : 'Buscar'}
            </button>
          </div>
        </form>
      </div>

      {error && <p className="error-msg mb-4">{error}</p>}

      {report && (
        <div className="card overflow-hidden">
          {report.product && (
            <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">receipt_long</span>
              <div>
                <p className="font-semibold text-on-surface">{report.product.name}</p>
                <p className="text-[12px] font-geist text-on-surface-variant">{report.product.sku} · {report.product.unit}</p>
              </div>
              <span className="ml-auto font-geist text-[12px] text-on-surface-variant">{report.lines.length} movimientos</span>
            </div>
          )}
          <table className="w-full">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="th">Fecha</th>
                <th className="th">Tipo</th>
                <th className="th">Bodega</th>
                <th className="th text-right">Cantidad</th>
                <th className="th text-right">Saldo</th>
                <th className="th">Referencia</th>
                <th className="th">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[13px] text-on-surface-variant">Sin movimientos para los filtros seleccionados.</td></tr>
              ) : (
                report.lines.map((l) => {
                  const qty = Number(l.quantity);
                  const isNeg = qty < 0;
                  return (
                    <tr key={l.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="td font-geist text-[11px] text-on-surface-variant">{new Date(l.date).toLocaleString('es-CL')}</td>
                      <td className="td"><span className={TYPE_BADGE[l.type]}>{TYPE_LABEL[l.type]}</span></td>
                      <td className="td text-on-surface-variant">{l.warehouseName}</td>
                      <td className={`td text-right font-geist font-medium ${isNeg || l.type === 'OUT' ? 'text-error' : 'text-secondary'}`}>
                        {l.type === 'OUT' ? '-' : isNeg ? '' : '+'}{fmt(Math.abs(qty))}
                      </td>
                      <td className="td text-right font-geist font-bold">{fmt(l.balance)}</td>
                      <td className="td font-geist text-[11px] text-on-surface-variant">{l.reference ?? '—'}</td>
                      <td className="td font-geist text-[11px] text-on-surface-variant">{l.createdBy}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
