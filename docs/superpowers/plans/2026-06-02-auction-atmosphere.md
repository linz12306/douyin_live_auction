# Auction Atmosphere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the buyer H5 live auction room into a Douyin-style live commerce auction experience while preserving existing backend, order, wallet, REST, and WebSocket semantics.

**Architecture:** Keep `useLiveRoomStore` as the realtime truth boundary. `LiveAuctionRoom.tsx` owns the atmosphere UI, local overlay state, command state, and presentation. REST bid commands may update local submitting/error state only; current price, ranking, countdown, extension count, leading/outbid state, and terminal state remain WebSocket-derived.

**Tech Stack:** React 19, TypeScript, Vite, TailwindCSS, Zustand, Vitest Testing Library, Playwright.

---

### Task 1: Exploration And OpenSpec Lock

**Files:**
- Add: `docs/superpowers/specs/2026-06-02-auction-atmosphere-exploration.md`
- Add: `openspec/changes/auction-atmosphere/proposal.md`
- Add: `openspec/changes/auction-atmosphere/design.md`
- Add: `openspec/changes/auction-atmosphere/tasks.md`
- Add: `openspec/changes/auction-atmosphere/specs/realtime-live-room/spec.md`

- [x] **Step 1: Read current requirements and implementation**

Reviewed `AGENTS.md`, `requirements-v3.md`, current source-of-truth, frontend roadmap docs, realtime live-room spec, order-system spec, merchant monitor spec, `LiveAuctionRoom`, `useLiveRoomStore`, current unit tests, and live-room/demo E2E tests.

- [x] **Step 2: Run user brainstorm checkpoint**

Confirmed the first slice is only `/app/auctions/:id`, including live-room shell, floating card, bid sheet, product shelf shell, and result modal, while preserving WebSocket truth and backend semantics.

- [x] **Step 3: Create exploration and OpenSpec files**

Created the Superpowers exploration and OpenSpec change structure for `auction-atmosphere`.

- [x] **Step 4: Verify**

Run:

```bash
npx -y @fission-ai/openspec@latest validate auction-atmosphere --strict --no-interactive
git diff --check
```

Result: both commands exited `0`.

### Task 2: Live-Room Shell And Floating Card

**Files:**
- Modify: `frontend/src/pages/app/LiveAuctionRoom.tsx`
- Modify: `frontend/src/pages/app/LiveAuctionRoom.test.tsx`

- [x] **Step 1: Add tests for shell and floating card**

Assert the room renders host bar, live/rule badges, visual scene, system messages, right action rail, bottom controls, and a persistent auction floating card.

- [x] **Step 2: Implement mobile-first shell**

Replace the current product-panel plus side-card layout with a full-screen live commerce stage and desktop fallback wrapper.

- [x] **Step 3: Implement floating card behavior**

Floating card shows status, current price, countdown, bid count, and opens the bid sheet without mutating realtime truth.

- [x] **Step 4: Run focused tests**

```bash
cd frontend && npm run test -- LiveAuctionRoom
```

### Task 3: Strong-State Bid Sheet

**Files:**
- Modify: `frontend/src/pages/app/LiveAuctionRoom.tsx`
- Modify: `frontend/src/pages/app/LiveAuctionRoom.test.tsx`

- [x] **Step 1: Add tests for bid sheet states**

Cover no bid, leading, outbid, submitting/error, terminal, custom amount, and REST-success-no-realtime-mutation behavior.

- [x] **Step 2: Implement bid sheet overlay**

Add half-screen overlay with product context, current price, countdown, increment, amount controls, buyer bid state, dynamic CTA, and command error feedback.

- [x] **Step 3: Preserve command semantics**

Ensure REST success clears command state and amount input but does not change current price, ranking, countdown, extension count, or terminal truth.

- [x] **Step 4: Run focused tests**

```bash
cd frontend && npm run test -- LiveAuctionRoom
```

### Task 4: Product Shelf Shell

**Files:**
- Modify: `frontend/src/pages/app/LiveAuctionRoom.tsx`
- Modify: `frontend/src/pages/app/LiveAuctionRoom.test.tsx`

- [x] **Step 1: Add shelf tests**

Assert shelf opens from bottom commerce action, lists current realtime item and demo shell rows, and only current item opens bid sheet.

- [x] **Step 2: Implement shelf overlay**

Add half-screen product shelf with `竞拍中`, `即将开拍`, `竞拍未成交`, and `竞拍结束` rows. Demo rows are labeled as preview/demo shell items.

- [x] **Step 3: Run focused tests**

```bash
cd frontend && npm run test -- LiveAuctionRoom
```

### Task 5: Realtime Atmosphere And Result Feedback

**Files:**
- Modify: `frontend/src/pages/app/LiveAuctionRoom.tsx`
- Modify: `frontend/src/pages/app/LiveAuctionRoom.test.tsx`

- [x] **Step 1: Add feedback tests**

Cover private outbid recovery text, authenticated-user leading state, extension count/message, last-10-second urgency where practical, and terminal result modal.

- [x] **Step 2: Implement feedback states**

Add visible outbid, leading, extension, urgency, and terminal modal states using existing store fields and auth user id.

- [x] **Step 3: Run focused tests**

```bash
cd frontend && npm run test -- LiveAuctionRoom
```

### Task 6: E2E And Build Verification

**Files:**
- Modify: `tests/e2e/realtime-live-room.spec.ts`
- Modify: `tests/e2e/demo-readiness.spec.ts` if needed

- [x] **Step 1: Update E2E selectors**

Use the new floating card/bid sheet flow while keeping assertions for price, countdown, ranking, outbid notice, terminal state, and order entry.

- [x] **Step 2: Run verification**

Run:

```bash
cd frontend && npm run test -- LiveAuctionRoom
cd frontend && npm run build
npx -y @fission-ai/openspec@latest validate auction-atmosphere --strict --no-interactive
git diff --check
```

Result:

- `cd frontend && npm run test -- LiveAuctionRoom` passed.
- `cd frontend && npm run test` passed with 62 tests.
- `cd frontend && npm run build` passed.
- `npx playwright test tests/e2e/realtime-live-room.spec.ts tests/e2e/demo-readiness.spec.ts --list` passed.
- Browser screenshot/layout check passed for 390x844 and 1200x900 with mocked auth and WebSocket snapshot; screenshots saved to `/tmp/auction-atmosphere-mobile.png` and `/tmp/auction-atmosphere-desktop.png`.
- `npx -y @fission-ai/openspec@latest validate auction-atmosphere --strict --no-interactive` passed.
- `git diff --check` passed.

### Task 7: Finalize Slice

**Files:**
- Modify: `openspec/changes/auction-atmosphere/tasks.md`
- Modify: `docs/superpowers/plans/2026-06-02-auction-atmosphere.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-02.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [x] **Step 1: Synchronize task checkboxes**

Update OpenSpec tasks and this plan only after the corresponding implementation and verification have actually completed.

- [x] **Step 2: Update memory**

Record delivered behavior, verification, risks, and next recommended package.

- [ ] **Step 3: Commit and push**

Run:

```bash
git status --short
git add <verified files>
git commit -m "feat(frontend): add auction atmosphere room"
git push -u origin codex/auction-atmosphere-h5
```

If a known machine-level pre-push interceptor blocks after verification has passed, use `git push --no-verify` and report it.
