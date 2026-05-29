# Tasks: observability-health

- [x] 1. Preflight, exploration, and OpenSpec lock
  - Read `AGENTS.md`, current source of truth, requirements v3, progress report, existing OpenSpec specs, existing Superpowers plans, and memory.
  - Inspect branch status and confirm unrelated dirty files before editing.
  - Review existing `bids` / `orders` migrations, models, repository/service code, and tests as required by AGENTS preflight.
  - Confirm Superpowers and OpenSpec availability.
  - Create `docs/superpowers/specs/2026-05-29-observability-health-exploration.md`.
  - Create this OpenSpec change and validate it strictly.
  - Current status: preflight completed with a clean worktree, exploration and OpenSpec change created, and strict validation passed.
  - Verification: `npx -y @fission-ai/openspec@latest validate observability-health --strict --no-interactive`.

- [x] 2. Generate Superpowers execution plan
  - Create `docs/superpowers/plans/2026-05-29-observability-health.md`.
  - Include exact files, TDD slices, route wiring, interface validation, final verification, and commit points.
  - Current status: execution plan created with service, realtime stats, handler, route wiring, interface verification, memory, commit, and push slices.
  - Verification: self-review confirms every OpenSpec requirement maps to at least one implementation task.

- [x] 3. Health service contract and tests
  - Create `backend/internal/service/health_service.go`.
  - Define response structs for top-level status, checked timestamp, and component entries.
  - Define small checker interfaces so tests can inject healthy and failing DB/Redis behavior.
  - Implement per-component timeout checks and sanitized failure messages.
  - Test healthy DB/Redis/engine, DB failure, Redis failure, and engine stats inclusion.
  - Current status: health service and tests implemented with bounded DB/Redis checks, sanitized failure messages, and engine stats.
  - Verification: `cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/service -run TestHealth`.

- [x] 4. Realtime runtime stats
  - Add concurrency-safe runtime stats accessors to `backend/internal/realtime/hub.go` and `backend/internal/realtime/event_bus.go` if the health service needs them.
  - Stats must include active rooms, connected clients, and dropped events.
  - Add or extend realtime package tests for stats.
  - Current status: Hub stats accessor implemented; dropped event count reuses existing event bus counter.
  - Verification: `cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/realtime -run 'Test.*Stats|TestInMemoryAuctionEventBusDropsForSlowSubscriber'`.

- [x] 5. HTTP handler and route wiring
  - Create `backend/internal/handler/health_handler.go`.
  - Map health status `ok` to HTTP 200 and `degraded` to HTTP 503.
  - Wire `GET /healthz` in `backend/cmd/server/main.go` outside authenticated route groups.
  - Add focused handler/route tests that prove `/healthz` is unauthenticated and returns the expected status/body.
  - Current status: handler and unauthenticated top-level route are wired in `cmd/server/main.go`.
  - Verification: `cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/handler -run TestHealth`.

- [x] 6. Interface and full verification
  - Run backend full test suite.
  - Run strict OpenSpec change validation.
  - Run strict persistent spec validation.
  - Run `git diff --check`.
  - Start the backend or use an equivalent local route harness to verify `GET /healthz` returns the documented JSON shape.
  - Update OpenSpec tasks and Superpowers plan checkboxes/results.
  - Update project memory.
  - Commit and push verified slice.
  - Current status: implementation verification and final verification after memory update passed through backend full tests, OpenSpec strict checks, whitespace check, and `/healthz` interface validation on port 18081. Memory/docs commit completed. Push attempted and was blocked by the local global pre-push hook (`/tmp/douyin_live_auction_push_forbidden`).
  - Verification:
    - `cd backend && /Users/vivix/.local/go/bin/go test ./...`
    - `npx -y @fission-ai/openspec@latest validate observability-health --strict --no-interactive`
    - `npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive`
    - `git diff --check`
    - `SERVER_PORT=18081 DISABLE_RATE_LIMIT=1 /Users/vivix/.local/go/bin/go run ./cmd/server` plus `curl -s -i http://127.0.0.1:18081/healthz`
