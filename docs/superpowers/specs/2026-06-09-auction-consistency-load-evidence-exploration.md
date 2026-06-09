# auction-consistency-load-evidence Exploration

## Goal

Prove the current single-backend auction MVP is consistent under local concurrency, make the evidence easy to demonstrate, and document the next distributed WebSocket step without implementing multi-instance realtime delivery in this slice.

## User-Facing Checkpoint

The originally confirmed direction was:

- Prioritize demo closure, local performance evidence, and backend consistency proof.
- Do not require cloud deployment before proving Redis locking, MySQL transaction safety, or local load behavior.
- Treat multi-backend WebSocket fanout as a later OpenSpec-level architecture change.
- Keep the current buyer/merchant UI behavior stable unless required for evidence collection.

The user explicitly requested: "PLEASE IMPLEMENT THIS PLAN". This document records that request as approval to proceed through the workflow for this plan in the current turn. Commit and push still require an explicit later request.

Follow-up correction on 2026-06-09: the user asked to directly switch to Redis Streams instead of leaving distributed WebSocket fanout as a future reminder. That implementation is tracked in `distributed-realtime-backplane`.

## Current State

- `AuctionService.PlaceBid` uses a per-auction Redis `SETNX` lock with a 5 second TTL, then enters a MySQL transaction.
- The bid transaction locks the auction row with `FOR UPDATE`, locks the current active bid, freezes the new bidder balance, marks the previous active bid outbid, unfreezes the previous bidder, inserts the bid, updates the auction state, handles ceiling settlement, and publishes realtime events after commit.
- Redis lock acquisition degrades to DB locking when Redis errors. The behavior exists, but it is not separately observable from normal bid processing.
- `orders.auction_id` is unique, which is the hard DB guard against duplicate orders per auction.
- Order confirmation/cancel/payment paths use `FindByIDForUpdate`, status-guarded updates, and refund on pending-confirm cancellation/timeout.
- `scripts/load-auction.mjs` can send concurrent bid traffic and open optional WebSocket connections, but it lacks percentile output, login-based token acquisition, and final-state verification.
- `docs/performance-report.md` is a template; it still needs concrete local run format and final-state query evidence.
- The WebSocket hub is process-local. It supports room isolation, snapshots, private outbid messages, heartbeat, and reconnect snapshots, but it does not broadcast across multiple backend processes.

## Non-Goals

- Do not implement Redis Pub/Sub or Streams inside the evidence/idempotency change itself; Redis Streams is handled by the follow-up `distributed-realtime-backplane` change.
- Do not require Kubernetes, cloud deployment, managed Redis, or external monitoring for the MVP evidence.
- Do not change the frontend realtime truth-source contract.
- Do not change core auction pricing rules, wallet semantics, order statuses, or settlement rules except for adding idempotency around duplicate client submissions.

## Acceptance Criteria

- Backend integration tests prove concurrent bidding leaves one active bid, correct highest price, non-negative wallets, and consistent rankings.
- Backend integration tests prove concurrent settlement/order creation cannot create duplicate orders.
- Backend integration tests prove order cancel/timeout refund paths are idempotent under concurrent/repeated processing.
- Bid requests accept an optional idempotency key and repeated same-user/same-auction/same-key submissions do not double-freeze or double-insert.
- `/healthz` exposes Redis lock degradation count separately from Redis lock-busy count.
- The local load script reports average, p50, p95, and max latency, status counts, WebSocket connections, and optional final-state verification.
- `docs/performance-report.md` explains the local run steps, metrics, result table, and SQL/API evidence for成交唯一性.
- A separate OpenSpec change covers the distributed realtime backplane; it was later promoted from design-only to Redis Streams implementation.

## Risks

- Concurrency tests can become flaky if they rely on exact success counts while Redis lock contention intentionally rejects some requests. The tests should assert invariant outcomes after concurrent traffic rather than exact accepted count.
- The current load script sends monotonically increasing bid amounts. If the seeded auction has a low ceiling, runs may settle early; documentation should instruct choosing start/step values that match the auction ceiling.
- Idempotency storage must be scoped and minimal. A database table provides durable replay protection without relying on Redis retention.
- Redis lock degrade behavior is intentionally permissive today; adding metrics should not change the fallback path.

## Technical Direction

- Add an `auction_bid_requests` table keyed by `(auction_id, user_id, idempotency_key)` to store successful idempotent bid results.
- Keep idempotency optional. Requests without a key follow the existing path.
- For keyed requests, use the existing Redis lock and DB transaction path, then persist the accepted response in the same transaction. Repeated matching keyed requests return the stored response without wallet mutation.
- Add `bid_lock_degraded_total` to in-memory auction metrics and `/healthz`.
- Extend the load script in-place, keeping Node built-ins only.
- Keep P2 distributed realtime work as design documentation and OpenSpec deltas only.
