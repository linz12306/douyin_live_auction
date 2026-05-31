# Proposal: merchant-auction-monitor

## Why

Merchants can create, publish, activate, cancel, and inspect products/orders, while users already have a realtime live auction room. Merchants still lack a focused realtime page for watching one auction as bids arrive. `requirements-v3.md` calls for merchant-side auction monitoring and `WORKTREE_PROMPT.md` narrows this slice to a single-auction monitor that reuses the existing WebSocket contract.

## What Changes

- Add merchant route `/merchant/auctions/:id/monitor`.
- Add visible monitor entry points from merchant product list and product detail.
- Reuse existing `/ws/auctions/:id` snapshot and realtime messages for monitor state.
- Display current price, countdown, status, rankings, bid events, and terminal state.
- Expose the existing merchant cancellation action with reason entry and restriction copy.
- Add the minimal read-only auction id data needed for merchant product list navigation.
- Stabilize existing bid/order timestamp persistence so recent-bid cancellation and order confirmation use service-owned time consistently.

## Non-Goals

- Dashboard aggregate statistics.
- Changes to bidding, settlement, wallet freeze/deduct, or order workflow rules.
- User live-room state machine rewrite.
- New WebSocket message types or backend realtime transport changes.
- Real video, chat, analytics charts, or order/payment UI.

## Impact

- Frontend adds one merchant page and route.
- Frontend product list/detail add monitor links when an auction exists.
- The live room store may record bid-event notifications from existing `price_update` messages.
- Backend merchant product list response gains optional `auction_id`.
- Existing tests gain coverage for merchant monitor navigation and timestamp consistency.
