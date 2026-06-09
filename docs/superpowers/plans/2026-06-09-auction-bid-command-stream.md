# auction-bid-command-stream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Redis Streams bid command queue so HTTP can enqueue bids quickly while workers process auction state in order per auction.

**Architecture:** MySQL is the command state source of truth, Redis Stream `auction_bid_commands` is the queue/wakeup transport, and workers drain queued commands per auction under a Redis lock. Synchronous bidding remains the fallback and both sync and async paths share the same bid transaction core.

**Tech Stack:** Go, Gin, MySQL 8, Redis 7 Streams, go-redis/v9, gorilla/websocket, React 19, TypeScript, Vite, Node load script, OpenSpec, Superpowers.

---

### Task 1: Workflow Lock

**Files:**
- Create: `docs/superpowers/specs/2026-06-09-auction-bid-command-stream-exploration.md`
- Create: `openspec/changes/auction-bid-command-stream/*`
- Create: `docs/superpowers/plans/2026-06-09-auction-bid-command-stream.md`

- [x] **Step 1: Validate OpenSpec change**

Run:

```bash
npx -y @fission-ai/openspec@latest validate auction-bid-command-stream --strict --no-interactive
git diff --check
```

Expected: OpenSpec validates and whitespace check passes.

Result: `npx -y @fission-ai/openspec@latest validate auction-bid-command-stream --strict --no-interactive` and `git diff --check` passed before implementation.

### Task 2: Command Schema And Repository TDD

**Files:**
- Create: `backend/migrations/010_create_auction_bid_commands.sql`
- Create: `backend/internal/model/bid_command.go`
- Create or modify: `backend/internal/repository/auction_bid_command_repo.go`
- Test: `backend/internal/repository/auction_bid_command_repo_test.go` or `backend/tests/integration/auction_engine_test.go`

- [x] **Step 1: Write failing duplicate-key test**

Add a test that creates an async command with `(auction_id,user_id,idempotency_key)`, attempts the same key again, and expects the same command id with no second queued row.

- [x] **Step 2: Write failing status-transition test**

Add a test that moves a command `queued -> processing -> accepted` and verifies bid id, order id, auction version, and timestamps are stored.

- [x] **Step 3: Implement migration**

Create `auction_bid_commands` with command id, auction id, user id, nullable client idempotency key, generated core idempotency key, amount, status enum, failure reason, bid id, order id, auction version, attempts, processing timestamps, and created/updated timestamps. Add indexes for owner query, queued auction drain, and keyed dedupe.

- [x] **Step 4: Implement repository methods**

Implement create-or-find, owner-scoped fetch, mark processing, mark accepted, mark rejected, mark failed, and list queued commands for one auction ordered by id.

- [x] **Step 5: Verify repository slice**

Run:

```bash
cd backend && REDIS_ADDR=127.0.0.1:16380 /Users/vivix/.local/go/bin/go test ./internal/repository ./tests/integration -run 'TestBidCommand|TestAsyncBidCommand' -count=1
```

Expected: new tests fail before implementation and pass after implementation.

Result: async integration tests cover duplicate command idempotency, owner query, accepted/rejected worker outcomes, reentry safety, same-auction ordered drain, and cross-auction drain independence.

### Task 3: Async API TDD

**Files:**
- Modify: `backend/internal/dto/auction.go`
- Modify: `backend/internal/handler/auction_handler.go`
- Modify: `backend/internal/service/auction_service.go`
- Modify: `backend/cmd/server/main.go`
- Test: `backend/tests/integration/auction_engine_test.go`

- [x] **Step 1: Write failing enqueue API test**

Add an integration test that posts to `/api/v1/auctions/:id/bid/async` and expects `202`, command id, auction id, amount, and status `queued`.

- [x] **Step 2: Write failing duplicate enqueue test**

Add an integration test using `X-Idempotency-Key` twice and assert the same command id and exactly one command row.

- [x] **Step 3: Write failing owner query test**

Add an integration test that command owner can query the command and another user cannot.

- [x] **Step 4: Implement DTO, handler, service, and routes**

Add async enqueue/query request and response DTOs, service methods, handler methods, and routes under `/api/v1/auctions`.

- [x] **Step 5: Verify API slice**

Run:

```bash
cd backend && REDIS_ADDR=127.0.0.1:16380 /Users/vivix/.local/go/bin/go test ./tests/integration -run 'TestAsyncBidCommand' -count=1
```

Expected: async API tests pass and existing sync bid tests still compile.

Result: `cd backend && REDIS_ADDR=127.0.0.1:16380 /Users/vivix/.local/go/bin/go test ./tests/integration -run 'TestAsyncBidCommand' -count=1` passed.

### Task 4: Shared Bid Core And Worker TDD

**Files:**
- Modify: `backend/internal/service/auction_service.go`
- Create: `backend/internal/service/auction_bid_command_worker.go`
- Modify: `backend/internal/config/config.go`
- Modify: `backend/cmd/server/main.go`
- Test: `backend/tests/integration/auction_engine_test.go`
- Test: `backend/internal/service/auction_service_test.go`

- [x] **Step 1: Write failing worker acceptance test**

Add a test that enqueues a valid async command, runs worker processing, and asserts command `accepted`, one active bid, correct frozen balance, and normal realtime bid event.

- [x] **Step 2: Write failing rejection test**

Add a test that enqueues a low async bid, runs worker processing, and asserts command `rejected`, no bid row for that command, and unchanged wallet totals.

- [x] **Step 3: Write failing ordering test**

Add a test that enqueues same-auction commands with increasing amounts, processes them, and asserts command completion order follows command id order and final active bid is the last accepted amount.

- [x] **Step 4: Write failing reentry test**

Add a test that processes the same command twice and asserts no duplicate freeze, bid, unfreeze, deduction, or order.

- [x] **Step 5: Refactor shared bid core**

Extract the existing `PlaceBid` mutation into a reusable internal method that can use caller-supplied idempotency and optionally skip the outer Redis bid lock.

- [x] **Step 6: Implement Redis Stream worker**

Add `XADD`, consumer-group setup, `XREADGROUP`, `XACK`, per-auction Redis worker lock, DB ordered drain, command transitions, and safe failure handling.

- [x] **Step 7: Start worker from server**

Add config defaults for stream key, group, consumer, worker concurrency, and lock TTL. Start the worker in `cmd/server` after constructing `AuctionService`.

- [x] **Step 8: Verify worker slice**

Run:

```bash
cd backend && REDIS_ADDR=127.0.0.1:16380 /Users/vivix/.local/go/bin/go test ./internal/service ./tests/integration -run 'TestAsyncBidCommand|TestBidCommandWorker|TestAuction' -count=1
```

Expected: worker tests and existing auction tests pass.

Result: focused async worker tests passed as part of the `TestAsyncBidCommand` integration run.

### Task 5: Realtime Command Status

**Files:**
- Modify: `backend/internal/realtime/event_bus.go`
- Modify: `backend/internal/realtime/hub.go`
- Modify: `backend/internal/realtime/message.go`
- Modify: `frontend/src/types/auction.ts`
- Modify: `frontend/src/store/liveRoomStore.ts`
- Test: `backend/internal/realtime/hub_test.go`
- Test: `frontend/src/store/liveRoomStore.test.ts`

- [x] **Step 1: Write failing backend realtime test**

Add a hub test showing `bid_command` messages are delivered only to the command owner.

- [x] **Step 2: Implement backend realtime message**

Add command status event fields, message payload, and `Hub.SendToUser` handling.

- [x] **Step 3: Add optional frontend handling**

Add TypeScript types and store handling for `bid_command` notifications without changing the default sync submit path.

- [x] **Step 4: Verify realtime slice**

Run:

```bash
cd backend && REDIS_ADDR=127.0.0.1:16380 /Users/vivix/.local/go/bin/go test ./internal/realtime -run 'TestHub|TestMessage' -count=1
cd frontend && npm run test -- --run src/store/liveRoomStore.test.ts
```

Expected: backend realtime and frontend store tests pass.

Result: backend realtime focused test passed, and `cd frontend && npm run test -- --run src/store/liveRoomStore.test.ts` passed after `npm install`.

### Task 6: Load Script And Performance Report

**Files:**
- Modify: `scripts/load-auction.mjs`
- Modify: `docs/performance-report.md`

- [x] **Step 1: Confirm help baseline**

Run:

```bash
node scripts/load-auction.mjs --help
```

Expected: help prints without contacting backend.

- [x] **Step 2: Add queued mode**

Add `--bid-mode sync|queued`, async endpoint support, command status polling, enqueue latency percentiles, accepted/rejected/failed/pending outcome counts, queue lag output, and final-state SQL guidance.

- [x] **Step 3: Update performance report**

Add sync vs queued comparison table, queued-mode command examples, SQL verification commands, and architecture explanation for Redis Streams as lightweight course MQ.

- [x] **Step 4: Verify tooling slice**

Run:

```bash
node scripts/load-auction.mjs --help
git diff --check
```

Expected: help includes queued mode and diff check passes.

Result: `node scripts/load-auction.mjs --help` passed and shows queued mode options.

### Task 7: Final Verification And Memory

**Files:**
- Modify: `openspec/changes/auction-bid-command-stream/tasks.md`
- Modify: `docs/superpowers/plans/2026-06-09-auction-bid-command-stream.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-09.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [x] **Step 1: Run backend verification**

```bash
cd backend && REDIS_ADDR=127.0.0.1:16380 /Users/vivix/.local/go/bin/go test ./...
```

- [x] **Step 2: Run frontend verification**

```bash
cd frontend && npm run test
cd frontend && npm run build
```

- [x] **Step 3: Run OpenSpec and tooling verification**

```bash
npx -y @fission-ai/openspec@latest validate auction-bid-command-stream --strict --no-interactive
npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive
node scripts/load-auction.mjs --help
git diff --check
```

- [x] **Step 4: Record memory and task results**

### Task 8: WebSocket Concurrency Optimization Follow-up

**Context:** Local WS load after the async command stream showed the core bid command path stayed healthy, but realtime dropped event counters increased under `5000` queued bids / `500` HTTP concurrency / `300` WS connections. The observed drops come from the `auction_events` Redis Stream subscriber buffer, not from the bid command consumer group.

**Files:**
- Modify: `backend/internal/realtime/redis_stream_bus.go`
- Modify: `backend/internal/realtime/redis_stream_bus_test.go`
- Modify: `backend/internal/service/auction_service.go`
- Modify: `backend/tests/integration/auction_engine_test.go`
- Modify: `docs/performance-report.md`
- Modify: `openspec/changes/auction-bid-command-stream/*`

- [x] **Step 1: Add failing realtime burst-buffer test**

Add a Redis Stream realtime bus test that publishes a burst while the subscriber is not draining and expects no dropped events within the local load-test burst envelope.

- [x] **Step 2: Add failing async enqueue noise test**

Add an integration test showing `POST /bid/async` returns `queued` but does not publish a per-command `queued` event to the shared realtime backplane.

- [x] **Step 3: Implement scoped optimization**

Increase Redis realtime subscriber buffering and suppress per-command `queued` realtime publication. Keep `processing`, `accepted`, `rejected`, and `failed` private command status messages.

- [x] **Step 4: Verify and retest**

Run:

```bash
cd backend && REDIS_ADDR=127.0.0.1:16380 /Users/vivix/.local/go/bin/go test ./internal/realtime ./tests/integration -run 'TestRedisStreamAuctionEventBusBuffersBurstySubscriberWithoutDrops|TestAsyncBidCommandEnqueueDoesNotPublishQueuedRealtimeEvent' -count=1
cd backend && REDIS_ADDR=127.0.0.1:16380 /Users/vivix/.local/go/bin/go test ./...
npx -y @fission-ai/openspec@latest validate auction-bid-command-stream --strict --no-interactive
git diff --check
```

Then run a local WS load smoke with queued mode and compare `/healthz` dropped event deltas.

Result:

- RED: focused tests failed before implementation (`240` Redis subscriber drops; enqueue emitted a queued realtime event).
- GREEN: focused tests passed after increasing Redis realtime subscriber buffer to `4096` and suppressing enqueue-stage queued publication.
- Full backend: `cd backend && REDIS_ADDR=127.0.0.1:16380 /Users/vivix/.local/go/bin/go test ./...` passed.
- OpenSpec: `npx -y @fission-ai/openspec@latest validate auction-bid-command-stream --strict --no-interactive` passed.
- Local WS load: `5000` requests / `500` HTTP concurrency / `300` WS connections on auction `565` produced `5000/5000` HTTP 202, worker `accepted 246`, `rejected 4754`, `pending 0`, `failed 0`, Redis command group `pending 0`, `lag 0`, and `/healthz` `dropped_events 0`.

Update OpenSpec tasks, Superpowers checkboxes, and memory with commands, results, decisions, and remaining risks. Do not commit or push unless explicitly requested.

Result: OpenSpec change validation, persistent specs validation, load-script help, and `git diff --check` passed after implementation and documentation updates.
