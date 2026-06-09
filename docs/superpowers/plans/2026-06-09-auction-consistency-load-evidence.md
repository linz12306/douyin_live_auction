# auction-consistency-load-evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove local single-backend auction consistency under concurrency, add optional bid idempotency, expose lock degradation metrics, improve load evidence, and hand distributed WebSocket fanout to the Redis Streams `distributed-realtime-backplane` change.

**Architecture:** Keep the existing Gin service/repository shape and MySQL transaction boundaries. Add a small durable idempotency table scoped by auction/user/key, extend process-local metrics, and improve local evidence tooling without changing the WebSocket message contract.

**Tech Stack:** Go, Gin, MySQL 8, Redis 7, gorilla/websocket, Node built-in fetch/WebSocket, OpenSpec, Superpowers.

---

### Task 1: Workflow Lock

**Files:**
- Create: `docs/superpowers/specs/2026-06-09-auction-consistency-load-evidence-exploration.md`
- Create: `openspec/changes/auction-consistency-load-evidence/*`
- Create: `openspec/changes/distributed-realtime-backplane/*`
- Create: `docs/superpowers/plans/2026-06-09-auction-consistency-load-evidence.md`

- [x] **Step 1: Validate OpenSpec changes**

Run:

```bash
npx -y @fission-ai/openspec@latest validate auction-consistency-load-evidence --strict --no-interactive
npx -y @fission-ai/openspec@latest validate distributed-realtime-backplane --strict --no-interactive
git diff --check
```

Expected: both changes validate and whitespace check passes.

Result: passed for both OpenSpec changes and `git diff --check`.

### Task 2: Idempotency And Metrics TDD

**Files:**
- Create: `backend/migrations/009_create_auction_bid_requests.sql`
- Modify: `backend/internal/dto/auction.go`
- Modify: `backend/internal/handler/auction_handler.go`
- Modify: `backend/internal/repository/auction_engine_repo.go`
- Modify: `backend/internal/service/auction_service.go`
- Modify: `backend/internal/service/auction_metrics.go`
- Modify: `backend/internal/service/health_service.go`
- Modify: `backend/cmd/server/main.go`
- Test: `backend/tests/integration/auction_engine_test.go`
- Test: `backend/internal/service/auction_metrics_test.go`
- Test: `backend/internal/service/health_service_test.go`

- [x] **Step 1: Write failing idempotency integration test**

Add a test that sends two successful bid requests with the same `X-Idempotency-Key`, then asserts the same `bid_id`, only one bid row for that user/auction/keyed amount, and unchanged wallet totals after replay.

- [x] **Step 2: Write failing metrics tests**

Extend metrics and health tests to expect `BidLockDegradedTotal` and JSON field `bid_lock_degraded_total`.

- [x] **Step 3: Implement migration and repository methods**

Create `auction_bid_requests` with unique `(auction_id, user_id, idempotency_key)` and methods to find/store successful bid responses inside existing transactions.

- [x] **Step 4: Implement service and handler support**

Parse `X-Idempotency-Key`, replay existing successful results before mutation, store successful keyed results in the same transaction, and record Redis lock degradation on Redis lock acquisition errors.

- [x] **Step 5: Verify**

Run:

```bash
cd backend && REDIS_ADDR=127.0.0.1:16380 go test ./internal/service ./tests/integration -run 'TestAuction|TestHealth|TestOrder' -count=1
```

Expected: focused tests pass.

Result: focused tests passed.

### Task 3: Concurrency Evidence TDD

**Files:**
- Test: `backend/tests/integration/auction_engine_test.go`
- Test: `backend/tests/integration/order_system_test.go`

- [x] **Step 1: Add concurrent bid invariant test**

Run concurrent bids against one active auction and assert one active bid, auction highest fields match, rankings first row matches, and wallets are non-negative.

- [x] **Step 2: Add unique settlement test**

Invoke settlement concurrently for an expired active auction with one active bid and assert one order and one won bid.

- [x] **Step 3: Add refund idempotency test**

Race buyer cancellation and timeout processing for a `pending_confirm` order and assert buyer balance increases by at most the order amount once.

- [x] **Step 4: Verify**

Run:

```bash
cd backend && REDIS_ADDR=127.0.0.1:16380 go test ./tests/integration -run 'TestAuction|TestOrder' -count=1
```

Expected: focused integration tests pass.

Result: focused integration tests passed.

### Task 4: Load Script And Report

**Files:**
- Modify: `scripts/load-auction.mjs`
- Modify: `docs/performance-report.md`

- [x] **Step 1: Add script tests by help/manual smoke**

Run `node scripts/load-auction.mjs --help` before and after changes. Keep help output available without backend.

- [x] **Step 2: Enhance script**

Add `--login-users`, latency percentile summary, max latency, and `--verify-final-state` output using existing API calls where possible.

- [x] **Step 3: Update report**

Document local setup, load commands, health metrics, result table with p50/p95/max latency, and final SQL checks for active bid uniqueness, order uniqueness, wallet non-negativity, and auction status.

### Task 5: Final Verification

**Files:**
- Modify: `openspec/changes/auction-consistency-load-evidence/tasks.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-09.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [x] **Step 1: Run backend tests**

```bash
cd backend && REDIS_ADDR=127.0.0.1:16380 go test ./...
```

- [x] **Step 2: Run tooling validation**

```bash
node scripts/load-auction.mjs --help
npx -y @fission-ai/openspec@latest validate auction-consistency-load-evidence --strict --no-interactive
npx -y @fission-ai/openspec@latest validate distributed-realtime-backplane --strict --no-interactive
npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive
git diff --check
```

- [x] **Step 3: Record memory**

Result: backend tests, load-script help, OpenSpec validation, specs validation, diff check, and memory updates completed.

Update memory with the implemented idempotency contract, lock degradation metric, concurrency tests, load-script evidence format, and remaining P2 distributed realtime status.
