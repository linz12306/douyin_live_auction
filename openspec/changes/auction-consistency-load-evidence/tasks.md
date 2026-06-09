# Tasks: auction-consistency-load-evidence

- [x] 1. Exploration and OpenSpec lock
  - Read `AGENTS.md`, `requirements-v3.md`, source-of-truth, progress report, auction/order/realtime/health specs, backend auction/order/WS/load code, and performance report.
  - Create Superpowers exploration document.
  - Create OpenSpec proposal/design/tasks/spec deltas.
  - Run `npx -y @fission-ai/openspec@latest validate auction-consistency-load-evidence --strict --no-interactive`.
  - Run `git diff --check`.

- [x] 2. Superpowers execution plan
  - Create `docs/superpowers/plans/2026-06-09-auction-consistency-load-evidence.md`.
  - Break work into TDD slices for backend idempotency/metrics, concurrency tests, script/docs, verification, and memory.

- [x] 3. Backend idempotency and metrics
  - Add bid idempotency migration and repository methods.
  - Parse optional `X-Idempotency-Key` in bid handler.
  - Store and replay successful bid responses for duplicate keyed requests.
  - Add `bid_lock_degraded_total` metric and expose it through `/healthz`.
  - Add tests for replay and metric reporting.

- [x] 4. Concurrency evidence tests
  - Add concurrent bidding invariant integration test.
  - Add unique settlement/order creation integration test.
  - Add refund idempotency/reentry integration test.
  - Keep tests focused on durable invariants rather than exact scheduler timing.

- [x] 5. Load tooling and performance report
  - Enhance `scripts/load-auction.mjs` with demo login, latency percentiles, and optional final-state verification.
  - Update `docs/performance-report.md` with commands, result format, metric definitions, SQL checks, and local single-instance narrative.

- [x] 6. Distributed realtime backplane handoff
  - Create `distributed-realtime-backplane` OpenSpec change.
  - Hand multi-instance WebSocket fanout to that change; it now implements Redis Streams with independent subscribers.

- [x] 7. Verification and memory
  - Run focused backend tests.
  - Run `cd backend && REDIS_ADDR=127.0.0.1:16380 go test ./...`.
  - Run load script help.
  - Run OpenSpec strict validation for changed specs.
  - Run `git diff --check`.
  - Update project memory with implementation decisions, verification, and remaining risks.
  - Verification:
    - `REDIS_ADDR=127.0.0.1:16380 go test ./...` passed.
    - `node scripts/load-auction.mjs --help` passed.
    - `npx -y @fission-ai/openspec@latest validate auction-consistency-load-evidence --strict --no-interactive` passed.
    - `npx -y @fission-ai/openspec@latest validate distributed-realtime-backplane --strict --no-interactive` passed.
    - `npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive` passed.
    - `git diff --check` passed.
