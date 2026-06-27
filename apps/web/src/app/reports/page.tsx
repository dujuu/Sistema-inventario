'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

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
    <main style={{ maxWidth: 1000, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <h1>Valorización de inventario</h1>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <select value={warehouseId} onChange={(e) => handleWarehouseChange(e.target.value)}>
          <option value="">Todas las bodegas</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
          ))}
        </select>
        {loading && <span style={{ color: '#666' }}>Cargando...</span>}
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {report && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ textAlign: 'left' }}>Bodega</th>
                <th style={{ textAlign: 'left' }}>SKU</th>
                <th style={{ textAlign: 'left' }}>Producto</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th style={{ textAlign: 'right' }}>Reservado</th>
                <th style={{ textAlign: 'right' }}>Costo unit.</th>
                <th style={{ textAlign: 'right' }}>Valor total</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((l, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td>{l.warehouseName}</td>
                  <td style={{ fontFamily: 'monospace' }}>{l.productSku}</td>
                  <td>{l.productName}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(l.quantityOnHand)} {l.unit}</td>
                  <td style={{ textAlign: 'right', color: '#888' }}>{fmt(l.quantityReserved)}</td>
                  <td style={{ textAlign: 'right' }}>${fmt(l.unitCost)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${fmt(l.value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #ccc', background: '#f9f9f9' }}>
                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: 8 }}>
                  Total inventario:
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: 16 }}>
                  ${fmt(report.grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
          <p style={{ color: '#666', fontSize: 12 }}>
            {report.lines.length} líneas · generado {new Date().toLocaleString()}
          </p>
        </>
      )}
    </main>
  );
}
