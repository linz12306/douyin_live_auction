# Auction Atmosphere Exploration

## Goal

Reshape the buyer H5 live auction room into a Douyin-style live commerce auction experience while preserving the existing auction engine, wallet, order, REST, and WebSocket semantics.

The first implementation slice focuses on `/app/auctions/:id` only. It should make the current realtime auction feel like a live commerce room through layout, state presentation, and bidding affordances, without adding true multi-item realtime bidding or changing backend contracts.

## Non-Goals

- Do not change auction engine, wallet, order, payment, settlement, cancellation, database, REST response, or WebSocket message semantics.
- Do not change merchant dashboard, merchant analytics, merchant monitor, or merchant order pages in this slice.
- Do not implement true multi-item realtime bidding inside one live room.
- Do not add Douyin branding, Douyin logos, copied Douyin UI assets, real third-party creator media, or real third-party brand/product imagery.
- Do not move buyer order confirmation or simulated payment into the live room. Winners still go to `/app/orders` or `/app/orders/:id`.

## Workflow Choice

This is full workflow work rather than fast lane. It changes a user-facing product surface and acceptance criteria for realtime H5 bidding, including outbid recovery, result presentation, shelf behavior, and mobile layout. Per `AGENTS.md`, it requires Superpowers exploration, OpenSpec lock, a Superpowers execution plan, implementation, focused verification, and a verified commit.

## Preflight Findings

- Current branch for this work: `codex/auction-atmosphere-h5`.
- A separate old local branch/worktree named `codex/auction-atmosphere` exists at an older commit, so this work uses the new branch to avoid overwriting that worktree.
- `requirements-v3.md` is the authority. It requires WebSocket as the realtime truth source, REST as initialization/command submission only, server-time offset countdowns, private outbid notifications, ranking, Soft Close feedback, terminal result feedback, and buyer order confirmation/payment.
- `frontend-experience-roadmap` is active and defines `auction-atmosphere` as the owner of H5 live-room shell, preset scenes, auction floating card, product shelf shell, strong-state bid sheet, in-room result modal, comments/system messages, and atmosphere controls.
- `LiveAuctionRoom.tsx` currently renders a responsive detail-room layout with a product visual panel, right-side realtime price/countdown/bid/ranking/message cards, and existing REST bid submission.
- `useLiveRoomStore` already protects the main realtime boundary: REST bid success does not directly update price/ranking, stale non-outbid versions are ignored, and WebSocket messages update snapshot, price, extension, terminal, and private outbid notification state.
- `AuctionMonitor` reuses the live-room store, so this slice should avoid shared store semantic changes unless both buyer room and monitor expectations are verified.
- Existing unit tests cover visible room state, REST bid command behavior, WebSocket price updates, refresh, custom bid, REST errors, terminal bidding disablement, and stale route/store mismatch.
- Existing E2E tests locate current price, countdown, bid buttons, ranking, private outbid notice, sold state, and order entry through the existing UI.

## User Brainstorm Checkpoint

The user confirmed this package should start now and accepted the following first-slice split:

- Only reshape the user H5 route `/app/auctions/:id`.
- Include full-screen live room shell, top host bar, live/rank/rule badges, central simulated live scene, comments/system messages, right-side atmosphere actions, bottom comment and commerce actions, lower-right auction floating card, half-screen bid sheet, half-screen product shelf shell, and in-room result modal.
- Preserve WebSocket as realtime truth for visible price, ranking, countdown, extension count, leading/outbid state, and terminal state.
- Keep only the current auction item fully realtime-backed. Product shelf rows beyond the current item are visual/demo shell items.
- Do not use Douyin marks, copied assets, real third-party creator media, or real third-party brand/product imagery.
- Continue routing winner business actions to buyer order pages.

## Users

- Buyer on H5: wants a live commerce bidding surface that feels immediate, legible, and exciting on a narrow phone viewport.
- Reviewer or presenter: wants an obvious demo path showing live room atmosphere, two-buyer bidding, private outbid recovery, terminal result, and order entry.
- Future frontend worker: needs clear component and test boundaries so later merchant analytics and demo material work do not collide.

## Scenarios

### Active Auction Entry

1. Buyer opens `/app/auctions/:id`.
2. Room connects through WebSocket and applies snapshot.
3. Buyer sees a full-screen live commerce room rather than a side-panel auction detail page.
4. Current product image is visible when available; otherwise a local simulated scene is shown.
5. Host bar, connection/status badges, comments, system messages, atmosphere actions, bottom controls, and auction floating card are visible without overlapping on mobile.

### Bid Sheet

1. Buyer taps the auction floating card or bid entry.
2. A half-screen bid sheet opens.
3. It shows product title/image, status, current price, countdown, increment, my bid state, amount controls, and dynamic CTA.
4. Submitting disables duplicate action.
5. REST success clears command state but does not change realtime truth until WS messages arrive.
6. REST validation or balance errors show command feedback without changing realtime price or ranking.

### Outbid Recovery

1. Buyer A is leading.
2. Buyer B sends a higher accepted bid.
3. Buyer A receives a private outbid notification from WebSocket.
4. Buyer A sees a prominent system-message/outbid state and a recovery CTA in the bid sheet.
5. Current price and ranking match the latest accepted WebSocket state.

### Soft Close And Urgency

1. Auction has ten seconds or less remaining according to server-time corrected countdown.
2. Countdown receives stronger urgency treatment while bid controls stay readable and operable.
3. A valid bid triggers extension.
4. WebSocket extension updates end time and extension count.
5. UI shows extension count and a system message, and urgency treatment resets when remaining time increases.

### Terminal Result

1. Room receives `ended_sold`, `ended_no_bid`, or `cancelled`.
2. Bid controls become disabled.
3. An in-room result modal explains winner, non-winner, no-bid, or cancellation state.
4. Winner sees order entry copy; business confirmation/payment remains on buyer order pages.

## Acceptance Criteria

- `LiveAuctionRoom` first screen renders as a full-screen mobile-first live commerce room.
- Product image remains the primary visible product media when available; fallback visual scene is owned/local and brand-safe.
- A persistent auction floating card shows status, current highest price, countdown, bid count when available, and opens the bid sheet.
- Bid sheet supports no bid, leading, outbid, submitting, command error, pending, active, and terminal states with accessible text feedback.
- Product shelf shell shows the current realtime auction item plus demo shell rows in `竞拍中`, `即将开拍`, `竞拍未成交`, and `竞拍结束` states without implying true multi-item realtime bidding.
- In-room result modal appears for terminal states and disables bidding.
- REST bid success does not directly mutate visible realtime truth.
- Narrow mobile and desktop fallback layouts keep host bar, badges, messages, floating card, shelf, and bid sheet controls readable without incoherent overlap.
- Focused frontend tests cover floating card, bid sheet, outbid feedback, terminal result modal, shelf shell, REST command behavior, and route/store mismatch behavior.
- Build and whitespace verification pass.

## Technical Direction

- Keep `useLiveRoomStore` as the realtime state boundary.
- Implement most atmosphere behavior inside `LiveAuctionRoom.tsx` and small local helpers only if they reduce complexity.
- Prefer local component functions within `LiveAuctionRoom.tsx` for this first slice to avoid prematurely creating shared UI abstractions.
- Use CSS/Tailwind layout primitives with stable dimensions for fixed controls such as action rails, floating card, sheet header, amount controls, and shelf rows.
- Use existing routes for order entry. If an exact order id is unavailable from realtime data, route to `/app/orders` rather than inventing a client-side order id.
- Update component tests first enough to express the new visible contract, then implement to satisfy them.
- Update E2E selectors only after component-level behavior is stable.

## Risks

- Visual polish could accidentally hide critical bidding states on small screens. Mitigation: tests for bid sheet and mobile-facing text, plus build verification.
- UI could imply multi-item realtime bidding. Mitigation: product shelf copy marks non-current rows as preview/demo shell and only the current row opens the realtime bid sheet.
- Result modal cannot know whether the current user won unless `winnerId` can be compared to authenticated user id. Mitigation: use existing `winnerId` and auth user id, and route winners to order list when no exact order id exists.
- Shared store changes could affect merchant monitor. Mitigation: avoid store semantic changes in this slice.
- Existing E2E selectors may need adjustment after layout changes. Mitigation: keep stable visible labels for price, countdown, bid actions, outbid notice, terminal state, and order entry.
