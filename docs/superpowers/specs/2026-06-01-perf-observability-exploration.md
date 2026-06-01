# perf-observability Exploration

> Date: 2026-06-01
> Change id: `perf-observability`
> Workflow: Superpowers exploration -> OpenSpec lock -> Superpowers execution -> verification/archive -> memory

## Preflight

- Branch/worktree: `/Users/vivix/Documents/Codex/douyin_live_auction_worktrees/perf-observability`, branch `codex/perf-observability`.
- Dirty files before planning: none.
- Requirements authority: `projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`.
- Required specs reviewed: `openspec/specs/auction-engine/spec.md`, `openspec/specs/realtime-live-room/spec.md`, and `openspec/specs/observability-health/spec.md`.
- Additional context reviewed: `projects/proj-1779447357476-ryiijf/outputs/current-source-of-truth.md`, `projects/proj-1779447357476-ryiijf/project.md`, existing observability-health exploration/plan/archive, current memory, auction service, health service, realtime hub/event bus, server wiring, and demo seed script.
- OpenSpec CLI: `npx -y @fission-ai/openspec@latest` is available. Baseline persistent spec validation passed with `npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive`.
- Superpowers skills: available from the installed Superpowers plugin; this exploration follows the repo-local AGENTS workflow.
- Required bids/orders review: `backend/migrations/006_create_bids.sql`, `backend/migrations/007_create_orders.sql`, `backend/internal/model/bid.go`, `backend/internal/model/order.go`, `backend/internal/repository/auction_engine_repo.go`, and related service code were reviewed. This change does not alter bid/order schema or settlement semantics.

This change uses the full workflow because it touches observability, auction engine instrumentation, WebSocket runtime counters, and public acceptance evidence.

## Goal

Make high-concurrency and observability evidence visible to judges without a large architecture change. The backend should expose lightweight in-memory auction-engine metrics through `/healthz`, and the repo should include a local load script plus a report template that explains how to demonstrate request volume, success rate, average latency, lock contention, and WebSocket connection count.

## Non-goals

- Do not introduce Prometheus, OpenTelemetry, external dashboards, Redis Pub/Sub, or multi-instance coordination.
- Do not change bid validation, wallet freeze/unfreeze, settlement, order, or realtime message semantics.
- Do not add database migrations.
- Do not add a new public endpoint unless the OpenSpec delta is updated first. The preferred path is to extend `/healthz`.
- Do not make the load script depend on browser automation or frontend UI state.

## Users

- Judges evaluating high-concurrency and observability proof.
- Demo operators running local smoke/load checks.
- Developers checking whether bid and WebSocket paths remain healthy after changes.

## Scenarios

- A judge calls `/healthz` during a demo and sees DB/Redis health plus auction-engine metrics for bid request totals, success/failure counts, success rate, average latency, lock-busy count, WebSocket connections, active rooms, and dropped realtime events.
- A developer runs `node scripts/load-auction.mjs --help` and sees documented options for base URL, auction id, token, concurrency, requests, bid amount range, and WebSocket connections.
- A demo operator runs the load script against a prepared local auction. The script opens optional WebSocket connections, sends concurrent bid requests with user tokens, prints a summary, and tells the operator to compare it with `/healthz`.
- A reader opens `docs/performance-report.md` and can explain each metric and how to fill in demo results.

## Acceptance Criteria

- `/healthz` remains unauthenticated and includes the existing DB, Redis, and auction_engine component structure.
- `components.auction_engine` additionally includes:
  - `bid_requests_total`
  - `bid_success_total`
  - `bid_failure_total`
  - `bid_success_rate`
  - `bid_avg_latency_ms`
  - `bid_lock_busy_total`
  - `ws_connections_current`
- Bid metrics are process-local, concurrency-safe, and reset on backend restart.
- Bid request metrics count every user-role `PlaceBid` attempt after role validation starts; success/failure counters classify the final result.
- Lock-busy metrics increase when Redis `SETNX` reports the bid lock is already held.
- WebSocket current connections come from the existing realtime hub state.
- `scripts/load-auction.mjs` supports `--help` without network access and provides a local concurrent bid/WebSocket smoke path.
- `docs/performance-report.md` records run commands, metric meanings, and a concise demo narrative.
- Final verification includes backend tests, load-script help smoke, strict OpenSpec specs validation, and `git diff --check`.

## Approach Options

### Option A: Extend existing health stats with in-memory metrics

Add a focused process-local metrics type in the service layer, inject it into `AuctionService`, and merge its snapshot into the existing `EngineStats` returned by `/healthz`.

Pros:
- Smallest coherent patch.
- No new infrastructure or endpoint.
- Fits current `HealthService` and `EngineStatsProvider` design.

Cons:
- Metrics are process-local and reset on restart.
- Multi-instance aggregation remains out of scope.

### Option B: Add a separate metrics endpoint

Add `GET /metrics` or `GET /api/v1/metrics` with the same counters.

Pros:
- Separates health from metrics.

Cons:
- Adds public surface area and more OpenSpec scope than needed.
- Requires extra route tests and demo explanation.

### Option C: Only provide a load script and report

Keep backend unchanged and rely on client-side measurements.

Pros:
- Minimal backend risk.

Cons:
- Does not satisfy the requirement to show backend bid request volume, success rate, lock contention, and WebSocket connection count.

Recommended: Option A.

## Technical Direction

- Create `backend/internal/service/auction_metrics.go` with atomic counters and a latency accumulator.
- Extend `service.EngineStats` and `AuctionEngineComponent` with JSON fields for bid metrics and `ws_connections_current`.
- Update main server wiring so the same metrics collector is passed to `AuctionService` and the health stats provider.
- Instrument `AuctionService.PlaceBid` at the outer boundary and `acquireBidLock` for lock-busy errors.
- Keep `NewAuctionService` and existing tests working by defaulting to an internal metrics collector when none is supplied.
- Add tests around metrics snapshots, successful/failing bid recording, and health JSON mapping.
- Add `scripts/load-auction.mjs` using only Node built-ins plus optional global WebSocket support when available. `--help` must not require dependencies or a running backend.
- Add `docs/performance-report.md` as a fill-in report template with exact commands and metric definitions.

## Risks

- Instrumentation can accidentally change bid semantics. Mitigation: wrap existing code and record after outcomes, without changing transaction logic.
- Average latency can race under concurrency. Mitigation: use atomic nanosecond totals and counters, then compute the snapshot.
- Load script can become a second demo setup tool. Mitigation: require caller-provided auction id and tokens; keep seeding in `scripts/demo-seed.mjs`.
- Health response can grow noisy. Mitigation: add only the requested metrics and keep names explicit.

## Subagent Scheduling

No parallel subagents are planned. The change touches shared service types, auction service construction, server wiring, and docs; sequential TDD slices reduce integration risk.
