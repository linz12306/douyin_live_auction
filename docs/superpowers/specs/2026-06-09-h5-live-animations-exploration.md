# h5-live-animations Exploration

## Goal

Add high-quality Motion for React animations to the buyer H5 live auction room at `/app/auctions/:id`.

The visual direction is an A+B hybrid from the brainstorm: a restrained premium baseline with stronger live-commerce impact during important bidding moments. The first version owns the core five effects:

- WebSocket price update glow/lift.
- WebSocket-confirmed bid success coin burst.
- Leading-state warm celebration accent.
- Private outbid warning pulse and recovery emphasis.
- Final-10-seconds countdown heartbeat.

## Non-Goals

- Do not change backend, database, REST, WebSocket, wallet, auction engine, order, payment, or merchant semantics.
- Do not touch merchant pages, buyer lobby, buyer order pages, true multi-item realtime bidding, or terminal order workflows.
- Do not trigger accepted-bid celebration from REST bid success alone.
- Do not add blocking animation overlays or modal interruptions for outbid.
- Do not archive prior OpenSpec changes in this slice.

## Workflow Choice

This uses the full workflow, not fast lane. It changes a user-facing product experience, adds a frontend dependency, and introduces new acceptance criteria around realtime animation feedback.

Current user request says "PLEASE IMPLEMENT THIS PLAN", so this exploration records approval to proceed through planning, OpenSpec lock, execution plan, implementation, and verification in this turn. It does not record approval to commit or push.

## Preflight Findings

- Current branch: `codex/frontend-live-animations`.
- Initial worktree status: clean.
- `requirements-v3.md` is the authority. It already lists buyer H5 animation expectations: price number rolling/update, bid success coin animation, leading celebration, outbid red warning, and last-10-seconds urgency.
- Existing `/app/auctions/:id` implementation is concentrated in `frontend/src/pages/app/LiveAuctionRoom.tsx`.
- Existing `useLiveRoomStore` already enforces the realtime boundary: REST submits commands; WebSocket messages update price, ranking, countdown extension, terminal state, and private outbid notifications.
- Existing tests already cover REST bid submission without direct realtime price mutation and WebSocket price update feedback.
- Official Motion documentation confirms `npm install motion`, imports from `motion/react`, React 18.2+ compatibility, and no special Vite configuration.
- Per `AGENTS.md`, the existing bids/orders review was performed before this feature:
  - `backend/migrations/006_create_bids.sql`
  - `backend/migrations/007_create_orders.sql`
  - `backend/internal/model/bid.go`
  - `backend/internal/model/order.go`
  This change intentionally leaves those files untouched because the feature is frontend-only presentation and does not alter bidding or order semantics.

## Users

- Buyer on H5: wants bidding to feel immediate, polished, and exciting without losing trust in realtime auction state.
- Presenter/reviewer: wants visible demo moments for accepted bid, leading, outbid, and final countdown.
- Future frontend worker: needs clear test boundaries so animation polish does not become a second source of auction truth.

## Scenarios

### Price Update

1. Live room displays current price from WebSocket/store state.
2. A newer `price_update` message is applied.
3. Price updates and briefly glows/lifts.
4. Next bid amount remains derived from store state.

### Bid Success And Leading

1. Buyer submits a REST bid command.
2. REST success clears command/submitting state but does not show accepted-bid celebration.
3. WebSocket/store state later shows the authenticated user is highest bidder.
4. The room shows a brief coin burst and a warm leading accent.

### Outbid

1. Buyer receives a private `outbid` notification while not leading.
2. The room shows a red warning pulse and recovery copy.
3. No modal blocks the bid controls.

### Final Countdown

1. Active auction has ten seconds or less remaining by server-time corrected countdown.
2. Countdown receives heartbeat animation.
3. Floating card and bid controls remain readable and operable.
4. Animation stops on extension or terminal state.

## Technical Direction

- Add `motion` to the frontend package.
- Import `motion`, `AnimatePresence`, and `useReducedMotion` from `motion/react`.
- Keep reusable animation helpers local to `LiveAuctionRoom.tsx` for this slice.
- Add semantic `data-testid` markers for tests rather than testing visual pixels.
- Use local transient state only for animation events:
  - price pulse already exists and can be upgraded to Motion.
  - bid success burst should be keyed from a transition into current-user leading state after the initial room snapshot.
  - outbid feedback should key from the latest private outbid notification id.
- Respect reduced motion by suppressing burst/pulse movement and retaining visible text feedback.

## Risks

- Motion could make tests brittle if DOM nodes appear/disappear asynchronously. Mitigation: test stable visible text/test ids and use `AnimatePresence` conservatively.
- Accepted-bid animation could accidentally fire on initial snapshot. Mitigation: track previous leading state and only fire after the initial comparison has been established.
- Animation could hide critical controls. Mitigation: keep particles small, pointer-events none, and visually bounded to the floating card.
- Dependency could affect build size. Mitigation: import only from `motion/react` and keep usage local.

## Acceptance Criteria

- The core five effects exist and are visually tied to the correct realtime state.
- REST bid success alone does not trigger accepted-bid or leading celebration.
- Reduced-motion preference disables or softens movement while keeping text feedback.
- No backend/API/WebSocket contracts change.
- Focused tests, full frontend tests, build, OpenSpec strict validation, and `git diff --check` pass before reporting completion.
