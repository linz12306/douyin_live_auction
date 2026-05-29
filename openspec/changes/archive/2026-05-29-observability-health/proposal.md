# Proposal: observability-health

## Why

Requirements v3 calls for a `/healthz` endpoint that reports backend component health for DB, Redis, and the auction engine. The current backend starts MySQL, Redis, auction service, realtime hub, settlement worker, and order timeout worker, but it has no unauthenticated operational endpoint for judges or local smoke tests to confirm readiness.

Without this endpoint, demo verification requires exercising business APIs and cannot distinguish a database outage, Redis outage, or missing in-process auction runtime.

## What Changes

- Add `GET /healthz` outside `/api/v1` and without JWT.
- Report top-level health status plus component states for:
  - MySQL DB
  - Redis
  - auction engine / realtime runtime
- Use short timeouts for dependency pings.
- Return HTTP 200 when all required components are healthy.
- Return HTTP 503 when DB or Redis is down, while still reporting all component statuses.
- Include lightweight auction runtime stats when available, such as active rooms, connected clients, and dropped realtime events.
- Add focused backend tests for healthy and degraded responses.

## Impact

- Backend:
  - New health DTO/service/handler code or equivalent focused module.
  - Route registration in `backend/cmd/server/main.go`.
  - Small realtime stats accessor if required.
  - Focused tests.
- Frontend: no changes.
- Schema: no migrations.
- Operations: `/healthz` becomes suitable for demo smoke checks and future health probes.

## Out Of Scope

- Prometheus/OpenTelemetry/tracing/exporter setup.
- Persistent metrics storage.
- Dashboard UI.
- Alerting.
- Changes to auction, bid, wallet, order, or WebSocket business behavior.
- New database tables or migrations.
