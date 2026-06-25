'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

export default function WarehousesPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadWarehouses() {
    return apiFetch<Warehouse[]>('/warehouses')
      .then(setWarehouses)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error desconocido'));
  }

  useEffect(() => {
    if (!getSession()) {
      router.push('/login');
      return;
    }
    void loadWarehouses();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/warehouses', { method: 'POST', body: JSON.stringify({ code, name }) });
      setCode('');
      setName('');
      await loadWarehouses();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <h1>Bodegas</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} required />
        <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creando...' : 'Crear bodega'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Código</th>
            <th style={{ textAlign: 'left' }}>Nombre</th>
          </tr>
        </thead>
        <tbody>
          {warehouses.map((w) => (
            <tr key={w.id}>
              <td>{w.code}</td>
              <td>{w.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
