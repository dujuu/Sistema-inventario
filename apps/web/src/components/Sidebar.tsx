'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, getSession } from '@/lib/api';

const NAV_ITEMS = [
  { href: '/dashboard', icon: 'dashboard', label: 'Stock' },
  { href: '/products', icon: 'inventory_2', label: 'Productos' },
  { href: '/warehouses', icon: 'warehouse', label: 'Bodegas' },
  { href: '/transfers', icon: 'move_up', label: 'Transferencias' },
  { href: '/suppliers', icon: 'business_center', label: 'Proveedores' },
  { href: '/purchase-orders', icon: 'shopping_cart', label: 'Órdenes de compra' },
  { href: '/reservations', icon: 'bookmark', label: 'Reservas' },
  { href: '/stock-alerts', icon: 'warning', label: 'Alertas' },
  { href: '/reports', icon: 'analytics', label: 'Valorización' },
  { href: '/reports/kardex', icon: 'receipt_long', label: 'Kardex' },
  { href: '/cycle-counts', icon: 'fact_check', label: 'Conteos' },
  { href: '/sale-orders', icon: 'point_of_sale', label: 'Ventas' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = getSession();

  function handleLogout() {
    clearSession();
    router.push('/login');
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-surface-container-lowest border-r border-outline-variant flex flex-col z-50">
      {/* Logo */}
      <div className="px-md py-lg flex items-center gap-sm border-b border-outline-variant">
        <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-white text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            inventory_2
          </span>
        </div>
        <div>
          <h1 className="text-[15px] font-bold text-primary leading-tight">StockFlow</h1>
          <p className="text-[11px] text-on-surface-variant opacity-70 leading-tight font-geist">Multi-Bodega</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-sm px-sm">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-sm px-3 py-2 rounded-lg mb-0.5 text-body-md transition-colors duration-150 ${
                active
                  ? 'bg-primary text-white font-medium'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] flex-shrink-0">{item.icon}</span>
              <span className="truncate text-[13px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-md py-md border-t border-outline-variant">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-sm overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-on-primary-container font-geist">
                {session?.email?.[0]?.toUpperCase() ?? 'U'}
              </span>
            </div>
            <p className="text-[12px] text-on-surface truncate font-medium">{session?.email ?? 'Usuario'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-error transition-colors"
            title="Cerrar sesión"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
