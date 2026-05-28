# Design: ws-realtime-live-room

## Technical Approach

Use approach `1B`: single-instance in-memory realtime delivery now, with a replaceable event-bus boundary and explicit message versioning for future multi-instance concurrency.

The key constraint is that `AuctionService` owns business state transitions, but it must not know about WebSocket clients. It emits domain events after committed state changes. A current in-memory event bus delivers those events to a realtime hub. A future Redis Pub/Sub or Redis Stream implementation can replace the event bus without changing the auction service contract or the frontend protocol.

## Backend Architecture

Add focused backend components:

- `AuctionEventBus`: interface for publishing and subscribing to committed auction events.
- `InMemoryAuctionEventBus`: single-process implementation used in this change.
- `RealtimeHub`: manages auction rooms, connected clients, broadcasts, private user messages, ping/pong, and cleanup.
- `AuctionSnapshotProvider`: builds the initial/reconnect snapshot from persisted auction state and rankings.
- WebSocket handler: authenticates, upgrades, joins `/ws/auctions/:id`, sends `snapshot`, and streams room messages.

Suggested package boundary:

- `backend/internal/realtime` for hub, client, messages, and event-bus interfaces.
- Keep existing auction repository/service package as the source of business state.

## Event Flow

Bid flow:

1. User submits bid through existing REST endpoint `POST /api/v1/auctions/:id/bid`.
2. `AuctionService` performs the existing Redis lock and DB transaction.
3. After commit, `AuctionService` publishes domain events:
   - `bid.accepted`
   - `bid.outbid`, when a previous bidder exists
   - `auction.extended`, when Soft Close changes `ended_at`
   - `auction.ended`, when ceiling price settles the auction
4. `RealtimeHub` converts domain events to WebSocket messages.
5. Room clients receive broadcasts; previous bidder receives private `outbid`.

Settlement/cancellation flow:

1. Settlement worker or merchant cancellation changes persisted auction state.
2. `AuctionService` publishes `auction.ended` or `auction.cancelled`.
3. `RealtimeHub` broadcasts `auction_end` and disables bidding on clients.

## WebSocket API

Endpoint:

- `GET /ws/auctions/:id`

Authentication:

- The endpoint requires an authenticated user token.
- The initial implementation may accept the JWT through query string `token` because browser WebSocket APIs cannot set arbitrary auth headers.
- Token validation must reuse existing JWT config and user identity semantics.

Connection behavior:

- On connect, send a `snapshot` message immediately.
- Join the auction room after auth and auction lookup succeed.
- Send ping/pong heartbeat around every 30 seconds.
- Remove clients on close, auth failure, write failure, or heartbeat timeout.

## Message Contract

Every WebSocket message includes:

- `type`
- `auction_id`
- `version`
- `server_time`
- `payload`

MVP message types:

- `snapshot`
- `price_update`
- `extended`
- `auction_end`
- `outbid`

`version` comes from the auction row version or an equivalent monotonically increasing auction-state version. The frontend must ignore messages with a version older than the current local room state.

## Frontend Architecture

Add user-facing routes:

- `/app/auctions`: mobile-first auction lobby.
- `/app/auctions/:id`: mobile-first live auction room.

Login redirect behavior:

- role `user` redirects to `/app/auctions`.
- role `merchant` continues to redirect to `/merchant/products`.

Live room layout:

- Top simulated live ambience area.
- First viewport includes current price, countdown, and primary bid action.
- Lower content includes rankings and realtime status messages.

Bid interaction:

- Primary button displays the next required bid, such as `出价 ¥330`.
- Custom amount entry allows bids above the required next price.
- REST bid response does not directly update realtime fields.
- WebSocket messages update current price, highest bidder, rankings, countdown, extension state, and terminal state.
- REST failures show a toast-style message.

State management:

- Use a focused room state layer for realtime auction state.
- Store the latest applied `version` per auction.
- Apply `snapshot` only when it is current or newer than local state.
- Apply `price_update`, `extended`, and `auction_end` only if their version is newer.
- `outbid` may display a private notification even when it does not advance the full room state.

Countdown:

- Every message includes `server_time`.
- Client computes server offset and renders countdown from `ended_at - Date.now() + offset`.
- Countdown must not continue enabling bids after terminal state.

## Dependencies And Constraints

- Existing REST auction APIs remain the command surface for bids, activation, cancellation, and rankings.
- WebSocket is the realtime truth source after room connection.
- This change stays single-instance at runtime, but the event-bus boundary is required.
- Do not introduce order/payment UI in this change.
- Do not introduce real video streaming.

## Risks

- WebSocket auth can drift from REST auth if token validation is duplicated incorrectly.
- In-memory event bus loses events across backend restarts; reconnect snapshot mitigates this for clients.
- Settlement worker must publish terminal events after successful persistence or rooms can stay visually active.
- UI can roll back if stale messages are not ignored by version.
- Existing product list API may need filtering or shape extensions for a user-friendly lobby.

## Testing Strategy

Backend:

- Event-bus publish/subscribe tests.
- Hub tests for room broadcast and private user delivery.
- WebSocket handler tests for auth, initial snapshot, and reconnect snapshot.
- Auction service integration tests verifying events after bid, outbid, extension, ceiling settlement, time settlement, and cancellation.

Frontend:

- Room reducer/store tests for snapshot, price update, extended, auction end, outbid, and stale version ignore.
- Route/render tests for lobby and live room.
- Bid interaction tests ensuring REST success does not directly mutate realtime fields.

End-to-end:

- Merchant creates, publishes, and activates an auction.
- User A enters room and receives snapshot.
- User A bids and sees price/ranking update from WebSocket.
- User B outbids.
- User A receives `outbid`.
- Soft Close or terminal state updates the room through WebSocket.
