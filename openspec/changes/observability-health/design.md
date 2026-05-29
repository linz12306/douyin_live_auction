# Design: observability-health

## Technical Approach

Add a focused health module that follows the existing Go/Gin layering:

- `service.HealthService` owns dependency checks and response assembly.
- `handler.HealthHandler` owns HTTP mapping and JSON response.
- `cmd/server/main.go` wires the service after DB, Redis, auction service, event bus, and hub are constructed.

The endpoint is intentionally outside `/api/v1`:

- `GET /healthz`
- no authentication
- response uses a direct health JSON shape rather than the normal business API wrapper, because health probes benefit from a stable operational body.

## Health Model

Top-level status values:

- `ok`: every required component is healthy.
- `degraded`: at least one required component is down.

Component status values:

- `ok`: component check succeeded.
- `down`: required component check failed.

Required components:

- `db`
- `redis`
- `auction_engine`

DB health:

- Call `db.PingContext` with a short timeout.
- Record latency in milliseconds.
- On failure, return sanitized message `ping failed`.

Redis health:

- Call `redis.Ping(ctx)` with a short timeout.
- Record latency in milliseconds.
- On failure, return sanitized message `ping failed`.

Auction engine health:

- Treat the engine as healthy when the auction service and realtime runtime dependencies are constructed.
- Include lightweight in-process stats:
  - active realtime rooms
  - connected realtime clients
  - dropped realtime events
- Do not inspect or mutate auction business state.

## Response Contract

Healthy response:

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

Degraded response:

```json
{
  "status": "degraded",
  "checked_at": "2026-05-29T10:00:00Z",
  "components": {
    "db": {"status": "down", "latency_ms": 0, "message": "ping failed"},
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

HTTP mapping:

- `200 OK` when top-level status is `ok`.
- `503 Service Unavailable` when top-level status is `degraded`.

## Structured Logging / Metrics Scope

This change should not introduce broad structured logging because the current backend uses the standard library `log` and adding zerolog everywhere would be a larger cross-cutting change.

The narrow metrics entry point is the health response's auction runtime stats. This keeps the implementation useful for demos without adding exporters, global registries, or business-path instrumentation.

## Tests

Backend focused tests:

- Healthy health service returns `ok` and all component entries.
- DB ping failure returns top-level `degraded`, DB `down`, HTTP 503, and sanitized message.
- Redis ping failure returns top-level `degraded`, Redis `down`, HTTP 503, and sanitized message.
- Auction engine runtime stats are included without requiring DB rows or Redis keys.
- `/healthz` route is unauthenticated.

Final verification:

- `cd backend && /Users/vivix/.local/go/bin/go test ./...`
- `npx -y @fission-ai/openspec@latest validate observability-health --strict --no-interactive`
- `npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive`
- manual/interface validation of `/healthz` against a running backend or equivalent `httptest` route verification.

## Risks And Mitigations

- Dependency ping hangs the request: use per-component context timeouts.
- Health endpoint leaks implementation detail: return short sanitized messages instead of raw errors.
- Runtime stats cause data races: expose stats through realtime package methods protected by existing locks/atomics.
- Scope creep into full observability: keep logging/metrics additions limited to the endpoint and trivial runtime stats.
