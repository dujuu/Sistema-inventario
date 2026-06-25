'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearSession } from '@/lib/api';

export default function Nav() {
  const router = useRouter();

  function handleLogout() {
    clearSession();
    router.push('/login');
  }

  return (
    <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <Link href="/dashboard">Stock</Link>
        <Link href="/products">Productos</Link>
        <Link href="/warehouses">Bodegas</Link>
      </div>
      <button onClick={handleLogout}>Cerrar sesión</button>
    </nav>
  );
}
