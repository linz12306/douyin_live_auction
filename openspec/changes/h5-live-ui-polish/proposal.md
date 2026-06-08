# Proposal: h5-live-ui-polish

## Why

The buyer H5 auction experience already has a Douyin-style live room and discovery entrance, but the current polish still has demo risks:

- Some live-room floating layers can overlap on narrow mobile screens.
- Several controls read as rough text or outline buttons instead of polished, clearly tappable live-commerce actions.
- Click and realtime-state feedback is present but not strong enough to make bidding feel responsive and alive.

The user explicitly prioritized fixing overlap first, improving button display second, and adding click/state animations third.

## What Changes

- Refine `/app/auctions/:id` as the primary surface:
  - stabilize mobile fixed zones for top host area, badges, ranking/messages, right action rail, floating auction card, bottom controls, bid sheet, shelf, and result modal;
  - upgrade rough/text/outline controls into polished, stable action buttons;
  - add lightweight click feedback and WebSocket-driven state feedback for price updates, outbid, leading, last 10 seconds, extension, submit/error, and terminal states.
- Apply scoped consistency polish to buyer secondary routes:
  - `/app/auctions`: button/CTA visual consistency only where needed;
  - `/app/orders`: order card action tappability and button copy polish;
  - `/app/orders/:id`: confirm/pay/cancel button display and click/submitting feedback.
- Preserve existing data flow and contracts:
  - REST initializes or submits commands only;
  - WebSocket/Zustand remains the realtime truth source for visible auction state.

## Compatibility Decisions

- No backend route, response field, WebSocket message type, database, wallet, auction-engine, order, settlement, or payment semantic changes are introduced.
- REST bid success may affect only local command state. It must not directly update visible current price, ranking, countdown, extension count, leading/outbid state, or terminal state.
- Animation must not imply accepted bids unless a WebSocket message updates state.
- Order pages keep existing order actions and APIs; this change only improves layout, button hierarchy, and submitting feedback.
- Douyin-style means interaction rhythm and live-commerce density, not use of Douyin marks, copied assets, or unlicensed media.

## Impact

- Frontend:
  - Modify `frontend/src/pages/app/LiveAuctionRoom.tsx`.
  - Modify `frontend/src/pages/app/AuctionLobby.tsx` only for scoped CTA polish if needed.
  - Modify `frontend/src/pages/app/OrderList.tsx` and `frontend/src/pages/app/OrderDetail.tsx` for buyer action polish.
  - Update focused tests for the touched buyer pages.
- Documentation:
  - Add Superpowers exploration.
  - Add OpenSpec proposal, design, tasks, and spec deltas.
  - Later add Superpowers implementation plan.
- Backend/API:
  - No change.
- Testing:
  - Focused frontend tests for live room and buyer order pages.
  - Full `cd frontend && npm run test`.
  - `cd frontend && npm run build`.
  - OpenSpec strict validation.
  - `git diff --check`.
  - Mobile screenshot/layout smoke at 390x844 and desktop fallback after implementation.

## Out Of Scope

- Merchant PC page redesign.
- Backend search/ranking/participant/view-count fields.
- True multi-item realtime bidding.
- New order confirmation/payment semantics.
- New animation library unless CSS/Tailwind is insufficient and the user approves the dependency.
- OpenSpec archive before implementation, verification, plan/task alignment, and memory updates are complete.
