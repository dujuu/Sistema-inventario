'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

interface ValuationLine {
  warehouseCode: string;
  warehouseName: string;
  productSku: string;
  productName: string;
  unit: string;
  unitCost: string;
  quantityOnHand: string;
  quantityReserved: string;
  value: string;
}

interface ValuationReport {
  lines: ValuationLine[];
  grandTotal: string;
}

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

export default function StockValuationPage() {
  const router = useRouter();
  const [report, setReport] = useState<ValuationReport | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getSession()) { router.push('/login'); return; }
    apiFetch<Warehouse[]>('/warehouses').then(setWarehouses).catch(() => undefined);
    void loadReport('');
  }, [router]);

  async function loadReport(wId: string) {
    setLoading(true);
    setError(null);
    try {
      const qs = wId ? `?warehouseId=${wId}` : '';
      setReport(await apiFetch<ValuationReport>(`/reports/stock-valuation${qs}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  function handleWarehouseChange(wId: string) {
    setWarehouseId(wId);
    void loadReport(wId);
  }

  const fmt = (n: string | number) =>
    Number(n).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div>
      <h1 className="page-title">Valorización de inventario</h1>
      <p className="page-subtitle">Valor total del inventario por producto y bodega.</p>

      {/* Grand total KPI */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="kpi-card">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-primary bg-primary/10 p-2 rounded-lg">analytics</span>
            </div>
            <p className="text-[12px] text-on-surface-variant font-geist uppercase tracking-wide mb-1">Valor total inventario</p>
            <p className="text-2xl font-bold text-on-surface">${fmt(report.grandTotal)}</p>
          </div>
          <div className="kpi-card">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-secondary bg-secondary/10 p-2 rounded-lg">inventory_2</span>
            </div>
            <p className="text-[12px] text-on-surface-variant font-geist uppercase tracking-wide mb-1">Líneas de inventario</p>
            <p className="text-2xl font-bold text-on-surface">{report.lines.length}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="card p-4 mb-6 flex items-center gap-4">
        <label className="label whitespace-nowrap">Filtrar bodega:</label>
        <select className="select max-w-xs" value={warehouseId} onChange={(e) => handleWarehouseChange(e.target.value)}>
          <option value="">Todas las bodegas</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
          ))}
        </select>
        {loading && <span className="text-[12px] text-on-surface-variant font-geist">Cargando…</span>}
      </div>

      {error && <p className="error-msg mb-4">{error}</p>}

      {report && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="th">Bodega</th>
                <th className="th">SKU</th>
                <th className="th">Producto</th>
                <th className="th text-right">Stock</th>
                <th className="th text-right">Reservado</th>
                <th className="th text-right">Costo unit.</th>
                <th className="th text-right">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((l, i) => (
                <tr key={i} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="td text-on-surface-variant">{l.warehouseName}</td>
                  <td className="td font-geist text-[12px] text-on-surface-variant">{l.productSku}</td>
                  <td className="td font-medium">{l.productName}</td>
                  <td className="td text-right font-geist">{fmt(l.quantityOnHand)} <span className="text-[11px] text-on-surface-variant">{l.unit}</span></td>
                  <td className="td text-right font-geist text-on-surface-variant">{fmt(l.quantityReserved)}</td>
                  <td className="td text-right font-geist">${fmt(l.unitCost)}</td>
                  <td className="td text-right font-geist font-semibold">${fmt(l.value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-container border-t-2 border-outline-variant">
                <td colSpan={6} className="px-4 py-3 text-right text-[13px] font-semibold text-on-surface">
                  Total inventario:
                </td>
                <td className="px-4 py-3 text-right font-geist font-bold text-[16px] text-primary">
                  ${fmt(report.grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="px-4 py-3 text-[11px] text-on-surface-variant font-geist border-t border-outline-variant/40">
            {report.lines.length} líneas · generado {new Date().toLocaleString('es-CL')}
          </p>
        </div>
      )}
    </div>
  );
}
