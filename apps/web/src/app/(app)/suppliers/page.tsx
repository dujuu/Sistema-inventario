'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getSession } from '@/lib/api';

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
    if (!getSession()) { router.push('/login'); return; }
    void loadSuppliers();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/suppliers', {
        method: 'POST',
        body: JSON.stringify({ name, taxId: taxId || undefined, email: email || undefined, phone: phone || undefined }),
      });
      setName(''); setTaxId(''); setEmail(''); setPhone('');
      await loadSuppliers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Proveedores</h1>
      <p className="page-subtitle">Gestión de proveedores para órdenes de compra.</p>

      <div className="card p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-on-surface mb-4">Nuevo proveedor</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="form-field">
            <label className="label">Nombre</label>
            <input className="input" placeholder="Nombre del proveedor" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-field">
            <label className="label">RUT/NIT (opcional)</label>
            <input className="input" placeholder="76.123.456-7" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="label">Email (opcional)</label>
            <input className="input" type="email" placeholder="proveedor@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-field">
            <label className="label">Teléfono (opcional)</label>
            <div className="flex gap-2">
              <input className="input" placeholder="+56 9..." value={phone} onChange={(e) => setPhone(e.target.value)} />
              <button type="submit" className="btn-primary flex-shrink-0" disabled={submitting}>
                {submitting ? '…' : <span className="material-symbols-outlined text-[16px]">add</span>}
              </button>
            </div>
          </div>
        </form>
        {error && <p className="error-msg mt-3">{error}</p>}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-container-low">
            <tr>
              <th className="th">Nombre</th>
              <th className="th">RUT/NIT</th>
              <th className="th">Email</th>
              <th className="th">Teléfono</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-on-surface-variant">Sin proveedores</td></tr>
            )}
            {suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="td font-medium">{s.name}</td>
                <td className="td font-geist text-[12px] text-on-surface-variant">{s.taxId ?? '—'}</td>
                <td className="td text-on-surface-variant">{s.email ?? '—'}</td>
                <td className="td text-on-surface-variant">{s.phone ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
