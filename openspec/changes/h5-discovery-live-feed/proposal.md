# Proposal: h5-discovery-live-feed

## Why

The H5 live auction room now has a Douyin-style visual direction, but the buyer entry route `/app/auctions` still reads like a conventional auction list. This creates a visual gap between discovering an auction and entering the live room.

The user selected the second-stage priority as search/discovery first and approved the `直播流入口` direction: search surface, channel chips, hero live card, and secondary feed cards.

## What Changes

- Upgrade `/app/auctions` from `竞拍大厅` to a mobile-first `发现竞拍` live-discovery entrance.
- Keep using the existing `listAuctionLobby()` data source and `AuctionLobbyItem[]` shape.
- Add front-end-only discovery affordances:
  - search input for currently loaded items,
  - channel chips derived from loaded item status/timing,
  - hero live auction card,
  - secondary two-column auction feed cards.
- Preserve existing route entries to `/app/auctions/:id`, `/app/orders`, and `/profile`.
- Preserve loading, empty, error, refresh, and item entry states with a stronger H5 visual shell.

## Compatibility Decisions

- No backend API is added.
- No WebSocket message type is added.
- No auction, order, wallet, payment, settlement, or ranking semantics change.
- Search and channel chips are local display/filter affordances only in the first implementation.
- Real backend search, real hot ranking, and personal homepage redesign remain deferred follow-up work.
- Douyin-style means structural and experiential similarity, not use of Douyin branding, copied UI assets, or unlicensed media.

## Impact

- Frontend:
  - Future implementation will modify `frontend/src/pages/app/AuctionLobby.tsx` and likely its focused tests.
- Documentation:
  - Add Superpowers design document for the approved visual direction.
  - Add OpenSpec change files for proposal, design, tasks, and frontend roadmap delta.
- Backend/API:
  - No change.
- Testing:
  - Focused `AuctionLobby` tests, frontend build, OpenSpec strict validation, diff hygiene, and mobile screenshot smoke.

## Out Of Scope

- React implementation in this lock slice.
- Personal homepage redesign.
- True search API.
- Hot-ranking algorithm or new analytics source.
- Live-room WebSocket/store changes.
- Product, order, wallet, payment, or merchant page changes.
