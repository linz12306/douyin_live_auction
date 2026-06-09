# distributed-realtime-backplane Exploration

## Goal

Replace the default process-local realtime event bus with a Redis Streams backplane so multiple backend instances can receive the same committed auction events and broadcast them to their own WebSocket clients.

## User-Facing Checkpoint

The user initially accepted keeping distributed WebSocket fanout as a future P2 item, then corrected the direction: "我觉得可以直接先换成redis streams，不然每次你说可以未来改我都不记得".

This document records that correction as approval to implement Redis Streams in the current slice. Commit and push still require explicit later approval.

## Current State

- `AuctionService` publishes committed `AuctionEvent` values through an `AuctionEventBus`.
- `Hub` subscribes to that bus and broadcasts public/private WebSocket messages to local clients.
- `cmd/server` used `NewInMemoryAuctionEventBus`, so events never crossed process boundaries.
- The in-memory bus is still useful for fast unit and integration tests.

## Non-Goals

- Do not change `/ws/auctions/:id` URLs or client message envelopes.
- Do not move bid ordering or wallet mutation into a queue in this slice.
- Do not implement Redis consumer groups for WebSocket fanout.
- Do not require cloud deployment or a load balancer.
- Do not aggregate metrics across backend instances.

## Acceptance Criteria

- A Redis Streams-backed `AuctionEventBus` publishes `AuctionEvent` payloads with `XADD`.
- Each backend subscriber reads with an independent `XREAD` cursor so all backend instances receive all committed events.
- The default server path uses the Redis Streams bus and a configurable stream key.
- Existing tests can still use the in-memory bus.
- Automated tests prove two independent backend subscribers both receive one published event.
- Reconnect snapshot remains the correctness fallback for missed realtime delivery.

## Risks

- Redis Streams consumer groups would accidentally turn broadcast into work distribution. The implementation must use independent cursors instead.
- A subscriber can miss events if it is down or if local buffers overflow. The database snapshot on reconnect remains the source-of-truth recovery path.
- Redis stream retention must be bounded to avoid unbounded memory growth.
- Tests that depend on Redis should skip cleanly if Redis is unavailable outside the integration environment.

## Technical Direction

- Keep the existing `AuctionEventBus` interface.
- Add `RedisStreamAuctionEventBus` in `backend/internal/realtime`.
- Store one JSON payload field named `event` per stream entry.
- Use approximate `MAXLEN` trimming with a modest default retention count.
- On subscribe, capture the current last stream ID and then read only newer events; this avoids replaying old events on server startup while still avoiding a publish/read race after subscribe.
- Wire `cmd/server` to `NewRedisStreamAuctionEventBus(rdb, cfg.RealtimeEventStreamKey)`.
- Add `REALTIME_EVENT_STREAM_KEY`, defaulting to `auction_events`.
