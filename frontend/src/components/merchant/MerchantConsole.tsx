import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

interface MerchantConsoleProps {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

const NAV_ITEMS = [
  { to: '/merchant/dashboard', label: '运营总览', end: true },
  { to: '/merchant/products', label: '直播商品', end: true },
  { to: '/merchant/orders', label: '成交订单' },
  { to: '/merchant/products/new', label: '发布竞拍', end: true },
  { to: '/profile', label: '账号资料', end: true },
];

export default function MerchantConsole({
  title,
  eyebrow,
  description,
  actions,
  children,
}: MerchantConsoleProps) {
  return (
    <div className="min-h-screen bg-[#07090D] text-[#F5F7FA]">
      <div className="mx-auto flex min-h-screen max-w-[1480px]">
        <aside className="hidden w-56 shrink-0 border-r border-[#263241] bg-[#0B1016] px-4 py-5 lg:block">
          <Link to="/merchant/dashboard" className="block rounded-lg border border-[#263241] bg-[#101820] px-3 py-3">
            <div className="text-xs font-semibold text-[#8B97A7]">LIVE OPS</div>
            <div className="mt-1 text-base font-black text-white">商家控盘台</div>
          </Link>
          <nav className="mt-5 space-y-1" aria-label="商家导航">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'block rounded-md px-3 py-2 text-sm font-semibold transition',
                    isActive
                      ? 'bg-[#182331] text-white ring-1 ring-[#263241]'
                      : 'text-[#8B97A7] hover:bg-[#131B24] hover:text-white',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-[#263241] bg-[#07090D]/95 px-4 py-4 backdrop-blur lg:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                {eyebrow ? <div className="text-xs font-black text-[#4BA3FF]">{eyebrow}</div> : null}
                <h1 className="mt-1 break-words text-2xl font-black text-white">{title}</h1>
                {description ? <p className="mt-1 max-w-3xl text-sm text-[#8B97A7]">{description}</p> : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
            <nav className="mt-4 flex gap-2 overflow-x-auto lg:hidden" aria-label="商家移动导航">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'shrink-0 rounded-md border px-3 py-2 text-xs font-semibold transition',
                      isActive
                        ? 'border-[#4BA3FF]/35 bg-[#4BA3FF]/10 text-white'
                        : 'border-[#263241] bg-[#0F151C] text-[#8B97A7] hover:bg-[#182331] hover:text-white',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </header>
          <main className="px-4 py-5 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
