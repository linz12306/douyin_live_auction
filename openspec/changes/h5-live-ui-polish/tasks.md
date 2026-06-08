# Tasks: h5-live-ui-polish

- [x] 1. Superpowers exploration
  - Read `AGENTS.md`, `requirements-v3.md`, current source-of-truth, existing H5 OpenSpec changes, buyer live room code, live room store, buyer lobby code, buyer order code, and focused tests.
  - Confirm user priorities:
    - fix overlap/layout first,
    - improve button display quality second,
    - add click/state feedback animations third.
  - Create `docs/superpowers/specs/2026-06-08-h5-live-ui-polish-exploration.md`.
  - Run exploration self-review and `git diff --check`.

- [x] 2. OpenSpec lock
  - Create `openspec/changes/h5-live-ui-polish/proposal.md`.
  - Create `openspec/changes/h5-live-ui-polish/design.md`.
  - Create `openspec/changes/h5-live-ui-polish/tasks.md`.
  - Create spec deltas for `realtime-live-room` and `order-system`.
  - Run `npx -y @fission-ai/openspec@latest validate h5-live-ui-polish --strict --no-interactive`.
  - Run `git diff --check`.

- [x] 3. Superpowers implementation plan
  - After user approval of OpenSpec lock, create `docs/superpowers/plans/2026-06-08-h5-live-ui-polish.md`.
  - Break work into focused slices:
    - live-room layout stability,
    - live-room button polish,
    - WebSocket-driven feedback motion,
    - buyer lobby CTA polish,
    - buyer order action polish,
    - focused tests and visual verification.
  - Include exact files, commands, expected results, and commit checkpoints.

- [x] 4. Live-room layout stability
  - Refine `frontend/src/pages/app/LiveAuctionRoom.tsx` fixed zones for mobile.
  - Keep host bar, badges, rankings, messages, action rail, floating card, bottom controls, bid sheet, shelf, and result modal readable at 390x844.
  - Preserve existing WebSocket connection lifecycle and store truth rules.
  - Add or update focused tests for visible critical controls.

- [x] 5. Live-room button polish
  - Replace rough/text/outline-feeling controls with polished filled/elevated controls.
  - Ensure buttons have stable dimensions, readable labels, accessible names, and disabled states.
  - Preserve existing route and command behavior.
  - Add or update focused tests for bid sheet CTAs, amount steppers, shelf entry, bottom bid entry, and terminal disabled state.

- [x] 6. Feedback motion and realtime state cues
  - Add CSS/Tailwind-based click feedback for key buttons.
  - Add WebSocket-driven price update pulse without relying on REST bid success.
  - Strengthen outbid, leading, last-10-second urgency, extension, submitting/error, and terminal feedback.
  - Add or update focused tests proving REST bid success still does not directly update visible realtime truth.

- [x] 7. Buyer secondary page polish
  - Refine `/app/auctions` CTAs only where needed for visual consistency.
  - Refine `/app/orders` card action layout and copy.
  - Refine `/app/orders/:id` confirm/pay/cancel/refresh action layout and submitting states.
  - Keep existing APIs and order actions unchanged.
  - Add or update focused tests for buyer order actions.

- [x] 8. Verification
  - Run `cd frontend && npm run test -- LiveAuctionRoom`.
  - Run `cd frontend && npm run test -- AuctionLobby OrderList OrderDetail`.
  - Run `cd frontend && npm run test`.
  - Run `cd frontend && npm run build`.
  - Run `npx -y @fission-ai/openspec@latest validate h5-live-ui-polish --strict --no-interactive`.
  - Run `git diff --check`.
  - Perform mobile layout smoke at 390x844 for live room default, bid sheet, shelf, result modal, order list, and order detail.
  - Run `go test ./...` only if backend files are touched.
  - Verification:
    - `cd frontend && npm run test -- LiveAuctionRoom AuctionLobby OrderList OrderDetail` passed with 6 files / 30 tests.
    - `cd frontend && npm run test` passed with 16 files / 80 tests.
    - `cd frontend && npm run build` passed.
    - `npx -y @fission-ai/openspec@latest validate h5-live-ui-polish --strict --no-interactive` passed.
    - `git diff --check` passed.
    - 390x844 Playwright smoke passed for live room default controls, bid sheet, shelf, order list, and order detail key actions.
    - Backend unchanged; `go test ./...` not required.

- [x] 9. Memory update
  - Update project memory with delivered scope, verification results, risks, and next step.

- [ ] 10. Commit and push
  - Confirm no unrelated dirty files are included.
  - Commit verified slice with a concise conventional message.
  - Push branch and report commit/push state.
