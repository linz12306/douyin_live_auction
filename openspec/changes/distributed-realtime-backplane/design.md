# Design: distributed-realtime-backplane

## Technical Approach

Introduce a backend-internal realtime backplane that sits between committed auction events and per-process WebSocket hubs:

```text
AuctionService commit
  -> publish AuctionEvent to Redis backplane
  -> every backend instance subscribes
  -> each instance broadcasts only to local clients in the matching auction room
```

The database remains the source of truth. WebSocket events are realtime delivery; reconnect snapshot covers missed delivery.

## Chosen Transport: Redis Streams

Use stream key `auction_events` by default, configurable with `REALTIME_EVENT_STREAM_KEY`, and publish compact JSON `AuctionEvent` messages after transaction commit.

Each backend instance creates its own independent `XREAD` cursor. This is deliberately **not** a Redis consumer group:

- Consumer groups distribute messages across consumers, which is useful for work queues.
- WebSocket fanout needs broadcast semantics, where every backend receives every committed event and then forwards only to its local clients.
- Independent cursors preserve broadcast semantics and avoid cross-instance ownership coordination.

Streams are trimmed approximately to a bounded length so Redis does not grow without limit. Reconnect snapshots remain the correctness fallback for missed events.

## Rejected Option: Redis Pub/Sub

Redis Pub/Sub was initially attractive for simplicity and low latency, but it has no durable event log. Redis Streams gives the project a stronger high-concurrency story without changing the public WebSocket contract.

## Rejected Option: Streams Consumer Groups

Cons:

- Wrong delivery shape for broadcast when all backends must receive each event.
- Requires consumer lifecycle and pending-entry management that does not help local WebSocket fanout.

## Acceptance Criteria

- Start two backend processes connected to the same MySQL and Redis.
- Connect Buyer A WebSocket to backend A and Buyer B WebSocket to backend B.
- Submit a bid through backend A.
- Buyer B receives `price_update` through backend B.
- Submit an outbid through backend B.
- Buyer A receives private `outbid` through backend A.
- Restart one backend; reconnecting clients receive a fresh snapshot that matches database state.

## Failure Handling

- If Redis backplane publish fails after commit, log the error and keep the committed database state.
- Clients recover by reconnecting and receiving a snapshot.
- If duplicate events arrive, clients continue to ignore stale versions by auction version.
- If a subscriber is too slow and its local channel is full, the bus increments dropped-event metrics and the client can recover through reconnect snapshot.
