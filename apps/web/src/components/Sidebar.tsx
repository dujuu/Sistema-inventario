'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearSession, getSession } from '@/lib/api';

interface NavItem {
  href: string;
  icon: string;
  label: string;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
    ],
  },
  {
    label: 'Inventario',
    items: [
      { href: '/products', icon: 'inventory_2', label: 'Productos' },
      { href: '/warehouses', icon: 'warehouse', label: 'Bodegas' },
      { href: '/stock-alerts', icon: 'warning', label: 'Alertas de stock' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/transfers', icon: 'move_up', label: 'Transferencias' },
      { href: '/reservations', icon: 'bookmark', label: 'Reservas' },
      { href: '/sale-orders', icon: 'point_of_sale', label: 'Ventas' },
      { href: '/cycle-counts', icon: 'fact_check', label: 'Conteos cíclicos' },
    ],
  },
  {
    label: 'Compras',
    items: [
      { href: '/suppliers', icon: 'business_center', label: 'Proveedores' },
      { href: '/purchase-orders', icon: 'shopping_cart', label: 'Órdenes de compra' },
    ],
  },
  {
    label: 'Reportes',
    items: [
      { href: '/reports', icon: 'analytics', label: 'Valorización' },
      { href: '/reports/kardex', icon: 'receipt_long', label: 'Kardex' },
    ],
  },
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
    if (href === '/reports') return pathname === '/reports';
    return pathname.startsWith(href);
  }

  const userName = session?.user?.name ?? session?.email ?? 'Usuario';
  const userEmail = session?.user?.email ?? session?.email ?? '';
  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] bg-[#ffffff] border-r border-[#e8eaf0] flex flex-col z-50">

      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-[#e8eaf0] flex-shrink-0">
        <div className="w-8 h-8 bg-primary rounded-[10px] flex items-center justify-center flex-shrink-0 shadow-sm">
          <span
            className="material-symbols-outlined text-white"
            style={{ fontSize: 18, fontVariationSettings: "'FILL' 1, 'wght' 500" }}
          >
            inventory_2
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#0b1c30] leading-none tracking-tight">StockFlow</p>
          <p className="text-[10px] text-[#737688] leading-none mt-0.5 font-geist tracking-wide">INVENTARIO PRO</p>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="text-[10px] font-semibold text-[#a0a3b0] uppercase tracking-[0.08em] px-3 mb-1 font-geist select-none">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`
                        group flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium
                        transition-all duration-100 relative
                        ${active
                          ? 'bg-[#eef2ff] text-primary'
                          : 'text-[#5a5f7d] hover:bg-[#f4f5fa] hover:text-[#0b1c30]'
                        }
                      `}
                    >
                      {/* Active left indicator */}
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                      )}
                      <span
                        className="material-symbols-outlined flex-shrink-0 transition-all"
                        style={{
                          fontSize: 18,
                          fontVariationSettings: active
                            ? "'FILL' 1, 'wght' 500"
                            : "'FILL' 0, 'wght' 400",
                        }}
                      >
                        {item.icon}
                      </span>
                      <span className="leading-none">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── User section ── */}
      <div className="flex-shrink-0 border-t border-[#e8eaf0]">
        <div className="flex items-center gap-3 px-4 py-3.5">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#0052ff] flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-[11px] font-bold text-white font-geist tracking-wide">{initials || 'U'}</span>
          </div>

          {/* Name + email */}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[#0b1c30] truncate leading-tight">{userName}</p>
            {userEmail && userName !== userEmail && (
              <p className="text-[10px] text-[#737688] truncate leading-tight font-geist mt-0.5">{userEmail}</p>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[#a0a3b0] hover:bg-[#f4f5fa] hover:text-[#ba1a1a] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
