# Design: merchant-ui-optimization

## Technical Approach

Implement a frontend-only merchant PC visual system on top of the current React route and API surface. The design follows the existing page/component conventions and keeps the business data flow unchanged.

Current merchant routes:

- `/merchant/dashboard`
- `/merchant/products`
- `/merchant/products/new`
- `/merchant/products/:id`
- `/merchant/products/:id/edit`
- `/merchant/auctions/:id/monitor`
- `/merchant/orders`
- `/merchant/orders/:id`

This change does not introduce a new application state architecture. It may introduce presentation helpers and reusable merchant layout components where they reduce duplication.

## Confirmed Visual Direction

The user approved the horizontal product-row direction after reviewing a live-commerce product management reference. The confirmed direction is:

> Dark horizontal live product control console.

The product management page is the visual anchor. It should borrow the reference's operational row structure: product identity on the left, auction/commercial metrics in the middle, status and actions on the right. The project should keep a graphite dark theme and avoid becoming a generic white admin clone.

## Visual System

### Concept

Name: Live Ops Console

The merchant backend should feel like a live auction backstage control surface:

- Dense enough for repeated PC operation.
- Clear enough for a competition demo.
- Status-first rather than decoration-first.
- Operational rather than marketing-like.

### Palette

Recommended values:

- Background: `#07090D`
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
- Draft / no-bid / inactive: `#7B8494`

Existing Tailwind utility usage may approximate these colors if exact CSS variables are not introduced. If shared CSS variables are introduced, they should be scoped to the frontend theme and not require framework or dependency changes.

### Layout And Components

Use compact, operational surfaces:

- 6-8px radii for repeated rows and controls.
- Thin cold-gray borders.
- Lightweight shadows.
- Tabular numbers for prices, countdowns, and counts.
- Semantic status badges and small realtime indicators.
- Stable row columns where viewport width allows.
- Responsive fallback that stacks row sections without overlapping text.

Avoid:

- Large purple gradients as the default accent.
- Decorative glow blobs and bokeh/orb backgrounds.
- Nested card structures.
- Marketing-style hero sections.
- Emoji-driven headings as primary structure.

## Merchant Console Frame

Introduce or approximate a shared merchant frame for merchant pages:

- Left navigation on desktop for dashboard, live products, orders, publish product, and profile/exit navigation when appropriate.
- Top/page bar for the current page title, short context, and page-level actions such as refresh or publish.
- Main content area with consistent background, spacing, and max width.

The shell must only wrap merchant pages. It must not change `ProtectedRoute`, auth hydration, role guards, or buyer routes.

## Product Management

Convert `/merchant/products` from a two-column card grid to a horizontal live product control list.

Row structure:

```text
Index | Product image + title + id/tags | Start/rule summary | Current state summary | Status + actions
```

When data is available, the row should show:

- Product thumbnail or fallback.
- Product title and short description.
- Product id or stable row identifier.
- Product/auction status.
- Auction id when present.
- Current route actions such as detail, monitor, edit, create/publish entry, and existing cancellation path where already available.

Data limitation:

- Current merchant product list rows expose `auction_id` but not every auction rule or bid metric. The row layout must not require unavailable backend fields.
- The UI may use placeholders such as `详情查看` or omit unavailable metrics.
- Deeper rule metrics remain on product detail, dashboard active auction summaries, and realtime monitor unless a later approved OpenSpec change adds read-only list fields.

## Dashboard

Keep the current merchant dashboard API and data model.

Update the visual structure:

- Compact KPI strip.
- Chart/list sections that align with the graphite console style.
- Active auctions and recent orders represented as scan-friendly rows.
- Empty, loading, and error states that match the console style.

The dashboard remains an operational PC overview, not an entertainment UI and not a decorative fullscreen data wall.

## Realtime Auction Monitor

Keep the current monitor behavior:

- Reuse `useLiveRoomStore`.
- Connect to `/ws/auctions/:id`.
- Render snapshot and realtime updates from WebSocket truth.
- Use the existing cancellation REST command and backend rejection messages.

Update visual hierarchy:

- Main area emphasizes product context, current price, countdown, status, connection state, and extension count.
- Side rail emphasizes ranking, realtime event feed, and operations control.
- Terminal states clearly disable mutation actions.
- Destructive cancellation is visible but visually contained.

## Orders

Update merchant order list to feel like transaction/deal flow rather than gallery cards:

```text
Product | Buyer | Amount | Status | Created | Confirmed/Paid | Action
```

The merchant order detail should emphasize:

- Product context.
- Buyer display info.
- Amount.
- Status.
- Created, confirmed, paid, and cancelled timestamps where present.
- Cancel reason when present.

Buyer-only confirm, cancel, and pay actions remain absent from merchant pages.

## Product Form And Detail

Keep all current form fields and commands.

Visual direction:

- Product identity and media section.
- Live-room material section.
- Auction rule parameter panel.
- Existing submit/publish/edit/delete/cancel/monitor actions with clearer visual hierarchy.

No validation rule, publish rule, or cancellation rule changes are included in this design.

## Testing Strategy

Update tests around user-visible behavior:

- Merchant product list should expose row/list semantics, status labels, and monitor/detail navigation.
- Merchant order list/detail should expose transaction status and detail navigation.
- Dashboard should still expose metrics, active auctions, recent orders, and navigation.
- Monitor should still expose current price, ranking, event feed, cancellation restrictions, and cancellation command.
- Product form/detail should still expose existing fields and actions.

Run:

- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `git diff --check`

Backend tests are only required if backend files are touched, which this design does not plan.

## Promotion Rule

If implementation requires new backend response fields, new endpoints, new WebSocket data, or modified business behavior, stop implementation and create a separate OpenSpec contract before continuing.
