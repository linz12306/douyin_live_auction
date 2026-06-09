# Design: auction-consistency-load-evidence

## Technical Approach

Keep the current single-backend auction architecture and strengthen proof around it. The bid path remains:

```text
HTTP bid request -> optional idempotency lookup -> Redis SETNX lock -> MySQL transaction/FOR UPDATE -> commit -> realtime event publish
```

The new pieces are durable idempotency records, metrics for Redis lock degradation, stronger integration tests, and better local load evidence.

## Bid Idempotency

Clients may send `X-Idempotency-Key` on bid requests. The backend trims the key and accepts up to 128 characters. Empty keys are treated as absent.

For keyed requests:

- Scope: `(auction_id, user_id, idempotency_key)`.
- If a completed record exists, return the stored accepted bid response without creating another bid or mutating wallet balances.
- If no record exists, process the bid through the existing lock and transaction path.
- Store the successful response in the same transaction as the bid mutation.
- Failed requests are not stored, so the client can retry after validation, lock-busy, or transient errors.

The record stores enough fields to reconstruct `PlaceBidResponse`: bid id, amount, current price, highest bidder id, resulting status, extended flag, settled flag, and optional order id.

## Metrics

Add `bid_lock_degraded_total` to `AuctionMetrics`. Increment it only when Redis lock acquisition returns an error and the service falls back to DB row locking. Keep `bid_lock_busy_total` limited to `SETNX` lock contention where Redis is reachable and the lock is already held.

Expose the new field through:

- `AuctionMetricsSnapshot`
- `EngineStats`
- `/healthz` `components.auction_engine.bid_lock_degraded_total`
- performance report metric definitions

## Tests

Use existing integration helpers and MySQL test lock discipline.

Concurrency tests should assert durable invariants, not exact timing:

- One active bid remains after concurrent bidding.
- Auction current price equals the accepted maximum bid.
- Rankings first row matches auction highest bidder and amount.
- All involved user balances and frozen amounts remain non-negative.
- Ceiling settlement creates exactly one order and one won bid.
- Repeated buyer cancel and timeout processing refund only once.
- Reusing the same idempotency key returns the same bid id and does not create extra bids or change wallet totals.

## Load Script

Enhance the script without adding dependencies:

- `--login-users user:pass,user2:pass` fetches access tokens from `/api/v1/auth/login` when `--tokens` is omitted.
- Summary includes average, p50, p95, max latency, status counts, success/failure totals, and opened WS count.
- `--verify-final-state` calls existing APIs where possible and prints guidance for DB queries that cannot be safely inferred from public APIs.

## Documentation

`docs/performance-report.md` should be usable as the presenter checklist:

- local service startup commands
- seed/login/load commands
- `/healthz` before/after metrics
- result table with percentile latency
- final-state SQL for active bid count, order count, wallet non-negativity, and auction status
- explanation that cloud deployment is not required for this proof

## Risks And Mitigations

- Duplicate-key race: use a database unique key and the existing per-auction lock; on duplicate insert, reread the stored response.
- Redis outage ambiguity: record degrade metrics while preserving existing DB lock fallback behavior.
- Load script false negatives: keep final-state verification advisory and avoid assuming one exact success count under lock contention.
