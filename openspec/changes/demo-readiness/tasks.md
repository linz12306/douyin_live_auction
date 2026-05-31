# Tasks: demo-readiness

- [ ] 1. Preflight and dependency cleanup
  - Confirm branch/worktree status.
  - Review `AGENTS.md`, current source of truth, requirements v3, progress report, existing E2E specs, and active OpenSpec changes.
  - Decide whether `merchant-dashboard` and `merchant-auction-monitor` are accepted and archive or record their status before final demo completion.
  - Validate `demo-readiness` with OpenSpec strict mode.

- [ ] 2. Superpowers execution plan
  - Create `docs/superpowers/plans/YYYY-MM-DD-demo-readiness.md`.
  - Include exact files, test-first slices, seed/reset strategy, E2E commands, and commit points.

- [ ] 3. Demo seed/reset support
  - Add local-only setup for demo merchant, buyer, competing bidder, auction data, and optional order/dashboard data.
  - Ensure repeated runs do not fail because of stale data.
  - Add verification for seed/reset behavior.

- [ ] 4. Demo-readiness E2E
  - Add a Playwright journey covering merchant setup/monitoring, buyer live bidding, competing outbid, settlement, and order confirmation/payment.
  - Use existing alternate-port environment conventions.

- [ ] 5. Demo blocker fixes
  - Run the demo journey and identify blocking UX or flow issues.
  - Fix only narrow blockers required for the runbook and E2E to pass.
  - Add focused tests for each blocker.

- [ ] 6. Runbook and final verification
  - Add the presenter runbook with startup, seed, accounts, path, checkpoints, and troubleshooting.
  - Run OpenSpec validation.
  - Run affected backend/frontend tests.
  - Run demo-readiness E2E.
  - Run `git diff --check`.
  - Update memory/progress and archive the accepted OpenSpec change.
