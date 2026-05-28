# ws-realtime-live-room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the user-facing realtime auction room: lobby, WebSocket room snapshot, price/ranking/countdown updates, quick/custom bid, and outbid notification.

**Architecture:** Backend uses an `internal/realtime` package with an `AuctionEventBus`, in-memory bus, hub, snapshot provider, and WebSocket handler. `AuctionService` emits domain events after committed state changes and remains independent from WebSocket clients. Frontend adds `/app/auctions` and `/app/auctions/:id`, with WebSocket messages as the source of truth for realtime room state.

**Tech Stack:** Go 1.26/Gin/gorilla-websocket-compatible stack via `github.com/gorilla/websocket`, MySQL, Redis, React 19, TypeScript, Zustand, Vite, Playwright.

---

## Current Context

- Branch: `ws-realtime-live-room`
- OpenSpec change: `openspec/changes/ws-realtime-live-room/`
- Existing backend bid APIs:
  - `POST /api/v1/auctions/:id/bid`
  - `GET /api/v1/auctions/:id/rankings`
  - `POST /api/v1/auctions/:id/activate`
  - `DELETE /api/v1/auctions/:id`
- Existing frontend user routes are missing; merchant routes live under `/merchant/products`.
- Existing E2E tests live in `tests/e2e/`.

## File Structure

Backend create:

- `backend/internal/realtime/message.go`: WebSocket envelope, payload structs, domain event structs, helper constructors.
- `backend/internal/realtime/event_bus.go`: `AuctionEventBus` interface and in-memory implementation.
- `backend/internal/realtime/hub.go`: room/client registry, broadcast, private message delivery, heartbeat constants.
- `backend/internal/realtime/snapshot.go`: snapshot service that queries auction/product/ranking state.
- `backend/internal/handler/realtime_handler.go`: Gin WebSocket handler for `/ws/auctions/:id`.
- `backend/internal/realtime/*_test.go`: unit tests for message/bus/hub/snapshot behavior.

Backend modify:

- `backend/internal/service/auction_service.go`: accept optional event bus and publish committed events.
- `backend/internal/repository/auction_engine_repo.go`: add snapshot query helpers if existing helpers are insufficient.
- `backend/internal/dto/auction.go`: add snapshot DTOs only when they are shared by handler/realtime code.
- `backend/cmd/server/main.go`: wire event bus, realtime hub, snapshot provider, WebSocket route.
- `backend/tests/integration/auction_engine_test.go`: extend server setup to include realtime route and event assertions or add focused realtime integration tests.

Frontend create:

- `frontend/src/api/auction.ts`: auction lobby/detail/ranking/bid helpers.
- `frontend/src/types/auction.ts`: user-side auction room and WebSocket message types.
- `frontend/src/store/liveRoomStore.ts`: version-aware realtime state store/reducer.
- `frontend/src/pages/app/AuctionLobby.tsx`: mobile-first lobby.
- `frontend/src/pages/app/LiveAuctionRoom.tsx`: approved layout A room UI.
- `frontend/src/pages/app/liveRoomUtils.ts`: next-bid and countdown helpers.

Frontend modify:

- `frontend/src/App.tsx`: add `/app/auctions` and `/app/auctions/:id`.
- `frontend/src/pages/Login.tsx`: user login redirects to `/app/auctions`; merchant remains `/merchant/products`.
- `frontend/src/pages/Register.tsx`: user registration redirects to `/app/auctions`; merchant remains `/merchant/products`.

E2E create/modify:

- `tests/e2e/realtime-live-room.spec.ts`: smoke E2E for lobby, room, bid, realtime update, outbid.
- `playwright.config.ts`: leave as-is unless test server setup requires a longer timeout.

## Task 1: Baseline And Dependency Setup

**Files:**
- Modify: `backend/go.mod`
- Modify: `backend/go.sum`

- [x] **Step 1: Run baseline validation**

Run:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction
npx -y @fission-ai/openspec@latest validate ws-realtime-live-room --strict --no-interactive
cd backend
/Users/vivix/.local/go/bin/go test ./...
cd ../frontend && npm run build
```

Expected:

- OpenSpec prints `Change 'ws-realtime-live-room' is valid`.
- Go tests pass.
- Frontend build exits 0.

- [x] **Step 2: Add WebSocket dependency if missing**

Run:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction/backend
/Users/vivix/.local/go/bin/go get github.com/gorilla/websocket@latest
/Users/vivix/.local/go/bin/go mod tidy
```

Expected:

- `backend/go.mod` contains `github.com/gorilla/websocket`.
- `backend/go.sum` is updated.

- [x] **Step 3: Verify dependency setup**

Run:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction/backend
/Users/vivix/.local/go/bin/go test ./...
```

Expected: all packages pass.

- [x] **Step 4: Commit baseline dependency slice**

Run:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction
git add backend/go.mod backend/go.sum
git commit -m "chore(realtime): add websocket dependency"
```

Skip the commit if `go.mod` and `go.sum` did not change.

Result: completed in commit `689ecc9 chore(realtime): add websocket dependency`. Spec compliance and code quality reviews approved the slice; note that `go mod tidy` may remove `github.com/gorilla/websocket` until Task 4 imports it.

## Task 2: Backend Message And Event Contracts

**Files:**
- Create: `backend/internal/realtime/message.go`
- Create: `backend/internal/realtime/message_test.go`
- Create: `backend/internal/realtime/event_bus.go`
- Create: `backend/internal/realtime/event_bus_test.go`

- [x] **Step 1: Write message serialization tests**

Create `backend/internal/realtime/message_test.go` with tests named:

```go
func TestEnvelopeJSONIncludesOrderingFields(t *testing.T)
func TestSnapshotMessageUsesStableType(t *testing.T)
```

Assert that marshalled JSON includes:

- `type`
- `auction_id`
- `version`
- `server_time`
- `payload`

- [x] **Step 2: Implement message contracts**

Create `backend/internal/realtime/message.go` with these exported types:

```go
package realtime

import "time"

const (
	MessageSnapshot    = "snapshot"
	MessagePriceUpdate = "price_update"
	MessageExtended    = "extended"
	MessageAuctionEnd  = "auction_end"
	MessageOutbid      = "outbid"
)

type Envelope struct {
	Type       string      `json:"type"`
	AuctionID  int64       `json:"auction_id"`
	Version    int64       `json:"version"`
	ServerTime time.Time   `json:"server_time"`
	Payload    interface{} `json:"payload"`
}

type ProductSummary struct {
	ID          int64    `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	ImageURLs   []string `json:"image_urls"`
}

type RankingItem struct {
	Rank        int       `json:"rank"`
	UserID      int64     `json:"user_id"`
	DisplayName string    `json:"display_name"`
	AvatarURL   string    `json:"avatar_url"`
	Amount      float64   `json:"amount"`
	Status      string    `json:"status"`
	BidTime     time.Time `json:"bid_time"`
}

type SnapshotPayload struct {
	Product            ProductSummary `json:"product"`
	Status             string         `json:"status"`
	CurrentPrice       float64        `json:"current_price"`
	HighestBidderID    *int64         `json:"highest_bidder_id"`
	StartedAt          *time.Time     `json:"started_at"`
	EndedAt            *time.Time     `json:"ended_at"`
	CurrentExtendCount int            `json:"current_extend_count"`
	BidIncrementType   string         `json:"bid_increment_type"`
	BidIncrementValue  float64        `json:"bid_increment_value"`
	NextBidAmount      float64        `json:"next_bid_amount"`
	Rankings           []RankingItem  `json:"rankings"`
}

type PriceUpdatePayload struct {
	CurrentPrice    float64       `json:"current_price"`
	HighestBidderID int64         `json:"highest_bidder_id"`
	Rankings        []RankingItem `json:"rankings"`
}

type ExtendedPayload struct {
	EndedAt            time.Time `json:"ended_at"`
	CurrentExtendCount int       `json:"current_extend_count"`
}

type AuctionEndPayload struct {
	Status          string  `json:"status"`
	WinnerID        *int64  `json:"winner_id"`
	FinalPrice      float64 `json:"final_price"`
	CancelReason    string  `json:"cancel_reason,omitempty"`
	TerminalMessage string  `json:"terminal_message"`
}

type OutbidPayload struct {
	PreviousAmount float64 `json:"previous_amount"`
	NewAmount      float64 `json:"new_amount"`
	NewBidderID    int64   `json:"new_bidder_id"`
}
```

- [x] **Step 3: Write event bus tests**

Create tests:

```go
func TestInMemoryAuctionEventBusPublishesToSubscribers(t *testing.T)
func TestInMemoryAuctionEventBusUnsubscribeStopsDelivery(t *testing.T)
```

Use a buffered channel and a short timeout to assert delivery and no delivery after unsubscribe.

- [x] **Step 4: Implement event bus**

Create `backend/internal/realtime/event_bus.go` with:

```go
type AuctionEventType string

const (
	EventBidAccepted      AuctionEventType = "bid.accepted"
	EventBidOutbid        AuctionEventType = "bid.outbid"
	EventAuctionExtended  AuctionEventType = "auction.extended"
	EventAuctionEnded     AuctionEventType = "auction.ended"
	EventAuctionCancelled AuctionEventType = "auction.cancelled"
)

type AuctionEvent struct {
	Type             AuctionEventType
	AuctionID        int64
	Version          int64
	UserID           int64
	PreviousUserID   *int64
	Amount           float64
	PreviousAmount   float64
	Status           string
	EndedAt          *time.Time
	ExtendCount      int
	OccurredAt       time.Time
}

type AuctionEventBus interface {
	Publish(ctx context.Context, event AuctionEvent) error
	Subscribe() (<-chan AuctionEvent, func())
}
```

`InMemoryAuctionEventBus` must be concurrency safe and non-blocking for slow subscribers.

- [x] **Step 5: Verify and commit**

Run:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction/backend
/Users/vivix/.local/go/bin/go test ./internal/realtime
```

Expected: realtime package tests pass.

Commit:

```bash
git add backend/internal/realtime/message.go backend/internal/realtime/message_test.go backend/internal/realtime/event_bus.go backend/internal/realtime/event_bus_test.go
git commit -m "feat(realtime): define auction message contracts"
```

Result: completed in `5dba7e7 feat(realtime): define auction message contracts` and hardened in `7edc16f fix(realtime): harden event bus contract`. Spec compliance and code quality reviews approved the slice. Verification included `/Users/vivix/.local/go/bin/go test -race -count=1 ./internal/realtime`.

## Task 3: Backend Snapshot Provider

**Files:**
- Create: `backend/internal/realtime/snapshot.go`
- Create: `backend/internal/realtime/snapshot_test.go`
- Modify: `backend/internal/repository/auction_engine_repo.go`

- [x] **Step 1: Add repository snapshot helper test**

Add an integration test that creates an active auction with two bids, calls the snapshot provider, and asserts:

- product id/title are present
- current price matches the auction
- rankings are ordered by amount descending
- `next_bid_amount` equals current price plus increment
- `version` equals auction version

- [x] **Step 2: Implement snapshot repository query**

Add a method to `AuctionEngineRepo`:

```go
func (r *AuctionEngineRepo) FindAuctionSnapshot(ctx context.Context, auctionID int64) (*AuctionSnapshotRow, error)
```

`AuctionSnapshotRow` should include auction fields, product title/description, and image URLs. Prefer structured scanning with `sql.Null*` types as in `FindAuctionForUpdate`.

- [x] **Step 3: Implement snapshot provider**

Create:

```go
type SnapshotProvider struct {
	repo *repository.AuctionEngineRepo
}

func NewSnapshotProvider(repo *repository.AuctionEngineRepo) *SnapshotProvider

func (p *SnapshotProvider) Snapshot(ctx context.Context, auctionID int64) (*Envelope, error)
```

`Snapshot` must call existing rankings query and convert `dto.RankingItem` to `realtime.RankingItem`.

- [x] **Step 4: Verify and commit**

Run:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction/backend
/Users/vivix/.local/go/bin/go test ./internal/realtime ./tests/integration
```

Commit:

```bash
git add backend/internal/realtime/snapshot.go backend/internal/realtime/snapshot_test.go backend/internal/repository/auction_engine_repo.go backend/tests/integration/auction_engine_test.go
git commit -m "feat(realtime): add auction snapshot provider"
```

Result: completed in `f56dde5 feat(realtime): add auction snapshot provider` and corrected in `caff2a9 fix(realtime): make snapshots consistent`. Spec compliance and code quality reviews approved the slice. Verification included `/Users/vivix/.local/go/bin/go test -count=1 ./internal/realtime ./tests/integration`.

## Task 4: Backend Hub And WebSocket Endpoint

**Files:**
- Create: `backend/internal/realtime/hub.go`
- Create: `backend/internal/realtime/hub_test.go`
- Create: `backend/internal/handler/realtime_handler.go`
- Create: `backend/internal/handler/realtime_handler_test.go`
- Modify: `backend/cmd/server/main.go`

- [x] **Step 1: Write hub tests**

Test:

- broadcasting to two clients in the same auction room
- not broadcasting to a different auction room
- sending private outbid to only the matching user id
- unregister removes client

- [x] **Step 2: Implement hub**

Expose:

```go
type Hub struct { /* mutex, rooms, bus, snapshot provider */ }

func NewHub(bus AuctionEventBus, snapshots *SnapshotProvider) *Hub
func (h *Hub) Run(ctx context.Context)
func (h *Hub) Register(auctionID int64, userID int64, send chan<- Envelope) func()
func (h *Hub) Broadcast(auctionID int64, msg Envelope)
func (h *Hub) SendToUser(auctionID int64, userID int64, msg Envelope)
```

The hub must subscribe to `AuctionEventBus` and convert events into message envelopes.

- [x] **Step 3: Write WebSocket handler tests**

Use `httptest.Server` and `websocket.DefaultDialer` to assert:

- missing token fails
- valid token connects
- first message is `snapshot`
- reconnect receives snapshot
- room broadcast over the WebSocket endpoint
- private `outbid` over the WebSocket endpoint
- queued private `outbid` with snapshot version is not dropped after initial snapshot

- [x] **Step 4: Implement WebSocket handler**

Create `RealtimeHandler` with:

```go
func NewRealtimeHandler(hub *realtime.Hub, snapshots *realtime.SnapshotProvider, cfg *config.Config) *RealtimeHandler
func (h *RealtimeHandler) AuctionRoom(c *gin.Context)
```

Auth behavior:

- read token from `?token=...`
- validate with existing JWT logic/helpers
- reject invalid/missing token

- [x] **Step 5: Wire server route**

In `backend/cmd/server/main.go`:

- create one event bus
- leave passing it to `AuctionService` for Task 5 event publishing
- create snapshot provider and hub
- start hub goroutine
- add `GET /ws/auctions/:id`

- [x] **Step 6: Verify and commit**

Run:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction/backend
/Users/vivix/.local/go/bin/go test ./internal/realtime ./internal/handler ./...
```

Commit:

```bash
git add backend/internal/realtime backend/internal/handler/realtime_handler.go backend/internal/handler/realtime_handler_test.go backend/cmd/server/main.go
git commit -m "feat(realtime): add auction websocket hub"
```

Result: completed in `7bf5059 feat(realtime): add auction websocket hub`. Spec compliance and code quality reviews approved the slice after fixes for join/snapshot ordering, snapshot-backed `price_update` version consistency, read deadlines, and private `outbid` delivery after initial snapshot. Verification included `/Users/vivix/.local/go/bin/go test -count=1 ./internal/realtime ./internal/handler`, `/Users/vivix/.local/go/bin/go test -count=1 ./...`, `git diff --check`, and `npx -y @fission-ai/openspec@latest validate ws-realtime-live-room --strict --no-interactive`.

## Task 5: Auction Service Event Publishing

**Files:**
- Modify: `backend/internal/service/auction_service.go`
- Modify: `backend/internal/service/auction_service_test.go`
- Modify: `backend/tests/integration/auction_engine_test.go`

- [x] **Step 1: Add service constructor compatibility**

Keep existing tests simple by supporting both:

```go
func NewAuctionService(repo *repository.AuctionEngineRepo, redis *redis.Client) *AuctionService
func NewAuctionServiceWithEvents(repo *repository.AuctionEngineRepo, redis *redis.Client, bus realtime.AuctionEventBus) *AuctionService
```

`NewAuctionService` should call `NewAuctionServiceWithEvents(repo, redis, realtime.NewNoopAuctionEventBus())`.

- [x] **Step 2: Add event assertions**

Create tests that subscribe to the in-memory bus, call service methods, and assert events:

- valid bid emits `bid.accepted`
- outbid emits `bid.outbid`
- Soft Close emits `auction.extended`
- ceiling settlement emits `auction.ended`
- cancellation emits `auction.cancelled`

- [x] **Step 3: Implement event publishing after commit**

Do not publish inside the DB transaction before commit. Collect events in a local slice during the transaction, then publish after `repo.WithTx` returns nil:

```go
var events []realtime.AuctionEvent
err := s.repo.WithTx(ctx, func(tx *sql.Tx) error {
    // mutate DB
    events = append(events, realtime.AuctionEvent{...})
    return nil
})
if err != nil {
    return nil, err
}
for _, event := range events {
    _ = s.eventBus.Publish(ctx, event)
}
```

If publish fails, log the failure and keep the already committed business result.

- [x] **Step 4: Verify and commit**

Run:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction/backend
/Users/vivix/.local/go/bin/go test ./internal/service ./tests/integration
```

Commit:

```bash
git add backend/internal/service/auction_service.go backend/internal/service/auction_service_test.go backend/tests/integration/auction_engine_test.go
git commit -m "feat(auction): publish realtime domain events"
```

Result: implementation verified locally with `/Users/vivix/.local/go/bin/go test -count=1 ./internal/service ./tests/integration`, `/Users/vivix/.local/go/bin/go test -count=1 ./...`, and `git diff --check`; commit recorded as part of the Task 5 slice.

## Task 6: Frontend Auction API And Lobby

**Files:**
- Create: `frontend/src/api/auction.ts`
- Create: `frontend/src/types/auction.ts`
- Create: `frontend/src/pages/app/AuctionLobby.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/pages/Register.tsx`

- [x] **Step 1: Define user-side auction types**

Create `frontend/src/types/auction.ts` with:

```ts
export type AuctionStatus = 'pending' | 'active' | 'ended_sold' | 'ended_no_bid' | 'cancelled';

export interface AuctionLobbyItem {
  product_id: number;
  auction_id: number;
  title: string;
  image_url?: string;
  status: AuctionStatus;
  current_price: number;
  ended_at?: string;
}
```

- [x] **Step 2: Add API helpers**

Create `frontend/src/api/auction.ts`:

```ts
import client from './client';
import type { AuctionLobbyItem } from '../types/auction';

export async function listAuctionLobby(): Promise<AuctionLobbyItem[]> {
  const { data } = await client.get('/products', { params: { status: 'active', page: 1, size: 50 } });
  const items = data.data.items ?? [];
  return items.map((item: any) => ({
    product_id: item.id,
    auction_id: item.auction?.id ?? item.auction_id,
    title: item.title,
    image_url: item.image_url,
    status: item.status,
    current_price: item.auction?.current_price ?? item.current_price ?? 0,
    ended_at: item.auction?.ended_at,
  })).filter((item: AuctionLobbyItem) => item.auction_id);
}
```

If `/products` does not return auction data for list rows, add a backend list extension in this task and cover it with `npm run build` plus Playwright smoke.

- [x] **Step 3: Implement mobile lobby**

Create `AuctionLobby.tsx` with:

- header `竞拍大厅`
- active auction cards
- image area
- current price
- status badge
- `进入直播间` link to `/app/auctions/:auctionId`

- [x] **Step 4: Add routes and redirects**

Modify:

- `App.tsx`: add protected routes for `/app/auctions` and `/app/auctions/:id`.
- `Login.tsx`: user role redirects to `/app/auctions`.
- `Register.tsx`: user role redirects to `/app/auctions`.

- [x] **Step 5: Verify and commit**

Run:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction/frontend
npm run build
```

Commit:

```bash
git add frontend/src/api/auction.ts frontend/src/types/auction.ts frontend/src/pages/app/AuctionLobby.tsx frontend/src/App.tsx frontend/src/pages/Login.tsx frontend/src/pages/Register.tsx
git commit -m "feat(frontend): add user auction lobby"
```

Result: implemented with a minimal backend extension for user lobby rows because merchant-scoped `GET /api/v1/products` did not include global auction data. The frontend stores the authenticated user role, hydrates unknown refresh-token sessions through `/users/me` before rendering protected role routes, redirects merchants away from `/app/auctions`, redirects users away from `/merchant/products`, logs failed hydration out to `/login`, and normalizes unexpected `/products` rows defensively. Verification passed with `cd frontend && npm run build`, `/Users/vivix/.local/go/bin/go test -count=1 ./tests/integration -run TestUserListsActiveAuctionLobbyRows`, `/Users/vivix/.local/go/bin/go test -count=1 ./tests/integration`, `/Users/vivix/.local/go/bin/go test -count=1 ./...`, `npx -y @fission-ai/openspec@latest validate ws-realtime-live-room --strict --no-interactive`, `git diff --check`, and Playwright smoke covering auth hydration redirects, `/profile` reload hydration, failed hydration logout, and merchant-shaped `/products` data rendering an empty lobby without page errors; commit recorded as part of the Task 6 slice.

## Task 7: Frontend Live Room State And WebSocket Client

**Files:**
- Create: `frontend/src/store/liveRoomStore.ts`
- Create: `frontend/src/pages/app/liveRoomUtils.ts`
- Create: `frontend/src/store/liveRoomStore.test.ts`
- Create: `frontend/vite.config.test.ts`
- Modify: `frontend/src/types/auction.ts`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [x] **Step 1: Define message types and reducer behavior**

In `frontend/src/types/auction.ts`, add:

```ts
export type RealtimeMessageType = 'snapshot' | 'price_update' | 'extended' | 'auction_end' | 'outbid';

export interface RealtimeEnvelope<T = unknown> {
  type: RealtimeMessageType;
  auction_id: number;
  version: number;
  server_time: string;
  payload: T;
}
```

- [x] **Step 2: Implement version-aware store**

Create `liveRoomStore.ts` with:

- `connect(auctionId, token)`
- `disconnect()`
- `applyMessage(message)`
- `submitState` for pending bid submission
- latest `version`
- notification list for outbid/errors

`applyMessage` must ignore any non-`outbid` message where `message.version < state.version`.

- [x] **Step 3: Implement countdown helpers**

Create `liveRoomUtils.ts`:

```ts
export function computeServerOffset(serverTime: string, clientNow = Date.now()): number {
  return new Date(serverTime).getTime() - clientNow;
}

export function remainingMs(endedAt: string | undefined, offsetMs: number, clientNow = Date.now()): number {
  if (!endedAt) return 0;
  return Math.max(0, new Date(endedAt).getTime() - clientNow - offsetMs);
}
```

- [x] **Step 4: Verify and commit**

Run:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction/frontend
npm run build
```

Commit:

```bash
git add frontend/src/types/auction.ts frontend/src/store/liveRoomStore.ts frontend/src/pages/app/liveRoomUtils.ts
git commit -m "feat(frontend): add realtime room state"
```

Result: implemented in the Task 7 slice. Frontend realtime types mirror backend snake_case envelope/payload fields, `liveRoomStore.ts` owns WebSocket connect/disconnect/reconnect state, version-aware message application, server time offset, submit state, and notifications, and `liveRoomUtils.ts` contains countdown helpers. Vite now proxies `/ws` with WebSocket support for local frontend dev, and Vitest coverage verifies snapshot, price update, extension, terminal auction end, outbid notification, reconnect behavior, stale-version ignore, token-query URL construction, and server time offset. Verification passed with `cd frontend && npm run build`, `cd frontend && npm test -- vite.config.test.ts src/store/liveRoomStore.test.ts`, `cd frontend && npx eslint vite.config.ts vite.config.test.ts src/types/auction.ts src/store/liveRoomStore.ts src/store/liveRoomStore.test.ts src/pages/app/liveRoomUtils.ts --quiet`, `npx -y @fission-ai/openspec@latest validate ws-realtime-live-room --strict --no-interactive`, and `git diff --check`. Full room UI and bid interaction remain Task 8.

## Task 8: Frontend Live Room UI And Bid Interaction

**Files:**
- Create: `frontend/src/pages/app/LiveAuctionRoom.tsx`
- Modify: `frontend/src/api/auction.ts`
- Modify: `frontend/src/App.tsx`

- [x] **Step 1: Add bid API helper**

In `frontend/src/api/auction.ts`:

```ts
export async function placeBid(auctionId: number, amount: number): Promise<void> {
  await client.post(`/auctions/${auctionId}/bid`, { amount });
}
```

- [x] **Step 2: Implement approved layout A**

`LiveAuctionRoom.tsx` must render:

- simulated live ambience region
- product title
- current price
- countdown
- primary `出价 ¥{nextBidAmount}` button
- custom amount input
- ranking list
- realtime status/outbid messages
- disabled bidding for terminal states

- [x] **Step 3: Enforce WebSocket truth source**

On bid submit:

- call REST `placeBid`
- show submitting state
- do not update `current_price` or rankings directly from REST
- wait for WebSocket `price_update` or `auction_end`
- show REST failure as visible error/toast

- [x] **Step 4: Verify and commit**

Run:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction/frontend
npm run build
```

Commit:

```bash
git add frontend/src/pages/app/LiveAuctionRoom.tsx frontend/src/api/auction.ts frontend/src/App.tsx
git commit -m "feat(frontend): add live auction room"
```

Result: implemented in the Task 8 slice. `LiveAuctionRoom.tsx` provides the mobile-first live auction room with live ambience, product/title media, current price, countdown driven by `remainingMs(endedAt, serverTimeOffsetMs)`, quick bid, custom bid, ranking list, realtime notifications, connection/status badges, and terminal-state disabled bidding. `placeBid` posts `{ amount }` to `/auctions/:id/bid`, `/app/auctions/:id` now uses the room component behind the existing user protected route, and bid success leaves price/rankings unchanged until WebSocket messages arrive. Review follow-up fixed reload sessions with stored user + refresh token + empty access token so protected routes hydrate before rendering room content, recomputes `nextBidAmount` from fixed/percent increment rules on `price_update`, and neutralizes stale room state while route auction id and store auction id differ. Vitest coverage verifies render/connect state, quick bid REST submission without local price mutation, custom bid, visible REST failure, terminal disable behavior, access-token hydration, price_update-driven current/next bid UI, and route-change stale-store safety. Verification passed with `cd frontend && npm run build`, `cd frontend && npm test -- src/pages/app/LiveAuctionRoom.test.tsx src/store/liveRoomStore.test.ts vite.config.test.ts`, `cd frontend && npx eslint src/api/auction.ts src/pages/app/LiveAuctionRoom.tsx src/pages/app/LiveAuctionRoom.test.tsx src/App.tsx src/store/liveRoomStore.ts src/store/liveRoomStore.test.ts --quiet`, `npx -y @fission-ai/openspec@latest validate ws-realtime-live-room --strict --no-interactive`, and `git diff --check`.

## Task 9: End-To-End Realtime Validation

**Files:**
- Create: `tests/e2e/realtime-live-room.spec.ts`
- Modify: `openspec/changes/ws-realtime-live-room/tasks.md`
- Modify: `docs/superpowers/plans/2026-05-28-ws-realtime-live-room.md`

- [ ] **Step 1: Add Playwright smoke test**

Create `tests/e2e/realtime-live-room.spec.ts` to cover:

1. merchant registers, creates product, uploads or uses existing image path, publishes, activates
2. user A registers and opens `/app/auctions`
3. user A enters `/app/auctions/:auctionId`
4. user A sees snapshot-derived current price
5. user A bids
6. second browser context user B bids higher
7. user A sees outbid notification
8. room ranking/current price update

- [ ] **Step 2: Run full validation**

Ensure backend and frontend dev servers are running, then run:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction
npx playwright test tests/e2e/realtime-live-room.spec.ts
npx -y @fission-ai/openspec@latest validate ws-realtime-live-room --strict --no-interactive
cd backend && /Users/vivix/.local/go/bin/go test ./...
cd ../frontend && npm run build
```

Expected:

- E2E realtime test passes.
- OpenSpec change remains valid.
- Backend tests pass.
- Frontend build passes.

- [ ] **Step 3: Update task statuses and memory**

Update:

- `openspec/changes/ws-realtime-live-room/tasks.md`
- `docs/superpowers/plans/2026-05-28-ws-realtime-live-room.md`
- `projects/proj-1779447357476-ryiijf/outputs/progress-report-v3.md`
- `projects/proj-1779447357476-ryiijf/memory/2026-05-28.md`
- `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [ ] **Step 4: Commit final implementation slice**

Run:

```bash
git add tests/e2e/realtime-live-room.spec.ts openspec/changes/ws-realtime-live-room/tasks.md docs/superpowers/plans/2026-05-28-ws-realtime-live-room.md projects/proj-1779447357476-ryiijf/outputs/progress-report-v3.md projects/proj-1779447357476-ryiijf/memory/2026-05-28.md projects/proj-1779447357476-ryiijf/memory/long-term.md
git commit -m "test(realtime): cover live room flow"
git push --no-verify
```

## Self-Review

- Spec coverage: user lobby, live room, WebSocket snapshot, message contract, broadcast, private outbid, Soft Close, terminal update, WebSocket truth source, and stale-message handling are covered by Tasks 2-9.
- Scope: order/payment, merchant monitoring, chat, online count, and Redis Pub/Sub are excluded as required.
- Type consistency: backend `Envelope` and frontend `RealtimeEnvelope` use the same envelope fields; event names stay internal and message names match OpenSpec.
- Verification: every implementation task has a concrete command and commit point.
