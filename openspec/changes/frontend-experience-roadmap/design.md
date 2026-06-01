# Design: frontend-experience-roadmap

## Technical Approach

Lock frontend requirements as a planning OpenSpec change that future implementation workers can execute in independent packages. The design uses current implementation as the baseline and avoids code changes in this slice.

The current route surface is:

- User H5: `/register`, `/login`, `/profile`, `/app/auctions`, `/app/auctions/:id`, `/app/orders`, `/app/orders/:id`.
- Merchant PC: `/merchant/dashboard`, `/merchant/products`, `/merchant/products/new`, `/merchant/products/:id`, `/merchant/products/:id/edit`, `/merchant/auctions/:id/monitor`, `/merchant/orders`, `/merchant/orders/:id`.

The roadmap does not introduce a new state architecture. It constrains future work to existing contracts unless a child OpenSpec change expands them.

## Current Frontend Baseline

`AuctionLobby` is REST-loaded and refreshable. It already has loading, error, empty, profile, order, and room entry affordances.

`LiveAuctionRoom` uses `useLiveRoomStore`, room WebSocket connection state, current price, countdown, next bid amount, custom bid submission, ranking, notification feed, terminal messages, and an order entry after sold state.

`AuctionMonitor` reuses the live room store for merchant monitoring. It shows PC-oriented product context, connection state, status, countdown, latest event, ranking, event feed, terminal state, and an existing cancellation command with reason input.

`Dashboard` shows merchant summary metric tiles, product and order status buckets, active auction summaries, and recent orders. It does not yet show trend charts, bid distribution, or user activity statistics required by `requirements-v3.md`.

`docs/demo-readiness.md` already contains a local presenter path through merchant dashboard, monitor, buyer bidding, outbid notice, settlement, and simulated payment.

## State Model Rules

Future frontend work must keep these state rules explicit:

- `loading`: first REST or route-level fetch has not completed.
- `empty`: request succeeds but there is no content, such as no auctions, rankings, notifications, orders, or chart data.
- `error`: REST or command failure is visible, recoverable, and does not leave stale submitting state.
- `connecting` / `reconnecting` / `closed` / `error`: WebSocket connection state is visible in live room and merchant monitor.
- `submitting`: bid, cancellation, confirmation, payment, or refresh commands disable duplicate submission and show immediate feedback.
- `realtime update`: accepted price, ranking, countdown, extension count, and terminal state update only from WebSocket truth after connection.
- `outbid`: private outbid feedback is prominent and provides a fast path to bid again when the auction is still active.
- `extended`: Soft Close reset is visible through countdown and extension count, without relying on client-only timers.
- `terminal`: ended sold, ended no-bid, and cancelled states disable mutation actions that no longer apply.
- `order result`: winners can reach order confirmation/payment; non-winners see terminal result without buyer-only order actions.

## Buyer H5 Experience

The buyer H5 work should remain mobile-first. The first screen of the room should prioritize:

- Product/live visual context.
- Current price and countdown.
- Connection/status indicators.
- Bid action and custom bid input.
- Ranking and recent event feedback.
- Terminal result and order entry when applicable.

`auction-atmosphere` should enhance the existing room instead of changing auction truth. It may add visual emphasis such as leading state, outbid warning, countdown urgency, price movement, extension reset, and result celebration/settlement cues. It must preserve accessible text feedback and keep controls usable on narrow screens.

## Merchant PC Experience

Merchant pages should stay operational and information-dense. The PC monitor should prioritize scanning and intervention:

- Current auction state, price, countdown, extension count, and connection status.
- Ranking and event feed.
- Cancellation affordance with reason and restriction copy.
- Terminal state and final price/result.
- Navigation back to products, orders, and dashboard.

`merchant-analytics` should extend the current dashboard with charts and richer summaries while preserving zero-data states. If trend, distribution, or activity data is not derivable from the current dashboard API, the worker must lock an API contract before implementation.

## Demo Materials

`demo-materials` owns presenter-facing reliability:

- Keep `docs/demo-readiness.md` aligned with actual routes, accounts, service ports, and checkpoints.
- Document the exact visual checkpoints for merchant monitor, buyer outbid, terminal result, and order payment.
- Add or update automated readiness checks only after the expected UI states are specified.
- Avoid production behavior changes unless an observed demo blocker is explicitly scoped.

## Perf And Observability Boundary

`perf-observability` is read-only by default. It may define or implement frontend entry points for:

- Backend health status from `/healthz`.
- Auction engine metrics such as active auctions, bid success rate, latency, WebSocket connections, and lock contention if an API contract exists.
- Load-test or demo pressure results when produced by a documented script or service.

Any missing metrics endpoint must be specified before UI implementation. The frontend must not infer performance health from buyer or merchant business state.

## Package Ownership

### `auction-atmosphere`

Owned surfaces:

- Buyer live room realtime atmosphere.
- Buyer outbid and leading states.
- Countdown urgency and Soft Close feedback.
- Buyer terminal result display and order entry clarity.

Primary files likely touched later:

- `frontend/src/pages/app/LiveAuctionRoom.tsx`
- `frontend/src/pages/app/liveRoomUtils.ts`
- `frontend/src/store/liveRoomStore.ts`
- Focused H5 component and E2E tests.

### `merchant-analytics`

Owned surfaces:

- Merchant dashboard charts.
- Trend, bid distribution, and user activity presentation.
- Dashboard empty/error/loading chart states.

Primary files likely touched later:

- `frontend/src/pages/merchant/Dashboard.tsx`
- `frontend/src/types/dashboard.ts`
- `frontend/src/api/dashboard.ts`
- Chart components under `frontend/src/components/` if shared.
- Focused dashboard tests.

### `demo-materials`

Owned surfaces:

- Demo runbook, route checklist, visual checkpoints, and readiness notes.
- Demo E2E expectations and fixture documentation.

Primary files likely touched later:

- `docs/demo-readiness.md`
- Demo docs under `docs/`
- `tests/e2e/` demo readiness tests if implementation is included.

### `perf-observability`

Owned surfaces:

- Read-only frontend entry for health and metrics.
- API boundary documentation for metrics if needed.
- Verification of metrics display using stable fixtures or mocked responses.

Primary files likely touched later:

- `openspec/specs/observability-health/spec.md` or a child change if API contract changes.
- Optional frontend observability page/component after contract lock.
- Focused route/component tests.

## Parallelization Rules

Packages may run in parallel when they keep the owned surfaces above and do not change shared contracts without coordination. A package must stop and update OpenSpec if it needs:

- New backend routes or response fields.
- A new WebSocket message type.
- A new order, auction, wallet, or payment semantic.
- Shared store changes that alter merchant monitor and buyer live room behavior together.

If two packages need `useLiveRoomStore`, `auction-atmosphere` owns user-visible buyer behavior and must coordinate any shared-store changes with monitor expectations.

## Verification Strategy

This planning slice verifies:

- `npx -y @fission-ai/openspec@latest validate frontend-experience-roadmap --strict --no-interactive`
- `git diff --check`

Future implementation packages should add focused verification:

- `auction-atmosphere`: component tests for states and Playwright coverage for outbid, extension, terminal, and mobile viewport checks.
- `merchant-analytics`: dashboard component/API tests, chart empty/error states, and build verification.
- `demo-materials`: demo readiness E2E or documented manual checkpoints.
- `perf-observability`: mocked health/metrics display tests and, when applicable, measured load-test source documentation.

## Archive Policy

Do not archive this change after planning. Archive only after the planned packages are implemented, verified, task checkboxes reflect reality, and the resulting persistent specs match the delivered frontend behavior.
