# Tasks: distributed-realtime-backplane

- [x] 1. Lock design
  - Choose Redis Streams as the immediate realtime backplane.
  - Preserve independent subscriber cursors for broadcast semantics.
  - Validate OpenSpec design and realtime-live-room spec delta.

- [x] 2. Implement Redis Streams bus
  - Add a Redis Streams-backed `AuctionEventBus` implementation.
  - Publish committed `AuctionEvent` payloads with `XADD`.
  - Subscribe with independent `XREAD` cursors so every backend receives every event.
  - Track local dropped events when subscriber buffers are full.

- [x] 3. Wire backend default path
  - Use the Redis Streams event bus in `cmd/server`.
  - Add `REALTIME_EVENT_STREAM_KEY` configuration.
  - Preserve current in-memory bus for focused tests.

- [x] 4. Verification
  - Add/execute automated bus test proving two independent backend subscribers both receive one published event.
  - Run backend tests.
  - Validate OpenSpec changes.
  - Optionally run a manual two-backend WebSocket smoke test for cross-process price updates and private outbid delivery.
