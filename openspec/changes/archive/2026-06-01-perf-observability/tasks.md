# Tasks: perf-observability

- [x] 1. Preflight, exploration, and OpenSpec lock
  - Read `AGENTS.md`, `requirements-v3.md`, `auction-engine`, `realtime-live-room`, and `observability-health` specs.
  - Inspect branch status and report unrelated dirty files before editing.
  - Review existing `bids` / `orders` migrations, models, repository/service code, and tests as required by AGENTS preflight.
  - Confirm Superpowers and OpenSpec availability.
  - Create `docs/superpowers/specs/2026-06-01-perf-observability-exploration.md`.
  - Create this OpenSpec change and validate it strictly.
  - Current status: preflight completed with a clean worktree, required docs/specs and bids/orders files reviewed, exploration and OpenSpec change created, and strict validation passed.
  - Verification: `npx -y @fission-ai/openspec@latest validate perf-observability --strict --no-interactive`.

- [x] 2. Generate Superpowers execution plan
  - Create `docs/superpowers/plans/2026-06-01-perf-observability.md`.
  - Include exact files, TDD slices, route/health wiring, script behavior, docs, final verification, memory, commit, and push steps.
  - Current status: execution plan created and self-reviewed against the OpenSpec delta.

- [x] 3. Metrics collector and health response contract
  - Add a process-local, concurrency-safe auction metrics collector.
  - Extend service health stats and JSON response types with bid metrics and current WebSocket connection count.
  - Add focused tests for snapshot calculations and health response mapping.
  - Current status: `AuctionMetrics` added with atomic counters and health response fields mapped.
  - Verification: `cd backend && REDIS_ADDR=127.0.0.1:16379 /Users/vivix/.local/go/bin/go test -count=1 ./internal/service ./internal/handler -run 'TestAuctionMetrics|TestAuctionServiceRecords|TestHealth'`.

- [x] 4. Bid and lock instrumentation
  - Inject the metrics collector into `AuctionService`.
  - Record bid request total, success/failure totals, average latency, and lock-busy outcomes without changing bid semantics.
  - Add focused tests that observe successful/failing request classification and lock-busy counting.
  - Current status: `AuctionService` records user bid attempts after role validation, classifies final success/failure, and counts `ErrAuctionLockBusy`.
  - Verification: focused service tests passed after RED failures for missing collector/constructor/hooks.

- [x] 5. Server wiring
  - Wire one metrics collector into the main auction service and health stats provider.
  - Preserve existing constructors for tests and other callers.
  - Add or update tests proving `/healthz` exposes the new fields.
  - Current status: `cmd/server` shares one collector between `AuctionService` and `/healthz`; existing constructors still default a collector.
  - Verification: `cd backend && REDIS_ADDR=127.0.0.1:16379 /Users/vivix/.local/go/bin/go test -count=1 ./cmd/server ./internal/service ./internal/handler`.

- [x] 6. Local load script
  - Add `scripts/load-auction.mjs`.
  - Support `--help` without a running backend.
  - Support configurable REST bid load and optional WebSocket connections.
  - Smoke test the help output.
  - Current status: script added with configurable base URL, auction id, tokens, request count, concurrency, bid amount sequence, and optional WebSocket connections.
  - Verification: `node scripts/load-auction.mjs --help`.

- [x] 7. Performance report template
  - Add `docs/performance-report.md`.
  - Document setup, load-script usage, metric meanings, result table, and demo narrative.
  - Current status: report template added with scope statement that excludes Redis Pub/Sub, multi-instance aggregation, and production monitoring claims.

- [x] 8. Final verification, archive, memory, commit, and push
  - Run `cd backend && /Users/vivix/.local/go/bin/go test ./...`.
  - Run `node scripts/load-auction.mjs --help`.
  - Run `npx -y @fission-ai/openspec@latest validate perf-observability --strict --no-interactive` before archive.
  - Archive or otherwise update persistent OpenSpec specs, then run `npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive`.
  - Run `git diff --check`.
  - Update OpenSpec tasks, Superpowers plan, and project memory with verification results.
  - Commit and push the verified slice.
  - Current status: final verification passed, memory updated, and OpenSpec change archived as `openspec/changes/archive/2026-06-01-perf-observability/`. Commit and push state is reported in the final response.
  - Verification:
    - `cd backend && /Users/vivix/.local/go/bin/go test ./...`
    - `node scripts/load-auction.mjs --help`
    - `npx -y @fission-ai/openspec@latest validate perf-observability --strict --no-interactive`
    - `npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive`
    - `git diff --check`
