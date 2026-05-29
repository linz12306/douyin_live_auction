# Tasks: order-system

- [x] 1. Preflight, exploration, and OpenSpec lock
  - Read `AGENTS.md`, current source-of-truth, progress report, requirements v3, auction/realtime specs, and prior Superpowers plans.
  - Inspect branch status and confirm no unrelated dirty files.
  - Review `bids` / `orders` migrations, models, auction settlement code, and relevant integration tests.
  - Confirm Superpowers and OpenSpec availability.
  - Create `docs/superpowers/specs/2026-05-29-order-system-exploration.md`.
  - Create this OpenSpec change and validate it strictly.
  - Verification: `npx -y @fission-ai/openspec@latest validate order-system --strict --no-interactive`.

- [ ] 2. Generate Superpowers execution plan
  - Create `docs/superpowers/plans/2026-05-29-order-system.md` from this OpenSpec change.
  - Include exact files, commands, TDD slices, verification, and commit points.
  - Verification: plan self-review confirms every OpenSpec requirement maps to at least one implementation task.

- [ ] 3. Backend order DTOs, repository, and service
  - Create `backend/internal/dto/order.go` with list query, list item, detail, action response, and cancel request types.
  - Create `backend/internal/repository/order_repo.go` with transaction helpers for:
    - finding an order by id with product/buyer summary
    - listing caller-scoped orders
    - locking an order for update
    - confirming, paying, cancelling, and refunding buyer balance
    - selecting expired `pending_confirm` orders
  - Create `backend/internal/service/order_service.go` with authorization and state-transition methods:
    - `ListOrders`
    - `GetOrder`
    - `ConfirmOrder`
    - `PayOrder`
    - `CancelOrder`
    - `ExpirePendingConfirmOrders`
  - Ensure confirm and pay do not change wallet fields.
  - Ensure cancellation refunds exactly once by updating only locked `pending_confirm` rows.
  - Verification: focused backend tests cover status transitions, owner checks, and wallet assertions.

- [ ] 4. Backend handlers, routes, and timeout worker
  - Create `backend/internal/handler/order_handler.go`.
  - Wire `OrderRepo`, `OrderService`, and `OrderHandler` in `backend/cmd/server/main.go`.
  - Add authenticated routes:
    - `GET /api/v1/orders`
    - `GET /api/v1/orders/:id`
    - `POST /api/v1/orders/:id/confirm`
    - `POST /api/v1/orders/:id/pay`
    - `POST /api/v1/orders/:id/cancel`
  - Start an order confirmation-timeout worker that calls `ExpirePendingConfirmOrders` about once per minute.
  - Extend integration server setup in `backend/tests/integration/auction_engine_test.go` or create `backend/tests/integration/order_system_test.go`.
  - Verification: `/Users/vivix/.local/go/bin/go test -count=1 ./tests/integration -run 'TestOrder|TestAuctionEngineEndToEndFlow'`.

- [ ] 5. User frontend order list and detail
  - Create `frontend/src/types/order.ts`.
  - Create `frontend/src/api/order.ts`.
  - Create `frontend/src/pages/app/OrderList.tsx`.
  - Create `frontend/src/pages/app/OrderDetail.tsx`.
  - Add protected user routes `/app/orders` and `/app/orders/:id` in `frontend/src/App.tsx`.
  - Add user entry points from `/app/auctions` and terminal sold state in `/app/auctions/:id`.
  - Verification: frontend tests cover rendering states and confirm/cancel/pay actions; `cd frontend && npm run build`.

- [ ] 6. Merchant frontend order list and detail
  - Create `frontend/src/pages/merchant/OrderList.tsx`.
  - Create `frontend/src/pages/merchant/OrderDetail.tsx`.
  - Add protected merchant routes `/merchant/orders` and `/merchant/orders/:id` in `frontend/src/App.tsx`.
  - Add merchant entry from the product management page.
  - Verification: frontend tests cover merchant list/detail scoping UI and `cd frontend && npm run build`.

- [ ] 7. End-to-end order workflow
  - Add or extend Playwright coverage for:
    - merchant creates, publishes, and activates an auction
    - buyer wins
    - buyer opens order list/detail
    - buyer confirms
    - buyer pays
    - final UI shows `paid`
  - Keep existing realtime E2E intact.
  - Verification: `PLAYWRIGHT_BASE_URL=<local-url> npx playwright test tests/e2e/order-system.spec.ts`.

- [ ] 8. Final verification, docs, and memory
  - Run relevant OpenSpec, backend, frontend, E2E, and whitespace verification.
  - Update this tasks file with actual results.
  - Update `docs/superpowers/plans/2026-05-29-order-system.md`.
  - Update project memory files after verified implementation.
  - Archive the OpenSpec change after acceptance.
  - Verification:
    - `npx -y @fission-ai/openspec@latest validate order-system --strict --no-interactive`
    - `npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive`
    - `cd backend && /Users/vivix/.local/go/bin/go test ./...`
    - `cd frontend && npm run build`
    - `git diff --check`
