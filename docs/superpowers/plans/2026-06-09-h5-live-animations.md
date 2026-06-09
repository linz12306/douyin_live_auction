# h5-live-animations Execution Plan

## Goal

Implement Motion for React animations for the buyer H5 live room core five effects while preserving WebSocket as realtime truth.

## Scope

Touch only:

- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/src/pages/app/LiveAuctionRoom.tsx`
- `frontend/src/pages/app/LiveAuctionRoom.test.tsx`
- workflow docs and memory

No backend/API/WebSocket/order/merchant changes.

## Tasks

- [x] 1. Planning and lock
  - Superpowers exploration created.
  - OpenSpec proposal/design/tasks/spec delta created.
  - This execution plan created.

- [x] 2. TDD red tests
  - Add tests for:
    - REST bid success does not show accepted-bid celebration.
    - WebSocket `price_update` renders price feedback.
    - WebSocket transition to current-user highest bidder renders bid-success and leading feedback.
    - Private outbid renders warning/recovery feedback.
    - Last-10-second state renders urgency feedback.
    - Terminal state suppresses active-auction animation and disables bidding.
  - Run `cd frontend && npm run test -- LiveAuctionRoom`.
  - Record the expected failing result.
  - Result: focused test run failed as expected before implementation with four missing animation markers.

- [x] 3. Dependency and implementation
  - Run `cd frontend && npm install motion`.
  - Import `motion`, `AnimatePresence`, and `useReducedMotion` from `motion/react`.
  - Add local `CoinBurst` and bounded animation wrappers in `LiveAuctionRoom.tsx`.
  - Track previous leading/outbid event keys so animations trigger only on WebSocket/store transitions, not REST command success or initial snapshot.
  - Keep decorative animation nodes `pointer-events-none`.
  - Result: implemented in `LiveAuctionRoom.tsx` with local Motion wrappers, reduced-motion branches, bounded coin burst, leading accent, outbid warning, price feedback, and countdown heartbeat.

- [x] 4. Focused verification
  - Run `cd frontend && npm run test -- LiveAuctionRoom`.
  - Fix until focused tests pass.
  - Result: passed with 23 tests.

- [x] 5. Full verification
  - Run `cd frontend && npm run test`.
  - Run `cd frontend && npm run build`.
  - Run `npx -y @fission-ai/openspec@latest validate h5-live-animations --strict --no-interactive`.
  - Run `git diff --check`.
  - Result:
    - `cd frontend && npm run test` passed with 16 files / 92 tests.
    - `cd frontend && npm run build` passed; Vite emitted the existing large-chunk warning.
    - `npx -y @fission-ai/openspec@latest validate h5-live-animations --strict --no-interactive` passed.
    - `git diff --check` passed.
    - 390x844 Playwright smoke passed for active + bid sheet, leading burst/accent, outbid warning, last-ten-seconds urgency, and terminal result with bidding disabled.

- [x] 6. Memory and status
  - Update `projects/proj-1779447357476-ryiijf/memory/2026-06-09.md`.
  - Update task checkboxes and verification notes.
  - Report no commit/push unless separately requested.

## Acceptance Checklist

- [x] Core five effects exist.
- [x] REST success does not imply accepted bid.
- [x] Reduced motion is respected.
- [x] No backend/API contracts changed.
- [x] Focused and full frontend verification completed.
