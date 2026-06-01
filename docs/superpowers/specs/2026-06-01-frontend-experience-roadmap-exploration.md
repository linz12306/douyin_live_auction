# Frontend Experience Roadmap Exploration

## Goal

Plan the next frontend experience layer for the Douyin live auction MVP without changing business implementation code in this slice.

The roadmap must turn the existing H5 buyer room, merchant PC pages, realtime auction feedback, order result flow, and local demo path into executable frontend requirements. It should give later parallel workers clear ownership boundaries for `auction-atmosphere`, `merchant-analytics`, `demo-materials`, and `perf-observability`.

## Non-Goals

- Do not change auction engine, wallet, order, payment, settlement, cancellation, WebSocket, or database semantics in this planning slice.
- Do not edit React/TypeScript implementation files in this planning slice.
- Do not add real video streaming, real payment integration, cross-merchant admin views, or production observability dashboards.
- Do not archive this OpenSpec change until the planned frontend work is implemented and verified in later slices.
- Do not treat this roadmap as a replacement for per-package Superpowers execution plans. Each implementation package still needs its own plan before code changes.

## Workflow Choice

This is not a fast-lane UI polish task. It changes the acceptance criteria and execution boundaries for multiple future frontend work streams, including realtime user experience, merchant analytics, demo materials, and observability-facing UI. Per `AGENTS.md`, it uses Superpowers exploration plus an OpenSpec lock. Business implementation code is intentionally out of scope.

## Preflight Findings

- Current branch: `codex/frontend-requirements`.
- Initial worktree status: clean before this planning change.
- OpenSpec CLI is available through `npx -y @fission-ai/openspec@latest`; observed version `1.3.1`.
- `requirements-v3.md` is the current authority. It requires WebSocket as the realtime truth source, REST only for initialization, server-time offset based countdowns, H5 realtime notifications, ranking, atmosphere animations, buyer order confirmation/payment, and merchant PC dashboard/monitoring.
- `current-source-of-truth.md` confirms the latest stable capabilities are auction engine, realtime live room, order system, observability health, merchant dashboard, merchant auction monitor, and demo readiness.
- `docs/demo-readiness.md` already documents a local path through merchant dashboard, merchant product monitor, two buyer contexts, outbid notification, settlement, and buyer simulated payment.
- `frontend/src/App.tsx` already exposes protected routes for user auction lobby, user live room, user orders, merchant dashboard, merchant product CRUD, merchant auction monitor, and merchant orders.
- `frontend/src/pages/app/AuctionLobby.tsx` has a REST-driven lobby with loading, error, empty, refresh, order, and profile entry points.
- `frontend/src/pages/app/LiveAuctionRoom.tsx` already uses the live room store, WebSocket state, current price, countdown, ranking, notification feed, terminal state, and an order entry after sold terminal state.
- `frontend/src/pages/merchant/Dashboard.tsx` currently shows compact metric tiles, product/order status counts, active auctions, and recent orders, but not trend, distribution, or user-activity charts.
- `frontend/src/pages/merchant/AuctionMonitor.tsx` reuses the auction WebSocket state, shows PC-oriented realtime monitor data, rankings, event feed, terminal state, and an existing cancellation command with reason input.

## Users

- Buyer on H5: wants a mobile-first path from registration/login to lobby, live room, bidding, outbid recovery, result, order confirmation, and simulated payment.
- Merchant operator on PC: wants to publish products, monitor active auctions, cancel abnormal auctions within existing rules, inspect orders, and understand operating results.
- Presenter or reviewer: wants a repeatable demo path that visibly proves realtime bidding, private outbid notification, merchant monitoring, settlement, and buyer payment.
- Future frontend workers: need small independent work packages with explicit files, contracts, and verification so parallel implementation does not collide.

## User Journey Scenarios

### Buyer H5 Journey

1. A buyer registers or logs in as role `user` and lands on a discoverable route into `/app/auctions`.
2. The buyer scans the auction lobby, sees status, image, current price, end time, empty/loading/error states, and enters a live room.
3. The buyer enters `/app/auctions/:id`, sees live ambience, product context, current price, countdown, connection status, ranking, event feed, and bid controls.
4. The buyer submits the next bid or a custom valid bid. The UI shows a submitting state, then waits for WebSocket truth before changing current price, ranking, countdown, or leading status.
5. If another buyer outbids them, the buyer receives a prominent private outbid state with recovery action and realtime feedback.
6. When Soft Close extends the auction, the countdown reset and extension count are visible without contradicting server time.
7. When the auction ends, the buyer sees a clear won, lost, no-bid, or cancelled result state. Winners get an order entry; non-winners see terminal status without buyer-only order mutation actions.
8. The winner opens `/app/orders` or `/app/orders/:id`, confirms the pending order, performs simulated payment, and reaches a paid terminal state.

### Merchant PC Journey

1. A merchant registers or logs in as role `merchant` and reaches a PC-oriented dashboard/product management entry.
2. The merchant publishes a product with required auction rules and can find its active monitor route.
3. The merchant opens `/merchant/auctions/:id/monitor`, sees current price, countdown, status, rankings, event feed, connection state, and terminal messages.
4. If an auction is abnormal, the merchant can initiate the existing cancellation command only when the current pending/active rules allow it and sees backend rejection copy when the rule denies cancellation.
5. The merchant inspects `/merchant/orders` or `/merchant/orders/:id` after settlement and sees buyer, product, amount, status, and timestamps without buyer-only actions.
6. The merchant returns to `/merchant/dashboard` to see summary metrics and, in a later package, charts for trend, bid distribution, and user activity.

### Demo Journey

1. Presenter starts MySQL, Redis, backend, and frontend.
2. Presenter seeds demo accounts and an active auction through the documented local setup.
3. Merchant opens dashboard and monitor.
4. Buyer A enters the lobby and room, then bids.
5. Buyer B enters the same room and bids higher.
6. Buyer A sees the private outbid signal and can recover with a higher bid.
7. Merchant monitor shows the same realtime price, ranking, and bid event.
8. Buyer reaches a sold result, opens orders, confirms, and pays.
9. Presenter can point to health/troubleshooting checks when realtime or service state is not ready.

## Acceptance Criteria

- The OpenSpec change defines page-level requirements for H5 buyer, merchant PC, realtime atmosphere, order result, and demo path.
- The OpenSpec change defines state requirements for loading, empty, error, submitting, reconnecting, realtime update, outbid, extended, terminal, and order mutation states.
- The roadmap preserves `requirements-v3.md` decisions: WebSocket is realtime truth, REST initializes, bids wait for WebSocket confirmation, stale versions are ignored, and server time offsets drive countdowns.
- The roadmap splits later work into independent packages with clear ownership:
  - `auction-atmosphere`: H5 live room ambience, animation states, outbid recovery, countdown urgency, leading/lost/won feedback.
  - `merchant-analytics`: merchant charted dashboard views for trend, bid distribution, and user activity.
  - `demo-materials`: presenter-facing runbook, fixture notes, screenshots or checklists, and E2E readiness expectations.
  - `perf-observability`: frontend entry boundaries for health, auction engine metrics, and load-test visibility when a UI is needed.
- Each package has explicit non-overlap rules and verification expectations.
- No TSX, API, backend, migration, or test implementation files are edited in this planning slice.

## Recommended Technical Direction

Use the existing routes and stores as the baseline instead of inventing a parallel frontend architecture.

- Keep `useLiveRoomStore` and the existing WebSocket envelope as the realtime state boundary for buyer live room and merchant monitor.
- Let `auction-atmosphere` enhance presentation and local UI states around the existing room state. It must not create alternate auction truth or infer settlement from REST bid responses.
- Let `merchant-analytics` extend the current merchant dashboard. If chart data needs backend support beyond the current dashboard API, the implementation worker must create a child OpenSpec change or extend this one before coding.
- Let `demo-materials` focus on docs, local demo data path, screenshots/checklists, and E2E coverage. It should not add production-only behavior.
- Let `perf-observability` define frontend boundaries around existing `/healthz` and any future metrics endpoint. It should remain read-only and non-authoritative for auction operation.

## Parallel Work Boundaries

| Package | Owned Surface | May Touch | Must Not Touch |
| --- | --- | --- | --- |
| `auction-atmosphere` | Buyer H5 lobby/live room realtime presentation and result states | `frontend/src/pages/app/LiveAuctionRoom.tsx`, live-room UI helpers, focused component/E2E tests, small shared UI components | Merchant dashboard/monitor analytics, backend auction semantics, order mutation semantics |
| `merchant-analytics` | Merchant dashboard charts and analytics presentation | `frontend/src/pages/merchant/Dashboard.tsx`, dashboard types/API if compatible, chart components, dashboard tests | H5 bidding atmosphere, cancellation semantics, order state transitions |
| `demo-materials` | Demo runbook, seed/readiness notes, presenter checklist, demo E2E expectations | `docs/demo-readiness.md`, demo docs under `docs/`, E2E docs/tests when planned | Core product UI implementation unless a blocker is explicitly scoped |
| `perf-observability` | Read-only health/metrics frontend entry boundary | Observability docs, optional frontend route/component after API contract is locked, health/metrics tests | Auction engine writes, wallet/order data, performance claims without measured source |

## Risks

- Realtime polish can accidentally create a second source of truth. Mitigation: require WebSocket state for price, ranking, countdown, and terminal updates.
- Animation work can hide critical bid or order states on small screens. Mitigation: require mobile-first layout checks and non-overlap states before completion.
- Merchant analytics may need backend aggregate data that does not exist yet. Mitigation: define API contract before implementation, and keep frontend charts empty-state capable.
- Demo materials can become stale quickly. Mitigation: tie runbook checkpoints to actual routes and automated readiness checks.
- Observability UI can imply operational authority it does not have. Mitigation: label it read-only and separate it from merchant/user decision flows.

## Open Questions Resolved By Assumption

- This roadmap is for local MVP and reviewer demo readiness, not production launch hardening.
- Existing authentication, product publishing, auction engine, WebSocket, order workflow, merchant dashboard, and merchant monitor remain the baseline.
- Future packages may run in parallel only after this OpenSpec change is validated, and each package should create or update its own Superpowers execution plan before touching code.
- If a package discovers that backend contracts are insufficient, it must pause and update OpenSpec before implementation.
