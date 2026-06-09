# Tasks: h5-live-animations

- [x] 1. Superpowers exploration
  - Read repo workflow rules, latest requirements, existing live-room docs, current live-room implementation, live-room store, and focused tests.
  - Confirm visual direction: A+B hybrid with Motion for React.
  - Review bids/orders files as required by `AGENTS.md` and record that this frontend-only change leaves them untouched.
  - Create `docs/superpowers/specs/2026-06-09-h5-live-animations-exploration.md`.

- [x] 2. OpenSpec lock
  - Create `openspec/changes/h5-live-animations/proposal.md`.
  - Create `openspec/changes/h5-live-animations/design.md`.
  - Create `openspec/changes/h5-live-animations/tasks.md`.
  - Create `openspec/changes/h5-live-animations/specs/realtime-live-room/spec.md`.
  - Run strict OpenSpec validation.

- [x] 3. Superpowers execution plan
  - Create `docs/superpowers/plans/2026-06-09-h5-live-animations.md`.
  - Use TDD for live-room behavior boundaries before production implementation.

- [x] 4. Add failing tests
  - Add focused tests to `LiveAuctionRoom.test.tsx` for REST no-celebration, price feedback, leading/bid-success feedback, outbid warning, final-10-second urgency, and terminal suppression.
  - Run focused tests and confirm the new behavior tests fail for missing animation markers.
  - Verification:
    - `cd frontend && npm run test -- LiveAuctionRoom` failed as expected before implementation with four missing animation markers: price feedback, bid-success burst, outbid warning, and countdown urgency.

- [x] 5. Install and implement Motion animations
  - Run `npm install motion` in `frontend/`.
  - Update `LiveAuctionRoom.tsx` with Motion imports, reduced-motion handling, event keys, animated price/leading/outbid/countdown/coin burst UI.
  - Keep decorative animation elements pointer-events free and non-blocking.

- [x] 6. Verification
  - Run focused live-room tests.
  - Run full frontend tests.
  - Run frontend build.
  - Run OpenSpec strict validation.
  - Run `git diff --check`.
  - Record results in this task file and the Superpowers plan.
  - Verification:
    - `cd frontend && npm run test -- LiveAuctionRoom` passed with 23 tests.
    - `cd frontend && npm run test` passed with 16 files / 92 tests.
    - `cd frontend && npm run build` passed; Vite emitted the existing large-chunk warning.
    - `npx -y @fission-ai/openspec@latest validate h5-live-animations --strict --no-interactive` passed.
    - `git diff --check` passed.
    - 390x844 Playwright smoke passed for active + bid sheet, leading burst/accent, outbid warning, last-ten-seconds urgency, and terminal result with bidding disabled.

- [x] 7. Memory update
  - Update project memory with delivered scope, verification, risks, and next step.

- [ ] 8. Commit/push
  - Not approved in the implementation request. Leave uncommitted unless the user explicitly asks to commit or push.
