# Proposal: ws-realtime-live-room

## Why

`auction-engine-mvp` is complete and archived, but users still cannot experience a realtime auction room. The current product can create, publish, activate, bid, rank, and settle auctions through backend APIs, while the frontend is still mostly merchant-side product management. `requirements-v3.md` defines WebSocket as the realtime truth source and calls for a mobile-first user auction experience with current price, countdown, rankings, outbid notification, and reconnection snapshot.

This change creates the next demonstrable slice: a user can enter a live auction room, bid, and see realtime state changes without refreshing.

## What Changes

- Add a backend realtime boundary around auction domain events.
- Add an in-memory `AuctionEventBus` implementation for the current single-instance MVP.
- Add a WebSocket `RealtimeHub` for auction rooms.
- Add `/ws/auctions/:id` for authenticated users to join an auction room and receive realtime messages.
- Add snapshot construction for reconnect and initial room state.
- Emit realtime events after successful auction state changes: bid accepted, previous bidder outbid, Soft Close extension, auction end, and cancellation.
- Add user-facing routes:
  - `/app/auctions`
  - `/app/auctions/:id`
- Add mobile-first live-room UI using the approved layout A: simulated live ambience, current price, countdown, bid action, and rankings.
- Add frontend realtime state handling where WebSocket messages are the source of truth for room state.

## Non-Goals

- Real livestream ingestion/playback.
- Merchant realtime monitoring dashboard.
- Order confirmation, simulated payment, fulfillment, or after-sale workflows.
- Chat, bullet comments, online user count, or analytics dashboard.
- Redis Pub/Sub or Redis Stream implementation in this slice.

## Impact

- Backend adds WebSocket/event-bus packages and tests.
- Auction service gains event publishing boundaries but must not depend directly on WebSocket clients.
- Frontend adds user-side app routes, API helpers, WebSocket client handling, and live-room state.
- Future multi-instance work can replace the in-memory event bus with Redis Pub/Sub or Redis Stream without changing the frontend message protocol.
