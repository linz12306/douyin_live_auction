# Tasks: merchant-dashboard

- [x] 1. Preflight, exploration, and OpenSpec lock
  - Read `AGENTS.md`, source-of-truth, requirements v3, progress report, and order/auction specs.
  - Review existing bids/orders files and migrations as required by `AGENTS.md`.
  - Inspect branch status and confirm unrelated dirty files.
  - Confirm Superpowers and OpenSpec availability.
  - Create `docs/superpowers/specs/2026-05-30-merchant-dashboard-exploration.md`.
  - Create this OpenSpec change.
  - Current status: preflight, exploration doc, OpenSpec change, and strict validation completed.
  - Verification: `openspec validate merchant-dashboard --strict --no-interactive` passed.

- [x] 2. Generate Superpowers execution plan
  - Create `docs/superpowers/plans/2026-05-30-merchant-dashboard.md`.
  - Include exact backend/frontend files, TDD slices, verification, and commit points.
  - Current status: execution plan created at `docs/superpowers/plans/2026-05-30-merchant-dashboard.md`.
  - Verification: plan self-review confirms every OpenSpec requirement maps to a task.

- [x] 3. Backend dashboard API
  - Add dashboard DTOs.
  - Add read-only dashboard repository aggregate queries.
  - Add dashboard service bucket normalization and transaction metric definition.
  - Add dashboard handler.
  - Wire `GET /api/v1/merchant/dashboard`.
  - Add backend integration tests for scoping, counts, completed metrics, active auctions, recent orders, and user rejection.
  - Current status: DTO, repository, service, handler, route wiring, and integration coverage completed.
  - Verification: focused dashboard integration test passed with `REDIS_ADDR=127.0.0.1:16380` and UTC MySQL DSN.

- [x] 4. Frontend dashboard page
  - Add dashboard types and API helper.
  - Add `/merchant/dashboard` page.
  - Add protected merchant route.
  - Add entry points from product management, order management, and profile.
  - Add focused frontend tests.
  - Current status: page, API helper, route, navigation links, and focused tests completed.
  - Verification: `npm run test -- Dashboard navigationAffordance`, full `npm run test`, `npm run build`, and browser smoke test at `http://127.0.0.1:5177/merchant/dashboard` passed.

- [x] 5. Final verification, docs, and memory
  - Run OpenSpec change validation and spec validation.
  - Run backend tests with `REDIS_ADDR=127.0.0.1:16380`.
  - Run frontend tests and build.
  - Run `git diff --check`.
  - Update task/plan checkboxes with actual results.
  - Update project memory.
  - Commit and push the verified slice unless blocked.
  - Current status: final validation, memory updates, commit, and push completed for the verified slice.
  - Verification:
    - `openspec validate merchant-dashboard --strict --no-interactive` passed.
    - `openspec validate --specs --strict --no-interactive` passed.
    - `cd backend && go test ./...` passed with `REDIS_ADDR=127.0.0.1:16380` and isolated local DB `auction_db_merchant_dashboard`.
    - `cd frontend && npm run test` passed.
    - `cd frontend && npm run build` passed.
    - `git diff --check` passed with line-ending warnings only.
