# Merchant UI Optimization Exploration

## Goal

Upgrade the merchant-facing frontend into a dense, professional live-commerce auction operations console. The first visual anchor is a horizontal "live product control list" for merchant products, inspired by live-commerce product operations tools, while preserving existing API contracts, auction rules, WebSocket semantics, order behavior, and data structures.

## Confirmed Direction

The approved visual direction is: dark horizontal live product control console.

This is not a generic dark SaaS dashboard and not a decorative fullscreen data wall. It should feel like a merchant's backstage control surface for live auction operations: compact, scannable, status-driven, and suitable for competition demos.

Key decisions confirmed with the user:

- Use horizontal product rows as the primary merchant product management layout.
- Borrow the operational structure from live product management references: product identity on the left, auction metrics in the middle, status and actions on the right.
- Keep the darker graphite/live-ops visual system rather than switching to a white Douyin-style admin page.
- Reduce large purple gradients, decorative light blobs, and oversized card compositions.
- Emphasize state semantics through color, copy, and layout.

## Non-Goals

- Do not change backend APIs.
- Do not change database schema or migrations.
- Do not change auction status machine behavior.
- Do not change WebSocket message semantics or realtime source-of-truth rules.
- Do not change order, payment, wallet, settlement, cancellation, or bidding business rules.
- Do not introduce a new charting or UI dependency unless implementation proves the existing stack cannot support the design.
- Do not redesign buyer H5 pages in this slice.

## Users

- Merchant operator running a PC management backend during a live auction session.
- Demo presenter who needs the merchant flow to communicate clearly under time pressure.
- Evaluator who should immediately understand auction status, price, order outcome, and available actions.

## Current Frontend Structure

Existing merchant routes:

- `/merchant/dashboard`: merchant operations dashboard with metrics, status buckets, trend-like charts, active auctions, and recent orders.
- `/merchant/products`: merchant product list with status tabs and two-column product cards.
- `/merchant/products/new`: product creation and auction publishing form.
- `/merchant/products/:id/edit`: product edit and auction rule form.
- `/merchant/products/:id`: product detail, media, auction rules, activation/cancellation actions, monitor entry.
- `/merchant/auctions/:id/monitor`: single-auction realtime monitor using the existing live room store and `/ws/auctions/:id`.
- `/merchant/orders`: merchant order list.
- `/merchant/orders/:id`: merchant order detail.

Existing frontend already uses dark styling, but pages are visually independent, many sections are card-heavy, and navigation is currently distributed through page-level buttons rather than a unified merchant console frame.

## Proposed Visual System

### Concept

Name: Live Ops Console

The interface should read as a deep graphite live-commerce trading console:

- High-density operational rows instead of gallery cards for management screens.
- Clear PC admin hierarchy with left navigation, top status bar, and constrained content surfaces.
- Status colors as operational language rather than decoration.
- Subtle borders and panels instead of large glows and purple gradients.

### Palette

- App background: `#07090D`
- Primary panel: `#0F151C`
- Row surface: `#131B24`
- Hover/elevated row: `#182331`
- Border: `#263241`
- Primary text: `#F5F7FA`
- Secondary text: `#8B97A7`
- Muted text: `#596575`
- Active / sold / realtime: `#21D19F`
- Pending / awaiting action / countdown: `#F4B740`
- Cancelled / risk / destructive: `#F05268`
- Payment / informational / synced: `#4BA3FF`
- Draft / no bid / inactive: `#7B8494`

### Shape And Density

- Prefer 6-8px radii for console surfaces and repeated rows.
- Use thin cold-gray borders and small shadows.
- Avoid nested cards and oversized hero panels in operational pages.
- Keep typography compact inside lists and panels.
- Emphasize numbers with tabular figures and stronger weight.

### State Language

Product and auction states must be visually distinct:

- `draft`: muted gray, "配置中" mood.
- `pending`: amber, "待开拍" and editable/activatable mood.
- `active`: green, realtime dot and countdown mood.
- `ended_sold`: green/blue-green, sold amount mood.
- `ended_no_bid`: cool gray/purple-gray, no-deal mood.
- `cancelled`: red/rose, stopped/risk mood.

Order states must stay separate:

- `pending_confirm`: amber.
- `pending_payment`: blue.
- `paid`: green.
- `cancelled`: red.

## Page-Level Direction

### Merchant Shell

Introduce a reusable merchant console frame for merchant pages:

- Fixed or sticky left navigation on desktop.
- Top status/header band for page title, merchant context, refresh/sync affordance, and quick actions.
- Main content area with consistent max width and spacing.
- Navigation entries for dashboard, live products, orders, publish product, and profile-related exit if needed.

This frame is visual/navigation structure only. It does not change route protection or auth behavior.

### Product Management

This is the primary visual anchor.

Replace the current two-column card grid with horizontal live product rows:

```text
Index | Product image + title + ID/tags | Start price | Increment | Ceiling | Current/sold amount | Bid count | Status + actions
```

Expected row behavior:

- Left section: sequence number, thumbnail, title, optional product id, description snippet, status/rule tags.
- Middle metric columns: start price, bid increment, ceiling price, current price or sold amount, bid count when available.
- Right control area: state badge, countdown/realtime hint when available, detail/monitor/edit/cancel actions based on existing data.
- Keep rows scannable even when product titles are long.
- Keep empty/loading/error states consistent with the console style.

Data limitation:

- Current `Product` list rows include `auction_id` but do not expose all auction rule metrics. If implementation cannot show every metric without backend changes, use available product/status fields and keep deeper metrics on product detail or dashboard active auction rows. Do not add backend fields in this slice unless the work is promoted through OpenSpec.

### Dashboard

Keep existing dashboard data, but visually align it with the console:

- Compact KPI strip for paid amount, paid orders, average paid price, active auctions, and recent orders.
- Trend and distribution sections should be clean and operational, not decorative.
- Active auctions and recent orders should use row/list patterns that echo product management.
- Replace purple-heavy accents with semantic state colors.

### Realtime Auction Monitor

Keep the existing WebSocket-backed single-auction monitor behavior.

Visual direction:

- Main monitoring stage should emphasize current price, countdown, auction state, extension count, and connection state.
- Side rail should show ranking, realtime event feed, and operational controls.
- Destructive cancellation remains visually clear but not oversized.
- Avoid decorative emoji-driven headings; use concise labels and status indicators.

### Orders

Convert the order list from card browsing into a transaction/deal-flow list:

```text
Product | Buyer | Amount | Status | Created | Confirmed/Paid | Action
```

Visual direction:

- Emphasize amount and state.
- Use row cards or table-like rows, not large gallery cards.
- Detail page should show product, buyer, amount, and a simple timeline for created/confirmed/paid/cancelled timestamps.

### Product Form

Keep current fields and submit behavior.

Visual direction:

- Make it feel like configuring a live product: product identity, media, live-room material, auction rules, submit actions.
- Use parameter-panel styling for auction rules.
- Keep form controls dense, readable, and aligned with the console palette.

## Implementation Strategy

Proceed in small visual slices:

1. Add or refactor shared merchant console styling/components where it reduces repetition.
2. Convert `/merchant/products` to horizontal live product rows first.
3. Align `/merchant/orders` and `/merchant/orders/:id` with the deal-flow row/timeline language.
4. Align `/merchant/dashboard` metric/list surfaces.
5. Align `/merchant/auctions/:id/monitor` with the control-room language.
6. Polish `/merchant/products/new`, `/merchant/products/:id/edit`, and `/merchant/products/:id` to match the console.

If any slice requires new backend fields or business behavior, stop and promote that slice through a formal OpenSpec change before implementation.

## Acceptance Criteria

- Merchant product management defaults to horizontal live product row layout.
- Merchant pages share a cohesive dark graphite console visual language.
- Product, auction, and order states are color-coded with clear semantic distinction.
- Realtime monitor remains WebSocket-backed and does not introduce bid controls for merchants.
- No backend API, database, WebSocket, auction, order, wallet, or payment semantics change.
- Existing merchant route tests remain meaningful and are updated only where UI text/query expectations change.
- Verification includes focused frontend tests, `npm run test`, and `npm run build`.
- Backend tests are not required unless implementation touches backend files.

## Risks

- Current list data may not contain every desired auction metric. Mitigation: only render available metrics, link to detail/monitor for deeper state, and avoid backend changes in this slice.
- A dense dark UI can become hard to scan. Mitigation: use strict semantic colors, stable metric columns, tabular numbers, and restrained panel nesting.
- Existing tests may depend on card labels or button copy. Mitigation: update tests to assert user-visible behavior and key navigation rather than exact old layout structure.
- A unified shell can accidentally affect non-merchant routes. Mitigation: scope shell usage to merchant pages only.

## Verification Plan

- Frontend focused tests for modified merchant pages.
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `git diff --check`
- Browser/screenshot verification is useful after implementation if a dev server can run, but the user declined visual companion during planning.
