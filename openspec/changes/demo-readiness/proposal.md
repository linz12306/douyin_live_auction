# Proposal: demo-readiness

## Why

The core MVP capabilities now exist, but a successful product demonstration still depends on manual setup, local data state, and remembering the correct sequence across merchant, buyer, competing bidder, realtime monitoring, and order pages. That creates avoidable risk before demos and makes regressions harder to catch.

This change turns the existing implementation into a repeatable demo slice with seeded data, a documented runbook, and an end-to-end readiness check.

## What Changes

- Add local-only demo setup/reset support for deterministic presenter data.
- Add a Playwright demo-readiness journey covering the full auction and order lifecycle.
- Add a runbook with exact startup, seed, login, navigation, and verification steps.
- Fix only narrow UI/flow blockers discovered while making the demo repeatable.
- Archive or reconcile accepted merchant dashboard/monitor OpenSpec changes before final demo-readiness completion.

## Non-Goals

- Real payment provider integration.
- Real livestream infrastructure.
- New auction, wallet, or order business semantics.
- Large analytics or reporting expansion.
- Production fixture management.

## Impact

- Adds local development/demo tooling.
- Adds cross-flow E2E coverage.
- Improves confidence that backend, frontend, MySQL, Redis, WebSocket, auction settlement, and order payment paths work together.
