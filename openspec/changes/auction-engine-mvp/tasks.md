# Tasks: auction-engine-mvp

- [ ] 1. Preflight and reconcile partial work
  - Verify `006_create_bids.sql`, `007_create_orders.sql`, `model/bid.go`, and `model/order.go` match this change; revise or replace them through this change if needed.
  - Verification: review diff and run OpenSpec validation before coding.

- [ ] 2. Schema and models
  - Finalize bids/orders schema, auction fields needed by settlement, and model structs.
  - Verification: migrations apply cleanly to a fresh MySQL database; Go model package compiles.

- [ ] 3. Wallet repository operations
  - Add transactional freeze, unfreeze, and deduct operations against `users.balance` and `users.frozen_amount`.
  - Verification: unit/integration tests cover insufficient balance, freeze, unfreeze, and deduct.

- [ ] 4. Auction repository operations
  - Add active bid lookup, bid insert, bid status update, ranking query, state update, and order creation helpers.
  - Verification: repository tests cover ranking order, previous-bid replacement, and order uniqueness.

- [ ] 5. Auction service bidding flow
  - Implement bid validation, Redis lock usage, DB transaction, previous bidder unfreeze, new bidder freeze, Soft Close, ceiling settlement, and audit logs.
  - Verification: service tests cover valid bid, too-low bid, wrong state, insufficient balance, outbid unfreeze, Soft Close, and ceiling price.

- [ ] 6. Auction state transitions and cancellation
  - Implement pending activation, ended_sold, ended_no_bid, merchant cancellation, and cancellation restrictions.
  - Verification: state-machine tests cover every allowed and rejected transition.

- [ ] 7. HTTP handlers and routes
  - Add `POST /api/v1/auctions/:id/bid`, `GET /api/v1/auctions/:id/rankings`, and `DELETE /api/v1/auctions/:id` routes with role guards.
  - Verification: handler/integration tests cover success and error responses.

- [ ] 8. End-to-end backend validation
  - Exercise register -> create product -> publish auction -> activate -> bid -> outbid -> settle -> order flow.
  - Verification: `go test ./...` plus focused auction integration tests pass.

- [ ] 9. Documentation and memory
  - Update Superpowers plan, OpenSpec tasks, and project memory with final state and next step.
  - Verification: final report lists commands run and any skipped validation.
