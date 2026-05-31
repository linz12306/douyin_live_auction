# Tasks: demo-readiness

- [x] 1. Preflight and dependency cleanup
  - Confirm branch/worktree status.
  - Review `AGENTS.md`, current source of truth, requirements v3, progress report, existing E2E specs, and active OpenSpec changes.
  - Decide whether `merchant-dashboard` and `merchant-auction-monitor` are accepted and archive or record their status before final demo completion.
  - Validate `demo-readiness` with OpenSpec strict mode.
  - Current status: `merchant-dashboard` and `merchant-auction-monitor` were validated and archived into persistent specs. `demo-readiness` remains active.

- [x] 2. Superpowers execution plan
  - Create `docs/superpowers/plans/YYYY-MM-DD-demo-readiness.md`.
  - Include exact files, test-first slices, seed/reset strategy, E2E commands, and commit points.
  - Current status: execution plan created at `docs/superpowers/plans/2026-05-31-demo-readiness.md`.

- [x] 3. Demo seed/reset support
  - Add local-only setup for demo merchant, buyer, competing bidder, auction data, and optional order/dashboard data.
  - Ensure repeated runs do not fail because of stale data.
  - Add verification for seed/reset behavior.
  - Current status: root `npm run demo:seed` creates/logs into demo accounts and creates a uniquely titled active auction through existing HTTP APIs.

- [x] 4. Demo-readiness E2E
  - Add a Playwright journey covering merchant setup/monitoring, buyer live bidding, competing outbid, settlement, and order confirmation/payment.
  - Use existing alternate-port environment conventions.
  - Current status: `tests/e2e/demo-readiness.spec.ts` passes against frontend `127.0.0.1:13000` and backend `127.0.0.1:18080` with `DISABLE_RATE_LIMIT=1`.

- [x] 5. Demo blocker fixes
  - Run the demo journey and identify blocking UX or flow issues.
  - Fix only narrow blockers required for the runbook and E2E to pass.
  - Add focused tests for each blocker.
  - Current status: no product blocker fix was required. The observed failures were E2E harness issues: direct full-page navigation lost refreshed auth state, and price assertions assumed a stale currency glyph. The test now follows the actual SPA demo path and accepts the rendered currency symbol.

- [x] 6. Runbook and final verification
  - Add the presenter runbook with startup, seed, accounts, path, checkpoints, and troubleshooting.
  - Run OpenSpec validation.
  - Run affected backend/frontend tests.
  - Run demo-readiness E2E.
  - Run `git diff --check`.
  - Update memory/progress and archive the accepted OpenSpec change.
  - Current status: runbook added at `docs/demo-readiness.md` and linked from `README.md`. Final verification passed with OpenSpec strict validation, backend Go tests, frontend unit tests, frontend build, demo-readiness E2E on isolated local ports, and `git diff --check`. Memory was updated before archive.
