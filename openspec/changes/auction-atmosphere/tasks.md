# Tasks: auction-atmosphere

- [x] 1. Exploration and OpenSpec lock
  - Read `AGENTS.md`, `requirements-v3.md`, current source-of-truth, frontend roadmap docs, realtime live-room spec, order-system spec, merchant monitor spec, `LiveAuctionRoom`, `useLiveRoomStore`, and current tests.
  - Run explicit user brainstorm checkpoint for the first slice.
  - Create `docs/superpowers/specs/2026-06-02-auction-atmosphere-exploration.md`.
  - Create OpenSpec change files under `openspec/changes/auction-atmosphere/`.
  - Run `npx -y @fission-ai/openspec@latest validate auction-atmosphere --strict --no-interactive`.
  - Run `git diff --check`.
  - Verification:
    - `npx -y @fission-ai/openspec@latest validate auction-atmosphere --strict --no-interactive` passed.
    - `git diff --check` passed.

- [x] 2. Superpowers execution plan
  - Create `docs/superpowers/plans/2026-06-02-auction-atmosphere.md`.
  - Break implementation into focused slices:
    - live-room shell and floating card,
    - bid sheet and REST command states,
    - shelf shell,
    - outbid/leading/urgency/extension/result feedback,
    - test/E2E updates.
  - Keep plan checkboxes synchronized with actual work.

- [x] 3. Live-room shell and floating card
  - Reshape `frontend/src/pages/app/LiveAuctionRoom.tsx` into a full-screen mobile-first live commerce surface.
  - Add top host bar, live/status/rule badges, scene layer, comments/system messages, right-side atmosphere controls, bottom controls, and persistent auction floating card.
  - Preserve existing WebSocket connection lifecycle and refresh behavior.
  - Add focused tests for the shell and floating card.

- [x] 4. Strong-state bid sheet
  - Add a half-screen bid sheet opened from the floating card and bid actions.
  - Show product context, current price, countdown, increment, my bid state, amount controls, CTA, and command errors.
  - Preserve REST command behavior: success does not directly update realtime price/ranking/countdown/terminal truth.
  - Add focused tests for no bid, leading, outbid, submitting/error, terminal, and custom amount behavior.

- [x] 5. Product shelf shell
  - Add a half-screen product shelf shell.
  - Show current realtime auction item plus demo shell rows for upcoming, no-bid, and ended states.
  - Make only the current item open the realtime bid sheet.
  - Add focused tests for current vs demo shelf behavior.

- [x] 6. Realtime atmosphere and result feedback
  - Add visible outbid recovery state in room messages and bid sheet.
  - Add leading state, last-10-second urgency, Soft Close extension count/message, and terminal result modal.
  - Add winner/non-winner/no-bid/cancelled modal states using existing order routes.
  - Add focused tests for outbid, leading, urgency/extension where practical, and terminal result states.

- [x] 7. E2E and verification
  - Update realtime/demo E2E selectors for the new bid sheet and result modal while preserving two-buyer behavior assertions.
  - Run focused frontend tests for `LiveAuctionRoom`.
  - Run `cd frontend && npm run build`.
  - Run `npx -y @fission-ai/openspec@latest validate auction-atmosphere --strict --no-interactive`.
  - Run `git diff --check`.
  - Verification:
    - `cd frontend && npm run test -- LiveAuctionRoom` passed.
    - `cd frontend && npm run test` passed with 62 tests.
    - `cd frontend && npm run build` passed.
    - `npx playwright test tests/e2e/realtime-live-room.spec.ts tests/e2e/demo-readiness.spec.ts --list` passed.
    - Browser screenshot/layout check passed for 390x844 and 1200x900 with mocked auth and WebSocket snapshot.
    - `npx -y @fission-ai/openspec@latest validate auction-atmosphere --strict --no-interactive` passed.
    - `git diff --check` passed.

- [ ] 8. Commit and push
  - Confirm no unrelated dirty files are included.
  - Commit the verified slice with a concise conventional message.
  - Push the branch and report commit/push state.
