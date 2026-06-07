# H5 Discovery Live Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Upgrade `/app/auctions` from a conventional auction lobby into a mobile-first H5 `发现竞拍` live-discovery entrance.

**Architecture:** Keep the change local to the buyer auction lobby page. Add local filtering and presentation helpers in `AuctionLobby.tsx`, preserve `listAuctionLobby()` as the only data source, and verify with focused component tests plus build and screenshot smoke.

**Tech Stack:** React 19, TypeScript, React Router, Tailwind CSS, Vitest, Testing Library, Vite.

---

## File Structure

- Modify: `frontend/src/pages/app/AuctionLobby.tsx`
  - Owns local filter state, derived hero/feed items, discovery visual shell, loading/error/empty/filtered-empty states, and navigation.
- Modify: `frontend/src/pages/app/AuctionLobby.test.tsx`
  - Owns polling/visibility regression tests plus new local search/filter, filtered-empty, and entry-link tests.
- Modify: `openspec/changes/h5-discovery-live-feed/tasks.md`
  - Keep task completion synchronized.
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-03.md`
  - Record implementation and verification results.
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`
  - Record current discovery-page status after verified implementation.

No backend, API, WebSocket, wallet, order, payment, or merchant files should change.

### Task 1: Local Discovery Filters

**Files:**
- Modify: `frontend/src/pages/app/AuctionLobby.test.tsx`
- Modify: `frontend/src/pages/app/AuctionLobby.tsx`

- [x] **Step 1: Add a failing test for local search**

Add this test inside `describe('AuctionLobby', ...)`:

```tsx
it('filters loaded lobby items by local search text', async () => {
  mocks.listAuctionLobby.mockResolvedValueOnce([
    activeItem,
    { ...activeItem, auction_id: 10, product_id: 13, title: '金镶玉平安扣吊坠' },
  ]);

  renderLobby();

  await act(async () => {
    await Promise.resolve();
  });

  const search = screen.getByLabelText('搜索直播、拍品或商家');
  await act(async () => {
    search.focus();
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
});
```

Then replace the dispatch block with Testing Library `fireEvent` after adding the import:

```tsx
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

fireEvent.change(search, { target: { value: '平安扣' } });
```

Expected assertions:

```tsx
expect(screen.getByText('金镶玉平安扣吊坠')).toBeInTheDocument();
expect(screen.queryByText('刚开拍的复古夹克')).not.toBeInTheDocument();
expect(screen.getByText('本地筛选 · 1 个结果')).toBeInTheDocument();
```

- [x] **Step 2: Run the focused test and confirm failure**

Run:

```bash
cd frontend && npm run test -- AuctionLobby
```

Expected: the new test fails because the search input and local filtering do not exist yet.

- [x] **Step 3: Add local filter state and helpers**

In `AuctionLobby.tsx`, add React change-event import:

```tsx
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
```

Add local state inside `AuctionLobby`:

```tsx
const [searchQuery, setSearchQuery] = useState('');
const [activeFilter, setActiveFilter] = useState<'recommended' | 'active' | 'ending' | 'pending'>('recommended');
```

Add handlers inside `AuctionLobby`:

```tsx
const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
  setSearchQuery(event.target.value);
};

const handleFilterChange = (nextFilter: 'recommended' | 'active' | 'ending' | 'pending') => {
  setActiveFilter(nextFilter);
};
```

Add derived filtering before `return`:

```tsx
const normalizedSearch = searchQuery.trim().toLowerCase();
const filteredItems = useMemo(() => {
  const now = Date.now();

  return items.filter((item) => {
    const matchesSearch = normalizedSearch.length === 0 || item.title.toLowerCase().includes(normalizedSearch);
    if (!matchesSearch) return false;

    if (activeFilter === 'active') return item.status === 'active';
    if (activeFilter === 'pending') return item.status === 'pending';
    if (activeFilter === 'ending') {
      if (!item.ended_at) return false;
      const remainingMs = new Date(item.ended_at).getTime() - now;
      return item.status === 'active' && remainingMs > 0 && remainingMs <= 10 * 60 * 1000;
    }

    return true;
  });
}, [activeFilter, items, normalizedSearch]);
```

- [x] **Step 4: Run the focused test**

Run:

```bash
cd frontend && npm run test -- AuctionLobby
```

Expected: the new local search test still fails until the input and rendered list use `filteredItems`.

### Task 2: Discovery Visual Shell

**Files:**
- Modify: `frontend/src/pages/app/AuctionLobby.tsx`
- Modify: `frontend/src/pages/app/AuctionLobby.test.tsx`

- [x] **Step 1: Add tests for discovery shell and navigation**

Add:

```tsx
it('renders discovery navigation and routes auction cards to live rooms', async () => {
  mocks.listAuctionLobby.mockResolvedValueOnce([activeItem]);

  renderLobby();

  await act(async () => {
    await Promise.resolve();
  });

  expect(screen.getByRole('heading', { name: '发现竞拍' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '订单' })).toHaveAttribute('href', '/app/orders');
  expect(screen.getByRole('link', { name: '我的' })).toHaveAttribute('href', '/profile');
  expect(screen.getByRole('link', { name: '进入直播' })).toHaveAttribute('href', '/app/auctions/9');
});
```

Add:

```tsx
it('shows a filtered-empty state without implying backend search failed', async () => {
  mocks.listAuctionLobby.mockResolvedValueOnce([activeItem]);

  renderLobby();

  await act(async () => {
    await Promise.resolve();
  });

  fireEvent.change(screen.getByLabelText('搜索直播、拍品或商家'), { target: { value: '不存在的拍品' } });

  expect(screen.getByText('当前列表没有匹配内容')).toBeInTheDocument();
  expect(screen.getByText('这是本地筛选结果，可以换个关键词或回到推荐。')).toBeInTheDocument();
});
```

- [x] **Step 2: Run tests and confirm failure**

Run:

```bash
cd frontend && npm run test -- AuctionLobby
```

Expected: tests fail because the discovery heading, search input, local empty state, and route names are not implemented.

- [x] **Step 3: Replace the page shell**

In `AuctionLobby.tsx`, replace the old header and grid with a discovery shell that keeps existing state branches. Use `filteredItems` for content rendering.

Required elements:

```tsx
<h1 className="text-2xl font-black text-white">发现竞拍</h1>

<input
  aria-label="搜索直播、拍品或商家"
  value={searchQuery}
  onChange={handleSearchChange}
  placeholder="搜索直播 / 拍品 / 商家"
/>

<Link to="/app/orders">订单</Link>
<Link to="/profile">我的</Link>
```

Use the first filtered item as hero and the rest as secondary cards:

```tsx
const [heroItem, ...feedItems] = filteredItems;
```

Hero CTA:

```tsx
<Link to={`/app/auctions/${heroItem.auction_id}`}>进入直播</Link>
```

Filtered-empty copy:

```tsx
<p className="font-semibold text-white">当前列表没有匹配内容</p>
<p className="mt-2 text-sm text-white/55">这是本地筛选结果，可以换个关键词或回到推荐。</p>
```

API-empty copy remains:

```tsx
<p className="font-semibold text-white">暂无可参与竞拍</p>
```

- [x] **Step 4: Run focused tests**

Run:

```bash
cd frontend && npm run test -- AuctionLobby
```

Expected: all `AuctionLobby` tests pass.

### Task 3: Channel Chips and Hero Prioritization

**Files:**
- Modify: `frontend/src/pages/app/AuctionLobby.tsx`
- Modify: `frontend/src/pages/app/AuctionLobby.test.tsx`

- [x] **Step 1: Add a channel-chip filtering test**

Add:

```tsx
it('filters currently loaded items with discovery channel chips', async () => {
  mocks.listAuctionLobby.mockResolvedValueOnce([
    activeItem,
    { ...activeItem, auction_id: 10, product_id: 13, title: '即将开拍的银饰', status: 'pending' },
  ]);

  renderLobby();

  await act(async () => {
    await Promise.resolve();
  });

  fireEvent.click(screen.getByRole('button', { name: '待开拍' }));

  expect(screen.getByText('即将开拍的银饰')).toBeInTheDocument();
  expect(screen.queryByText('刚开拍的复古夹克')).not.toBeInTheDocument();
});
```

- [x] **Step 2: Run tests and confirm failure**

Run:

```bash
cd frontend && npm run test -- AuctionLobby
```

Expected: the new test fails until chip buttons call `handleFilterChange` and content uses filtered items.

- [x] **Step 3: Add chip rendering**

In `AuctionLobby.tsx`, define chips near constants:

```tsx
const FILTERS = [
  { key: 'recommended', label: '推荐' },
  { key: 'active', label: '正在竞拍' },
  { key: 'ending', label: '快结束' },
  { key: 'pending', label: '待开拍' },
] as const;
```

Render:

```tsx
{FILTERS.map((filter) => (
  <button
    key={filter.key}
    type="button"
    onClick={() => handleFilterChange(filter.key)}
    className={filter.key === activeFilter ? '...' : '...'}
  >
    {filter.label}
  </button>
))}
```

Sort active items first for hero selection:

```tsx
const prioritizedItems = useMemo(() => {
  return [...filteredItems].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return a.auction_id - b.auction_id;
  });
}, [filteredItems]);

const [heroItem, ...feedItems] = prioritizedItems;
```

- [x] **Step 4: Run focused tests**

Run:

```bash
cd frontend && npm run test -- AuctionLobby
```

Expected: all `AuctionLobby` tests pass.

### Task 4: Visual Polish and State Coverage

**Files:**
- Modify: `frontend/src/pages/app/AuctionLobby.tsx`

- [x] **Step 1: Add visual helpers**

Add helpers near existing `formatEndTime`:

```tsx
const getTimingText = (item: AuctionLobbyItem) => {
  if (!item.ended_at) return '时间待定';
  if (item.status !== 'active') return `结束 ${formatEndTime(item.ended_at)}`;

  const remainingMs = new Date(item.ended_at).getTime() - Date.now();
  if (remainingMs <= 0) return '即将落槌';
  if (remainingMs <= 60 * 1000) return `${Math.max(1, Math.ceil(remainingMs / 1000))} 秒`;
  if (remainingMs <= 10 * 60 * 1000) return `${Math.ceil(remainingMs / 60000)} 分钟`;
  return `结束 ${formatEndTime(item.ended_at)}`;
};

const getHeroSubtitle = (item: AuctionLobbyItem) => {
  if (item.status === 'active') return '正在竞拍';
  if (item.status === 'pending') return '即将开拍';
  return getStatusText(item.status);
};
```

Use these helpers in hero/feed cards.

- [x] **Step 2: Ensure state panels match discovery shell**

Keep these visible strings for regression and review:

```tsx
加载中...
竞拍列表加载失败
暂无可参与竞拍
当前列表没有匹配内容
刷新中...
```

Error panel must include a retry button that calls `loadLobby()`:

```tsx
<button type="button" onClick={() => void loadLobby()}>重新加载</button>
```

- [x] **Step 3: Run focused tests**

Run:

```bash
cd frontend && npm run test -- AuctionLobby
```

Expected: all `AuctionLobby` tests pass.

### Task 5: Full Verification and Screenshot Smoke

**Files:**
- Modify: `openspec/changes/h5-discovery-live-feed/tasks.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-03.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [x] **Step 1: Run focused frontend tests**

Run:

```bash
cd frontend && npm run test -- AuctionLobby
```

Expected: PASS.

- [x] **Step 2: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: PASS.

- [x] **Step 3: Run OpenSpec validation**

Run:

```bash
npx -y @fission-ai/openspec@latest validate h5-discovery-live-feed --strict --no-interactive
```

Expected: `Change 'h5-discovery-live-feed' is valid`.

- [x] **Step 4: Run diff hygiene check**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

- [x] **Step 5: Capture mobile screenshot smoke**

Start the frontend with a mocked or local backend setup. If backend services are not running, use the same Playwright route-mocking approach used for H5 live-room visual checks.

Capture:

```text
/tmp/h5-discovery-live-feed-mobile.png
/tmp/h5-discovery-live-feed-filtered-empty.png
```

Expected visual checks:

- 390x844 first screen shows title, search, chips, hero card, and part of the feed.
- Text and controls do not overlap.
- Card links and top nav remain visible.
- Filtered-empty state distinguishes local filtering from API failure.

- [x] **Step 6: Update task and memory docs**

Record actual verification commands and screenshot paths in:

```text
openspec/changes/h5-discovery-live-feed/tasks.md
projects/proj-1779447357476-ryiijf/memory/2026-06-03.md
projects/proj-1779447357476-ryiijf/memory/long-term.md
```

### Task 6: Commit and Push

**Files:**
- All files touched by Tasks 1-5.

- [ ] **Step 1: Inspect changed files**

Run:

```bash
git status --short
git diff --stat
```

Expected: only planned frontend, OpenSpec task, Superpowers plan, and memory files are changed.

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add frontend/src/pages/app/AuctionLobby.tsx frontend/src/pages/app/AuctionLobby.test.tsx openspec/changes/h5-discovery-live-feed/tasks.md docs/superpowers/plans/2026-06-02-h5-discovery-live-feed.md projects/proj-1779447357476-ryiijf/memory/2026-06-03.md projects/proj-1779447357476-ryiijf/memory/long-term.md
git commit -m "feat(frontend): add h5 discovery live feed"
```

Expected: commit succeeds.

- [ ] **Step 3: Attempt push**

Run:

```bash
git push origin HEAD:codex/frontend-experience-integration
```

Expected in this local environment: push may be blocked by `/Users/vivix/.git-hooks/pre-push`. If blocked, report it and do not bypass the hook.

## Execution Results

- Implementation:
  - `frontend/src/pages/app/AuctionLobby.tsx` now renders the `发现竞拍` H5 discovery shell.
  - `frontend/src/pages/app/AuctionLobby.test.tsx` covers polling, visibility refresh, local search, filtered empty, channel chips, ending-soon filtering, navigation, and accessible CTA names.
- Review:
  - Subagent spec compliance review passed.
  - Subagent code-quality review initially found CTA accessible-name and chip selected-state issues.
  - Fixes were applied and code-quality re-review passed.
- Verification:
  - `cd frontend && npm run test -- AuctionLobby` passed with 7 tests.
  - `cd frontend && npm run build` passed.
  - `npx -y @fission-ai/openspec@latest validate h5-discovery-live-feed --strict --no-interactive` passed.
  - `git diff --check` passed.
  - Mobile screenshots captured:
    - `/tmp/h5-discovery-live-feed-mobile.png`
    - `/tmp/h5-discovery-live-feed-filtered-empty.png`

## Self-Review

- Spec coverage:
  - Discovery shell: Tasks 2 and 4.
  - Existing lobby data only: Tasks 1, 2, and 5.
  - Local search/filter: Tasks 1 and 3.
  - Loading/empty/error/filtered-empty: Tasks 2 and 4.
  - No unsupported semantics: file scope and verification exclude backend/API/WS changes.
- Placeholder scan:
  - No unresolved placeholder markers or vague implementation-only steps.
- Type consistency:
  - `AuctionLobbyItem`, `AuctionStatus`, `listAuctionLobby()`, and route names match existing code.
