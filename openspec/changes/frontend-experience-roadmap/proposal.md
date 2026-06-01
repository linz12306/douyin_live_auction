# Proposal: frontend-experience-roadmap

## Why

The project now has the core auction engine, realtime room, order workflow, merchant dashboard, merchant monitor, observability health, and demo readiness path. The next risk is no longer a single missing endpoint. The risk is frontend work spreading across H5 buyer experience, merchant PC experience, realtime atmosphere, analytics, demo materials, and observability entry points without a shared page-level contract.

This change locks the frontend experience roadmap before parallel implementation starts. It translates `requirements-v3.md`, the current OpenSpec specs, the demo runbook, the current React routes/pages, and the user-confirmed Douyin-style live commerce direction into executable requirements and package boundaries.

## What Changes

- Define the buyer H5 journey from auth, lobby, Douyin-style live room, auction floating card, half-screen bid sheet, product shelf shell, outbid recovery, in-room result modal, order confirmation, and simulated payment.
- Define the merchant PC journey from auth, product publishing, auction monitoring, abnormal cancellation, order inspection, and dashboard review.
- Define page-level states for loading, empty, error, submitting, reconnecting, realtime update, outbid, extension, terminal, and order-action feedback.
- Define mobile adaptation expectations for the live commerce H5 room and dense PC expectations for merchant pages.
- Define a repeatable demo path and demo-material expectations.
- Split future frontend implementation into independent packages:
  - `auction-atmosphere`
  - `merchant-analytics`
  - `demo-materials`
  - `perf-observability`
- Define read-only frontend boundaries for observability and performance displays when a UI is needed.

## Important Compatibility Decisions

- WebSocket remains the realtime truth source after room connection. REST initializes state and submits commands, but REST bid responses must not directly mutate visible realtime price, ranking, countdown, or terminal state.
- Server time and auction version metadata remain required for realtime countdown and stale-message protection.
- Douyin-style means structural and experiential similarity to live commerce references, not use of Douyin marks, copied UI assets, or real third-party creator/product media.
- The first H5 implementation may show a multi-item product shelf shell, but only the current auction item is required to be realtime-backed. True multi-item realtime bidding is out of scope until a later OpenSpec contract expands backend and WebSocket semantics.
- Buyer order actions remain scoped to buyer pages. Merchant pages inspect orders but do not expose buyer-only confirm, cancel, or pay actions.
- Merchant cancellation remains the existing backend command and rule set. This roadmap only clarifies frontend affordance, copy, state display, and error handling.
- Analytics and observability work must remain read-only unless a later OpenSpec change explicitly changes backend contracts.

## Impact

- Documentation:
  - Add Superpowers exploration for frontend experience roadmap.
  - Add OpenSpec change files for proposal, design, tasks, and frontend roadmap requirements.
- Frontend:
  - No implementation files are modified in this planning slice.
  - Future work will likely touch H5 auction pages, merchant dashboard, demo docs/tests, and optional observability UI entry points.
- Backend/API:
  - No backend code or schema change in this planning slice.
  - Future `merchant-analytics` or `perf-observability` work may require explicit API contracts before implementation.
- Testing:
  - This planning slice validates OpenSpec strictness and whitespace only.
  - Future packages must add focused frontend tests and E2E/demo verification.

## Out Of Scope

- Business implementation code changes.
- Database migrations.
- Auction engine, wallet, payment, settlement, or order state-machine changes.
- Real livestream ingestion, chat, real payment, production analytics, or production monitoring dashboards.
- True multi-item realtime bidding inside one live room.
- Use of Douyin branding, copied Douyin assets, or real third-party creator/brand media.
- OpenSpec archive. This change should remain active until implementation packages are completed and verified.
