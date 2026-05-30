# Merchant Auction Monitor Exploration

## Goal

Build a merchant-facing realtime auction monitor at `/merchant/auctions/:id/monitor` so a merchant can watch one of their auctions while it runs, enter from merchant product pages, and cancel when the existing auction cancellation rules allow it.

## Non-Goals

- No dashboard-level aggregate statistics.
- No rewrite of the user live room state machine.
- No changes to bidding, settlement, wallet, or order core rules.
- No real livestream, chat, analytics charts, or order/payment UI in this slice.

## Users

- Merchant operator: needs a dense PC-oriented monitor for a single auction.
- Existing buyer/user clients: continue using `/app/auctions/:id` and the same realtime WebSocket contract.

## Scenarios

- A merchant opens product list and sees a direct monitor entry for published auction products.
- A merchant opens product detail and can jump to the monitor for the product auction.
- A merchant opens `/merchant/auctions/:id/monitor` and receives the existing `/ws/auctions/:id` snapshot.
- Accepted bids update current price, countdown/version state, rankings, and the monitor event feed through WebSocket messages.
- Terminal states show final status, final price, winner when known, and disable cancellation.
- Pending and active auctions expose the existing merchant cancellation command with a reason field; active cancellation shows the 30-second recent-bid restriction copy and surfaces backend rejection messages.

## Acceptance Criteria

- Route `/merchant/auctions/:id/monitor` is protected for merchant users.
- Product list and product detail both expose visible monitor navigation when an auction exists.
- The monitor uses the existing `/ws/auctions/:id?token=...` snapshot and realtime messages as the realtime source of truth.
- The monitor displays current price, countdown, status, rankings, bid events, and terminal state.
- Cancellation calls the existing `DELETE /api/v1/auctions/:id` command, requires a reason, and refreshes/reuses realtime state after completion.
- If merchant list rows lack auction ids, the backend may add only a read-only field needed for navigation.
- Existing auction cancellation, bidding, settlement, order, and wallet semantics remain unchanged.

## Preflight Findings

- Current branch is `codex/merchant-auction-monitor` in a linked worktree at `D:\pythoncode\douyin-live\.worktrees\merchant-auction-monitor`.
- OpenSpec CLI is available.
- `WORKTREE_PROMPT.md` is an untracked instruction artifact and should not be committed.
- The local MySQL database was behind repo migrations; applying `backend/migrations/001` through `007` created missing `bids` and `orders` tables.
- Baseline tests exposed a time-source bug: test helpers and persisted `bids.created_at` / `orders.created_at` mixed DB default time with Go `time.Now()`. The fix aligns persisted bid/order timestamps with service time and preserves existing rules.
- The merchant product list currently returns product rows without auction ids, so a minimal read-only list field is needed for direct monitor entry.

## Technical Direction

- Add a minimal `auction_id` field to merchant product list rows by left-joining `auctions`.
- Add a merchant monitor page that reuses `useLiveRoomStore` and `/ws/auctions/:id` rather than creating a parallel realtime client.
- Extend the existing live room store only where needed to record bid-event notifications from `price_update` messages.
- Keep cancellation as an existing REST command and rely on WebSocket terminal messages or explicit reconnect to refresh state.
- Use focused Vitest coverage for route/page/store behavior and Go integration coverage for merchant list auction ids.

## Risks

- Reusing the live-room store could leak stale state between user and merchant routes; the route auction id guard must remain in place.
- Directly entering a monitor URL relies on WebSocket auth plus cancellation ownership checks; direct monitor visibility is not a new command authority.
- Bid event history is best-effort for connected-session events; historical rankings are still shown from snapshot.
- Local DB time zone differences can make tests and business rules flaky unless service-owned timestamps are persisted explicitly.
