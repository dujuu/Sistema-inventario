'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

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

interface Supplier {
  id: string;
  name: string;
}

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

interface LineDraft {
  productId: string;
  quantity: string;
  unitCost: string;
}

const STATUS_LABEL: Record<PurchaseOrder['status'], string> = {
  PENDING: 'Pendiente',
  PARTIALLY_RECEIVED: 'Recibida parcialmente',
  RECEIVED: 'Recibida',
  CANCELLED: 'Cancelada',
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
    if (!getSession()) {
      router.push('/login');
      return;
    }
    void loadOrders();
    apiFetch<Product[]>('/products').then(setProducts).catch(() => undefined);
    apiFetch<Warehouse[]>('/warehouses').then(setWarehouses).catch(() => undefined);
    apiFetch<Supplier[]>('/suppliers').then(setSuppliers).catch(() => undefined);
  }, [router]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { productId: '', quantity: '1', unitCost: '0' }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/purchase-orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          warehouseId,
          reference: reference || undefined,
          idempotencyKey: crypto.randomUUID(),
          lines: lines.map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity),
            unitCost: Number(l.unitCost),
          })),
        }),
      });
      setReference('');
      setLines([{ productId: '', quantity: '1', unitCost: '0' }]);
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
      const quantity = Number(
        receiveQuantities[line.id] ?? Number(line.quantityOrdered) - Number(line.quantityReceived),
      );
      await apiFetch(`/purchase-orders/${order.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          warehouseId: order.warehouse.id,
          idempotencyKey: crypto.randomUUID(),
          lines: [{ lineId: line.id, quantity }],
        }),
      });
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setReceivingLineId(null);
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <h1>Órdenes de compra</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            <option value="" disabled>
              Proveedor
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
            <option value="" disabled>
              Bodega destino
            </option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Referencia (opcional)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select
              value={line.productId}
              onChange={(e) => updateLine(i, { productId: e.target.value })}
              required
            >
              <option value="" disabled>
                Producto
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Cantidad"
              value={line.quantity}
              onChange={(e) => updateLine(i, { quantity: e.target.value })}
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Costo unitario"
              value={line.unitCost}
              onChange={(e) => updateLine(i, { unitCost: e.target.value })}
              required
            />
            {lines.length > 1 && (
              <button type="button" onClick={() => removeLine(i)}>
                Quitar
              </button>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={addLine}>
            + Agregar línea
          </button>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creando...' : 'Crear orden de compra'}
          </button>
        </div>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {orders.map((order) => (
        <div key={order.id} style={{ border: '1px solid #ccc', borderRadius: 4, padding: 12, marginBottom: 12 }}>
          <strong>
            {order.supplier.name} → {order.warehouse.name}
          </strong>{' '}
          — {STATUS_LABEL[order.status]}
          {order.reference && <span> ({order.reference})</span>}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Producto</th>
                <th style={{ textAlign: 'right' }}>Ordenado</th>
                <th style={{ textAlign: 'right' }}>Recibido</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => {
                const remaining = Number(line.quantityOrdered) - Number(line.quantityReceived);
                return (
                  <tr key={line.id}>
                    <td>{line.product.name}</td>
                    <td style={{ textAlign: 'right' }}>{line.quantityOrdered}</td>
                    <td style={{ textAlign: 'right' }}>{line.quantityReceived}</td>
                    <td>
                      {remaining > 0 && (
                        <>
                          <input
                            type="number"
                            step="0.01"
                            style={{ width: 80 }}
                            value={receiveQuantities[line.id] ?? String(remaining)}
                            onChange={(e) =>
                              setReceiveQuantities((prev) => ({ ...prev, [line.id]: e.target.value }))
                            }
                          />
                          <button
                            onClick={() => handleReceiveLine(order, line)}
                            disabled={receivingLineId === line.id}
                          >
                            {receivingLineId === line.id ? 'Recibiendo...' : 'Recibir'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </main>
  );
}
