# Proposal: h5-live-animations

## Why

The buyer H5 live room already has a polished live-commerce shell, but the key realtime bidding moments still need higher-quality motion to feel premium in a demo:

- price updates should feel live and authoritative;
- accepted bids should produce a rewarding confirmation only after WebSocket truth arrives;
- leading and outbid states should be immediately legible;
- the final countdown should feel urgent without blocking bidding.

## What Changes

- Add Motion for React to the frontend.
- Enhance `/app/auctions/:id` with Motion-driven realtime feedback:
  - price update glow/lift;
  - WebSocket-confirmed bid success coin burst;
  - leading-state warm celebration accent;
  - private outbid warning pulse and recovery emphasis;
  - final-10-seconds countdown heartbeat.
- Preserve existing realtime truth-source rules:
  - REST bid success never updates visible realtime auction state;
  - accepted-bid celebration only appears after WebSocket/store state shows the current user is highest bidder;
  - price animation only follows WebSocket/store price changes.

## Compatibility Decisions

- No backend route, REST response, WebSocket message type, database, wallet, auction-engine, order, settlement, payment, or merchant-page changes.
- No true multi-item realtime bidding.
- Animations are non-blocking and pointer-events free where decorative.
- Reduced-motion preference keeps visible feedback while suppressing unnecessary movement.
- Existing accessible labels and visible copy remain stable unless a test-driven adjustment requires a small additive marker.

## Impact

- Frontend:
  - `frontend/package.json`
  - `frontend/package-lock.json`
  - `frontend/src/pages/app/LiveAuctionRoom.tsx`
  - `frontend/src/pages/app/LiveAuctionRoom.test.tsx`
- Documentation:
  - Superpowers exploration and execution plan.
  - OpenSpec proposal, design, tasks, and realtime live-room spec delta.
- Testing:
  - Focused live-room tests.
  - Full frontend tests.
  - Frontend build.
  - OpenSpec strict validation.
  - Whitespace check.

## Out Of Scope

- Backend/API contract work.
- Merchant UI.
- Buyer lobby or order page polish.
- Canvas particle engine.
- Motion+ paid APIs.
- Commit/push unless separately requested.
