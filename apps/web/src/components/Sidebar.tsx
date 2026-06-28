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

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
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
    .map((w: string) => w[0])
    .join('')
    .toUpperCase();

  return (
    <aside
      className="fixed left-0 top-0 h-screen bg-white border-r border-[#e8eaf0] flex flex-col z-50 transition-[width] duration-200 ease-in-out overflow-hidden"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* ── Logo + Toggle ── */}
      <div className="flex items-center h-16 border-b border-[#e8eaf0] flex-shrink-0 relative px-4">
        {/* Icon always visible */}
        <div className="w-8 h-8 bg-primary rounded-[10px] flex items-center justify-center flex-shrink-0 shadow-sm">
          <span
            className="material-symbols-outlined text-white"
            style={{ fontSize: 17, fontVariationSettings: "'FILL' 1, 'wght' 500" }}
          >
            inventory_2
          </span>
        </div>

        {/* Name — hidden when collapsed */}
        <div
          className="ml-3 min-w-0 transition-[opacity,width] duration-150"
          style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', overflow: 'hidden' }}
        >
          <p className="text-[14px] font-semibold text-[#0b1c30] leading-none tracking-tight whitespace-nowrap">StockFlow</p>
          <p className="text-[10px] text-[#a0a3b0] leading-none mt-0.5 font-geist tracking-widest whitespace-nowrap">INVENTARIO PRO</p>
        </div>

        {/* Toggle button — positioned at right edge */}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className={`
            absolute right-2 top-1/2 -translate-y-1/2
            w-6 h-6 rounded-md flex items-center justify-center
            text-[#a0a3b0] hover:text-[#0b1c30] hover:bg-[#f4f5fa]
            transition-colors duration-150
            ${collapsed ? 'opacity-0 hover:opacity-100' : ''}
          `}
          style={{ opacity: collapsed ? undefined : 1 }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            {collapsed ? 'menu_open' : 'menu'}
          </span>
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {/* Separator before each group (except first) */}
            {gi > 0 && (
              <div className="mx-3 my-2 border-t border-[#f0f1f6]" />
            )}

            {/* Group label */}
            {group.label && !collapsed && (
              <p className="text-[10px] font-semibold text-[#b0b3c0] uppercase tracking-[0.09em] px-4 mb-1 mt-1 font-geist select-none whitespace-nowrap">
                {group.label}
              </p>
            )}

            {/* Items */}
            <ul className="space-y-0.5 px-2">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={`
                        group relative flex items-center gap-2.5 rounded-lg
                        transition-all duration-100
                        ${collapsed ? 'justify-center px-0 py-2' : 'px-3 py-[7px]'}
                        ${active
                          ? 'bg-[#eef2ff] text-primary'
                          : 'text-[#5a5f7d] hover:bg-[#f4f5fa] hover:text-[#0b1c30]'
                        }
                      `}
                    >
                      {/* Left border indicator */}
                      {active && !collapsed && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                      )}

                      {/* Icon */}
                      <span
                        className="material-symbols-outlined flex-shrink-0 transition-all duration-100"
                        style={{
                          fontSize: 19,
                          fontVariationSettings: active
                            ? "'FILL' 1, 'wght' 500"
                            : "'FILL' 0, 'wght' 400",
                        }}
                      >
                        {item.icon}
                      </span>

                      {/* Label */}
                      {!collapsed && (
                        <span className="text-[13px] font-medium leading-none whitespace-nowrap">{item.label}</span>
                      )}

                      {/* Tooltip when collapsed */}
                      {collapsed && (
                        <span className="
                          pointer-events-none absolute left-full ml-2 z-50
                          px-2 py-1 rounded-md bg-[#0b1c30] text-white text-[12px] font-medium whitespace-nowrap
                          opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg
                        ">
                          {item.label}
                        </span>
                      )}
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
        {collapsed ? (
          /* Collapsed: just avatar + logout stacked */
          <div className="flex flex-col items-center py-3 gap-2">
            <div
              title={userName}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#0052ff] flex items-center justify-center shadow-sm"
            >
              <span className="text-[11px] font-bold text-white font-geist">{initials || 'U'}</span>
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#a0a3b0] hover:bg-[#f4f5fa] hover:text-[#ba1a1a] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
            </button>
          </div>
        ) : (
          /* Expanded: full user card */
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#0052ff] flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-[11px] font-bold text-white font-geist">{initials || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#0b1c30] truncate leading-tight">{userName}</p>
              {userEmail && userName !== userEmail && (
                <p className="text-[10px] text-[#737688] truncate font-geist mt-0.5">{userEmail}</p>
              )}
            </div>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[#a0a3b0] hover:bg-[#f4f5fa] hover:text-[#ba1a1a] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
