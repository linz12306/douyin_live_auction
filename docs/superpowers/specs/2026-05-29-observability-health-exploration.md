# observability-health Exploration

> Date: 2026-05-29
> Change id: `observability-health`
> Workflow: Superpowers exploration -> OpenSpec lock -> Superpowers execution -> verification/archive -> memory

## Preflight

- Branch/worktree: `/Users/vivix/Documents/Codex/douyin_live_auction_worktrees/observability-health`, branch `codex/observability-health`.
- Dirty files before planning: none.
- Requirements authority: `projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`.
- Existing specs reviewed: `auction-engine`, `realtime-live-room`, and `order-system`.
- Existing plans/memory reviewed: auction engine, realtime room, order system, daily memory, and long-term memory.
- OpenSpec CLI: repo-local binary is not on `PATH`, but `npx -y @fission-ai/openspec@latest` is available. Existing persistent specs validated with `npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive`.
- Superpowers skills: available from the installed Superpowers plugin; this exploration follows the repo-local AGENTS workflow.
- Required bids/orders review: `backend/migrations/006_create_bids.sql`, `backend/migrations/007_create_orders.sql`, `backend/internal/model/bid.go`, `backend/internal/model/order.go`, `backend/internal/repository/auction_engine_repo.go`, and order service/handler files were reviewed for context. This change does not modify bid/order schema or semantics.

This is full workflow rather than fast lane because it adds a public operational endpoint and defines health semantics for DB, Redis, and the auction engine.

## Goal

Add an unauthenticated `GET /healthz` endpoint that lets judges and operators verify whether the backend process can reach MySQL, Redis, and the in-process auction engine/realtime components.

## Non-goals

- Do not add Prometheus, OpenTelemetry, tracing, dashboards, or external log shipping.
- Do not change auction bidding, settlement, wallet, order, or WebSocket business semantics.
- Do not add database migrations.
- Do not expose secrets, DSNs, Redis passwords, stack traces, or detailed internal SQL errors.
- Do not require authentication for `/healthz`; this endpoint is intentionally demo/operator visible.

## Users

- Judges and demo operators checking whether the system is ready.
- Developers running local smoke tests before E2E.
- Future deployment health probes.

## Scenarios

- All dependencies are healthy: `/healthz` returns HTTP 200 and body status `ok`.
- MySQL ping fails: `/healthz` returns HTTP 503, body status `degraded`, DB component status `down`, and Redis/engine components still report their own state.
- Redis ping fails: `/healthz` returns HTTP 503, body status `degraded`, Redis component status `down`, and DB/engine components still report their own state.
- Auction engine process components are constructed: `/healthz` includes engine status `ok` with basic in-process stats.
- Auction event bus drops messages because subscribers are slow: `/healthz` remains available and exposes the dropped-event count as an engine/realtime stat, not as a business failure.

## Acceptance Criteria

- `GET /healthz` is registered outside `/api/v1` and requires no JWT.
- Response JSON includes:
  - top-level `status`, `checked_at`, and `components`.
  - component entries for `db`, `redis`, and `auction_engine`.
- DB and Redis checks use short context timeouts and do not hang the request path.
- HTTP 200 is returned only when required components are healthy.
- HTTP 503 is returned when DB or Redis health is down.
- Engine health is based on local construction/runtime state and includes lightweight stats from the in-memory realtime layer when available.
- Backend tests cover healthy and degraded responses without requiring new schema.
- Final verification includes backend tests, OpenSpec strict validation, and a manual/interface validation of `/healthz`.

## Approach Options

### Option A: Minimal health handler with direct dependency checks

Create a small health service/handler that receives `*sql.DB`, `*redis.Client`, and an engine checker. The handler calls `db.PingContext`, `redis.Ping`, and a lightweight auction-engine checker with short timeouts.

Pros:
- Smallest coherent patch.
- Fits existing Gin handler/service style.
- Easy to unit/integration test with fake checkers.

Cons:
- Metrics remain limited to the health response.

### Option B: Add a full metrics registry now

Add a metrics package, counters, and a `/metrics`-like surface.

Pros:
- Better foundation for future dashboards.

Cons:
- Larger surface area than required.
- Higher risk of mixing observability instrumentation into auction logic before it is needed.

### Option C: Only expose process liveness

Return `ok` whenever the process is running.

Pros:
- Very small.

Cons:
- Does not satisfy requirements because it omits DB, Redis, and auction-engine health.

Recommended: Option A, with a small metrics/stat entry for the realtime event bus dropped-event count and connected room/client counts if those are cheap to expose.

## Technical Direction

- Add `backend/internal/service/health_service.go` for dependency checks and response data construction.
- Add `backend/internal/handler/health_handler.go` for HTTP status mapping.
- Add minimal runtime stats methods to realtime Hub/event bus only if needed for the engine component; avoid changing message delivery semantics.
- Wire `GET /healthz` in `backend/cmd/server/main.go` after dependencies are constructed.
- Keep response fields stable and modest:

```json
{
  "status": "ok",
  "checked_at": "2026-05-29T10:00:00Z",
  "components": {
    "db": {"status": "ok", "latency_ms": 1},
    "redis": {"status": "ok", "latency_ms": 1},
    "auction_engine": {
      "status": "ok",
      "active_rooms": 0,
      "connected_clients": 0,
      "dropped_events": 0
    }
  }
}
```

For degraded components, return a short sanitized `message` such as `ping failed`; do not return raw DSNs or backend error text.

## Risks

- Health checks can become slow if dependency pings lack timeouts. Mitigation: per-component timeout.
- Exposing raw errors can leak infrastructure details. Mitigation: sanitized messages only.
- Over-expanding into metrics can delay core demo work. Mitigation: only expose stats already available in memory or trivial to count safely.
- Integration tests may depend on local MySQL/Redis. Mitigation: handler/service tests should use fakes where possible; run existing backend integration suite in final verification as requested.

## Subagent Scheduling

No parallel subagents are planned. The change touches `cmd/server`, health handler/service, and small realtime stats; dependencies are sequential and the write scope is small.
