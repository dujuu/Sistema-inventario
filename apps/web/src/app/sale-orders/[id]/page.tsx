'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

interface Line {
  id: string;
  quantity: string;
  unitPrice: string;
  product: { sku: string; name: string; unit: string };
}

interface SaleOrder {
  id: string;
  status: 'PENDING' | 'DISPATCHED' | 'CANCELLED';
  reference: string | null;
  customerName: string | null;
  warehouseId: string;
  createdAt: string;
  dispatchedAt: string | null;
  warehouse: { code: string; name: string };
  createdBy: { name: string };
  dispatchedBy: { name: string } | null;
  lines: Line[];
}

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

export default function SaleOrderDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<SaleOrder | null>(null);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setOrder(await apiFetch<SaleOrder>(`/sale-orders/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  useEffect(() => {
    if (!getSession()) { router.push('/login'); return; }
    void load();
  }, [id, router]);

  async function handleAction(action: 'dispatch' | 'cancel') {
    if (!order) return;
    setError(null);
    setActing(true);
    try {
      await apiFetch(`/sale-orders/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ warehouseId: order.warehouseId }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setActing(false);
    }
  }

  if (!order) return <main style={{ padding: 40 }}><Nav />{error ?? 'Cargando...'}</main>;

  const total = order.lines.reduce(
    (sum, l) => sum + Number(l.quantity) * Number(l.unitPrice),
    0,
  );
  const fmt = (n: number) => n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main style={{ maxWidth: 900, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <button onClick={() => router.push('/sale-orders')} style={{ marginBottom: 16 }}>← Volver</button>
      <h1>Pedido de venta</h1>
      <p style={{ color: '#555' }}>
        Estado: <strong style={{ color: STATUS_COLOR[order.status] }}>{STATUS_LABEL[order.status]}</strong>
        {order.customerName && <> · Cliente: <strong>{order.customerName}</strong></>}
        {order.reference && <> · Ref: {order.reference}</>}
        <br />
        Bodega: {order.warehouse.name} · Creado por {order.createdBy.name} el {new Date(order.createdAt).toLocaleString()}
        {order.dispatchedBy && (
          <> · Despachado por {order.dispatchedBy.name} el {new Date(order.dispatchedAt!).toLocaleString()}</>
        )}
      </p>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc' }}>
            <th style={{ textAlign: 'left' }}>SKU</th>
            <th style={{ textAlign: 'left' }}>Producto</th>
            <th style={{ textAlign: 'right' }}>Cantidad</th>
            <th style={{ textAlign: 'right' }}>Precio unit.</th>
            <th style={{ textAlign: 'right' }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {order.lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{l.product.sku}</td>
              <td>{l.product.name}</td>
              <td style={{ textAlign: 'right' }}>{fmt(Number(l.quantity))} {l.product.unit}</td>
              <td style={{ textAlign: 'right' }}>${fmt(Number(l.unitPrice))}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                ${fmt(Number(l.quantity) * Number(l.unitPrice))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #ccc', background: '#f9f9f9' }}>
            <td colSpan={4} style={{ textAlign: 'right', fontWeight: 'bold', paddingRight: 8 }}>Total:</td>
            <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: 16 }}>${fmt(total)}</td>
          </tr>
        </tfoot>
      </table>

      {order.status === 'PENDING' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleAction('dispatch')}
            disabled={acting}
            style={{ background: '#0a0', color: '#fff', border: 'none', padding: '8px 16px', cursor: 'pointer' }}
          >
            {acting ? '...' : 'Despachar (descontar stock)'}
          </button>
          <button
            onClick={() => handleAction('cancel')}
            disabled={acting}
            style={{ color: '#c00' }}
          >
            {acting ? '...' : 'Cancelar pedido'}
          </button>
        </div>
      )}
    </main>
  );
}
