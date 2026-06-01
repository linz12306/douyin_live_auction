# Perf Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose local auction-engine performance metrics, provide a concurrent load script, and document the judge-facing performance evidence flow.

**Architecture:** Add a process-local atomic metrics collector in the backend service layer, inject it into auction bid handling, and surface its snapshot through the existing `/healthz` auction_engine component alongside realtime hub stats. Keep the load script external and configurable so it exercises existing REST/WebSocket APIs without changing business semantics.

**Tech Stack:** Go 1.26.3, Gin, go-redis v9, gorilla/websocket server, Node.js built-in `fetch`, optional Node global `WebSocket`.

---

## File Structure

- Create `backend/internal/service/auction_metrics.go`: atomic bid counters, latency accumulator, lock-busy counter, and snapshot calculations.
- Create `backend/internal/service/auction_metrics_test.go`: collector tests for initial state, success/failure classification, average latency, and lock-busy count.
- Modify `backend/internal/service/health_service.go`: extend `EngineStats` and `AuctionEngineComponent` with bid metrics and `ws_connections_current`.
- Modify `backend/internal/service/health_service_test.go`: assert the new health fields map from `EngineStats`.
- Modify `backend/internal/service/auction_service.go`: add optional metrics dependency, record bid outcomes and lock-busy results.
- Modify `backend/internal/service/auction_service_test.go`: add focused tests for metrics wrapping and lock-busy counting using a controllable fake Redis client or service-level helper.
- Modify `backend/cmd/server/main.go`: construct one metrics collector and include its snapshot in health stats.
- Modify `backend/internal/handler/health_handler_test.go`: assert health JSON includes the new auction-engine metrics.
- Create `scripts/load-auction.mjs`: local concurrent bid and optional WebSocket load utility.
- Create `docs/performance-report.md`: command examples, metric definitions, results table, and demo narrative.
- Update `openspec/changes/perf-observability/tasks.md`: track actual implementation and verification results.
- Update `projects/proj-1779447357476-ryiijf/memory/2026-06-01.md` and `projects/proj-1779447357476-ryiijf/memory/long-term.md`: record verified outcome.

## Task 1: Metrics Collector

**Files:**
- Create: `backend/internal/service/auction_metrics.go`
- Create: `backend/internal/service/auction_metrics_test.go`

- [x] **Step 1: Write failing collector tests**

Create tests for:

```go
func TestAuctionMetricsInitialSnapshot(t *testing.T) {
	metrics := NewAuctionMetrics()
	snapshot := metrics.Snapshot()
	if snapshot.BidRequestsTotal != 0 || snapshot.BidSuccessRate != 0 || snapshot.BidAvgLatencyMS != 0 {
		t.Fatalf("initial snapshot = %+v", snapshot)
	}
}

func TestAuctionMetricsRecordsOutcomesAndLatency(t *testing.T) {
	metrics := NewAuctionMetrics()
	metrics.RecordBid(true, 10*time.Millisecond)
	metrics.RecordBid(false, 30*time.Millisecond)
	snapshot := metrics.Snapshot()
	if snapshot.BidRequestsTotal != 2 || snapshot.BidSuccessTotal != 1 || snapshot.BidFailureTotal != 1 {
		t.Fatalf("snapshot counts = %+v", snapshot)
	}
	if snapshot.BidSuccessRate != 0.5 {
		t.Fatalf("success rate = %v", snapshot.BidSuccessRate)
	}
	if snapshot.BidAvgLatencyMS != 20 {
		t.Fatalf("avg latency = %v", snapshot.BidAvgLatencyMS)
	}
}

func TestAuctionMetricsRecordsLockBusy(t *testing.T) {
	metrics := NewAuctionMetrics()
	metrics.RecordLockBusy()
	if metrics.Snapshot().BidLockBusyTotal != 1 {
		t.Fatalf("lock busy total = %d", metrics.Snapshot().BidLockBusyTotal)
	}
}
```

- [x] **Step 2: Run test to verify RED**

Run: `cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/service -run TestAuctionMetrics`

Expected: FAIL because `NewAuctionMetrics` and snapshot fields do not exist.

- [x] **Step 3: Implement collector**

Create an atomic collector with `RecordBid(success bool, latency time.Duration)`, `RecordLockBusy()`, and `Snapshot() AuctionMetricsSnapshot`.

- [x] **Step 4: Run test to verify GREEN**

Run: `cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/service -run TestAuctionMetrics`

Expected: PASS.

## Task 2: Health Response Fields

**Files:**
- Modify: `backend/internal/service/health_service.go`
- Modify: `backend/internal/service/health_service_test.go`
- Modify: `backend/internal/handler/health_handler_test.go`

- [x] **Step 1: Write failing health assertions**

Extend health tests so fake engine stats include:

```go
BidRequestsTotal: 10,
BidSuccessTotal: 8,
BidFailureTotal: 2,
BidSuccessRate: 0.8,
BidAvgLatencyMS: 12.5,
BidLockBusyTotal: 3,
WSConnectionsCurrent: 4,
```

Assert these values appear in `report.Components.AuctionEngine`.

- [x] **Step 2: Run test to verify RED**

Run: `cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/service ./internal/handler -run TestHealth`

Expected: FAIL because the structs do not expose the fields.

- [x] **Step 3: Extend health structs and mapping**

Add the fields to `EngineStats` and `AuctionEngineComponent` with stable snake_case JSON tags. In `checkAuctionEngine`, copy every field from stats into the component.

- [x] **Step 4: Run test to verify GREEN**

Run: `cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/service ./internal/handler -run TestHealth`

Expected: PASS.

## Task 3: Bid and Lock Instrumentation

**Files:**
- Modify: `backend/internal/service/auction_service.go`
- Modify: `backend/internal/service/auction_service_test.go`

- [x] **Step 1: Write failing service instrumentation tests**

Add tests that construct an `AuctionService` with a metrics collector and a focused helper path:

```go
func TestAuctionServiceRecordsBidOutcome(t *testing.T) {
	metrics := NewAuctionMetrics()
	svc := NewAuctionServiceWithMetrics(nil, nil, realtime.NewNoopAuctionEventBus(), metrics)
	err := errors.New("bid failed")
	if got := svc.recordBidMetrics(time.Now().Add(-10*time.Millisecond), err); got != err {
		t.Fatalf("returned error = %v", got)
	}
	snapshot := metrics.Snapshot()
	if snapshot.BidRequestsTotal != 1 || snapshot.BidFailureTotal != 1 {
		t.Fatalf("snapshot = %+v", snapshot)
	}
}

func TestAuctionServiceRecordsLockBusy(t *testing.T) {
	metrics := NewAuctionMetrics()
	svc := NewAuctionServiceWithMetrics(nil, nil, realtime.NewNoopAuctionEventBus(), metrics)
	svc.recordLockBusy(ErrAuctionLockBusy)
	if metrics.Snapshot().BidLockBusyTotal != 1 {
		t.Fatalf("snapshot = %+v", metrics.Snapshot())
	}
}
```

- [x] **Step 2: Run test to verify RED**

Run: `cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/service -run 'TestAuctionServiceRecords.*|TestAuctionMetrics'`

Expected: FAIL because metrics constructor/helper hooks do not exist.

- [x] **Step 3: Implement instrumentation**

Add `metrics *AuctionMetrics` to `AuctionService`, a `NewAuctionServiceWithMetrics` constructor, and default metrics in existing constructors. Wrap `PlaceBid` with a named return so a deferred helper records duration and final error after the role guard. Count lock-busy when `acquireBidLock` gets `SETNX == false`.

- [x] **Step 4: Run test to verify GREEN**

Run: `cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/service -run 'TestAuctionServiceRecords.*|TestAuctionMetrics'`

Expected: PASS.

## Task 4: Server Wiring

**Files:**
- Modify: `backend/cmd/server/main.go`

- [x] **Step 1: Wire shared collector**

Create `auctionMetrics := service.NewAuctionMetrics()`, pass it to `NewAuctionServiceWithMetrics`, and merge `auctionMetrics.Snapshot()` into the health `EngineStats` provider. Set `WSConnectionsCurrent` from `hubStats.ConnectedClients`.

- [x] **Step 2: Run backend compile check**

Run: `cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./cmd/server ./internal/service ./internal/handler`

Expected: PASS.

## Task 5: Local Load Script

**Files:**
- Create: `scripts/load-auction.mjs`

- [x] **Step 1: Add script**

Implement argument parsing for `--help`, `--base-url`, `--auction-id`, `--tokens`, `--requests`, `--concurrency`, `--start-amount`, `--bid-step`, and `--ws-connections`. Use `fetch` for REST requests and global `WebSocket` only when available.

- [x] **Step 2: Smoke help**

Run: `node scripts/load-auction.mjs --help`

Expected: exits 0 and prints usage/options without network access.

## Task 6: Performance Report

**Files:**
- Create: `docs/performance-report.md`

- [x] **Step 1: Add report template**

Document prerequisites, demo seed/load commands, health metric definitions, a fill-in result table, and the process-local scope statement.

- [x] **Step 2: Review for scope**

Confirm the report does not claim Redis Pub/Sub, multi-instance aggregation, or production-grade monitoring.

## Task 7: Final Verification and Workflow Closeout

**Files:**
- Modify: `openspec/changes/perf-observability/tasks.md`
- Modify: `docs/superpowers/plans/2026-06-01-perf-observability.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-01.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`
- Modify after archive: `openspec/specs/observability-health/spec.md`

- [x] **Step 1: Run full verification**

Run:

```bash
cd backend && /Users/vivix/.local/go/bin/go test ./...
node scripts/load-auction.mjs --help
npx -y @fission-ai/openspec@latest validate perf-observability --strict --no-interactive
npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive
git diff --check
```

- [x] **Step 2: Archive OpenSpec change if implementation is accepted by verification**

Run:

```bash
npx -y @fission-ai/openspec@latest archive perf-observability --yes
npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive
```

- [x] **Step 3: Update tasks, plan, and memory**

Record actual verification commands/results in OpenSpec tasks, this plan, and memory.

- [x] **Step 4: Commit and push**

Run:

```bash
git status --short
git add backend/internal/service/auction_metrics.go backend/internal/service/auction_metrics_test.go backend/internal/service/health_service.go backend/internal/service/health_service_test.go backend/internal/service/auction_service.go backend/internal/service/auction_service_test.go backend/internal/handler/health_handler_test.go backend/cmd/server/main.go scripts/load-auction.mjs docs/performance-report.md docs/superpowers/specs/2026-06-01-perf-observability-exploration.md docs/superpowers/plans/2026-06-01-perf-observability.md openspec projects/proj-1779447357476-ryiijf/memory
git commit -m "feat(observability): add auction performance metrics"
git push origin codex/perf-observability
```
