# Design: auction-engine-mvp

## Technical Approach

Build a backend-only auction engine MVP around the current Go/Gin layered architecture: handler -> service -> repository. Keep REST APIs as the initial command/query surface. WebSocket broadcasting remains out of scope for this change, but service methods should return enough state for a later realtime layer.

Use the existing `users.balance` and `users.frozen_amount` columns for wallet state in this MVP. Do not introduce separate `wallets` or `wallet_records` tables unless this change first updates the OpenSpec design and migrations accordingly.

## Data Model

Review the already committed `bids` and `orders` migrations/models before implementation:

- Keep `bids` if it can represent active/outbid/won/cancelled bid lifecycle.
- Keep `orders` if it can represent pending_confirm -> pending_payment -> paid/cancelled lifecycle.
- Adjust schema only through this change's tasks and tests.

Auction settlement depends on `auctions.current_price`, `highest_bidder_id`, `status`, `version`, `ended_at`, and `current_extend_count`.

## Bid Transaction

`POST /api/v1/auctions/:id/bid` should execute a short critical section:

1. acquire a Redis lock `auction:{id}:bid_lock` with a short TTL when Redis is available
2. load auction and user wallet state inside a DB transaction
3. reject invalid auction state or insufficient bid amount
4. freeze the new bidder's amount
5. mark the previous active bid as outbid and unfreeze it
6. insert the new active bid
7. update auction current price, highest bidder, version, and extension fields
8. record audit logs
9. release Redis lock

If Redis is unavailable, the implementation may fall back to DB transaction + optimistic locking, but it must record/log the fallback path.

## State Machine

The MVP supports:

- `pending -> active` when the auction starts
- `active -> ended_sold` when time expires with a winning bid or ceiling price is reached
- `active -> ended_no_bid` when time expires without a bid
- `pending|active -> cancelled` by merchant, subject to cancellation rules

Soft Close extends the auction when a valid bid arrives near the end and `current_extend_count < max_extend_count`.

## API Surface

- `POST /api/v1/auctions/:id/bid` for authenticated users with role `user`
- `GET /api/v1/auctions/:id/rankings` for authenticated users
- `POST /api/v1/auctions/:id/activate` for owning merchants to move a pending auction into active state in this MVP
- `DELETE /api/v1/auctions/:id` for merchants, with cancellation reason

## Risks

- Balance inconsistency under concurrent bidding: cover with transaction tests and concurrent integration tests.
- Spec/code drift from partial files: first implementation task must audit and reconcile those files.
- Time-based behavior can be flaky: isolate time calculations where possible and test deterministic helpers.
