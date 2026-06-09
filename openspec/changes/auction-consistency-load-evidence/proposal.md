# Proposal: auction-consistency-load-evidence

## Why

The MVP already has the core single-process auction path: Redis bid lock, MySQL row locks and transactions, wallet freeze/unfreeze, order handoff, WebSocket rooms, health metrics, and a local load script. The remaining gap for scoring is evidence. Reviewers need to see that the single-instance path preserves consistency under concurrent bidding, that duplicate client retries do not double-freeze or double-insert bids, and that local load output can be recorded in a clear report.

## What Changes

- Add durable optional bid idempotency for repeated client submissions.
- Expose Redis bid-lock degradation count through `/healthz`.
- Add backend integration tests for concurrent bidding invariants, unique settlement/order creation, and refund idempotency.
- Enhance `scripts/load-auction.mjs` with latency percentiles, optional demo login, and optional final-state verification.
- Expand `docs/performance-report.md` with run steps, result format, and SQL/API evidence for lock contention, WebSocket connections, latency, and成交唯一性.
- Keep multi-instance WebSocket fanout in the separate `distributed-realtime-backplane` change, now implemented with Redis Streams.

## Compatibility Decisions

- Existing `POST /api/v1/auctions/:id/bid` requests without an idempotency key keep current behavior.
- A new optional `X-Idempotency-Key` header is accepted for bid placement.
- Existing WebSocket message contracts are unchanged.
- Existing health fields are preserved; one new auction-engine metric is added.
- No frontend UI changes are required for this slice.

## Impact

- Backend:
  - Add one migration for bid idempotency records.
  - Extend auction DTO/handler/service/repository code.
  - Extend auction metrics and health response.
  - Add integration coverage for concurrency invariants.
- Tooling/docs:
  - Enhance local load script output and verification.
  - Update performance report instructions and result table.
- OpenSpec/Superpowers:
  - Add exploration, change files, and implementation plan.

## Out Of Scope

- Multi-instance metric aggregation.
- Cloud deployment.
- Prometheus/Grafana.
- Changes to pricing, Soft Close, settlement state machine, order statuses, or frontend realtime source-of-truth behavior.
