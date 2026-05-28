# Superpowers Exploration: ws-realtime-live-room

Date: 2026-05-28
Change id: `ws-realtime-live-room`
Branch: `ws-realtime-live-room`

## Goal

Build the next demonstrable product slice after `auction-engine-mvp`: a user-facing mobile-first live auction room where users can browse active auctions, enter a room, place bids, and see price/ranking/countdown updates through WebSocket-driven realtime state.

This change turns the backend auction engine into something visible and interactive for users. It should preserve future concurrency and multi-instance options without overbuilding the first implementation.

## Non-Goals

- Real video livestream ingestion or playback.
- Merchant realtime monitoring dashboard.
- Order confirmation, simulated payment, fulfillment, or after-sale flows.
- Chat, bullet comments, online user count, or analytics dashboard.
- Multi-instance Redis Pub/Sub/Stream implementation in this slice.

## User Stories

- As a user, I can open `/app/auctions` and see auctions I can join.
- As a user, I can open `/app/auctions/:id` and see a mobile-first live-room layout with live ambience, current price, countdown, bid action, and rankings.
- As a user, I can tap the default next-bid button to bid quickly.
- As a user, I can enter a custom bid amount when I want to bid above the next required price.
- As a user, I see price, ranking, countdown extension, and auction-end updates without manually refreshing.
- As a user, if I am outbid, I receive a private `outbid` notification.
- As a user, if I reconnect, I receive a complete snapshot and the UI recovers to the latest auction state.

## UX Decisions

### Routes

- `/app/auctions`: user auction lobby.
- `/app/auctions/:id`: user live auction room.
- User login redirects to `/app/auctions`.
- Merchant login continues to redirect to `/merchant/products`.

### Live Room Layout

Use layout A from brainstorming:

1. Top: lightweight simulated livestream ambience area.
2. Middle: current price, countdown, and primary bid button.
3. Lower section: ranking list and realtime status messages.

The first viewport must let a user understand the auction and place a bid without scrolling.

### Bid Interaction

- Primary button displays the next required bid, for example `出价 ¥330`.
- Secondary entry allows a custom amount.
- Bid submission uses the existing REST bid endpoint.
- The UI does not treat the REST response as the realtime state source.
- The UI updates current price, rankings, and countdown from WebSocket messages.
- REST failures show a toast-style error, such as insufficient balance, bid too low, auction ended, or lock busy.

## Recommended Technical Approach

Use approach `1B`: single-instance in-memory realtime hub now, with a replaceable event bus boundary for future multi-instance concurrency.

### Backend Components

- `AuctionEventBus` interface: publishes domain events emitted after committed auction state changes.
- `InMemoryAuctionEventBus`: current MVP implementation for one backend instance.
- `RealtimeHub`: manages auction rooms, connected clients, broadcast, private user messages, ping/pong, and cleanup.
- `AuctionSnapshotProvider`: builds a current room snapshot from database-backed auction/ranking state.
- WebSocket handler: upgrades `/ws/auctions/:id`, authenticates the user, joins the room, sends initial snapshot, and streams subsequent events.

### Service Boundary

`AuctionService` must not know about WebSocket clients. It only emits domain events after successful committed changes:

- bid accepted
- previous bidder outbid
- auction extended
- auction ended
- auction cancelled

The current event bus can be in-memory. A future `RedisPubSubAuctionEventBus` or Redis Stream-backed implementation can replace it without changing the frontend protocol or auction service contract.

### Ordering And Concurrency

The existing bid consistency path remains authoritative:

- Redis bid lock serializes bid placement.
- Database transaction persists wallet/bid/auction changes.
- Settlement worker persists auction-end changes.

Realtime delivery adds ordering metadata:

- Every WebSocket message includes `auction_id`, `version`, and `server_time`.
- The frontend only applies messages with a newer version for the same auction.
- Older or duplicate messages are ignored so the UI never rolls back.

For future multi-instance deployment, the event bus can move to Redis Pub/Sub or Redis Stream while keeping `version` as the client-side ordering guard.

## WebSocket Message Scope

MVP supports five message types:

- `snapshot`: full room state on join or reconnect.
- `price_update`: current price, highest bidder, ranking, and version after a bid.
- `extended`: Soft Close countdown reset and current extension count.
- `auction_end`: ended_sold, ended_no_bid, or cancelled result.
- `outbid`: private message to the previous highest bidder.

Every message includes:

- `type`
- `auction_id`
- `version`
- `server_time`
- `payload`

## Frontend Data Flow

`requirements-v3.md` states that WebSocket is the realtime truth source:

- REST initializes lobby/detail data.
- WebSocket overwrites realtime room state after connection.
- Bid submission uses REST, then waits for WebSocket updates.
- Store state should ignore stale versions.
- Countdown uses server time offset from WebSocket messages.

The frontend implementation should add a focused user-side state layer for auction room state instead of mixing realtime state into merchant product components.

## Acceptance Criteria

- A user can navigate to `/app/auctions` after login.
- The lobby lists joinable auction products with status, current price, and a room entry action.
- The user can open `/app/auctions/:id`.
- The room connects to WebSocket and receives a `snapshot`.
- The room shows simulated live ambience, current price, countdown, primary next-bid button, custom bid entry, and rankings.
- A successful bid causes a WebSocket `price_update` and ranking refresh.
- A bid near the end can produce an `extended` update and reset the countdown.
- If user A is outbid by user B, user A receives `outbid`.
- Auction end/cancel messages update the room to a terminal state and disable bidding.
- Reconnecting receives a fresh `snapshot`.

## Risks

- Current auction service may need small DTO/repository extensions to expose complete snapshot data.
- Existing auction settlement worker must emit realtime events after terminal state changes.
- UI can become inconsistent if REST success is applied before WebSocket state; this is explicitly forbidden for realtime fields.
- In-memory event bus is single-instance only; the interface boundary and version metadata are required to avoid future rewrites.
- Countdown correctness depends on consistent `server_time` and `ended_at` fields.

## Verification Plan

- Backend unit/integration tests for event bus publishing after bid, outbid, extension, end, and cancel.
- Backend WebSocket tests for join snapshot, broadcast, private outbid, stale/ordered version metadata, and reconnect snapshot.
- Frontend tests for room state reducer/store handling snapshot, price update, extended, auction end, outbid, and stale versions.
- E2E test: merchant creates/publishes/activates auction, user enters room, user bids, another user outbids, first user receives outbid, room price/ranking/countdown update.

## Recommended Next Step

Create OpenSpec change `ws-realtime-live-room` with:

- `proposal.md`
- `design.md`
- `tasks.md`
- `specs/realtime-live-room/spec.md`

The first implementation milestone should be backend event bus + WebSocket snapshot/broadcast, followed by the user lobby and room UI.
