# Design: merchant-auction-monitor

## Approach

Use the existing realtime room contract as the only realtime data source. The merchant monitor is a new presentation of the same auction room state, not a new auction engine path. REST remains the command surface for cancellation only.

## Backend

Merchant product list rows need to link directly to `/merchant/auctions/:id/monitor`, but current rows only expose product fields. Add an optional `auction_id` to merchant product list rows with a left join against `auctions`. This is read-only data and does not change product creation, auction state transitions, or user lobby rows.

While validating the baseline, bid and order timestamp persistence showed an environment-sensitive bug: some business checks compare persisted timestamps with Go `time.Now()`, while rows used DB default timestamps. Persist `bids.created_at`, `orders.created_at`, and `orders.updated_at` from the service time used for the transition. This aligns existing requirements for recent-bid cancellation and order confirmation without changing the rules.

No new WebSocket endpoint is needed. `/ws/auctions/:id` already sends snapshot, price update, extension, terminal, and outbid messages.

## Frontend

Add `MerchantAuctionMonitor.tsx` under `frontend/src/pages/merchant`. The page:

- Reads `:id` as the auction id.
- Requires merchant auth through `ProtectedRoute`.
- Calls `useLiveRoomStore.connect(auctionId, accessToken)` and disconnects on unmount.
- Ignores stale store data when route auction id and store auction id differ, following the existing user live-room pattern.
- Displays compact operational panels for current price, countdown, status, extension count, rankings, bid events, and final result.
- Shows cancellation restriction copy and a reason textarea for pending/active auctions.
- Calls `cancelAuction(auctionId, reason)` and reconnects after success so the snapshot catches terminal state even if the WebSocket terminal event arrives late.

Product list and detail add monitor links when an auction exists. Product detail already has the auction object. Product list uses the new optional `auction_id` field.

## Store Behavior

The existing `useLiveRoomStore` already handles snapshots, price updates, extensions, terminal messages, outbid notifications, reconnects, and stale versions. Extend `price_update` handling to add a status notification describing the latest bid from the top ranking row when available. This gives the monitor a bid-event feed while keeping the user live room compatible.

## Error Handling

- Invalid auction ids render a local error state and do not connect.
- Missing access token leaves the monitor waiting for protected-route hydration.
- WebSocket parse and connection errors continue to appear through store notifications.
- Cancellation requires a non-empty reason and surfaces backend messages such as the 30-second recent-bid restriction.

## Testing

- Go integration test: merchant product list includes `auction_id` after publish.
- Existing Go integration tests: recent-bid cancellation and order confirmation remain valid under service-owned timestamps.
- Store unit test: `price_update` records a bid-event notification.
- Product list/detail tests: monitor links are visible and point to `/merchant/auctions/:id/monitor`.
- Monitor page test: seeded realtime state renders current price, countdown/status, rankings, bid event, restriction copy, and calls cancellation API with the reason.
- Full verification uses the commands from `WORKTREE_PROMPT.md`.
