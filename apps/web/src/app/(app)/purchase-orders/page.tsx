'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

interface Product { id: string; sku: string; name: string; }
interface Warehouse { id: string; code: string; name: string; }
interface Supplier { id: string; name: string; }
interface PurchaseOrderLine {
  id: string;
  quantityOrdered: string;
  quantityReceived: string;
  unitCost: string;
  product: Product;
}
interface PurchaseOrder {
  id: string;
  status: 'PENDING' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  reference: string | null;
  supplier: Supplier;
  warehouse: Warehouse;
  lines: PurchaseOrderLine[];
}
interface LineDraft { productId: string; quantity: string; unitCost: string; }

const STATUS_LABEL: Record<PurchaseOrder['status'], string> = {
  PENDING: 'Pendiente', PARTIALLY_RECEIVED: 'Recibida parcialmente',
  RECEIVED: 'Recibida', CANCELLED: 'Cancelada',
};

const STATUS_BADGE: Record<PurchaseOrder['status'], string> = {
  PENDING: 'badge-neutral', PARTIALLY_RECEIVED: 'badge-warning',
  RECEIVED: 'badge-success', CANCELLED: 'badge-error',
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [receivingLineId, setReceivingLineId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ productId: '', quantity: '1', unitCost: '0' }]);
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({});

  function loadOrders() {
    return apiFetch<PurchaseOrder[]>('/purchase-orders')
      .then(setOrders)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error desconocido'));
  }

  useEffect(() => {
    if (!getSession()) { router.push('/login'); return; }
    void loadOrders();
    apiFetch<Product[]>('/products').then(setProducts).catch(() => undefined);
    apiFetch<Warehouse[]>('/warehouses').then(setWarehouses).catch(() => undefined);
    apiFetch<Supplier[]>('/suppliers').then(setSuppliers).catch(() => undefined);
  }, [router]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId, warehouseId, reference: reference || undefined,
          idempotencyKey: crypto.randomUUID(),
          lines: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })),
        }),
      });
      setReference('');
      setLines([{ productId: '', quantity: '1', unitCost: '0' }]);
      setShowForm(false);
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReceiveLine(order: PurchaseOrder, line: PurchaseOrderLine) {
    setError(null);
    setReceivingLineId(line.id);
    try {
      const qty = Number(receiveQuantities[line.id] ?? Number(line.quantityOrdered) - Number(line.quantityReceived));
      await apiFetch(`/purchase-orders/${order.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({ warehouseId: order.warehouse.id, idempotencyKey: crypto.randomUUID(), lines: [{ lineId: line.id, quantity: qty }] }),
      });
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setReceivingLineId(null);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">Órdenes de compra</h1>
          <p className="text-[13px] text-on-surface-variant">Gestión de compras a proveedores.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          <span className="material-symbols-outlined text-[16px]">{showForm ? 'close' : 'add'}</span>
          {showForm ? 'Cerrar' : 'Nueva orden'}
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h2 className="text-[15px] font-semibold text-on-surface mb-4">Nueva orden de compra</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="form-field">
                <label className="label">Proveedor</label>
                <select className="select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
                  <option value="" disabled>Selecciona…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="label">Bodega destino</label>
                <select className="select" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
                  <option value="" disabled>Selecciona…</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="label">Referencia (opcional)</label>
                <input className="input" placeholder="OC-2024-001" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>

            <div className="border border-outline-variant rounded-lg overflow-hidden mb-3">
              <table className="w-full">
                <thead className="bg-surface-container-low">
                  <tr>
                    <th className="th">Producto</th>
                    <th className="th w-32">Cantidad</th>
                    <th className="th w-36">Costo unitario</th>
                    <th className="th w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className="border-b border-outline-variant/40 last:border-0">
                      <td className="px-4 py-2">
                        <select className="select" value={line.productId} onChange={(e) => updateLine(i, { productId: e.target.value })} required>
                          <option value="" disabled>Producto…</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input className="input" type="number" step="0.01" value={line.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} required />
                      </td>
                      <td className="px-4 py-2">
                        <input className="input" type="number" step="0.01" value={line.unitCost} onChange={(e) => updateLine(i, { unitCost: e.target.value })} required />
                      </td>
                      <td className="px-4 py-2 text-center">
                        {lines.length > 1 && (
                          <button type="button" className="text-error hover:text-[#93000a]" onClick={() => setLines((p) => p.filter((_, j) => j !== i))}>
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
              <button type="button" className="btn-secondary" onClick={() => setLines((p) => [...p, { productId: '', quantity: '1', unitCost: '0' }])}>
                <span className="material-symbols-outlined text-[16px]">add</span>Agregar línea
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Creando…' : 'Crear orden'}
              </button>
            </div>
          </form>
          {error && <p className="error-msg mt-3">{error}</p>}
        </div>
      )}

      <div className="space-y-3">
        {orders.length === 0 && <p className="text-[13px] text-on-surface-variant">Sin órdenes de compra.</p>}
        {orders.map((order) => (
          <div key={order.id} className="card overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-container-low/40 transition-colors"
              onClick={() => setExpanded(expanded === order.id ? null : order.id)}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-on-surface-variant">shopping_cart</span>
                <div className="text-left">
                  <p className="text-[14px] font-medium text-on-surface">{order.supplier.name} → {order.warehouse.name}</p>
                  {order.reference && <p className="text-[12px] text-on-surface-variant font-geist">{order.reference}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={STATUS_BADGE[order.status]}>{STATUS_LABEL[order.status]}</span>
                <span className="material-symbols-outlined text-on-surface-variant">{expanded === order.id ? 'expand_less' : 'expand_more'}</span>
              </div>
            </button>
            {expanded === order.id && (
              <div className="border-t border-outline-variant">
                <table className="w-full">
                  <thead className="bg-surface-container-low">
                    <tr>
                      <th className="th">Producto</th>
                      <th className="th text-right">Ordenado</th>
                      <th className="th text-right">Recibido</th>
                      <th className="th">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.lines.map((line) => {
                      const remaining = Number(line.quantityOrdered) - Number(line.quantityReceived);
                      return (
                        <tr key={line.id} className="hover:bg-surface-container-low/50">
                          <td className="td">{line.product.name}</td>
                          <td className="td text-right font-geist">{line.quantityOrdered}</td>
                          <td className="td text-right font-geist">{line.quantityReceived}</td>
                          <td className="td">
                            {remaining > 0 && (
                              <div className="flex items-center gap-2">
                                <input
                                  className="input w-24"
                                  type="number"
                                  step="0.01"
                                  value={receiveQuantities[line.id] ?? String(remaining)}
                                  onChange={(e) => setReceiveQuantities((p) => ({ ...p, [line.id]: e.target.value }))}
                                />
                                <button
                                  className="btn-sm bg-secondary/10 text-secondary hover:bg-secondary/20"
                                  onClick={() => handleReceiveLine(order, line)}
                                  disabled={receivingLineId === line.id}
                                >
                                  {receivingLineId === line.id ? '…' : 'Recibir'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
