'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';
import Nav from '@/components/Nav';

interface Supplier {
  id: string;
  name: string;
  taxId: string | null;
  email: string | null;
  phone: string | null;
}

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadSuppliers() {
    return apiFetch<Supplier[]>('/suppliers')
      .then(setSuppliers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error desconocido'));
  }

  useEffect(() => {
    if (!getSession()) {
      router.push('/login');
      return;
    }
    void loadSuppliers();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          taxId: taxId || undefined,
          email: email || undefined,
          phone: phone || undefined,
        }),
      });
      setName('');
      setTaxId('');
      setEmail('');
      setPhone('');
      await loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <Nav />
      <h1>Proveedores</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="RUT/NIT (opcional)" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
        <input placeholder="Email (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Teléfono (opcional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creando...' : 'Crear proveedor'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Nombre</th>
            <th style={{ textAlign: 'left' }}>RUT/NIT</th>
            <th style={{ textAlign: 'left' }}>Email</th>
            <th style={{ textAlign: 'left' }}>Teléfono</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.taxId ?? '—'}</td>
              <td>{s.email ?? '—'}</td>
              <td>{s.phone ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
