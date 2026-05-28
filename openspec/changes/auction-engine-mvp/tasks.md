# Tasks: auction-engine-mvp

- [x] 1. Preflight and reconcile partial work
  - Verified `006_create_bids.sql`, `007_create_orders.sql`, `model/bid.go`, and `model/order.go` are being incorporated into this OpenSpec change instead of treated as unrelated work.
  - Verification: OpenSpec validation passed on 2026-05-27; remote implementation started from this change.

- [ ] 2. Schema and models
  - Finalize bids/orders schema, auction fields needed by settlement, and model structs.
  - Current status: bids/orders migrations and models exist; fresh DB migration verification is still blocked until local repository access is available.
  - Verification: migrations apply cleanly to a fresh MySQL database; Go model package compiles.

- [ ] 3. Wallet repository operations
  - Add transactional freeze, unfreeze, and deduct operations against `users.balance` and `users.frozen_amount`.
  - Current status: first-pass operations are implemented in `backend/internal/repository/auction_engine_repo.go`; tests are still required.
  - Verification: unit/integration tests cover insufficient balance, freeze, unfreeze, and deduct.

- [ ] 4. Auction repository operations
  - Add active bid lookup, bid insert, bid status update, ranking query, state update, and order creation helpers.
  - Current status: first-pass helpers are implemented, including nullable auction scan handling; repository tests are still required.
  - Verification: repository tests cover ranking order, previous-bid replacement, and order uniqueness.

- [ ] 5. Auction service bidding flow
  - Implement bid validation, Redis lock usage, DB transaction, previous bidder unfreeze, new bidder freeze, Soft Close, ceiling settlement, and audit logs.
  - Current status: first-pass bidding service is implemented; TDD coverage and edge-case validation are still required before this task can be checked off.
  - Verification: service tests cover valid bid, too-low bid, wrong state, insufficient balance, outbid unfreeze, Soft Close, and ceiling price.

- [ ] 6. Auction state transitions and cancellation
  - Implement pending activation, ended_sold, ended_no_bid, merchant cancellation, and cancellation restrictions.
  - Verification: state-machine tests cover every allowed and rejected transition.

- [ ] 7. HTTP handlers and routes
  - Add `POST /api/v1/auctions/:id/bid`, `GET /api/v1/auctions/:id/rankings`, and `DELETE /api/v1/auctions/:id` routes with role guards.
  - Current status: bid and ranking routes are wired; cancellation route remains pending.
  - Verification: handler/integration tests cover success and error responses.

- [ ] 8. End-to-end backend validation
  - Exercise register -> create product -> publish auction -> activate -> bid -> outbid -> settle -> order flow.
  - Verification: `go test ./...` plus focused auction integration tests pass.

- [ ] 9. Documentation and memory
  - Update Superpowers plan, OpenSpec tasks, and project memory with final state and next step.
  - Current status: task and Superpowers plan are being kept in sync as implementation proceeds.
  - Verification: final report lists commands run and any skipped validation.
