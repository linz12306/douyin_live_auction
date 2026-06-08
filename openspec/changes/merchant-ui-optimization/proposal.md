# Proposal: merchant-ui-optimization

## Why

The merchant PC frontend currently has the required surfaces for dashboard, product management, auction monitoring, product publishing, and order inspection, but the pages still feel like separate card-based admin screens. For a Douyin live auction demo, the merchant side should communicate live-commerce operations immediately: which items are being controlled, which auctions are active, what price state each item is in, and what action the merchant should take next.

This change locks a frontend-only visual and information-architecture upgrade for the merchant experience. The user-confirmed direction is a dark horizontal live product control console: dense, operational, state-driven, and closer to a live-commerce product control desk than a generic table backend.

## What Changes

- Add a cohesive merchant console visual language for merchant pages.
- Introduce a merchant console frame pattern with left navigation, top/page status area, and consistent content surfaces.
- Convert merchant product management from a two-column product card grid into a horizontal live product control list.
- Align merchant dashboard surfaces with the same graphite/live-ops visual system.
- Align merchant realtime monitor visual hierarchy around price, countdown, connection state, ranking, event feed, and existing cancellation controls.
- Align merchant order list/detail with a transaction/deal-flow row and timeline language.
- Align product create/edit/detail pages with the same control-console styling.
- Preserve all existing backend APIs, WebSocket semantics, auction rules, order rules, wallet behavior, and route protection.

## Important Compatibility Decisions

- This is a frontend-only implementation change unless later implementation discovers a hard blocker. Backend fields must not be added opportunistically in this change.
- The horizontal product list should render only the data available from current frontend types and current API responses. If a desired metric is unavailable, the UI should show an unavailable/secondary state or link to detail/monitor instead of changing the API.
- WebSocket remains the realtime truth source for merchant auction monitoring.
- Merchant pages inspect orders but do not expose buyer-only confirm, cancel, or pay actions.
- Existing product activation and cancellation actions must keep their current backend rules and error handling.
- The design may update copy, layout, visual grouping, and tests that assert user-visible behavior; it must not change business semantics.

## Impact

- Documentation:
  - Adds Superpowers exploration for merchant UI optimization.
  - Adds OpenSpec proposal, design, tasks, and merchant UI requirements.
- Frontend:
  - Likely touches merchant pages under `frontend/src/pages/merchant/`.
  - May add shared merchant layout/presentation components under `frontend/src/components/`.
  - May update merchant page tests to match the new row/list semantics.
- Backend/API:
  - No planned backend, schema, migration, WebSocket, auction, order, wallet, or payment changes.
- Testing:
  - Focused merchant frontend tests.
  - Full `cd frontend && npm run test`.
  - Full `cd frontend && npm run build`.
  - `git diff --check`.

## Out Of Scope

- Buyer H5 redesign.
- Backend API fields or routes.
- Database schema or migrations.
- Auction engine, bid validation, settlement, wallet, payment, order, or cancellation rule changes.
- New WebSocket message types.
- Production analytics API expansion.
- Use of Douyin branding, copied UI assets, or third-party creator/product media.
- Archiving the change before implementation and verification are complete.
