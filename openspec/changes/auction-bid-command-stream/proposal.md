# Proposal: auction-bid-command-stream

## Why

The current bid path is correct under high concurrency, but it relies on a per-auction Redis `SETNX` lock that rejects most simultaneous requests with 429 during hot-auction load. That protects consistency, yet it gives low successful bid throughput and does not show the high-concurrency queueing architecture expected for the next stage of the course project.

This change adds an optional asynchronous bid command stream. HTTP can enqueue quickly, workers process commands in auction order, and committed bid results continue to use the existing Redis Streams realtime backplane and WebSocket rooms.

## What Changes

- Keep synchronous `POST /api/v1/auctions/:id/bid` unchanged as fallback.
- Add async enqueue and command query APIs:
  - `POST /api/v1/auctions/:id/bid/async`
  - `GET /api/v1/auctions/:id/bid-commands/:command_id`
- Add durable MySQL command state in `auction_bid_commands`.
- Add Redis Stream `auction_bid_commands` for command queue delivery.
- Add a worker that drains queued commands in DB order per auction while allowing different auctions to process concurrently.
- Refactor bid processing so sync HTTP and async worker share the same transaction logic.
- Add private realtime command-status messages and load-test queued-mode evidence.

## Impact

- Public API adds new endpoints; existing endpoints remain compatible.
- Database adds one table for bid command state.
- Backend adds Redis Streams consumer-group worker behavior.
- Realtime contract adds one message type for private command status.
- Frontend may consume async status but remains defaulted to synchronous bidding for the existing demo.

## Out Of Scope

- Removing the synchronous bid path.
- Replacing Redis Streams with Kafka, RocketMQ, or another enterprise MQ.
- Changing wallet, order, auction state, or price rules beyond routing async commands through the existing business logic.
- Requiring cloud deployment before local verification.
