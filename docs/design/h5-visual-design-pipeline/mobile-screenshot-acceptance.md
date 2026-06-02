# Mobile Screenshot Acceptance: H5 Live Room

This checklist is used after React H5 visual refinement is implemented from the high-fidelity Figma live-room design.

## Required Viewports

- Primary automated viewport: 390x844.
- Desktop fallback smoke viewport: 1200x900.
- Real-device/source comparison: compare against Source Batch 01 from chat until the user uploads persistent Figma/file assets.

## Required 390x844 Screenshots

Capture these states:

- Default live room after WebSocket snapshot.
- Current buyer leading.
- Current buyer outbid.
- Last 10 seconds urgency.
- Soft Close extension visible.
- Product shelf open.
- Bid sheet open.
- Winner result modal.
- Non-winner sold result modal.
- No-bid or cancelled terminal result.

## Source Batch 01 Comparison Targets

- Default live room should borrow density and hierarchy from R1/R2: compact host capsule, badge rows, comments, right action rail, floating commerce/auction card, and bottom controls.
- Auction card should primarily follow R2: state header, bid count, lot/product identity, current price, countdown, and a single dominant bid CTA.
- Bid sheet should follow R3/R5/R6: timer headline, current/my bid split, large centered amount, edge steppers, state chip, and terminal disabled CTA.
- Product shelf should follow R4: dense rows, image-left/content-right, state chips, price-label changes, and active/terminal CTA differences.
- Result modal should follow R7: live-room context remains behind the modal, winner and non-winner sold states have distinct hierarchy, and only winners see order-entry CTA.

## Layout Checks

For every screenshot:

- Top host bar remains readable.
- Live/rank/status badges do not cover the host controls.
- Right action rail does not collide with the auction floating card.
- Comment/system messages do not obscure bid entry controls.
- Auction floating card is readable and has a stable primary action.
- Bottom controls remain visible and tappable.
- Product shelf and bid sheet fit within the viewport and scroll when needed.
- Result modal does not hide the final price or primary route action.
- Text does not overflow buttons, cards, overlays, or badges.

## Realtime Truth Checks

For states driven by auction data:

- Current price is from WebSocket/store state.
- Ranking is from WebSocket/store state.
- Countdown uses server-time corrected logic.
- Extension count appears only after extension state is applied.
- Outbid and leading states match authenticated user and realtime bidder state.
- REST bid success does not directly mutate visible realtime price.

## Action-State Checks

- Pending auctions do not expose a misleading active bid action.
- Active auctions expose bid entry unless the user is already leading or command state disables it.
- Leading state uses softened or disabled bid CTA with visible explanation.
- Outbid state provides a clear recovery path.
- Terminal states disable bidding.
- Winner result routes to existing buyer order pages.
- Non-winner, no-bid, and cancelled outcomes do not expose buyer-only order mutation actions.

## Motion Checks

- Price movement has visible feedback after accepted WebSocket update.
- Urgency treatment appears at 10 seconds or less and clears after extension or terminal state.
- Half-screen overlays animate without trapping inaccessible content.
- Outbid recovery has accessible text, not animation-only feedback.
- Result modal entrance does not obscure the terminal explanation.
- Reduced-motion fallback still communicates state changes through text.

## Brand Safety Checks

- No Douyin logo.
- No copied Douyin UI assets.
- No third-party creator or product media unless the user explicitly provides owned or permitted assets.
- Simulated live-room scenes are local, generated, owned, or otherwise safe to use.
