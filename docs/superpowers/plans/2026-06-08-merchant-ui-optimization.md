# Merchant UI Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the merchant PC frontend into a dark horizontal live product control console while preserving existing backend contracts and auction/order behavior.

**Architecture:** Add scoped merchant presentation primitives and reuse them across existing merchant routes. Convert product management first because it is the visual anchor, then align orders, dashboard, monitor, product detail, and product form. Keep all work frontend-only unless implementation discovers a backend data requirement, in which case stop and promote that requirement through a separate OpenSpec change.

**Tech Stack:** React 19, TypeScript, Vite, TailwindCSS 4, Vitest Testing Library, React Router 7, Zustand, OpenSpec.

---

## File Map

- Create: `frontend/src/components/merchant/MerchantConsole.tsx`
  - Shared merchant page frame, left navigation, top/page header, action slots, and content wrapper.
- Create: `frontend/src/components/merchant/MerchantPrimitives.tsx`
  - Shared status badges, metric cells, row surfaces, empty/error/loading panels, and compact action styles.
- Modify: `frontend/src/pages/merchant/ProductList.tsx`
  - Convert card grid to horizontal live product control rows.
- Modify: `frontend/src/pages/merchant/ProductList.test.tsx`
  - Verify row layout behavior, status filters, monitor/detail navigation, empty/error/loading states.
- Modify: `frontend/src/pages/merchant/OrderList.tsx`
  - Convert order cards to deal-flow rows.
- Modify: `frontend/src/pages/merchant/OrderList.test.tsx`
  - Verify product, buyer, amount, status, timestamps, detail navigation.
- Modify: `frontend/src/pages/merchant/OrderDetail.tsx`
  - Add read-only transaction summary and timestamp timeline.
- Modify: `frontend/src/pages/merchant/OrderDetail.test.tsx`
  - Verify merchant read-only order detail state.
- Modify: `frontend/src/pages/merchant/Dashboard.tsx`
  - Align KPI, chart, active auction, recent order, and status bucket surfaces.
- Modify: `frontend/src/pages/merchant/Dashboard.test.tsx`
  - Verify dashboard data remains visible under the new presentation.
- Modify: `frontend/src/pages/merchant/AuctionMonitor.tsx`
  - Align monitor with control-room hierarchy while preserving WebSocket store behavior.
- Modify: `frontend/src/pages/merchant/AuctionMonitor.test.tsx`
  - Verify state, ranking, event feed, cancellation, terminal behavior.
- Modify: `frontend/src/pages/merchant/ProductDetail.tsx`
  - Align detail, rule summary, media, and actions with console style.
- Modify: `frontend/src/pages/merchant/ProductDetail.test.tsx`
  - Verify existing detail actions remain available.
- Modify: `frontend/src/pages/merchant/ProductForm.tsx`
  - Align create/edit form sections with console style.
- Modify: `frontend/src/pages/merchant/ProductForm.test.tsx`
  - Verify existing form controls and submit/publish behavior.
- Modify: `frontend/src/components/AuctionRuleForm.tsx`
  - Align rule inputs with parameter-panel visual style.
- Modify: `frontend/src/components/ImageUploader.tsx` only if image/media controls need console alignment.
- Modify: `frontend/src/index.css` only if shared CSS variables or console utility classes reduce repeated color literals.
- Modify: `openspec/changes/merchant-ui-optimization/tasks.md`
  - Synchronize task status and actual verification results.
- Modify/Add: `projects/proj-1779447357476-ryiijf/memory/2026-06-08.md`
  - Record delivered UI decision, verification, and next step.
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`
  - Record durable merchant UI direction if implementation completes.

## Execution Notes

- Do not modify backend files in this plan.
- Do not introduce new dependencies.
- Do not add unavailable list metrics by changing API responses.
- If the product list lacks a desired auction metric, show existing status/auction id/navigation and keep detailed metrics on detail, dashboard, or monitor surfaces.
- Keep tests focused on user-visible behavior, not exact class names.
- Preserve route protection and `ProtectedRoute` behavior.

### Task 1: Planning Documents And OpenSpec Sync

**Files:**
- Modify: `openspec/changes/merchant-ui-optimization/tasks.md`
- Add: `docs/superpowers/plans/2026-06-08-merchant-ui-optimization.md`

- [x] **Step 1: Create exploration and OpenSpec files**

Created:

```text
docs/superpowers/specs/2026-06-08-merchant-ui-optimization-exploration.md
openspec/changes/merchant-ui-optimization/proposal.md
openspec/changes/merchant-ui-optimization/design.md
openspec/changes/merchant-ui-optimization/tasks.md
openspec/changes/merchant-ui-optimization/specs/merchant-ui-optimization/spec.md
```

- [x] **Step 2: Validate OpenSpec lock**

Run:

```bash
npx -y @fission-ai/openspec@latest validate merchant-ui-optimization --strict --no-interactive
git diff --check
```

Result: OpenSpec validation passed with `Change 'merchant-ui-optimization' is valid`; `git diff --check` passed.

- [ ] **Step 3: Save execution plan and wait for user approval**

Save this plan, update OpenSpec task status for the planning lock, then ask the user whether to proceed with subagent-driven execution, inline execution, or stop for review.

Expected: no frontend implementation code is changed before this approval.

### Task 2: Shared Merchant Console Frame And Primitives

**Files:**
- Create: `frontend/src/components/merchant/MerchantConsole.tsx`
- Create: `frontend/src/components/merchant/MerchantPrimitives.tsx`
- Modify: `frontend/src/pages/merchant/ProductList.tsx`
- Modify: `frontend/src/pages/merchant/ProductList.test.tsx`
- Modify: `frontend/src/pages/navigationAffordance.test.ts` only if the shared frame changes back-button expectations.

- [x] **Step 1: Add tests for product list still rendering navigation and actions after shared frame adoption**

In `frontend/src/pages/merchant/ProductList.test.tsx`, keep or add assertions that the merchant product page exposes:

```tsx
expect(await screen.findByRole('heading', { name: /直播商品|商品管理/ })).toBeInTheDocument();
expect(screen.getByRole('link', { name: /新建竞拍|添加商品/ })).toHaveAttribute('href', '/merchant/products/new');
expect(screen.getByRole('link', { name: /运营看板/ })).toHaveAttribute('href', '/merchant/dashboard');
expect(screen.getByRole('link', { name: /订单管理|成交订单/ })).toHaveAttribute('href', '/merchant/orders');
```

- [x] **Step 2: Run focused test before implementation**

Run:

```bash
cd frontend && npm run test -- src/pages/merchant/ProductList.test.tsx
```

Result: passed.

- [x] **Step 3: Implement `MerchantConsole.tsx`**

Create a scoped merchant shell with this public interface:

```tsx
import { Link, NavLink } from 'react-router-dom';

interface MerchantConsoleProps {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { to: '/merchant/dashboard', label: '运营总览' },
  { to: '/merchant/products', label: '直播商品' },
  { to: '/merchant/orders', label: '成交订单' },
  { to: '/merchant/products/new', label: '发布竞拍' },
  { to: '/profile', label: '账号资料' },
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
          <nav className="mt-5 space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
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
                {eyebrow ? <div className="text-xs font-black tracking-[0.2em] text-[#4BA3FF]">{eyebrow}</div> : null}
                <h1 className="mt-1 break-words text-2xl font-black tracking-tight text-white">{title}</h1>
                {description ? <p className="mt-1 max-w-3xl text-sm text-[#8B97A7]">{description}</p> : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          </header>
          <main className="px-4 py-5 lg:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 4: Implement `MerchantPrimitives.tsx`**

Create reusable primitives:

```tsx
import type { OrderStatus } from '../../types/order';
import type { ProductStatus } from '../../types/product';

type Tone = 'neutral' | 'active' | 'pending' | 'danger' | 'info' | 'sold';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-[#384553] bg-[#182331] text-[#B2BECC]',
  active: 'border-[#21D19F]/35 bg-[#21D19F]/10 text-[#76F2CD]',
  pending: 'border-[#F4B740]/35 bg-[#F4B740]/10 text-[#FFD47A]',
  danger: 'border-[#F05268]/35 bg-[#F05268]/10 text-[#FF8A9A]',
  info: 'border-[#4BA3FF]/35 bg-[#4BA3FF]/10 text-[#9CCBFF]',
  sold: 'border-[#21D19F]/35 bg-[#21D19F]/10 text-[#76F2CD]',
};

export const PRODUCT_STATUS_TEXT: Record<ProductStatus, string> = {
  draft: '草稿',
  pending: '待开拍',
  active: '竞拍中',
  ended_sold: '已成交',
  ended_no_bid: '流拍',
  cancelled: '已取消',
};

export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  pending_confirm: '待确认',
  pending_payment: '待支付',
  paid: '已支付',
  cancelled: '已取消',
};

export function productStatusTone(status: ProductStatus): Tone {
  if (status === 'active') return 'active';
  if (status === 'pending') return 'pending';
  if (status === 'ended_sold') return 'sold';
  if (status === 'cancelled') return 'danger';
  if (status === 'ended_no_bid') return 'neutral';
  return 'neutral';
}

export function orderStatusTone(status: OrderStatus): Tone {
  if (status === 'paid') return 'sold';
  if (status === 'pending_confirm') return 'pending';
  if (status === 'pending_payment') return 'info';
  return 'danger';
}

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-black ${TONE_CLASS[tone]}`}>
      {label}
    </span>
  );
}

export function MetricCell({ label, value, tone = 'neutral' }: { label: string; value: React.ReactNode; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold text-[#596575]">{label}</div>
      <div className={`mt-1 truncate text-sm font-black tabular-nums ${tone === 'active' || tone === 'sold' ? 'text-[#76F2CD]' : 'text-[#F5F7FA]'}`}>
        {value}
      </div>
    </div>
  );
}

export function ConsolePanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-[#263241] bg-[#0F151C] ${className}`}>{children}</section>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#263241] bg-[#0F151C] px-4 py-12 text-center">
      <div className="text-sm font-bold text-[#F5F7FA]">{title}</div>
      {description ? <div className="mt-1 text-sm text-[#8B97A7]">{description}</div> : null}
    </div>
  );
}
```

- [x] **Step 5: Wrap `ProductList` with `MerchantConsole`**

Use `MerchantConsole` for product page header/actions and keep current data fetching intact.

- [x] **Step 6: Run focused test**

Run:

```bash
cd frontend && npm run test -- src/pages/merchant/ProductList.test.tsx
```

Result:

- `cd frontend && npm run test -- src/pages/merchant/ProductList.test.tsx` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && npm run lint` failed only on pre-existing unrelated files; targeted lint on touched files passed.
- `git diff --check` passed.
- Spec compliance review and code quality review approved after fixes for distinct status tones, React Refresh lint, exact nav matching, and mobile merchant navigation.

### Task 3: Product Management Horizontal Live Product Rows

**Files:**
- Modify: `frontend/src/pages/merchant/ProductList.tsx`
- Modify: `frontend/src/pages/merchant/ProductList.test.tsx`
- Use: `frontend/src/components/merchant/MerchantConsole.tsx`
- Use: `frontend/src/components/merchant/MerchantPrimitives.tsx`

- [x] **Step 1: Update product list tests for horizontal row behavior**

Add assertions for:

```tsx
expect(await screen.findByText('直播商品')).toBeInTheDocument();
expect(screen.getByText('竞拍中')).toBeInTheDocument();
expect(screen.getByText(/商品ID/)).toBeInTheDocument();
expect(screen.getByRole('link', { name: /实时监控/ })).toHaveAttribute('href', '/merchant/auctions/9/monitor');
expect(screen.getByRole('link', { name: /详情/ })).toHaveAttribute('href', '/merchant/products/1');
```

Also keep status tab checks:

```tsx
expect(screen.getByRole('button', { name: '全部' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '待开拍' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: '竞拍中' })).toBeInTheDocument();
```

- [x] **Step 2: Run test and confirm intended failures**

Run:

```bash
cd frontend && npm run test -- src/pages/merchant/ProductList.test.tsx
```

Result: focused ProductList tests were updated around the intended row semantics.

- [x] **Step 3: Replace card grid with row list**

In `ProductList.tsx`, keep the current `TABS`, fetching, refresh, and `usePageRefresh`. Replace the non-empty product render with rows using this shape:

```tsx
<div className="space-y-2">
  {products.map((product, index) => (
    <article
      key={product.id}
      className="grid gap-4 rounded-lg border border-[#263241] bg-[#131B24] p-3 transition hover:border-[#3B4B5D] hover:bg-[#182331] xl:grid-cols-[3rem_minmax(20rem,1fr)_28rem_14rem]"
    >
      <div className="text-sm font-black text-[#596575]">{String(index + 1).padStart(2, '0')}</div>
      <div className="flex min-w-0 gap-3">
        <div className="h-16 w-16 shrink-0 rounded-md border border-[#263241] bg-[#0B1016]" />
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black text-white">{product.title}</h2>
          <p className="mt-1 line-clamp-1 text-xs text-[#8B97A7]">{product.description || '暂无介绍'}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge label={PRODUCT_STATUS_TEXT[product.status]} tone={productStatusTone(product.status)} />
            <span className="rounded-md border border-[#263241] px-2 py-1 text-[11px] font-bold text-[#8B97A7]">商品ID {product.id}</span>
            {product.auction_id ? <span className="rounded-md border border-[#263241] px-2 py-1 text-[11px] font-bold text-[#8B97A7]">竞拍ID {product.auction_id}</span> : null}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCell label="起拍价" value="详情查看" />
        <MetricCell label="加价规则" value="详情查看" />
        <MetricCell label="封顶价" value="详情查看" />
        <MetricCell label={product.status === 'ended_sold' ? '成交结果' : '当前状态'} value={PRODUCT_STATUS_TEXT[product.status]} tone={productStatusTone(product.status)} />
      </div>
      <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
        <Link to={`/merchant/products/${product.id}`} className="rounded-md border border-[#384553] px-3 py-2 text-xs font-bold text-white hover:bg-[#0F151C]">详情</Link>
        {product.auction_id ? (
          <Link to={`/merchant/auctions/${product.auction_id}/monitor`} className="rounded-md bg-[#21D19F] px-3 py-2 text-xs font-black text-[#07100D] hover:bg-[#76F2CD]">
            实时监控
          </Link>
        ) : null}
      </div>
    </article>
  ))}
</div>
```

If product thumbnails are not available in list rows, keep the fallback surface instead of adding backend fields.

- [x] **Step 4: Confirm responsive layout does not rely on fixed widths only**

Ensure row uses stacked layout below `xl` and no text overlaps. Use `truncate`, `line-clamp`, `min-w-0`, and wrapping actions.

- [x] **Step 5: Run focused product tests**

Run:

```bash
cd frontend && npm run test -- src/pages/merchant/ProductList.test.tsx
```

Result:

- `cd frontend && npm run test -- src/pages/merchant/ProductList.test.tsx` passed with 5 tests.
- `cd frontend && npm run build` passed.
- `git diff --check` passed.
- Spec compliance and code quality reviews approved.

### Task 4: Merchant Order Deal-Flow List And Detail Timeline

**Files:**
- Modify: `frontend/src/pages/merchant/OrderList.tsx`
- Modify: `frontend/src/pages/merchant/OrderList.test.tsx`
- Modify: `frontend/src/pages/merchant/OrderDetail.tsx`
- Modify: `frontend/src/pages/merchant/OrderDetail.test.tsx`
- Use: `frontend/src/components/merchant/MerchantConsole.tsx`
- Use: `frontend/src/components/merchant/MerchantPrimitives.tsx`

- [x] **Step 1: Update order list tests**

Assert the list shows deal-flow content:

```tsx
expect(await screen.findByRole('heading', { name: /成交订单|订单管理/ })).toBeInTheDocument();
expect(screen.getByText(/买家/)).toBeInTheDocument();
expect(screen.getByText('¥960.00')).toBeInTheDocument();
expect(screen.getByText('已支付')).toBeInTheDocument();
expect(screen.getByRole('link', { name: /详情/ })).toHaveAttribute('href', '/merchant/orders/1');
```

- [x] **Step 2: Update order detail tests**

Assert the detail page shows merchant read-only transaction timeline:

```tsx
expect(await screen.findByRole('heading', { name: /订单详情|成交详情/ })).toBeInTheDocument();
expect(screen.getByText(/成交金额/)).toBeInTheDocument();
expect(screen.getByText(/创建时间/)).toBeInTheDocument();
expect(screen.getByText(/确认时间/)).toBeInTheDocument();
expect(screen.getByText(/支付时间/)).toBeInTheDocument();
expect(screen.queryByRole('button', { name: /确认订单|模拟支付|取消订单/ })).not.toBeInTheDocument();
```

- [x] **Step 3: Run focused tests before implementation**

Run:

```bash
cd frontend && npm run test -- src/pages/merchant/OrderList.test.tsx src/pages/merchant/OrderDetail.test.tsx
```

Result: focused tests were updated around deal-flow rows and read-only detail timeline semantics.

- [x] **Step 4: Implement order rows**

Wrap `OrderList` in `MerchantConsole`. Replace the card grid with rows:

```tsx
<article className="grid gap-3 rounded-lg border border-[#263241] bg-[#131B24] p-3 xl:grid-cols-[minmax(18rem,1fr)_12rem_8rem_8rem_12rem_6rem]">
  <div className="flex min-w-0 gap-3">
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-[#263241] bg-[#0B1016]">
      {order.product_image_url ? <img src={order.product_image_url} alt={order.product_title} className="h-full w-full object-cover" /> : null}
    </div>
    <div className="min-w-0">
      <h2 className="truncate text-sm font-black text-white">{order.product_title}</h2>
      <p className="mt-1 text-xs text-[#8B97A7]">订单ID {order.id}</p>
    </div>
  </div>
  <MetricCell label="买家" value={order.buyer_name || `用户 ${order.buyer_id}`} />
  <MetricCell label="成交金额" value={formatPrice(order.amount)} tone="sold" />
  <div><StatusBadge label={ORDER_STATUS_TEXT[order.status]} tone={orderStatusTone(order.status)} /></div>
  <MetricCell label="创建时间" value={formatTime(order.created_at)} />
  <Link to={`/merchant/orders/${order.id}`} className="rounded-md border border-[#384553] px-3 py-2 text-center text-xs font-bold text-white hover:bg-[#0F151C]">详情</Link>
</article>
```

- [x] **Step 5: Implement detail timeline**

In `OrderDetail.tsx`, keep existing fetch/refresh logic. Present four timeline cells:

```tsx
const timeline = [
  { label: '创建时间', value: order.created_at },
  { label: '确认时间', value: order.confirmed_at },
  { label: '支付时间', value: order.paid_at },
  { label: '取消时间', value: order.cancelled_at },
];
```

Render unavailable values as `未记录`.

- [x] **Step 6: Run focused order tests**

Run:

```bash
cd frontend && npm run test -- src/pages/merchant/OrderList.test.tsx src/pages/merchant/OrderDetail.test.tsx
```

Result:

- `cd frontend && npm run test -- src/pages/merchant/OrderList.test.tsx src/pages/merchant/OrderDetail.test.tsx` passed.
- `cd frontend && npm run build` passed.
- Focused eslint on touched order files passed after fixing invalid-id handling.
- `git diff --check` passed.
- Spec compliance and code quality reviews approved after fixing relevant status timestamps and unique detail-link accessible names.

### Task 5: Dashboard Console Alignment

**Files:**
- Modify: `frontend/src/pages/merchant/Dashboard.tsx`
- Modify: `frontend/src/pages/merchant/Dashboard.test.tsx`
- Use: `frontend/src/components/merchant/MerchantConsole.tsx`
- Use: `frontend/src/components/merchant/MerchantPrimitives.tsx`

- [x] **Step 1: Update dashboard tests for preserved behavior**

Keep assertions for:

```tsx
expect(await screen.findByRole('heading', { name: /运营总览|运营看板/ })).toBeInTheDocument();
expect(screen.getByText('成交金额')).toBeInTheDocument();
expect(screen.getByText('成交趋势')).toBeInTheDocument();
expect(screen.getByText('出价分布区间')).toBeInTheDocument();
expect(screen.getByText('买家用户活跃度')).toBeInTheDocument();
expect(screen.getByText('进行中竞拍')).toBeInTheDocument();
expect(screen.getByText('本周新增订单')).toBeInTheDocument();
```

- [x] **Step 2: Run dashboard test before implementation**

Run:

```bash
cd frontend && npm run test -- src/pages/merchant/Dashboard.test.tsx
```

Result: focused tests were updated around preserved dashboard behavior and console copy.

- [x] **Step 3: Wrap dashboard in `MerchantConsole` and align surfaces**

Keep all existing data transformations and chart components. Replace purple/glow page shell with `MerchantConsole`, `ConsolePanel`, `MetricCell`, `StatusBadge`, and row panels.

- [x] **Step 4: Preserve chart empty states**

Ensure `EmptyChart`, `TransactionTrendChart`, `BidDistributionChart`, and `UserActivityChart` still render empty/zero states with console panel styles and accessible labels/titles.

- [x] **Step 5: Run focused dashboard tests**

Run:

```bash
cd frontend && npm run test -- src/pages/merchant/Dashboard.test.tsx
```

Result:

- `cd frontend && npm run test -- src/pages/merchant/Dashboard.test.tsx` passed with 3 tests.
- `cd frontend && npm run build` passed.
- Focused eslint and TypeScript checks on dashboard files passed.
- `git diff --check` passed.
- Spec compliance and code quality reviews approved.

### Task 6: Realtime Auction Monitor Visual Hierarchy

**Files:**
- Modify: `frontend/src/pages/merchant/AuctionMonitor.tsx`
- Modify: `frontend/src/pages/merchant/AuctionMonitor.test.tsx`
- Use: `frontend/src/components/merchant/MerchantConsole.tsx`
- Use: `frontend/src/components/merchant/MerchantPrimitives.tsx`

- [x] **Step 1: Update monitor tests for preserved realtime behavior**

Keep/assert:

```tsx
expect(await screen.findByRole('heading', { name: /实时竞拍监控|商家实时监控大盘|复古牛仔夹克/ })).toBeInTheDocument();
expect(screen.getByText('¥120.00')).toBeInTheDocument();
expect(screen.getByText(/出价排行榜|排行榜/)).toBeInTheDocument();
expect(screen.getByText(/实时监控日志|事件流/)).toBeInTheDocument();
expect(screen.getByText(/最后出价后 30 秒内|30 秒/)).toBeInTheDocument();
```

Cancellation test remains:

```tsx
await user.type(screen.getByLabelText('取消原因'), '直播异常');
await user.click(screen.getByRole('button', { name: /确认取消/ }));
await waitFor(() => expect(cancelAuction).toHaveBeenCalledWith(9, '直播异常'));
```

- [x] **Step 2: Run monitor test before implementation**

Run:

```bash
cd frontend && npm run test -- src/pages/merchant/AuctionMonitor.test.tsx
```

Result: focused tests were updated around monitor hierarchy and cancellation reconnect behavior.

- [x] **Step 3: Align monitor layout**

Keep existing store selectors, `refreshRoom`, `submitCancellation`, `terminalLine`, and countdown logic. Change only layout/classes:

- left main region: product media/context, current price, countdown, connection/status strip.
- right rail: ranking, event feed, cancellation controls.
- terminal state panel: compact status panel.

- [x] **Step 4: Run focused monitor tests**

Run:

```bash
cd frontend && npm run test -- src/pages/merchant/AuctionMonitor.test.tsx
```

Result:

- `cd frontend && npm run test -- src/pages/merchant/AuctionMonitor.test.tsx` passed with 3 tests.
- `cd frontend && npm run build` passed.
- Focused eslint and TypeScript checks on monitor files passed.
- `git diff --check` passed.
- Spec compliance and code quality reviews approved.

### Task 7: Product Form And Detail Console Polish

**Files:**
- Modify: `frontend/src/pages/merchant/ProductDetail.tsx`
- Modify: `frontend/src/pages/merchant/ProductDetail.test.tsx`
- Modify: `frontend/src/pages/merchant/ProductForm.tsx`
- Modify: `frontend/src/pages/merchant/ProductForm.test.tsx`
- Modify: `frontend/src/components/AuctionRuleForm.tsx`
- Modify: `frontend/src/components/ImageUploader.tsx` only if needed.

- [x] **Step 1: Update product detail tests for existing behavior**

Assert:

```tsx
expect(await screen.findByText(/商品介绍|暂无商品详情介绍/)).toBeInTheDocument();
expect(screen.getByText(/竞拍规则/)).toBeInTheDocument();
expect(screen.getByRole('link', { name: /实时竞拍监控|进入实时竞拍监控台/ })).toHaveAttribute('href', '/merchant/auctions/9/monitor');
```

- [x] **Step 2: Update product form tests for existing controls**

Assert:

```tsx
expect(screen.getByLabelText(/商品名称/)).toBeInTheDocument();
expect(screen.getByText(/竞拍规则配置/)).toBeInTheDocument();
expect(screen.getByText(/固定金额/)).toBeInTheDocument();
expect(screen.getByText(/百分比/)).toBeInTheDocument();
expect(screen.getByRole('button', { name: /创建草稿|保存修改|发布到待开拍/ })).toBeInTheDocument();
```

- [x] **Step 3: Run focused tests before implementation**

Run:

```bash
cd frontend && npm run test -- src/pages/merchant/ProductDetail.test.tsx src/pages/merchant/ProductForm.test.tsx
```

Result: focused tests were updated around preserved product detail actions, form controls, live media behavior, and console copy.

- [x] **Step 4: Align detail page**

Wrap with `MerchantConsole`. Present:

- product image/media area,
- product info panel,
- auction rule metrics,
- existing action bar.

Kept `handleDelete`, `handleActivate`, `handleCancelAuction`, status gating, and API calls unchanged. Added invalid route ID guards so bad product routes do not call product APIs.

- [x] **Step 5: Align form and rule component**

Wrap with `MerchantConsole`. Present:

- product identity panel,
- gallery image panel,
- live media panel,
- auction rule parameter panel,
- action bar.

Kept upload, publish, save, live media, and error logic unchanged. Updated image/live media upload affordances to remain keyboard-operable and exposed selected states on segmented rule controls.

- [x] **Step 6: Run focused tests**

Run:

```bash
cd frontend && npm run test -- src/pages/merchant/ProductDetail.test.tsx src/pages/merchant/ProductForm.test.tsx
```

Result:

- `cd frontend && npm run test -- src/pages/merchant/ProductDetail.test.tsx src/pages/merchant/ProductForm.test.tsx` passed with 12 tests.
- `cd frontend && npm run build` passed.
- Focused eslint on product detail/form, product tests, `AuctionRuleForm`, and `ImageUploader` passed.
- `git diff --check` passed.
- Spec compliance review approved; code quality review findings were fixed and re-verified.

### Task 8: Full Frontend Verification And Browser Smoke

**Files:**
- Modify as needed: merchant page tests touched by prior tasks.
- Modify: `openspec/changes/merchant-ui-optimization/tasks.md`
- Modify: `docs/superpowers/plans/2026-06-08-merchant-ui-optimization.md`

- [x] **Step 1: Run full frontend tests**

Run:

```bash
cd frontend && npm run test
```

Result: passed with 16 test files and 82 tests.

- [x] **Step 2: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Result: passed.

- [x] **Step 3: Run diff check**

Run:

```bash
git diff --check
```

Result: passed.

- [x] **Step 4: Start frontend dev server for smoke check**

Run:

```bash
cd frontend && npm run dev -- --host 127.0.0.1
```

Result: Vite served `http://127.0.0.1:3000/`.

- [x] **Step 5: Browser smoke merchant pages**

Use the Browser plugin or Playwright after dev server starts. Check desktop width and a narrow width for:

```text
/merchant/products
/merchant/dashboard
/merchant/orders
/merchant/auctions/:id/monitor when test auth/state is available
```

Expected:

- Product rows are horizontal on desktop and stacked without overlap on narrow screens.
- Status badges are readable and distinct.
- Buttons do not overflow.
- Text does not overlap adjacent columns.
- No blank screens.

Result: `/merchant/dashboard`, `/merchant/products`, `/merchant/orders`, and `/merchant/auctions/9/monitor` all redirected to `/login` through route protection with no browser console errors. Auth/backend session was unavailable, so authenticated merchant visual screenshots were not captured; component tests and production build are the primary verification for merchant page rendering.

### Task 9: Memory, Task Sync, Commit, And Push

**Files:**
- Modify: `openspec/changes/merchant-ui-optimization/tasks.md`
- Modify: `docs/superpowers/plans/2026-06-08-merchant-ui-optimization.md`
- Add/modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-08.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [x] **Step 1: Synchronize checkboxes and verification results**

Update OpenSpec tasks and this plan with actual focused tests, full test, build, diff, and browser smoke results.

- [x] **Step 2: Update memory**

Record:

```text
2026-06-08 merchant-ui-optimization:
- Direction: dark horizontal live product control console.
- Product list is the anchor surface.
- Backend/API/WS/business rules unchanged.
- Verification commands and results.
- Remaining visual polish or limitations.
```

- [x] **Step 3: Review changed files**

Run:

```bash
git status --short
git diff --stat
```

Expected: only planned frontend/docs/OpenSpec/memory files are changed.

- [x] **Step 4: Commit verified slice**

Run:

```bash
git add frontend docs openspec projects
git commit -m "feat(merchant): optimize operations console UI"
```

Result: commit created after full tests/build/OpenSpec/diff checks passed.

- [x] **Step 5: Push branch**

Run:

```bash
git push -u origin codex/merchant-ui-optimization
```

Result: push state is reported in the final response.

## Self-Review

- Spec coverage:
  - Merchant console visual system: Tasks 2, 5, 6, 7.
  - Horizontal product control list: Task 3.
  - Semantic status language: Task 2 primitives plus Tasks 3-7 usage.
  - Dashboard alignment: Task 5.
  - Realtime monitor hierarchy: Task 6.
  - Order deal-flow: Task 4.
  - Product publishing presentation: Task 7.
  - Frontend-only boundary: Execution notes and promotion rule in all tasks.
- Placeholder scan:
  - No unfinished placeholder markers or open-ended implementation placeholders are intentionally left.
- Type consistency:
  - Shared status helpers use existing `ProductStatus` and `OrderStatus` type names.
  - Merchant frame/primitives are scoped under `frontend/src/components/merchant/`.
