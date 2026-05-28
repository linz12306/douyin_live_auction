# Tasks: auction-engine-mvp

- [x] 1. Preflight and reconcile partial work
  - Verified `006_create_bids.sql`, `007_create_orders.sql`, `model/bid.go`, and `model/order.go` are being incorporated into this OpenSpec change instead of treated as unrelated work.
  - Verification: OpenSpec validation passed on 2026-05-27; remote implementation started from this change.

- [x] 2. Schema and models
  - Finalize bids/orders schema, auction fields needed by settlement, and model structs.
  - Current status: bids/orders migrations and models exist; local MySQL migrations apply cleanly and Go packages compile.
  - Verification: migrations apply cleanly to a fresh MySQL database; Go model package compiles.

- [x] 3. Wallet repository operations
  - Add transactional freeze, unfreeze, and deduct operations against `users.balance` and `users.frozen_amount`.
  - Current status: freeze, insufficient balance, outbid unfreeze, cancellation unfreeze, and ceiling deduct are covered by integration tests.
  - Verification: unit/integration tests cover insufficient balance, freeze, unfreeze, and deduct.

- [x] 4. Auction repository operations
  - Add active bid lookup, bid insert, bid status update, ranking query, state update, and order creation helpers.
  - Current status: active bid replacement, rankings, cancellation helpers, order creation, and repeated post-settlement bid rejection are covered by integration tests.
  - Verification: repository tests cover ranking order, previous-bid replacement, and order uniqueness.

- [x] 5. Auction service bidding flow
  - Implement bid validation, Redis lock usage, DB transaction, previous bidder unfreeze, new bidder freeze, Soft Close, ceiling settlement, and audit logs.
  - Current status: valid bid, too-low bid, wrong state, insufficient balance, outbid unfreeze, Soft Close, Redis lock contention, ceiling settlement, and order creation are covered by integration tests.
  - Verification: service tests cover valid bid, too-low bid, wrong state, insufficient balance, outbid unfreeze, Soft Close, and ceiling price.

- [x] 6. Auction state transitions and cancellation
  - Implement pending activation, ended_sold, ended_no_bid, merchant cancellation, and cancellation restrictions.
  - Current status: pending activation, time-based ended_sold, ended_no_bid, merchant cancellation, recent-bid active cancellation blocking, and active cancellation unfreeze are implemented and tested.
  - Verification: state-machine tests cover every allowed and rejected transition.

- [x] 7. HTTP handlers and routes
  - Add `POST /api/v1/auctions/:id/bid`, `GET /api/v1/auctions/:id/rankings`, `POST /api/v1/auctions/:id/activate`, and `DELETE /api/v1/auctions/:id` routes with role guards.
  - Current status: bid, ranking, activation, and cancellation routes are wired; integration tests cover success paths and representative error responses.
  - Verification: handler/integration tests cover success and error responses.

- [x] 8. End-to-end backend validation
  - Exercise register -> create product -> publish auction -> activate -> bid -> outbid -> settle -> order flow.
  - Current status: full auction engine end-to-end integration test passes locally with MySQL/Redis, and `go test ./...` passes.
  - Verification: `go test ./...` plus focused auction integration tests pass.

- [x] 9. Documentation and memory
  - Update Superpowers plan, OpenSpec tasks, and project memory with final state and next step.
  - Current status: task status, Superpowers plan, current source-of-truth, and progress memory are updated for this implementation slice.
  - Verification: final report lists commands run and any skipped validation.
