# Tasks: ws-realtime-live-room

- [ ] 1. Preflight and baseline verification
  - Review `requirements-v3.md`, `openspec/specs/auction-engine/spec.md`, current frontend routes, current auction service, and existing tests.
  - Confirm branch is `ws-realtime-live-room` and no unrelated files are dirty.
  - Verification: `npx -y @fission-ai/openspec@latest validate ws-realtime-live-room --strict --no-interactive`, `/Users/vivix/.local/go/bin/go test ./...`, and `cd frontend && npm run build`.

- [ ] 2. Backend realtime message and event contracts
  - Define WebSocket message DTOs, payloads, auction domain events, and `AuctionEventBus` interface.
  - Include `type`, `auction_id`, `version`, `server_time`, and `payload` on every message.
  - Verification: Go unit tests for message serialization and in-memory event bus publish/subscribe.

- [ ] 3. Backend snapshot provider
  - Add snapshot query/building for auction room state: auction status, current price, highest bidder, end time, extension count, product summary, images, rankings, and next required bid when possible.
  - Verification: integration tests create auction/bids and assert snapshot fields and ranking order.

- [ ] 4. Backend RealtimeHub and WebSocket endpoint
  - Implement room join/leave, broadcast, private user message, ping/pong heartbeat, cleanup, and `/ws/auctions/:id` auth/upgrade.
  - Verification: WebSocket tests cover auth rejection, initial snapshot, room broadcast, private `outbid`, and reconnect snapshot.

- [ ] 5. Auction service event publishing
  - Publish committed events after bid accepted, previous bidder outbid, Soft Close extension, ceiling settlement, time settlement, and merchant cancellation.
  - Keep WebSocket dependencies outside `AuctionService`; publish only domain events through `AuctionEventBus`.
  - Verification: integration tests assert expected events for bid, outbid, extension, auction end, and cancellation.

- [ ] 6. Frontend user auction lobby
  - Add `/app/auctions`, API helpers, mobile-first lobby UI, and user-login redirect to the lobby.
  - Show joinable products with status, image, current price, and room entry action.
  - Verification: frontend build plus route/render tests or Playwright smoke test for user login to lobby.

- [ ] 7. Frontend live room state and WebSocket client
  - Add `/app/auctions/:id`, room state reducer/store, WebSocket connection/reconnect, token query auth, server time offset, version-based stale-message ignore, and message handlers.
  - Verification: frontend tests for snapshot, price update, extended, auction end, outbid, reconnect, and stale version ignore.

- [ ] 8. Frontend live room UI and bid interaction
  - Implement approved layout A: simulated live ambience, current price, countdown, primary next-bid button, custom amount, rankings, realtime status messages, and terminal-state disabled bidding.
  - Submit bids through REST and update realtime fields only from WebSocket messages.
  - Verification: frontend tests or Playwright smoke test for rendering, custom bid, REST failure toast, and WS-driven update.

- [ ] 9. End-to-end realtime validation
  - Cover merchant publish/activate, user A room snapshot, user A bid, user B outbid, user A private outbid notification, ranking update, countdown/terminal update.
  - Verification: Playwright or integration E2E records the command and result; backend and frontend test/build commands pass.

- [ ] 10. Documentation, plan sync, and memory
  - Update Superpowers execution plan, OpenSpec task statuses, current status docs, and project memory.
  - Verification: docs reference `requirements-v3.md`, active OpenSpec change, latest validation commands, and no stale `auction-engine-mvp` active-change paths.
