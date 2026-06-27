'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

interface SaleOrder {
  id: string;
  status: 'PENDING' | 'DISPATCHED' | 'CANCELLED';
  reference: string | null;
  customerName: string | null;
  createdAt: string;
  warehouse: { code: string; name: string };
  createdBy: { name: string };
  _count: { lines: number };
}

interface Product { id: string; sku: string; name: string; unit: string }
interface Warehouse { id: string; code: string; name: string }

interface LineInput { productId: string; quantity: string; unitPrice: string }

const STATUS_LABEL: Record<SaleOrder['status'], string> = {
  PENDING: 'Pendiente',
  DISPATCHED: 'Despachado',
  CANCELLED: 'Cancelado',
};
const STATUS_COLOR: Record<SaleOrder['status'], string> = {
  PENDING: '#a60',
  DISPATCHED: '#0a0',
  CANCELLED: '#999',
};

export default function SaleOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [reference, setReference] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [lines, setLines] = useState<LineInput[]>([{ productId: '', quantity: '1', unitPrice: '0' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function loadOrders() {
    return apiFetch<SaleOrder[]>('/sale-orders')
      .then(setOrders)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error'));
  }

  useEffect(() => {
    if (!getSession()) { router.push('/login'); return; }
    void loadOrders();
    apiFetch<Product[]>('/products').then(setProducts).catch(() => undefined);
    apiFetch<Warehouse[]>('/warehouses').then(setWarehouses).catch(() => undefined);
  }, [router]);

  function addLine() {
    setLines((l) => [...l, { productId: '', quantity: '1', unitPrice: '0' }]);
  }
  function removeLine(i: number) {
    setLines((l) => l.filter((_, idx) => idx !== i));
  }
  function updateLine(i: number, field: keyof LineInput, value: string) {
    setLines((l) => l.map((line, idx) => idx === i ? { ...line, [field]: value } : line));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await apiFetch<{ id: string }>('/sale-orders', {
        method: 'POST',
        body: JSON.stringify({
          warehouseId,
          reference: reference || undefined,
          customerName: customerName || undefined,
          idempotencyKey: crypto.randomUUID(),
          lines: lines.map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
          })),
        }),
      });
      router.push(`/sale-orders/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Pedidos de venta</h1>
        <button onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cerrar formulario' : 'Nuevo pedido'}
        </button>
      </div>

      {showForm && (
        <form ref={formRef} onSubmit={handleCreate} style={{ border: '1px solid #ddd', padding: 16, marginBottom: 24, borderRadius: 6 }}>
          <h3 style={{ marginTop: 0 }}>Nuevo pedido</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
              <option value="" disabled>Bodega *</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
            </select>
            <input placeholder="Cliente (opcional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <input placeholder="Referencia (opcional)" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Producto</th>
                <th style={{ textAlign: 'right' }}>Cantidad</th>
                <th style={{ textAlign: 'right' }}>Precio unit.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>
                    <select value={l.productId} onChange={(e) => updateLine(i, 'productId', e.target.value)} required style={{ width: '100%' }}>
                      <option value="" disabled>Producto *</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                    </select>
                  </td>
                  <td><input type="number" step="0.01" min="0.01" value={l.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} required style={{ width: 80, textAlign: 'right' }} /></td>
                  <td><input type="number" step="0.01" min="0" value={l.unitPrice} onChange={(e) => updateLine(i, 'unitPrice', e.target.value)} required style={{ width: 100, textAlign: 'right' }} /></td>
                  <td>{lines.length > 1 && <button type="button" onClick={() => removeLine(i)}>✕</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={addLine}>+ Línea</button>
            <button type="submit" disabled={submitting}>{submitting ? 'Creando...' : 'Crear pedido'}</button>
          </div>
        </form>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc' }}>
            <th style={{ textAlign: 'left' }}>Cliente</th>
            <th style={{ textAlign: 'left' }}>Bodega</th>
            <th style={{ textAlign: 'left' }}>Referencia</th>
            <th style={{ textAlign: 'right' }}>Líneas</th>
            <th style={{ textAlign: 'left' }}>Estado</th>
            <th style={{ textAlign: 'left' }}>Fecha</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{o.customerName ?? <span style={{ color: '#999' }}>—</span>}</td>
              <td>{o.warehouse.name}</td>
              <td style={{ color: '#555' }}>{o.reference ?? '—'}</td>
              <td style={{ textAlign: 'right' }}>{o._count.lines}</td>
              <td style={{ color: STATUS_COLOR[o.status], fontWeight: 'bold' }}>{STATUS_LABEL[o.status]}</td>
              <td style={{ fontSize: 12 }}>{new Date(o.createdAt).toLocaleString()}</td>
              <td><button onClick={() => router.push(`/sale-orders/${o.id}`)}>Ver</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
