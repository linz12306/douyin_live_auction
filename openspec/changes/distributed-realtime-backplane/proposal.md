# Proposal: distributed-realtime-backplane

## Why

The current WebSocket Hub was intentionally in-process. It works for a single backend instance and the local MVP demo, but clients connected to different backend processes would not receive each other's realtime bid, outbid, extension, or terminal events. The project now needs this gap addressed directly so the architecture does not depend on remembering a future TODO.

## What Changes

- Implement a Redis Streams-backed realtime event backplane for multiple backend instances.
- Keep each backend responsible for only its own connected WebSocket clients.
- Broadcast committed auction events through Redis Streams using independent subscriber cursors.
- Use reconnect snapshots as the correctness fallback when transient realtime events are missed.
- Define local two-backend acceptance criteria.

## Compatibility Decisions

- Existing `/ws/auctions/:id` URL and message envelopes remain stable.
- Existing single-process Hub behavior remains valid because one backend also publishes and subscribes through Redis Streams.
- Auction bid transactions remain the source of truth; Redis realtime events are delivery hints after commit.
- The in-memory event bus remains available for focused tests.

## Out Of Scope

- Load balancer sticky sessions.
- Cloud deployment.
- Cross-process metric aggregation.
