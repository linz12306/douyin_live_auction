# demo-readiness Exploration

## Goal

Make the current Douyin live auction MVP reliable to demonstrate repeatedly from a clean local environment.

The demo should show a complete business path: merchant prepares an auction, users participate in the live auction, realtime outbid/price updates work, the merchant monitors the auction, the auction settles, and the buyer completes order confirmation and simulated payment.

## Non-Goals

- Do not add real livestream ingestion or playback.
- Do not add real payment integration.
- Do not add new auction/order state semantics.
- Do not build a large analytics system.
- Do not make demo seed data usable in production.

## Current Context

- `master` is clean and synced to `origin/master`.
- The core archived capabilities are present: auction engine, realtime live room, order system, observability health, and self-outbid bugfix.
- `merchant-dashboard` and `merchant-auction-monitor` are implemented and verified, but their OpenSpec changes are still active and should be archived or explicitly carried forward before demo completion.
- Existing Playwright coverage already includes auth, product CRUD, realtime live room, and order system flows.
- Local backend and frontend are expected to run against Docker MySQL and Redis, with `DISABLE_RATE_LIMIT=1` available for repeatable E2E runs.

## Users

- The presenter needs a repeatable path that can be run before a demo to confirm the system is ready.
- Judges or reviewers need a short, predictable scenario that demonstrates the product's core value.
- Developers need a smoke test that catches regressions across backend, frontend, realtime, and order flows.

## Scenarios

1. A developer runs a demo seed command and gets deterministic demo accounts, products, auctions, bids, and/or orders suitable for local presentation.
2. A presenter follows a runbook to start the system, log in as merchant and users, open the core pages, and demonstrate the auction lifecycle.
3. A Playwright demo journey validates the end-to-end flow across merchant, buyer, and competing bidder contexts.
4. Core demo pages handle empty/loading/error states without blocking the presentation.
5. Health checks and test commands make it clear whether MySQL, Redis, backend, frontend, and realtime behavior are ready.

## Acceptance Criteria

- Demo setup is repeatable and documented.
- Demo data is clearly non-production and can be reset or made unique per run.
- A single E2E journey verifies the main demo path.
- Existing focused E2E tests remain usable.
- The demo runbook lists exact commands, demo accounts, expected pages, and fallback checks.
- Any UX fixes are limited to demonstration blockers and do not change backend contracts unless explicitly added to OpenSpec.

## Recommended Technical Direction

Use a conservative three-part implementation:

1. Add local-only demo seed/reset support using existing HTTP APIs or repository/service boundaries.
2. Add a Playwright `demo-readiness` spec that drives the full presenter path.
3. Add a demo runbook and small UI polish only where the E2E or manual runbook reveals a blocker.

## Risks

- Shared local database state can make demos flaky. Mitigation: deterministic cleanup or unique demo identifiers.
- Auction countdowns are time-sensitive. Mitigation: use short but stable durations and explicit waits around WebSocket messages.
- Existing unarchived merchant changes can confuse capability state. Mitigation: archive accepted changes before completing demo-readiness.
- Over-polishing can expand scope. Mitigation: only fix blockers observed in the demo journey.

## Open Questions Resolved by Assumption

- Demo target is local development, not production.
- The main route should demonstrate existing product value before adding analytics or large merchant features.
- Seed data may use test-mode/local-only safeguards.
