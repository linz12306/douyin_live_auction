# Source Material Teardown: Batch 01

This teardown captures the first user-provided reference batch from chat. The image files are not committed to the repo. Treat them as source references for structure, hierarchy, state behavior, and motion rhythm only.

## Reference Index

| Ref | Source Type | Primary Use | Notes |
| --- | --- | --- | --- |
| R1 | Beauty live commerce room | General Douyin-like live room density, product card, comments, action rail, bottom commerce bar | Do not copy creator/person/media. Use structure and hierarchy only. |
| R2 | Sneaker auction live room | Auction-specific floating card, countdown, bid CTA, rules badge, auction comments | Closest match for current `LiveAuctionRoom`. |
| R3 | Bid sheet close-up | Half-screen bid sheet layout, amount stepper, timer, current/my bid split | Strong reference for bid sheet. |
| R4 | Product shelf/status table | Product shelf rows and state copy rules | Strong reference for shelf state copy and CTAs. |
| R5 | Bid sheet state variants | Over-minimum and self-leading bid states | Strong reference for validation/leading copy. |
| R6 | Ended bid sheet state | Terminal bid sheet after auction ended | Strong reference for disabled terminal CTA. |
| R7 | Result modal variants | Winner and sold result overlay treatments | Strong reference for terminal modal hierarchy. |

## Shared Live-Room Layout Observations

- Top area uses compact stacked pills rather than a full-width app header.
- Host identity is a dark translucent rounded capsule with avatar, room name, metrics, and a bright pink follow button.
- Viewer avatars and total viewer count sit near the top-right before the close button.
- Live/rank/category badges sit below the host bar and use dark translucent backgrounds with bright accent chips.
- The central visual scene remains the emotional anchor; UI chrome floats over it.
- Comments stack from lower-left upward in translucent rounded rows.
- Right-side action rail prioritizes large recognizable actions and vertical spacing over dense text.
- Bottom area combines a comment input with commerce actions, using large tap targets and safe-area breathing room.
- Primary commerce/auction card floats above the bottom controls, not inside a traditional page card grid.

## Auction-Specific Observations

R2 is the strongest auction reference for the current product:

- Auction rules are exposed as a small floating pill on the upper-right, not buried in the bid sheet.
- The auction card sits lower-right and carries:
  - state label: `正在竞拍`
  - bid count chip: `117次出价`
  - lot number
  - product title/subtitle
  - thumbnail
  - current price
  - secondary link: `出价记录`
  - countdown
  - primary CTA: `出价`
- The countdown block is visually separate from the price block and uses red numeric urgency.
- Comments include auction event messages such as `拍卖助手：恭喜 用户_6523 出价 ¥1280`.
- The bottom action row in auction mode can be simpler than commerce mode: item/store/customer service or cart/coupon/gift depending on scenario.

## Product Shelf Observations

R4 shows a shelf drawer that is closer to auction inventory than a normal shopping cart:

- Drawer is a white half-screen sheet over a dimmed live room.
- Top row includes `进主播橱窗` and utility actions such as customer service, cart, and more.
- Rows are vertically dense and image-left/content-right.
- State copy:
  - Active with no bids: price label should use `起拍价`.
  - Active with bids: price label should use `当前最高价`.
  - Upcoming: price label should use `起拍价`; CTA opens the half-screen detail/bid preview.
  - Ended no-sale: price label should use `起拍价`; CTA disabled as `已结束`.
  - Sold: price label should use `落槌价`; CTA disabled as `已结束`.
  - Cut-off/in-progress terminal: price label should use `落槌价`; CTA can show `截拍中`.
- Row state chips use strong pink/red for active/upcoming and muted gray/pink for terminal states.

## Bid Sheet Observations

R3, R5, and R6 define the bid sheet:

- Sheet top has a strong timer headline: `距竞拍结束仅剩 00:09:20`.
- Product context uses image-left and title/current state-right.
- Current bid and my bid are split into two columns.
- The main amount is centered and very large, with stepper buttons at the left and right edges.
- Increment copy sits directly under the amount, e.g. `加价幅度 ¥50`.
- Primary CTA is a full-width rounded pink/red button.
- State badges sit above the amount when needed:
  - `高于当前价100元`
  - `当前您已是最高价`
- Terminal sheet keeps the amount context but replaces CTA with disabled copy:
  - `当前品拍卖已结束，5s后自动返回直播间`

## Result Modal Observations

R7 shows two terminal result treatments:

- Winner modal:
  - Background live room remains visible and dimmed/blurred.
  - Celebration headline is large and graphic-like.
  - Modal content includes product image/title, final price, guarantee/payment note, and a strong payment/confirmation CTA.
  - Secondary countdown copy appears below the CTA.
- Sold/not-current-user modal:
  - Larger headline emphasizes `落槌定音` and sold success.
  - Modal highlights winner nickname, bid rounds, final成交价, and `最终成交价`.
  - It does not expose buyer-only payment actions.
- Both result states preserve the live-room context behind the modal.

## Color and Surface Direction

- Primary accent: saturated pink/red for follow, live, bid, and primary CTA.
- Auction secondary accent: violet/blue for price panels can work, but should not dominate every screen.
- Timer/urgency: red numerals on light surface or warm accent chips.
- Live-room chrome: translucent black/charcoal pills over media.
- Sheets/modals: white or very light surfaces with dark text and pink/red primary CTA.
- Comments: translucent dark rows with colored user names and level/gem badges.

## Typography and Density Direction

- Host room title: bold, compact, roughly 16-18px on 390-wide H5.
- Secondary metrics: 12-13px.
- Floating auction card price: largest element in the card, tabular numerals.
- Bid sheet amount: screen-dominant numeric text, tabular/monospace-friendly.
- Comments: 13-15px equivalent, single-line-first behavior with graceful wrap.
- Badges: short text only; avoid long explanatory labels in pills.

## Motion Direction

- Price updates should pulse or flip briefly, then settle.
- Countdown urgency should intensify color/scale but not block tap targets.
- Sheet open/close should slide from bottom with dim-layer fade.
- Outbid recovery should combine visible text with card/sheet accent change.
- Winner result can use one celebration entrance; reduced-motion users still get text-only success state.
- Terminal return countdown should be text-visible and not rely only on animation.

## React H5 Implications

- Existing `LiveAuctionRoom` already has most required layers, but the auction card should move closer to R2:
  - More auction-specific lot/rule/record hierarchy.
  - Stronger current price/countdown separation.
  - Less generic commerce card copy.
- Bid sheet should move closer to R3/R5/R6:
  - Timer headline at top.
  - Current bid/my bid split.
  - Large centered amount with edge steppers.
  - State chip above amount.
  - Terminal disabled CTA copy.
- Shelf should move closer to R4:
  - Denser rows.
  - State-specific price labels.
  - Demo rows clearly labeled but visually aligned with auction inventory.
- Result modal should move closer to R7:
  - Winner and non-winner sold states need more distinct hierarchy.
  - Modal should keep live-room background context visible.
  - Winner CTA routes to existing order pages.

## Brand Safety

Do not copy:

- Creator/person images.
- Product brand media.
- Douyin logos or proprietary icons.
- Watermarked reference content.
- Exact text that identifies third-party examples unless it is generic auction terminology.

Use:

- Structure.
- Hierarchy.
- Density.
- State logic.
- Motion rhythm.
- Generic Chinese auction/live-commerce copy.
