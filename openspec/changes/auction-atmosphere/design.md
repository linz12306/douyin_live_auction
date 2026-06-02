# Design: auction-atmosphere

## Technical Approach

Implement `auction-atmosphere` as a focused frontend slice around the existing user live room route and realtime store. The implementation should reshape presentation and command affordances while keeping existing data flow intact:

```text
REST submit bid command -> wait for WebSocket -> Zustand live room store -> React room UI
```

The buyer room may add local UI state for bid sheet visibility, shelf visibility, result modal visibility, selected bid amount, and command error copy. These states must not become an alternate auction truth source.

## Current Baseline

`LiveAuctionRoom.tsx` currently includes:

- Route id parsing and auth token hydration.
- WebSocket connection through `useLiveRoomStore.connect`.
- Server-time corrected countdown through `remainingMs`.
- Current price, countdown, rankings, notifications, terminal message, custom amount input, REST bid submission, and order-list entry.
- Tests proving REST bid success does not directly mutate realtime price.

`useLiveRoomStore` already handles:

- `snapshot`
- `price_update`
- `extended`
- `auction_end`
- private `outbid`
- stale non-outbid message rejection
- connection state

This slice should not alter these semantics.

## Live Room Structure

The new room should render as a single full-screen H5 surface with responsive desktop fallback.

Required layers:

- Background visual scene using the product image when available, with a brand-safe fallback scene when absent.
- Top host bar with avatar, room name, follow action, online count, close/back action, and realtime connection label.
- Secondary badges for live status, hourly rank, commerce rank, auction status, and rule/extension context.
- Left-bottom comments/system messages based on realtime notifications and safe default room chatter.
- Right-side atmosphere controls for like, gift, share, popularity/ranking, and coupon affordances. These are visual/demo affordances only.
- Bottom comment input and commerce actions, including shelf entry and bid entry.
- Persistent lower-right auction floating card showing status, current highest price, countdown, bid count when available, and primary action.

## Bid Sheet

The bid sheet is a half-screen overlay controlled by local UI state.

It should show:

- Product image/title.
- Auction status and server-time corrected countdown.
- Current highest price.
- My bid state.
- Increment amount.
- Amount stepper controls.
- Primary CTA.
- Command error feedback.

Bid sheet state derivation:

- `pending`: bidding disabled, copy says the auction has not started.
- `active/no bid`: CTA `立即出价`.
- `active/leading`: copy says `当前您是最高价`; CTA is softened or disabled.
- `active/outbid`: copy says buyer has been outbid; CTA `立即追回`.
- `submitting`: CTA shows progress and duplicate submissions are disabled.
- `error`: REST command error is visible, but realtime values remain unchanged.
- `terminal`: bidding disabled and terminal result entry is emphasized.

The current user is leading when `highestBidderId` equals the authenticated user id. The buyer is outbid when recent notifications include type `outbid` and the current user is not leading while the auction is active.

## Product Shelf Shell

The shelf is a half-screen overlay. It lists:

- Current auction item as `竞拍中` or the current terminal/pending state.
- Demo shell rows for `即将开拍`, `竞拍未成交`, and `竞拍结束`.

Only the current item may open the bid sheet. Demo rows should use copy such as `预览拍品` or `演示货架` so the UI does not imply multiple realtime auctions in this slice.

## Result Modal

The result modal appears when the room status is `ended_sold`, `ended_no_bid`, or `cancelled`.

State rules:

- Winner: authenticated user id equals `winnerId`; show success copy, final price, and order entry.
- Non-winner sold: show not-won copy and continue watching action.
- No bid: show no-bid terminal explanation.
- Cancelled: show cancellation terminal explanation.

The modal should use existing order routes. If no specific order id exists in realtime data, the action links to `/app/orders`.

## Realtime Truth Rules

- REST bid command may update local submitting/error state only.
- REST success may clear local amount/error state and close or keep the bid sheet, but visible current price, ranking, countdown, extension count, leading/outbid state, and terminal state update only from WebSocket state.
- Countdown uses `remainingMs(endedAt, serverTimeOffsetMs, nowTick)`.
- Outbid feedback uses private `outbid` notifications and current ranking/highest bidder state.
- Extension feedback uses `currentExtendCount`, updated `endedAt`, and notification type `status`.

## Test Strategy

Focused component tests should cover:

- Full-screen live room shell, floating card, and atmosphere layers.
- Floating card opens bid sheet.
- Bid sheet submits next bid through REST without mutating realtime price.
- Outbid notification produces prominent recovery feedback.
- Leading state uses authenticated user id.
- Shelf opens and distinguishes current realtime item from demo shell rows.
- Terminal state disables bidding and renders result modal with order entry.
- Route/store mismatch remains neutralized.

E2E expectations should keep stable assertions for:

- Current price and countdown visibility.
- Bid button availability through the bid sheet/floating card.
- Two-buyer outbid notice.
- Ranking visibility.
- Sold terminal state and order entry.

## Accessibility And Layout

- Every animation or visual-only state must have visible text feedback.
- Overlays should use buttons with accessible labels and stable dimensions.
- Mobile viewport must keep top host bar, right action rail, comments, floating card, and bottom controls readable.
- Desktop fallback may center the H5 room in a wider dark stage but should preserve the same H5 information hierarchy.
