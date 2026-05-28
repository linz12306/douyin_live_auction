# Tasks: ws-realtime-live-room

- [x] 1. Preflight and baseline verification
  - Review `requirements-v3.md`, `openspec/specs/auction-engine/spec.md`, current frontend routes, current auction service, and existing tests.
  - Confirm branch is `ws-realtime-live-room` and no unrelated files are dirty.
  - Current status: baseline validation passed; `github.com/gorilla/websocket v1.5.3` added in commit `689ecc9`.
  - Verification: `npx -y @fission-ai/openspec@latest validate ws-realtime-live-room --strict --no-interactive`, `/Users/vivix/.local/go/bin/go test ./...`, and `cd frontend && npm run build`.

- [x] 2. Backend realtime message and event contracts
  - Define WebSocket message DTOs, payloads, auction domain events, and `AuctionEventBus` interface.
  - Include `type`, `auction_id`, `version`, `server_time`, and `payload` on every message.
  - Current status: message/event contracts added in `5dba7e7`; event bus drop/close contract hardened in `7edc16f`.
  - Verification: Go unit tests for message serialization and in-memory event bus publish/subscribe.

- [x] 3. Backend snapshot provider
  - Add snapshot query/building for auction room state: auction status, current price, highest bidder, end time, extension count, product summary, images, rankings, and next required bid when possible.
  - Current status: snapshot provider added in `f56dde5`; consistency and start-price fallback fixed in `caff2a9`.
  - Verification: integration tests create auction/bids and assert snapshot fields and ranking order.

- [x] 4. Backend RealtimeHub and WebSocket endpoint
  - Implement room join/leave, broadcast, private user message, ping/pong heartbeat, cleanup, and `/ws/auctions/:id` auth/upgrade.
  - Verification: WebSocket tests cover auth rejection, initial snapshot, room broadcast, private `outbid`, and reconnect snapshot.
  - Current status: WebSocket hub and `/ws/auctions/:id` endpoint completed in `7bf5059`; Task 5 remains responsible for wiring `AuctionService` event publishing.
  - Verification: `/Users/vivix/.local/go/bin/go test -count=1 ./internal/realtime ./internal/handler`, `/Users/vivix/.local/go/bin/go test -count=1 ./...`, `git diff --check`, and `npx -y @fission-ai/openspec@latest validate ws-realtime-live-room --strict --no-interactive`.

- [x] 5. Auction service event publishing
  - Publish committed events after bid accepted, previous bidder outbid, Soft Close extension, ceiling settlement, time settlement, and merchant cancellation.
  - Keep WebSocket dependencies outside `AuctionService`; publish only domain events through `AuctionEventBus`.
  - Current status: completed in Task 5 slice; `AuctionService` publishes committed events through `AuctionEventBus`, and server wiring shares the hub event bus.
  - Verification: `/Users/vivix/.local/go/bin/go test -count=1 ./internal/service ./tests/integration`, `/Users/vivix/.local/go/bin/go test -count=1 ./...`, and `git diff --check`.

- [x] 6. Frontend user auction lobby
  - Add `/app/auctions`, API helpers, mobile-first lobby UI, and user-login redirect to the lobby.
  - Show joinable products with status, image, current price, and room entry action.
  - Current status: completed in Task 6 slice; user role login/register redirects to `/app/auctions`, unknown refresh-token sessions hydrate via `/users/me` before rendering protected role routes, merchants are redirected away from `/app/auctions`, users are redirected away from `/merchant/products`, failed hydration logs out to `/login`, and `GET /api/v1/products?status=active` returns global active lobby rows for authenticated users.
  - Verification: `cd frontend && npm run build`, `/Users/vivix/.local/go/bin/go test -count=1 ./tests/integration -run TestUserListsActiveAuctionLobbyRows`, `/Users/vivix/.local/go/bin/go test -count=1 ./tests/integration`, `/Users/vivix/.local/go/bin/go test -count=1 ./...`, `npx -y @fission-ai/openspec@latest validate ws-realtime-live-room --strict --no-interactive`, `git diff --check`, and Playwright smoke covering auth hydration redirects, `/profile` reload hydration, failed hydration logout, and merchant-shaped `/products` data rendering an empty lobby without page errors.

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
