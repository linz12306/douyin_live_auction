# H5 Live UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Polish the buyer H5 auction experience by fixing mobile overlap, improving button presentation, and adding click/WebSocket-driven feedback without changing backend or realtime truth semantics.

**Architecture:** Keep `useLiveRoomStore` as the realtime source of truth and implement all new feedback as derived React UI state in buyer pages. Layout changes stay local to the existing buyer route components, with tests guarding that REST bid success still does not mutate visible realtime state.

**Tech Stack:** React, TypeScript, Vite, TailwindCSS utilities, Zustand, Vitest, Testing Library, OpenSpec.

---

## File Map

- Modify: `frontend/src/pages/app/LiveAuctionRoom.tsx`
  - Stabilize mobile fixed zones.
  - Improve action rail, bottom controls, floating card, bid sheet, shelf, and result modal controls.
  - Add transient UI feedback derived from clicks and WebSocket/store changes.
- Modify: `frontend/src/pages/app/LiveAuctionRoom.test.tsx`
  - Add tests for price feedback, polished action labels, mobile-safe overlay affordances, and preserved REST/WS truth.
- Modify: `frontend/src/pages/app/AuctionLobby.tsx`
  - Apply scoped CTA/button visual consistency only.
- Modify: `frontend/src/pages/app/AuctionLobby.test.tsx`
  - Keep existing discovery behavior and assert CTA names remain stable.
- Modify: `frontend/src/pages/app/OrderList.tsx`
  - Polish buyer order card action copy and tap target.
- Modify: `frontend/src/pages/app/OrderList.test.tsx`
  - Update action copy assertion and keep list/refresh behavior.
- Modify: `frontend/src/pages/app/OrderDetail.tsx`
  - Polish confirm/pay/cancel/refresh controls and submitting copy.
- Modify: `frontend/src/pages/app/OrderDetail.test.tsx`
  - Assert actions still call existing APIs and prevent duplicate submit where practical.
- Modify: `openspec/changes/h5-live-ui-polish/tasks.md`
  - Keep task checkboxes synchronized with completed implementation.
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-08.md`
  - Record delivered scope and verification after implementation.
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`
  - Add durable note only if the implementation changes a reusable UI convention.

## Implementation Rules

- Do not change backend files unless a true blocker is discovered.
- Do not change REST or WebSocket contracts.
- Do not update visible current price, ranking, countdown, extension count, leading/outbid state, or terminal state from REST bid success alone.
- Use CSS/Tailwind classes and local component helpers before adding dependencies.
- Preserve accessible names used by tests and E2E where possible.

### Task 1: Live Room Regression Tests For Truth And Feedback

**Files:**
- Modify: `frontend/src/pages/app/LiveAuctionRoom.test.tsx`

- [x] **Step 1: Add a test for WebSocket-driven price feedback**

Add a focused assertion after the existing `price_update` test or as a new test:

```tsx
it('marks the visible price as updated only after websocket price_update', async () => {
  seedRoom({ notifications: [] });
  renderRoom();

  expect(screen.queryByText('价格已更新')).not.toBeInTheDocument();

  act(() => {
    useLiveRoomStore.getState().applyMessage({
      type: 'price_update',
      auction_id: 7,
      version: 5,
      server_time: '2026-05-28T10:00:01.000Z',
      payload: {
        current_price: 140,
        highest_bidder_id: 4,
        rankings: [
          {
            rank: 1,
            user_id: 4,
            display_name: '阿辰',
            avatar_url: '',
            amount: 140,
            status: 'winning',
            bid_time: '2026-05-28T10:00:01.000Z',
          },
        ],
      },
    });
  });

  expect(screen.getAllByText('¥140.00').length).toBeGreaterThan(0);
  expect(screen.getByText('价格已更新')).toBeInTheDocument();
});
```

- [x] **Step 2: Add a test that REST bid success does not show price feedback**

Use the existing REST bid test and add the explicit feedback assertion:

```tsx
expect(screen.queryByText('价格已更新')).not.toBeInTheDocument();
```

Keep the existing assertion:

```tsx
expect(useLiveRoomStore.getState().currentPrice).toBe(120);
expect(screen.getAllByText('¥120.00').length).toBeGreaterThan(0);
```

- [x] **Step 3: Add a test for polished control labels**

Add a test that asserts the key controls remain discoverable by accessible label/text:

```tsx
it('keeps polished live room controls discoverable', () => {
  renderRoom();

  expect(screen.getByRole('button', { name: '打开出价面板' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '打开商品橱窗' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '查看我的订单' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '点赞' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '分享' })).toBeInTheDocument();
});
```

- [x] **Step 4: Run the focused test and confirm expected failures**

Run:

```bash
cd frontend && npm run test -- LiveAuctionRoom
```

Expected before implementation: at least the new `价格已更新` assertion fails because no feedback marker exists yet.

### Task 2: Stabilize Live Room Mobile Layout

**Files:**
- Modify: `frontend/src/pages/app/LiveAuctionRoom.tsx`
- Modify: `frontend/src/pages/app/LiveAuctionRoom.test.tsx`

- [x] **Step 1: Add explicit live room zone constants**

Near existing constants in `LiveAuctionRoom.tsx`, add stable class group strings:

```tsx
const LIVE_ROOM_STAGE_CLASS = 'relative mx-auto h-[100svh] min-h-[640px] w-full max-w-[430px] overflow-hidden bg-black shadow-2xl shadow-black/50 lg:h-[860px] lg:min-h-0 lg:rounded-[8px] lg:border lg:border-white/10';
const LIVE_ROOM_TOP_CLASS = 'absolute left-0 right-0 top-0 z-30 px-3 pt-10 sm:pt-3';
const LIVE_ROOM_MESSAGE_CLASS = 'absolute bottom-[7.25rem] left-3 z-20 w-[52%] max-w-[224px]';
const LIVE_ROOM_FLOATING_CARD_CLASS = 'absolute bottom-[7.15rem] right-3 z-30 w-[45%] min-w-[172px] max-w-[196px]';
const LIVE_ROOM_BOTTOM_CLASS = 'absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black via-black/82 to-transparent px-3 pb-3 pt-9';
```

- [x] **Step 2: Apply the zone constants**

Replace the corresponding hard-coded `className` values on:

- the `<main>` live room stage,
- `<header>`,
- comments/system-message `<section>`,
- floating auction card `<section>`,
- bottom `<footer>`.

- [x] **Step 3: Reduce comment layer collision risk**

Change rendered message count from four to three in `roomMessages`:

```tsx
const realtimeMessages = roomNotifications.slice(0, 3).map((item) => ({
  id: item.id,
  type: item.type,
  message: item.message,
}));
```

Update default fallback messages to at most three items.

- [x] **Step 4: Make floating card more compact**

In the floating card:

- reduce large price text from `text-[30px]` to `text-[26px]`;
- reduce countdown text from `text-[30px]` to `text-[26px]`;
- keep `tabular-nums`;
- keep the primary bid button at `h-13` or `h-14` so it remains tappable.

Example:

```tsx
<div className="mt-1 whitespace-nowrap text-[26px] font-black leading-none tabular-nums">{formatPrice(roomCurrentPrice)}</div>
```

- [x] **Step 5: Keep overlays scrollable and reachable**

For shelf and bid sheet sections, ensure:

```tsx
className="absolute bottom-0 left-0 right-0 max-h-[76vh] overflow-y-auto rounded-t-xl ..."
```

For result modal content, use:

```tsx
className="relative max-h-[82vh] w-full overflow-y-auto rounded-xl ..."
```

- [x] **Step 6: Run focused tests**

Run:

```bash
cd frontend && npm run test -- LiveAuctionRoom
```

Expected: existing behavior still passes except tests intentionally waiting for later feedback implementation.

### Task 3: Polish Live Room Buttons

**Files:**
- Modify: `frontend/src/pages/app/LiveAuctionRoom.tsx`
- Modify: `frontend/src/pages/app/LiveAuctionRoom.test.tsx`

- [x] **Step 1: Add shared button feedback classes**

Near the zone constants, add:

```tsx
const PRESSABLE_CLASS = 'transition duration-150 active:scale-95 active:brightness-110 disabled:active:scale-100';
const TILE_BUTTON_CLASS = `rounded-[8px] border border-white/12 bg-white/14 shadow-lg shadow-black/20 backdrop-blur ${PRESSABLE_CLASS}`;
const PRIMARY_ACTION_CLASS = `shadow-lg transition duration-150 active:scale-[0.98] disabled:active:scale-100`;
```

- [x] **Step 2: Upgrade action rail buttons**

In `ActionRailButton`, replace rough text circle styling with a polished elevated surface:

```tsx
className="group flex w-11 flex-col items-center gap-1 text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)] transition duration-150 active:scale-95"
```

Use a stronger inner surface:

```tsx
className="flex h-11 w-11 items-center justify-center rounded-full border border-white/18 bg-white/16 text-xs font-black shadow-lg shadow-black/30 backdrop-blur-xl transition group-hover:bg-white/22"
```

- [x] **Step 3: Replace rough action text where possible**

Keep accessible labels stable, but improve visible labels:

- `榜` -> `榜单`
- `心` -> `赞`
- `礼` -> `礼物`
- `↗` -> `分享`

Make sure text fits by using `text-[11px]`.

- [x] **Step 4: Polish bottom controls**

For `商品`, `竞拍`, and `订单`, use consistent tile classes:

```tsx
className={`${TILE_BUTTON_CLASS} relative flex h-12 w-12 flex-col items-center justify-center text-[11px] font-black text-white`}
```

For the bid tile, use a stronger amber/rose filled treatment:

```tsx
className={`${PRIMARY_ACTION_CLASS} flex h-12 w-12 flex-col items-center justify-center rounded-[8px] bg-gradient-to-br from-amber-200 to-rose-400 text-[11px] font-black text-zinc-950 shadow-lg shadow-black/20 disabled:cursor-not-allowed disabled:from-white/18 disabled:to-white/18 disabled:text-white/45`}
```

- [x] **Step 5: Polish bid sheet steppers and CTAs**

Stepper buttons should use stable square buttons:

```tsx
className={`${PRESSABLE_CLASS} h-12 rounded-lg border border-zinc-200 bg-white text-2xl font-black text-zinc-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-35`}
```

Primary bid CTA should keep a filled gradient and submitting disabled state:

```tsx
className={`${PRIMARY_ACTION_CLASS} mt-4 h-14 w-full rounded-full bg-gradient-to-r from-rose-500 to-red-500 px-4 text-lg font-black text-white shadow-lg shadow-rose-500/25 hover:from-rose-400 hover:to-red-400 disabled:cursor-not-allowed disabled:from-zinc-200 disabled:to-zinc-200 disabled:text-zinc-500 disabled:shadow-none`}
```

- [x] **Step 6: Run focused tests**

Run:

```bash
cd frontend && npm run test -- LiveAuctionRoom
```

Expected: polished control label test passes.

### Task 4: Add WebSocket-Driven Price And State Feedback

**Files:**
- Modify: `frontend/src/pages/app/LiveAuctionRoom.tsx`
- Modify: `frontend/src/pages/app/LiveAuctionRoom.test.tsx`

- [x] **Step 1: Import `useRef`**

Change the React import:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
```

- [x] **Step 2: Add transient feedback state**

Inside `LiveAuctionRoom`, after existing local state declarations:

```tsx
const previousPriceRef = useRef(roomCurrentPrice);
const [pricePulse, setPricePulse] = useState(false);
const [pressedAction, setPressedAction] = useState('');
```

- [x] **Step 3: Trigger price pulse only from store price changes**

After derived values are declared, add:

```tsx
useEffect(() => {
  if (!isCurrentRoom) {
    previousPriceRef.current = roomCurrentPrice;
    setPricePulse(false);
    return;
  }

  if (previousPriceRef.current !== roomCurrentPrice) {
    previousPriceRef.current = roomCurrentPrice;
    setPricePulse(true);
    const timer = window.setTimeout(() => setPricePulse(false), 900);
    return () => window.clearTimeout(timer);
  }
}, [isCurrentRoom, roomCurrentPrice]);
```

- [x] **Step 4: Add accessible price feedback text**

Near the floating card price display, add:

```tsx
{pricePulse ? (
  <div aria-live="polite" className="mt-1 text-[11px] font-black text-amber-100">
    价格已更新
  </div>
) : null}
```

Add pulse classes to the price container:

```tsx
className={`mt-1 whitespace-nowrap text-[26px] font-black leading-none tabular-nums transition duration-300 ${pricePulse ? 'scale-[1.03] text-amber-100' : ''}`}
```

- [x] **Step 5: Add leading celebration text**

When `isLeading` is true, add a small non-blocking badge above or inside the floating card:

```tsx
{isLeading ? (
  <div className="mx-3 mb-2 rounded-full bg-amber-100 px-2 py-1 text-center text-[11px] font-black text-amber-800">
    领先中，保持住
  </div>
) : null}
```

- [x] **Step 6: Strengthen outbid feedback**

When `isOutbid` is true, add a compact warning inside the floating card before the CTA:

```tsx
{isOutbid ? (
  <div className="mx-3 mb-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-black text-rose-600">
    已被超过，点出价追回
  </div>
) : null}
```

- [x] **Step 7: Add button press marker without changing truth**

Create helper:

```tsx
function markPressed(action: string) {
  setPressedAction(action);
  window.setTimeout(() => setPressedAction(''), 220);
}
```

Call it in click handlers before opening overlays:

```tsx
onClick={() => {
  markPressed('shelf');
  setBidSheetOpen(false);
  setShelfOpen(true);
}}
```

Only use `pressedAction` for class feedback, never auction values.

- [x] **Step 8: Run focused tests**

Run:

```bash
cd frontend && npm run test -- LiveAuctionRoom
```

Expected: all `LiveAuctionRoom` tests pass.

### Task 5: Polish Buyer Discovery CTAs

**Files:**
- Modify: `frontend/src/pages/app/AuctionLobby.tsx`
- Modify: `frontend/src/pages/app/AuctionLobby.test.tsx`

- [x] **Step 1: Add local button class constants**

Near constants:

```tsx
const PRESSABLE = 'transition duration-150 active:scale-[0.98] disabled:active:scale-100';
const GHOST_BUTTON = `${PRESSABLE} rounded-full border border-white/12 bg-white/10 px-3 py-2 text-sm font-semibold text-white/78 shadow-lg shadow-black/10 hover:border-white/30 hover:bg-white/14 hover:text-white disabled:cursor-not-allowed disabled:opacity-50`;
const PRIMARY_LINK = `${PRESSABLE} block rounded-full bg-gradient-to-r from-rose-400 to-red-500 px-4 py-3 text-center text-sm font-black text-white shadow-lg shadow-rose-950/25 hover:from-rose-300 hover:to-red-400`;
```

- [x] **Step 2: Apply button classes**

Use `GHOST_BUTTON` for refresh/orders/profile nav controls, preserving route labels.

Use `PRIMARY_LINK` for hero `进入直播`.

For feed card `进入直播`, use:

```tsx
className={`${PRESSABLE} shrink-0 rounded-full bg-white/12 px-3 py-1.5 text-xs font-black text-rose-100 shadow-sm shadow-black/10 ring-1 ring-rose-300/50 hover:bg-rose-400 hover:text-zinc-950`}
```

- [x] **Step 3: Run focused tests**

Run:

```bash
cd frontend && npm run test -- AuctionLobby
```

Expected: existing lobby tests pass with unchanged accessible labels.

### Task 6: Polish Buyer Order List

**Files:**
- Modify: `frontend/src/pages/app/OrderList.tsx`
- Modify: `frontend/src/pages/app/OrderList.test.tsx`

- [x] **Step 1: Fix rough action copy**

Change detail link text from:

```tsx
详情大区 ›
```

to:

```tsx
查看详情
```

- [x] **Step 2: Improve order list action button styling**

Use a stable filled button:

```tsx
className="rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2 text-xs font-black text-white shadow-md shadow-rose-500/15 transition duration-150 hover:from-rose-400 hover:to-red-400 active:scale-[0.98]"
```

- [x] **Step 3: Update test assertion**

Change:

```tsx
expect(screen.getByRole('link', { name: '详情大区 ›' })).toHaveAttribute('href', '/app/orders/9');
```

to:

```tsx
expect(screen.getByRole('link', { name: '查看详情' })).toHaveAttribute('href', '/app/orders/9');
```

- [x] **Step 4: Run focused tests**

Run:

```bash
cd frontend && npm run test -- OrderList
```

Expected: order list tests pass.

### Task 7: Polish Buyer Order Detail Actions

**Files:**
- Modify: `frontend/src/pages/app/OrderDetail.tsx`
- Modify: `frontend/src/pages/app/OrderDetail.test.tsx`

- [x] **Step 1: Add action button class helpers**

Near helper functions:

```tsx
const ACTION_ROW_CLASS = 'flex flex-col gap-3 sm:flex-row sm:flex-wrap';
const PRIMARY_ORDER_ACTION = 'min-h-12 rounded-xl px-6 py-3 text-sm font-black shadow-lg transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';
const SECONDARY_ORDER_ACTION = 'min-h-12 rounded-xl border border-white/10 bg-white/8 px-6 py-3 text-sm font-bold text-slate-200 transition duration-150 hover:bg-white/12 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100';
```

- [x] **Step 2: Add submitting copy to mutation buttons**

For confirm button:

```tsx
{submitting ? '处理中...' : '确认中标订单'}
```

For pay button:

```tsx
{submitting ? '处理中...' : '立即模拟支付'}
```

For cancel button:

```tsx
{submitting ? '处理中...' : '申请取消订单'}
```

- [x] **Step 3: Make actions mobile-first full-width**

Update action row:

```tsx
<div className={ACTION_ROW_CLASS}>
```

Use `w-full sm:w-auto` in each action button class so actions stack on mobile and wrap on desktop.

- [x] **Step 4: Add duplicate-submit test for confirm**

Extend the pending confirm test:

```tsx
mockedConfirmOrder.mockImplementation(async () => {
  await new Promise((resolve) => setTimeout(resolve, 20));
  return order('pending_payment');
});

fireEvent.click(screen.getByRole('button', { name: '确认中标订单' }));
fireEvent.click(screen.getByRole('button', { name: '处理中...' }));

await waitFor(() => expect(mockedConfirmOrder).toHaveBeenCalledTimes(1));
```

If fake timers make this awkward, assert the button becomes disabled immediately after first click:

```tsx
expect(screen.getByRole('button', { name: '处理中...' })).toBeDisabled();
```

- [x] **Step 5: Run focused tests**

Run:

```bash
cd frontend && npm run test -- OrderDetail
```

Expected: order detail tests pass.

### Task 8: Full Verification And Visual Smoke

**Files:**
- Modify: `openspec/changes/h5-live-ui-polish/tasks.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-08.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md` if needed.

- [x] **Step 1: Run focused buyer page tests**

Run:

```bash
cd frontend && npm run test -- LiveAuctionRoom AuctionLobby OrderList OrderDetail
```

Expected: all focused buyer page tests pass.

- [x] **Step 2: Run full frontend test suite**

Run:

```bash
cd frontend && npm run test
```

Expected: all frontend tests pass.

- [x] **Step 3: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: TypeScript and Vite build pass.

- [x] **Step 4: Run OpenSpec validation**

Run:

```bash
npx -y @fission-ai/openspec@latest validate h5-live-ui-polish --strict --no-interactive
```

Expected: `Change 'h5-live-ui-polish' is valid`.

- [x] **Step 5: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

- [x] **Step 6: Run browser/mobile smoke if a dev server is available**

Start frontend dev server if needed:

```bash
cd frontend && npm run dev -- --host 127.0.0.1
```

Use Browser/Playwright smoke for:

- `/app/auctions/:id` at 390x844 default active state,
- bid sheet open,
- shelf open,
- terminal result modal if a mocked state path is available,
- `/app/orders`,
- `/app/orders/:id`,
- desktop fallback.

Expected: no obvious overlap among critical controls and buttons remain tappable.

Actual verification:

- `cd frontend && npm run test -- LiveAuctionRoom AuctionLobby OrderList OrderDetail` passed with 6 files / 30 tests.
- `cd frontend && npm run test` passed with 16 files / 80 tests.
- `cd frontend && npm run build` passed.
- `npx -y @fission-ai/openspec@latest validate h5-live-ui-polish --strict --no-interactive` passed.
- `git diff --check` passed.
- 390x844 Playwright smoke passed for live room default controls, bid sheet, shelf, order list, and order detail key actions.
- Backend files were not touched; `go test ./...` was not required.

- [x] **Step 7: Update OpenSpec task checkboxes**

In `openspec/changes/h5-live-ui-polish/tasks.md`, mark completed implementation and verification tasks with `[x]`, and record verification results under Task 8.

- [x] **Step 8: Update memory**

Create or update `projects/proj-1779447357476-ryiijf/memory/2026-06-08.md` with:

```markdown
# 2026-06-08

## h5-live-ui-polish

- Delivered buyer H5 live UI polish focused on mobile overlap, button display quality, and click/WebSocket-driven feedback.
- Preserved REST/WS truth rules: REST bid success does not update visible realtime price/ranking/countdown/terminal state.
- Verification:
  - `cd frontend && npm run test`
  - `cd frontend && npm run build`
  - `npx -y @fission-ai/openspec@latest validate h5-live-ui-polish --strict --no-interactive`
  - `git diff --check`
- Backend unchanged; `go test ./...` not required.
- Next: archive only after user accepts the delivered UI polish.
```

- [ ] **Step 9: Commit and push**

After confirming only related files are staged:

```bash
git status --short
git add docs/superpowers/specs/2026-06-08-h5-live-ui-polish-exploration.md \
  docs/superpowers/plans/2026-06-08-h5-live-ui-polish.md \
  openspec/changes/h5-live-ui-polish \
  frontend/src/pages/app/LiveAuctionRoom.tsx \
  frontend/src/pages/app/LiveAuctionRoom.test.tsx \
  frontend/src/pages/app/AuctionLobby.tsx \
  frontend/src/pages/app/AuctionLobby.test.tsx \
  frontend/src/pages/app/OrderList.tsx \
  frontend/src/pages/app/OrderList.test.tsx \
  frontend/src/pages/app/OrderDetail.tsx \
  frontend/src/pages/app/OrderDetail.test.tsx \
  projects/proj-1779447357476-ryiijf/memory/2026-06-08.md \
  projects/proj-1779447357476-ryiijf/memory/long-term.md
git commit -m "feat(frontend): polish buyer h5 live auction ui"
git push
```

If `long-term.md` was not changed, omit it from `git add`.
