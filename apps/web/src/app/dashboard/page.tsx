'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearSession, getSession } from '@/lib/api';

interface StockRow {
  productId: string;
  warehouseId: string;
  quantityOnHand: string;
  quantityReserved: string;
  product: { sku: string; name: string };
  warehouse: { code: string; name: string };
}

export default function DashboardPage() {
  const router = useRouter();
  const [stock, setStock] = useState<StockRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getSession()) {
      router.push('/login');
      return;
    }
    apiFetch<StockRow[]>('/stock')
      .then(setStock)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error desconocido'));
  }, [router]);

  function handleLogout() {
    clearSession();
    router.push('/login');
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Stock</h1>
        <button onClick={handleLogout}>Cerrar sesión</button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>SKU</th>
            <th style={{ textAlign: 'left' }}>Producto</th>
            <th style={{ textAlign: 'left' }}>Bodega</th>
            <th style={{ textAlign: 'right' }}>Disponible</th>
            <th style={{ textAlign: 'right' }}>Reservado</th>
          </tr>
        </thead>
        <tbody>
          {stock.map((row) => (
            <tr key={`${row.productId}-${row.warehouseId}`}>
              <td>{row.product.sku}</td>
              <td>{row.product.name}</td>
              <td>{row.warehouse.name}</td>
              <td style={{ textAlign: 'right' }}>{row.quantityOnHand}</td>
              <td style={{ textAlign: 'right' }}>{row.quantityReserved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
