# Design: demo-readiness

## Overview

`demo-readiness` is a hardening and verification change. It does not create a new product domain; it packages the existing domains into a reliable local presentation workflow.

The implementation should be split into three boundaries:

1. **Demo data setup**: create or reset local-only demo accounts and auction/order data.
2. **Demo verification**: run an E2E journey that proves the presenter path works.
3. **Demo documentation and polish**: provide a runbook and fix only blockers that interrupt the main demo path.

## Demo Data Setup

The seed mechanism should be explicit and local-only. It may be implemented as a script or a guarded backend command/endpoint, but it must avoid production exposure.

Required demo actors:

- Merchant account.
- Buyer/user A account.
- Competing bidder/user B account.

Required demo objects:

- At least one published active auction for live bidding.
- At least one path that can produce a settled order.
- Optional already-completed order data for dashboard pages, if needed for a useful first screen.

The seed flow should either clean previous demo data by a stable prefix or create unique identifiers per run. It must not rely on manually editing the database.

## Demo Verification

Add a Playwright E2E spec for the presenter journey. It should use existing APIs for setup where possible and browser interactions for user-visible proof.

The journey should verify:

- Merchant can reach product/dashboard/monitor entry points.
- Buyer can enter the auction room.
- Buyer A can bid and see realtime state.
- User B can outbid Buyer A.
- Buyer A receives a private outbid notification only when outbid by User B.
- Merchant monitor reflects the realtime auction state.
- Auction can settle into an order.
- Buyer can confirm and simulate payment.
- Health/readiness checks are visible or documented before the demo.

This E2E should be allowed to run against alternate local ports using existing `PLAYWRIGHT_BASE_URL`, `VITE_BACKEND_TARGET`, `SERVER_PORT`, and `DISABLE_RATE_LIMIT` conventions.

## Demo Runbook

Add documentation that a presenter can follow without reading code. It should include:

- Required Docker services and expected ports.
- Backend/frontend startup commands.
- Demo seed/reset command.
- Demo accounts and roles.
- Main demonstration path.
- Expected visible checkpoints.
- Troubleshooting checks for `/healthz`, WebSocket behavior, stale local data, and rate limits.

## UX Polish Boundary

Only fix blockers that affect the demo path. Examples:

- A required entry link is missing.
- A loading or empty state makes a valid seeded page look broken.
- A button remains enabled when the backend will certainly reject the action.
- An error message is unreadable or hidden.

Do not redesign pages or add analytics charts in this change unless the existing demo path cannot communicate the product without them.

## OpenSpec State Cleanup

Before archiving `demo-readiness`, accepted active changes should be reconciled:

- `merchant-dashboard`
- `merchant-auction-monitor`

If they are accepted, archive them. If not accepted, record their status and avoid building demo-readiness on unaccepted behavior.

## Verification

Minimum verification for completion:

- OpenSpec validation for `demo-readiness`.
- All affected backend tests.
- All affected frontend tests.
- Demo-readiness Playwright E2E.
- Existing realtime and order E2E remain runnable or are included in the combined demo journey.
- `git diff --check`.

## Risks and Mitigations

- **Flaky timing around WebSocket and auction settlement**: use explicit UI checkpoints and bounded waits tied to observable state.
- **Dirty local database state**: seed/reset must be deterministic.
- **Over-expansion into feature work**: only fix demo blockers, and promote larger product changes into separate OpenSpec changes.
- **Unarchived dependency confusion**: resolve dashboard/monitor change status before final demo archive.
