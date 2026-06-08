# H5 Live UI Polish Exploration

## Goal

Polish the buyer H5 auction experience so the demo feels stable, tappable, and alive on mobile:

- Fix visible layout overlap in the user live room first.
- Replace rough text/outline-like buttons with clearer, more polished action controls.
- Add lightweight click and realtime-state feedback animations.

The work should preserve the current auction engine, wallet, order, REST, and WebSocket semantics. It is a presentation and interaction-quality change, not a business-behavior change.

## Non-Goals

- Do not change backend APIs, database schema, WebSocket message contracts, auction engine behavior, wallet freezing, order confirmation, or payment semantics.
- Do not treat REST bid success as realtime truth. Visible price, ranking, countdown, extension count, leading/outbid state, and terminal state remain WebSocket/Zustand driven.
- Do not introduce true multi-item realtime bidding in one live room.
- Do not add Douyin branding, copied assets, real third-party creator media, or unlicensed product imagery.
- Do not redesign merchant PC pages in this change.
- Do not make broad route or state architecture changes.

## Workflow Choice

This is full workflow work rather than fast lane. The requested work changes a user-facing H5 auction experience across multiple visible states and potentially several buyer routes. Per `AGENTS.md`, it should use Superpowers exploration, OpenSpec lock, a Superpowers execution plan, implementation, focused verification, and a verified commit/push after the required approval gates.

## Preflight Findings

- Current branch: `codex/user-live-ui-optimization`.
- Worktree status before writing this exploration: no tracked dirty files. Ignored generated/runtime directories are present: `frontend/dist/`, `frontend/node_modules/`, and root `node_modules/`.
- OpenSpec CLI is available through `npx -y @fission-ai/openspec@latest`, version `1.4.1`.
- `requirements-v3.md` is the current authority. Relevant rules:
  - REST initializes or submits commands only.
  - WebSocket messages update the Zustand live room store and remain the realtime truth source.
  - User bid submission waits for WebSocket broadcast instead of trusting REST response as final visible state.
  - H5 should show realtime price, countdown, leaderboard, participants, outbid, extension, terminal, and animation feedback.
- Existing `auction-atmosphere` already reshaped `/app/auctions/:id` into a Douyin-style H5 live commerce room with host bar, simulated scene, comments, action rail, floating auction card, bid sheet, shelf shell, and result modal.
- Existing `h5-discovery-live-feed` already reshaped `/app/auctions` into `发现竞拍` with search/filter chips, hero card, and feed cards.
- Current buyer order pages exist at `/app/orders` and `/app/orders/:id`, but their visual language is less tightly aligned with the live room and has some rough button/copy polish.
- `useLiveRoomStore` already protects realtime boundaries for `snapshot`, `price_update`, `extended`, `auction_end`, and private `outbid` messages.
- Existing focused tests protect the most important rule: REST bid success does not directly mutate realtime price or ranking.

## User Brainstorm Checkpoint

The user declined a visual companion and requested text-only planning.

The user then confirmed the priorities:

1. Solve layout problems first, especially previous versions where elements overlapped.
2. Improve button display quality, because some buttons currently feel like rough sketch/outline controls and are not visually pleasing.
3. Add animations and feedback after clicks.

The recommended direction was accepted:

- Prioritize a stable refined implementation rather than a broad redesign.
- Make `/app/auctions/:id` the main page to polish.
- Apply smaller consistency and tappability fixes to `/app/auctions`, `/app/orders`, and `/app/orders/:id` only where needed.
- Keep changes frontend-only unless implementation uncovers a true blocker, in which case stop and return to OpenSpec.

## Users

- Buyer on mobile H5: needs a live auction room that is readable, exciting, and easy to act in under time pressure.
- Demo presenter: needs the first screen to clearly show that a live auction is happening, without embarrassing overlap or confusing rough controls.
- Reviewer: needs evidence that realtime truth rules remain intact while visual polish improves.

## Target Pages

### Primary

- `/app/auctions/:id` user live auction room.

### Secondary, Scoped Polish Only

- `/app/auctions` discovery/lobby.
- `/app/orders` buyer order/my auction result list.
- `/app/orders/:id` buyer order confirmation and simulated payment detail.

## Scenarios

### Mobile Layout Stability

1. Buyer opens `/app/auctions/:id` on a narrow mobile viewport.
2. Top host bar, live badges, ranking pills, comments/system messages, right action rail, auction floating card, and bottom controls render in stable zones.
3. Critical controls do not overlap each other or obscure the primary bid entry.
4. Half-screen shelf and bid sheet remain scrollable and keep close/CTA controls visible.

### Button Visual Polish

1. Buyer scans the live room action rail, bottom controls, floating card, bid sheet, shelf, and order actions.
2. Buttons look intentional and tappable, with clear filled or elevated surfaces instead of rough outline-only or text-only controls.
3. Icon-like controls have accessible labels and visible text/value where needed.
4. Primary actions such as bid, recover bid, confirm order, and pay are visually stronger than secondary actions.

### Click Feedback

1. Buyer taps live room controls such as bid entry, shelf, refresh, action rail, amount stepper, submit bid, or order actions.
2. The tapped control gives immediate visible feedback through press scale, active state, disabled/submitting state, or short-lived pulse.
3. Feedback does not imply an accepted bid unless WebSocket state actually changes.

### Realtime State Feedback

1. A WebSocket `price_update` changes the current price.
2. Price display pulses or highlights briefly from WebSocket-driven state.
3. A private `outbid` message produces a prominent but non-overlapping recovery warning.
4. A leading state gives celebratory feedback without blocking the bid sheet or bottom controls.
5. Last 10 seconds creates urgency without hiding the CTA.
6. `extended` feedback shows countdown reset/extension count without relying on REST truth.

### Result And Order Follow-Through

1. Auction ends and result modal appears.
2. Winner/non-winner/no-bid/cancelled states remain legible and do not overlap primary actions.
3. `/app/orders` and `/app/orders/:id` present confirm/pay/cancel actions as clear mobile controls with visible submitting feedback.

## Acceptance Criteria

- On 390x844 mobile, live room host bar, badges, comments, action rail, floating auction card, bottom controls, shelf, and bid sheet do not overlap incoherently.
- The live room primary bid path remains visible and tappable for active auctions.
- Button styles in the live room and buyer order surfaces look polished, with clear filled/elevated states and stable tap targets.
- Click feedback exists for important controls and never changes auction truth on its own.
- WebSocket-driven price updates get a visible price-change animation or highlight.
- Outbid, leading, last-10-second urgency, extension, terminal, and submit/error states remain accessible through visible text.
- Existing realtime truth tests continue to pass.
- New focused tests cover at least the layout/state hooks that can be asserted in jsdom: price update feedback, polished button labels/classes where practical, submit/disabled behavior, and terminal/overlay safety.
- `cd frontend && npm run test` passes.
- `cd frontend && npm run build` passes.
- If no backend files are touched, `go test ./...` is not required.
- OpenSpec strict validation and `git diff --check` pass for the change.

## Technical Direction

- Keep `useLiveRoomStore` as the realtime state boundary.
- Prefer local UI state in `LiveAuctionRoom.tsx` for transient visual feedback such as price pulse, button press state, celebration visibility, and overlay open state.
- Use CSS/Tailwind utility classes and small local component helpers before adding shared abstractions.
- Add stable dimensions and safer positioning for live room fixed zones:
  - top host area,
  - ranking/message area,
  - right action rail,
  - floating auction card,
  - bottom command bar,
  - sheet headers and CTAs.
- Replace rough button surfaces with consistent live-commerce controls:
  - action rail: icon/value stacked buttons with polished filled surfaces,
  - bottom controls: square/rounded action tiles with labels,
  - bid sheet: strong primary CTA plus clear stepper controls,
  - order actions: full-width mobile-first buttons.
- Use animation only as feedback:
  - press/active scale on buttons,
  - WS price pulse,
  - countdown urgency pulse,
  - outbid warning pulse,
  - leading celebration accent.
- Respect reduced complexity: no large animation library unless the existing stack already uses one or CSS is insufficient.

## Risks

- Visual fixes could break existing tests that assert visible labels. Mitigation: preserve stable accessible labels and update tests only for intentional UI copy changes.
- Added animation could imply successful bidding before WebSocket confirmation. Mitigation: bid submit animation only indicates command submission; accepted price animation only follows WebSocket price state.
- Layout changes could improve one viewport while breaking another. Mitigation: verify 390x844 mobile and desktop fallback, and keep stable dimensions for fixed-format controls.
- Order pages could become too visually heavy. Mitigation: scope order work to button polish, action clarity, and mobile tap targets rather than full redesign.

## Proposed Change Id

`h5-live-ui-polish`
