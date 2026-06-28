'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

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
  PENDING: 'Pendiente', DISPATCHED: 'Despachado', CANCELLED: 'Cancelado',
};
const STATUS_BADGE: Record<SaleOrder['status'], string> = {
  PENDING: 'badge-warning', DISPATCHED: 'badge-success', CANCELLED: 'badge-neutral',
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

  if (!order) {
    return (
      <div className="flex items-center justify-center py-20">
        {error ? <p className="error-msg">{error}</p> : <p className="text-[13px] text-on-surface-variant">Cargando…</p>}
      </div>
    );
  }

  const fmt = (n: number) => n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const total = order.lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice), 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button className="text-on-surface-variant hover:text-on-surface transition-colors" onClick={() => router.push('/sale-orders')}>
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <h1 className="page-title m-0">Pedido de venta</h1>
            <span className={STATUS_BADGE[order.status]}>{STATUS_LABEL[order.status]}</span>
          </div>
          <div className="ml-9 space-y-0.5">
            {order.customerName && (
              <p className="text-[13px] text-on-surface font-medium">{order.customerName}</p>
            )}
            <p className="text-[12px] text-on-surface-variant font-geist">
              {order.warehouse.name} · Creado por {order.createdBy.name} · {new Date(order.createdAt).toLocaleString('es-CL')}
              {order.reference && ` · ${order.reference}`}
            </p>
            {order.dispatchedBy && (
              <p className="text-[12px] text-secondary font-geist">
                Despachado por {order.dispatchedBy.name} · {new Date(order.dispatchedAt!).toLocaleString('es-CL')}
              </p>
            )}
          </div>
        </div>
        {order.status === 'PENDING' && (
          <div className="flex gap-3">
            <button className="btn-secondary text-error border-error/30 hover:bg-error/5" onClick={() => handleAction('cancel')} disabled={acting}>
              <span className="material-symbols-outlined text-[16px]">cancel</span>
              Cancelar
            </button>
            <button className="btn-primary" onClick={() => handleAction('dispatch')} disabled={acting}>
              <span className="material-symbols-outlined text-[16px]">local_shipping</span>
              {acting ? 'Procesando…' : 'Despachar'}
            </button>
          </div>
        )}
      </div>

      {error && <p className="error-msg mb-4">{error}</p>}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="th">SKU</th>
              <th className="th">Producto</th>
              <th className="th text-right">Cantidad</th>
              <th className="th text-right">Precio unit.</th>
              <th className="th text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={l.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="td font-geist text-[12px] text-on-surface-variant">{l.product.sku}</td>
                <td className="td font-medium">{l.product.name}</td>
                <td className="td text-right font-geist">{fmt(Number(l.quantity))} {l.product.unit}</td>
                <td className="td text-right font-geist">${fmt(Number(l.unitPrice))}</td>
                <td className="td text-right font-geist font-semibold">${fmt(Number(l.quantity) * Number(l.unitPrice))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-container border-t-2 border-outline-variant">
              <td colSpan={4} className="px-4 py-3 text-right text-[13px] font-semibold text-on-surface">Total:</td>
              <td className="px-4 py-3 text-right font-geist font-bold text-[16px] text-primary">${fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
