# Design: auction-bid-command-stream

## Architecture

```text
POST /bid/async
  -> create/find auction_bid_commands row
  -> XADD auction_bid_commands {command_id, auction_id}
  -> 202 queued/current command state

worker consumer group
  -> XREADGROUP Redis Stream
  -> acquire auction:{id}:bid_command_worker_lock
  -> drain queued DB commands for auction_id ordered by id
  -> shared PlaceBid core with generated core idempotency key
  -> update command status
  -> publish bid_command private status event
  -> accepted bid core publishes existing auction_events
```

MySQL is the command status source of truth. Redis Streams is the lightweight queue and retry transport.

## API Shape

`POST /api/v1/auctions/:id/bid/async` accepts the existing bid body:

```json
{ "amount": 120 }
```

It reads optional `X-Idempotency-Key`, scoped to `(auction_id,user_id,idempotency_key)`. A new command returns HTTP `202` and a duplicate key returns the existing command state without creating another command.

`GET /api/v1/auctions/:id/bid-commands/:command_id` returns the command only when the authenticated user owns it and the auction id matches.

Command responses include:

- `command_id`
- `auction_id`
- `amount`
- `status`
- `failure_reason`
- `bid_id`
- `order_id`
- `auction_version`
- `created_at`
- `updated_at`

## Command State

Statuses:

- `queued`: created and waiting for worker processing.
- `processing`: currently owned by a worker attempt.
- `accepted`: shared bid core accepted the bid.
- `rejected`: shared bid core rejected because of business validation such as low price, closed auction, or insufficient balance.
- `failed`: infrastructure or unexpected worker failure; safe for requeue/retry policy.

The table stores both the client idempotency key and a generated `core_idempotency_key`. The generated core key is always passed to the shared bid transaction so duplicate worker deliveries replay a stored accepted result instead of mutating wallet/order state again.

## Ordering And Concurrency

Workers consume Redis Stream messages with a consumer group. Each stream message identifies an auction that may have queued work.

To preserve same-auction order, a worker must acquire `auction:{auction_id}:bid_command_worker_lock` before draining. Once acquired, it reads queued command rows for that auction ordered by command id and processes them sequentially. This makes Redis message order advisory and DB order authoritative.

Different auction ids use different locks, so workers can process different auctions concurrently.

## Shared Bid Core

Refactor the existing `PlaceBid` flow into:

- synchronous wrapper: keeps role check, optional client idempotency, metrics, and Redis fail-fast bid lock.
- shared core: performs auction validation, row locks, wallet freeze/unfreeze, bid insertion, settlement/order creation, idempotency replay/storage, audit logs, and realtime event construction.
- async worker wrapper: calls the shared core with the command's generated core idempotency key and without the outer Redis fail-fast bid lock.

MySQL row locks remain the consistency guard when sync and async paths race.

## Realtime

Accepted bids continue publishing committed auction events to `auction_events`. The existing WebSocket messages remain unchanged:

- `price_update`
- `outbid`
- `extended`
- `auction_end`

Add private `bid_command` realtime messages for the command owner. Payload includes command id, status, amount, failure reason, bid id, order id, and auction version where available.

Queued command status is returned directly by the async HTTP response and stored in MySQL. To keep the shared realtime backplane from being flooded by one event per enqueue during load spikes, the first implementation does not need to broadcast every `queued` status over `auction_events`. Worker-owned state changes (`processing`, `accepted`, `rejected`, `failed`) remain eligible for private realtime delivery because they represent asynchronous progress after the HTTP response.

The Redis Streams realtime backplane must also tolerate short bursts without dropping subscriber events in normal local load-test ranges. Each backend subscriber keeps an enlarged local buffer so the stream reader can drain Redis quickly while the Hub serializes snapshots and WebSocket writes. This protects committed `price_update`, `outbid`, `extended`, `auction_end`, and private command-result messages from avoidable process-local drops.

## Observability And Load Evidence

Expose lightweight command metrics through `/healthz`, including enqueue totals, accepted/rejected/failed totals, processing total, and queue lag for queued commands.

Extend `scripts/load-auction.mjs` with `--bid-mode sync|queued`. Queued mode records HTTP enqueue success and latency separately from worker outcomes by polling command status.

`docs/performance-report.md` will present side-by-side sync lock-contention and async queued-mode evidence.

## Failure Handling

- Redis enqueue failure after DB command creation returns an error only if the command cannot be reliably woken. A retry with the same idempotency key returns the existing command and can re-enqueue it if still queued.
- Worker duplicate delivery checks DB command status before processing.
- Accepted command completion is idempotent because the shared core uses generated core idempotency.
- Rejected commands are terminal business outcomes.
- Failed infrastructure outcomes are observable and can be retried by later operational tooling; first implementation records failure and avoids hidden mutation.
