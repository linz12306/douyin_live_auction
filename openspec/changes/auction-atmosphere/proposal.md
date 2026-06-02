# Proposal: auction-atmosphere

## Why

The buyer live auction room currently proves realtime bidding, but it still reads like a traditional auction detail page. The confirmed frontend roadmap requires the H5 buyer room to feel like a Douyin-style live commerce auction surface: full-screen room, host/context layers, atmosphere controls, persistent auction floating card, product shelf shell, strong-state bid sheet, and in-room terminal result.

This change locks and implements the first `auction-atmosphere` slice for `/app/auctions/:id` while preserving the existing backend and WebSocket contracts.

## What Changes

- Reshape the user live auction room into a full-screen mobile-first live commerce room.
- Add host bar, live/status/rule badges, brand-safe simulated scene layer, comments/system messages, right-side atmosphere controls, and bottom commerce controls.
- Add persistent auction floating card as the primary bid entry.
- Add half-screen bid sheet with strong bid states and amount controls.
- Add half-screen product shelf shell with the current realtime auction item and visual/demo shelf rows.
- Add in-room result modal for sold, no-bid, and cancelled outcomes.
- Preserve realtime truth-source rules: REST bid success does not directly update visible current price, ranking, countdown, extension count, leading/outbid state, or terminal state.
- Update focused frontend tests and visible E2E expectations for the new live room structure.

## Compatibility Decisions

- No backend route, response field, WebSocket message type, database, wallet, order, settlement, or payment semantic changes are introduced.
- `useLiveRoomStore` remains the realtime state boundary and is not changed unless implementation finds a purely additive, buyer-safe need.
- Merchant monitor behavior is not changed.
- Product shelf shell does not implement true multi-item realtime bidding. Only the current auction item opens the realtime bid sheet.
- Winner order entry routes to existing buyer order pages. The live room does not perform confirm or payment actions.
- Douyin-style means interaction structure and live commerce rhythm, not Douyin branding, copied assets, or real third-party creator/brand media.

## Impact

- Frontend:
  - Modify `frontend/src/pages/app/LiveAuctionRoom.tsx`.
  - Update focused tests for `LiveAuctionRoom`.
  - Update E2E tests that assert live room visible behavior.
- Documentation:
  - Add Superpowers exploration and execution plan for `auction-atmosphere`.
  - Add OpenSpec change files.
- Backend/API:
  - No code or contract changes.
- Testing:
  - Focused component tests.
  - Existing realtime/demo E2E expectations adjusted for the new UI where needed.
  - Frontend build.
  - OpenSpec strict validation and whitespace checks.

## Out Of Scope

- Merchant analytics or merchant monitor redesign.
- True multi-item realtime bidding in one live room.
- New chat, gift, coupon, payment, or order business actions.
- Real livestream ingestion.
- Use of Douyin branding or third-party media assets.
- OpenSpec archive. Archive happens only after the implementation and broader roadmap packages are complete.
