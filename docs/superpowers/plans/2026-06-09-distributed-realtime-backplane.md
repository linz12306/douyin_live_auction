# distributed-realtime-backplane Implementation Plan

> **For agentic workers:** Use TDD for realtime bus behavior. Keep the public WebSocket contract unchanged.

**Goal:** Make Redis Streams the default backend realtime event backplane while preserving the existing in-memory test bus.

**Architecture:** Keep `AuctionEventBus` as the internal seam. `AuctionService` publishes committed auction events after DB commit; every backend subscribes through Redis Streams and its local Hub fans out to connected clients.

**Tech Stack:** Go, Redis Streams, go-redis/v9, Gin WebSocket Hub, OpenSpec, Superpowers.

---

### Task 1: Workflow Lock

**Files:**
- Create: `docs/superpowers/specs/2026-06-09-distributed-realtime-backplane-exploration.md`
- Modify: `openspec/changes/distributed-realtime-backplane/*`
- Create: `docs/superpowers/plans/2026-06-09-distributed-realtime-backplane.md`

- [x] **Step 1: Record direction**

Capture the user correction that Redis Streams should be implemented now rather than left as a future TODO.

- [x] **Step 2: Update OpenSpec**

Update proposal, design, tasks, and realtime-live-room spec to require Redis Streams with independent subscriber cursors.

### Task 2: Redis Streams Bus TDD

**Files:**
- Create: `backend/internal/realtime/redis_stream_bus_test.go`
- Create: `backend/internal/realtime/redis_stream_bus.go`

- [x] **Step 1: Write failing broadcast test**

Create two Redis Streams bus instances sharing one stream key, subscribe both, publish one event, and assert both subscribers receive it.

Result before implementation: failed with `undefined: NewRedisStreamAuctionEventBus`.

- [x] **Step 2: Implement bus**

Use `XADD` with approximate max length and `XREAD` with independent cursors. Keep slow-subscriber drops observable through `DroppedEvents`.

- [x] **Step 3: Verify realtime package**

Run:

```bash
cd backend && REDIS_ADDR=127.0.0.1:16380 go test ./internal/realtime -count=1
```

Expected: pass.

Result: passed.

### Task 3: Server Wiring

**Files:**
- Modify: `backend/internal/config/config.go`
- Modify: `backend/cmd/server/main.go`

- [x] **Step 1: Add stream key config**

Add `REALTIME_EVENT_STREAM_KEY`, defaulting to `auction_events`.

- [x] **Step 2: Switch default server bus**

Use `NewRedisStreamAuctionEventBus` in `cmd/server`; keep `NewInMemoryAuctionEventBus` for tests.

### Task 4: Final Verification

**Files:**
- Modify: `openspec/changes/distributed-realtime-backplane/tasks.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-09.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [x] **Step 1: Run backend tests**

```bash
cd backend && REDIS_ADDR=127.0.0.1:16380 go test ./...
```

Result: passed.

- [x] **Step 2: Validate OpenSpec and formatting**

```bash
npx -y @fission-ai/openspec@latest validate distributed-realtime-backplane --strict --no-interactive
npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive
git diff --check
```

Result: passed.

- [x] **Step 3: Record memory**

Update project memory with the Redis Streams backplane decision, implementation files, verification status, and remaining optional two-backend manual smoke test.
