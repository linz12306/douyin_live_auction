# Design: h5-live-ui-polish

## Technical Approach

Implement `h5-live-ui-polish` as a frontend presentation slice. The live room remains driven by the existing flow:

```text
REST command submission -> wait for WebSocket -> Zustand live room store -> React visible realtime state
```

The implementation may add local transient UI state for visual feedback, such as press state, brief price highlight, recent WebSocket update markers, overlay open state, and submitting/error presentation. These states must not become alternate auction truth.

## Current Baseline

`LiveAuctionRoom.tsx` currently renders:

- full-screen H5 room stage;
- host bar, live/status badges, ranking pills, system messages, action rail, bottom controls;
- persistent auction floating card;
- half-screen bid sheet;
- product shelf shell;
- terminal result modal;
- REST bid command with WebSocket truth preserved.

`AuctionLobby.tsx` currently renders:

- `发现竞拍` discovery shell;
- search input and channel chips;
- hero auction card and secondary feed cards;
- visible routes to orders, profile, and live room.

`OrderList.tsx` and `OrderDetail.tsx` currently render buyer order workflows and actions, but their button and action areas are less aligned with the live-room polish target.

## Page Ownership

### Primary Surface: `/app/auctions/:id`

This change owns:

- collision-free mobile positioning for fixed live-room layers;
- polished action rail and bottom command controls;
- polished floating auction card and bid sheet controls;
- click/press feedback for visible actions;
- WebSocket-driven feedback for price, outbid, leading, urgency, extension, and terminal states.

### Secondary Surface: `/app/auctions`

This change may touch:

- CTA consistency and button affordance polish;
- no new data source or filtering behavior.

### Secondary Surface: `/app/orders`

This change may touch:

- mobile card action layout;
- clearer `查看详情` action copy;
- button visual hierarchy and tap targets.

### Secondary Surface: `/app/orders/:id`

This change may touch:

- confirm, pay, cancel, refresh, and back action button presentation;
- submitting feedback and disabled states;
- action layout on narrow mobile.

## Layout Stability Rules

The live room must reserve stable visual zones:

- Top safe area: host bar and status badges.
- Upper content band: ranking pills and compact live badges.
- Mid-right rail: atmosphere controls with stable square/circular controls.
- Lower-left band: comments/system messages constrained in width and height.
- Lower-right band: auction floating card with a stable maximum width and no collision with bottom controls.
- Bottom bar: comment input, shelf, bid, and order actions.
- Overlays: shelf, bid sheet, and result modal sit above room layers and remain scrollable on small screens.

On 390x844, the implementation should prefer reducing message count, shrinking fixed card height, or moving secondary text into sheets before allowing action overlap.

## Button Polish Rules

Buttons should have stable dimensions, clear hierarchy, and visible feedback:

- Primary bid/recover/pay/confirm actions use filled or gradient surfaces.
- Secondary actions use quieter filled/elevated surfaces, not bare outline-only text where the result looks rough.
- Icon-like controls include accessible labels and visible short labels or values.
- Amount steppers use obvious plus/minus buttons with stable square dimensions.
- Disabled states remain readable and clearly non-interactive.
- Button labels must fit within their containers on mobile.

## Feedback And Motion Rules

Motion is feedback, not truth.

Allowed feedback:

- press scale or active brightness on buttons;
- short price pulse after a WebSocket `price_update` changes `currentPrice`;
- urgency pulse when server-time corrected countdown is at or below ten seconds;
- outbid warning pulse after private `outbid` notification;
- leading celebration accent when authenticated user is highest bidder according to store state;
- submitting state on REST commands;
- result modal entrance.

Disallowed feedback:

- changing current price, ranking, countdown, extension count, leading/outbid state, or terminal state from REST bid success alone;
- showing accepted bid celebration before WebSocket state confirms the buyer is leading;
- adding motion that blocks bid controls or hides terminal/order actions.

## Testing Strategy

Focused tests should cover:

- live room still submits bids through REST without directly mutating realtime price;
- WebSocket `price_update` changes visible price and triggers a price-feedback marker or accessible text/class that can be asserted;
- outbid and leading states remain prominent and do not disable the wrong actions;
- terminal result disables bidding and leaves order entry visible for winners;
- bid sheet amount controls and primary CTA retain stable accessible labels;
- order list detail links and order detail confirm/pay/cancel actions remain available in their correct statuses;
- submitting states prevent duplicate order actions where practical.

Visual/manual verification after implementation should include:

- 390x844 live room default active state;
- 390x844 bid sheet open;
- 390x844 shelf open;
- 390x844 terminal modal;
- 390x844 order list and order detail;
- desktop fallback for the live room.

## Verification Commands

- `cd frontend && npm run test -- LiveAuctionRoom`
- `cd frontend && npm run test -- AuctionLobby OrderList OrderDetail`
- `cd frontend && npm run test`
- `cd frontend && npm run build`
- `npx -y @fission-ai/openspec@latest validate h5-live-ui-polish --strict --no-interactive`
- `git diff --check`

`go test ./...` is not required unless backend files are touched.

## Risk Controls

- Keep route labels and accessible names stable where tests and E2E depend on them.
- Add feedback markers through visible text, `aria-live`, or stable class names instead of screenshot-only behavior.
- Avoid shared store semantic changes. If a store change becomes necessary, verify merchant monitor and stop to update scope if semantics change.
- Keep order page changes narrow enough that existing order workflow tests remain meaningful.
