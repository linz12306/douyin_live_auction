# Merchant Auction Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a merchant-facing realtime auction monitor at `/merchant/auctions/:id/monitor`.

**Architecture:** Reuse the existing `/ws/auctions/:id` realtime room state and keep REST as the command path for cancellation. Add only minimal backend read-only data for product-list navigation.

**Tech Stack:** Go + Gin + MySQL, React + TypeScript + Vite + Zustand + Vitest, OpenSpec.

---

### Task 1: Baseline Timestamp Stabilization

**Files:**
- Modify: `backend/internal/service/auction_service.go`
- Modify: `backend/internal/repository/auction_engine_repo.go`
- Modify: `backend/tests/integration/auction_engine_test.go`
- Modify: `backend/tests/integration/order_system_test.go`

- [x] **Step 1: Capture failing behavior**

Run:

```powershell
$env:REDIS_ADDR='127.0.0.1:16380'; go test -count=1 ./tests/integration -run TestMerchantCannotCancelActiveAuctionAfterRecentBid -v
```

Expected before fix: FAIL because a recent bid can be treated as expired or an auction can be treated as already ended when DB time and Go time differ.

- [x] **Step 2: Persist service-owned bid time**

Set `model.Bid.CreatedAt` from the `now` already used by `AuctionService.PlaceBid`, and write it in `AuctionEngineRepo.CreateBid`.

```go
bid := &model.Bid{
    AuctionID: auctionID,
    UserID: userID,
    Amount: req.Amount,
    Status: "active",
    CreatedAt: now,
}
```

```go
`INSERT INTO bids (auction_id, user_id, amount, status, created_at) VALUES (?, ?, ?, ?, ?)`
```

- [x] **Step 3: Persist service-owned order time**

Set `CreatedAt` and `UpdatedAt` on orders created by ceiling and time settlement, and write both columns in `CreateOrder`.

```go
order := &model.Order{
    AuctionID: auctionID,
    ProductID: auction.ProductID,
    MerchantID: auction.MerchantID,
    BuyerID: activeBid.UserID,
    Amount: activeBid.Amount,
    CreatedAt: now,
    UpdatedAt: now,
}
```

- [x] **Step 4: Align direct SQL test helpers with Go time**

Use Go `time.Now()` arguments in helpers that set auction and order timestamps directly.

- [x] **Step 5: Verify focused timestamp coverage**

Run:

```powershell
$env:REDIS_ADDR='127.0.0.1:16380'; go test -count=1 ./tests/integration -run "TestMerchantCannotCancelActiveAuctionAfterRecentBid|TestOrderBuyerCanConfirmAndPayWithoutWalletMutation|TestOrderTimeoutCancelsAndRefundsOnce" -v
```

Expected: PASS.

### Task 2: Merchant Product List Auction ID

**Files:**
- Modify: `backend/internal/model/product.go`
- Modify: `backend/internal/repository/product_repo.go`
- Modify: `backend/tests/integration/product_test.go`
- Modify: `frontend/src/types/product.ts`

- [x] **Step 1: Add failing Go integration assertion**

Extend `TestUserListsActiveAuctionLobbyRows` or add a merchant-list test:

```go
resp, err := makeRequest("GET", ts.URL+"/api/v1/products?page=1&size=20", merchantToken, nil)
if err != nil {
    t.Fatalf("list merchant products failed: %v", err)
}
defer resp.Body.Close()
if resp.StatusCode != http.StatusOK {
    t.Fatalf("expected merchant list 200, got %d", resp.StatusCode)
}
// Decode items and assert the published product row has auction_id == activeAuctionID.
```

- [x] **Step 2: Run red test**

Run:

```powershell
$env:REDIS_ADDR='127.0.0.1:16380'; go test -count=1 ./tests/integration -run TestMerchantListsProductsWithAuctionIDs -v
```

Expected: FAIL because `auction_id` is absent.

- [x] **Step 3: Add optional backend field**

Add to `model.Product`:

```go
AuctionID *int64 `json:"auction_id,omitempty"`
```

Update `ProductRepo.ListByMerchant` to left join auctions and scan `a.id` into `sql.NullInt64`.

- [x] **Step 4: Update frontend type**

Add to `Product`:

```ts
auction_id?: number;
```

- [x] **Step 5: Verify green**

Run:

```powershell
$env:REDIS_ADDR='127.0.0.1:16380'; go test -count=1 ./tests/integration -run TestMerchantListsProductsWithAuctionIDs -v
```

Expected: PASS.

### Task 3: Merchant Navigation Links

**Files:**
- Modify: `frontend/src/pages/merchant/ProductList.test.tsx`
- Modify: `frontend/src/pages/merchant/ProductList.tsx`
- Modify: `frontend/src/pages/merchant/ProductDetail.test.tsx`
- Modify: `frontend/src/pages/merchant/ProductDetail.tsx`

- [x] **Step 1: Add failing ProductList test**

Use a product with `auction_id: 9` and assert:

```ts
expect(await screen.findByRole('link', { name: '实时监控' }))
  .toHaveAttribute('href', '/merchant/auctions/9/monitor');
```

- [x] **Step 2: Add failing ProductDetail test**

Use existing `pendingDetail` and assert the detail page exposes the same link.

- [x] **Step 3: Run red tests**

Run:

```powershell
npm run test -- src/pages/merchant/ProductList.test.tsx src/pages/merchant/ProductDetail.test.tsx
```

Expected: FAIL because links are absent.

- [x] **Step 4: Implement links**

Add a compact monitor link on product list rows when `p.auction_id` exists. Add a monitor link near product detail actions when `auction` exists.

- [x] **Step 5: Verify green**

Run the same Vitest command. Expected: PASS.

### Task 4: Store Bid Event Feed

**Files:**
- Modify: `frontend/src/store/liveRoomStore.test.ts`
- Modify: `frontend/src/store/liveRoomStore.ts`

- [x] **Step 1: Add failing store test**

Apply a `price_update` with ranking display name `阿辰` and amount `140`, then assert a notification contains `阿辰 出价 ¥140.00`.

- [x] **Step 2: Run red test**

Run:

```powershell
npm run test -- src/store/liveRoomStore.test.ts
```

Expected: FAIL because `price_update` does not add a bid-event notification.

- [x] **Step 3: Implement notification**

In `price_update`, derive the top ranking and append:

```ts
const top = normalizeRankings(payload.rankings)[0];
const item = top ? notification('status', `${top.display_name || `用户 ${top.user_id}`} 出价 ¥${top.amount.toFixed(2)}`, message.server_time) : undefined;
```

- [x] **Step 4: Verify green**

Run the same Vitest command. Expected: PASS.

### Task 5: Merchant Monitor Page

**Files:**
- Create: `frontend/src/pages/merchant/AuctionMonitor.tsx`
- Create: `frontend/src/pages/merchant/AuctionMonitor.test.tsx`
- Modify: `frontend/src/App.tsx`

- [x] **Step 1: Add failing page test**

Seed `useLiveRoomStore` with auction id `9`, product, active status, price, rankings, and a bid notification. Render `/merchant/auctions/9/monitor` and assert:

```ts
expect(screen.getByRole('heading', { name: '复古牛仔夹克' })).toBeInTheDocument();
expect(screen.getByText('¥120.00')).toBeInTheDocument();
expect(screen.getByText('排行榜')).toBeInTheDocument();
expect(screen.getByText('最后出价后 30 秒内不可取消')).toBeInTheDocument();
```

Then enter reason `直播异常`, click `确认取消`, and assert:

```ts
await waitFor(() => expect(cancelAuction).toHaveBeenCalledWith(9, '直播异常'));
```

- [x] **Step 2: Run red test**

Run:

```powershell
npm run test -- src/pages/merchant/AuctionMonitor.test.tsx
```

Expected: FAIL because the page file/route does not exist.

- [x] **Step 3: Implement page**

Implement a merchant, PC-oriented monitor using `useLiveRoomStore`, `cancelAuction`, `PageBackButton`, and the existing countdown helper. No bid controls.

- [x] **Step 4: Add route**

Add:

```tsx
<Route path="/merchant/auctions/:id/monitor" element={<ProtectedRoute requiredRole="merchant" fallbackPath="/app/auctions"><MerchantAuctionMonitor /></ProtectedRoute>} />
```

- [x] **Step 5: Verify green**

Run:

```powershell
npm run test -- src/pages/merchant/AuctionMonitor.test.tsx src/App.tsx
```

Expected: PASS.

### Task 6: Final Verification and Documentation Sync

**Files:**
- Modify: `openspec/changes/merchant-auction-monitor/tasks.md`
- Modify: `docs/superpowers/plans/2026-05-30-merchant-auction-monitor.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-05-30.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [x] **Step 1: Run OpenSpec validation**

```powershell
openspec validate merchant-auction-monitor --strict --no-interactive
```

- [x] **Step 2: Run backend tests**

```powershell
$env:REDIS_ADDR='127.0.0.1:16380'; go test ./...
```

- [x] **Step 3: Run frontend tests**

```powershell
npm run test
```

- [x] **Step 4: Run frontend build**

```powershell
npm run build
```

- [x] **Step 5: Run whitespace check**

```powershell
git diff --check
```

- [x] **Step 6: Sync docs and memory**

Mark completed tasks in OpenSpec and this plan. Record verification commands, timestamp fixes, monitor implementation state, and next step in project memory.

- [x] **Step 7: Commit and push**

```powershell
git status --short
git add <verified files>
git commit -m "feat(merchant): add auction monitor"
git push
```
