'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

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

const TYPE_LABEL: Record<KardexLine['type'], string> = {
  IN: 'Entrada',
  OUT: 'Salida',
  ADJUSTMENT: 'Ajuste',
};

const TYPE_COLOR: Record<KardexLine['type'], string> = {
  IN: '#0a6',
  OUT: '#c00',
  ADJUSTMENT: '#77a',
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
    <main style={{ maxWidth: 1000, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <h1>Kardex de producto</h1>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
          <option value="" disabled>Producto *</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
          ))}
        </select>
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">Todas las bodegas</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Desde" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Hasta" />
        <button type="submit" disabled={loading || !productId}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {report && (
        <>
          {report.product && (
            <p style={{ marginBottom: 8 }}>
              <strong>{report.product.sku}</strong> — {report.product.name} ({report.product.unit})
            </p>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ textAlign: 'left' }}>Fecha</th>
                <th style={{ textAlign: 'left' }}>Tipo</th>
                <th style={{ textAlign: 'left' }}>Bodega</th>
                <th style={{ textAlign: 'right' }}>Cantidad</th>
                <th style={{ textAlign: 'right' }}>Saldo</th>
                <th style={{ textAlign: 'left' }}>Referencia</th>
                <th style={{ textAlign: 'left' }}>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ color: '#666', padding: '16px 0' }}>
                    Sin movimientos para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                report.lines.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ fontSize: 12 }}>{new Date(l.date).toLocaleString()}</td>
                    <td style={{ color: TYPE_COLOR[l.type], fontWeight: 'bold' }}>
                      {TYPE_LABEL[l.type]}
                    </td>
                    <td>{l.warehouseName}</td>
                    <td style={{ textAlign: 'right', color: TYPE_COLOR[l.type] }}>
                      {l.type === 'OUT' ? '-' : l.type === 'ADJUSTMENT' && Number(l.quantity) < 0 ? '' : '+'}
                      {fmt(Math.abs(Number(l.quantity)))}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{fmt(l.balance)}</td>
                    <td style={{ fontSize: 12, color: '#555' }}>{l.reference ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{l.createdBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>
            {report.lines.length} movimientos
          </p>
        </>
      )}
    </main>
  );
}
