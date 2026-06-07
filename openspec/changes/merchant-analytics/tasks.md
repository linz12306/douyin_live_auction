# Tasks: merchant-analytics

- [x] 1. Exploration and OpenSpec lock
  - Read `AGENTS.md`, `requirements-v3.md`, current source-of-truth, frontend roadmap, merchant dashboard spec, dashboard frontend/backend code, dashboard tests, and bids/orders schema.
  - Confirm with the user that `merchant-analytics` is next and that missing API data should be handled by a read-only dashboard response extension.
  - Create `docs/superpowers/specs/2026-06-02-merchant-analytics-exploration.md`.
  - Create OpenSpec change files under `openspec/changes/merchant-analytics/`.
  - Run `npx -y @fission-ai/openspec@latest validate merchant-analytics --strict --no-interactive`.
  - Run `git diff --check`.
  - Verification:
    - `npx -y @fission-ai/openspec@latest validate merchant-analytics --strict --no-interactive` passed.
    - `git diff --check` passed.

- [x] 2. Superpowers execution plan
  - Create `docs/superpowers/plans/2026-06-02-merchant-analytics.md`.
  - Break implementation into backend API, frontend charts, verification, memory, commit, and push.

- [x] 3. Backend analytics API
  - Extend `backend/internal/dto/dashboard.go` with analytics DTOs.
  - Extend `backend/internal/repository/merchant_dashboard_repo.go` with transaction trend, bid distribution, and user activity aggregate methods.
  - Extend `backend/internal/service/merchant_dashboard_service.go` with analytics mapping, zero-filled day ranges, and normalized buckets.
  - Extend `backend/tests/integration/merchant_dashboard_test.go` to cover analytics scoping and bucket/day shape.

- [x] 4. Frontend analytics charts
  - Extend `frontend/src/types/dashboard.ts` with analytics types.
  - Extend `frontend/src/pages/merchant/Dashboard.tsx` with transaction trend, bid distribution, and user activity chart sections.
  - Preserve summary metrics, status buckets, active auctions, recent orders, loading, error, and navigation.
  - Add populated and zero-data analytics coverage in `Dashboard.test.tsx`.

- [x] 5. Verification
  - Run focused backend dashboard integration tests.
  - Run focused frontend dashboard tests.
  - Run `cd frontend && npm run test`.
  - Run `cd frontend && npm run build`.
  - Run `npx -y @fission-ai/openspec@latest validate merchant-analytics --strict --no-interactive`.
  - Run `git diff --check`.
  - Verification:
    - `REDIS_ADDR=127.0.0.1:16379 go test ./tests/integration -run TestMerchantDashboard -count=1` passed.
    - `cd frontend && npm run test -- Dashboard` passed.
    - `cd frontend && npm run test` passed with 61 tests.
    - `cd frontend && npm run build` passed.
    - Browser smoke check with mocked merchant auth/dashboard API passed and saved `/tmp/merchant-analytics-dashboard.png`.
    - `npx -y @fission-ai/openspec@latest validate merchant-analytics --strict --no-interactive` passed.
    - `git diff --check` passed.

- [ ] 6. Finalize, commit, and push
  - Synchronize OpenSpec task checkboxes and Superpowers plan.
  - Update project memory.
  - Commit a verified slice.
  - Push `codex/merchant-analytics-dashboard`.
