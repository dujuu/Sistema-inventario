'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

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

interface Product { id: string; sku: string; name: string; unit: string; }
interface Warehouse { id: string; code: string; name: string; }
interface LineInput { productId: string; quantity: string; unitPrice: string; }

const STATUS_LABEL: Record<SaleOrder['status'], string> = {
  PENDING: 'Pendiente', DISPATCHED: 'Despachado', CANCELLED: 'Cancelado',
};
const STATUS_BADGE: Record<SaleOrder['status'], string> = {
  PENDING: 'badge-warning', DISPATCHED: 'badge-success', CANCELLED: 'badge-neutral',
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
          lines: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
        }),
      });
      router.push(`/sale-orders/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">Pedidos de venta</h1>
          <p className="text-[13px] text-on-surface-variant">Gestión de despachos y órdenes de clientes.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          <span className="material-symbols-outlined text-[16px]">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'Cerrar' : 'Nuevo pedido'}
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="text-[15px] font-semibold text-on-surface mb-4">Nuevo pedido</h2>
          <form ref={formRef} onSubmit={handleCreate}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="form-field">
                <label className="label">Bodega *</label>
                <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                  <option value="" disabled>Selecciona…</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="label">Cliente (opcional)</label>
                <input className="input" placeholder="Nombre del cliente" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>
              <div className="form-field">
                <label className="label">Referencia (opcional)</label>
                <input className="input" placeholder="Pedido, cotización…" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>

            <div className="border border-outline-variant rounded-lg overflow-hidden mb-3">
              <table className="w-full">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th className="th">Producto</th>
                    <th className="th w-28">Cantidad</th>
                    <th className="th w-32">Precio unit.</th>
                    <th className="th w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b border-outline-variant/40 last:border-0">
                      <td className="px-4 py-2">
                        <select className="select" value={l.productId} onChange={(e) => updateLine(i, 'productId', e.target.value)} required>
                          <option value="" disabled>Producto…</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input className="input text-right" type="number" step="0.01" min="0.01" value={l.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)} required />
                      </td>
                      <td className="px-4 py-2">
                        <input className="input text-right" type="number" step="0.01" min="0" value={l.unitPrice} onChange={(e) => updateLine(i, 'unitPrice', e.target.value)} required />
                      </td>
                      <td className="px-4 py-2 text-center">
                        {lines.length > 1 && (
                          <button type="button" className="text-error hover:text-[#93000a]" onClick={() => setLines((l) => l.filter((_, j) => j !== i))}>
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button type="button" className="btn-secondary" onClick={() => setLines((l) => [...l, { productId: '', quantity: '1', unitPrice: '0' }])}>
                <span className="material-symbols-outlined text-[16px]">add</span>Agregar línea
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Creando…' : 'Crear pedido'}
              </button>
            </div>
            {error && <p className="error-msg mt-3">{error}</p>}
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="th">Cliente</th>
              <th className="th">Bodega</th>
              <th className="th">Referencia</th>
              <th className="th text-right">Líneas</th>
              <th className="th">Estado</th>
              <th className="th">Fecha</th>
              <th className="th"></th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[13px] text-on-surface-variant">Sin pedidos</td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-surface-container-low/50 transition-colors cursor-pointer" onClick={() => router.push(`/sale-orders/${o.id}`)}>
                <td className="td font-medium">{o.customerName ?? <span className="text-on-surface-variant/50">—</span>}</td>
                <td className="td text-on-surface-variant">{o.warehouse.name}</td>
                <td className="td font-geist text-[12px] text-on-surface-variant">{o.reference ?? '—'}</td>
                <td className="td text-right font-geist">{o._count.lines}</td>
                <td className="td"><span className={STATUS_BADGE[o.status]}>{STATUS_LABEL[o.status]}</span></td>
                <td className="td font-geist text-[11px] text-on-surface-variant">{new Date(o.createdAt).toLocaleString('es-CL')}</td>
                <td className="td">
                  <span className="material-symbols-outlined text-on-surface-variant text-[18px]">chevron_right</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
