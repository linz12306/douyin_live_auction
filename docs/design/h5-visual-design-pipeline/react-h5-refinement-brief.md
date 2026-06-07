# React H5 Refinement Brief

This brief translates Source Batch 01 into implementation direction for the existing buyer live room. It is not a request to change backend contracts or realtime semantics.

## Target Surface

- Route: `/app/auctions/:id`
- Primary file today: `frontend/src/pages/app/LiveAuctionRoom.tsx`
- Supporting utility today: `frontend/src/pages/app/liveRoomUtils.ts`
- Store: `frontend/src/store/liveRoomStore.ts`

Future implementation may extract presentational components if it improves clarity:

- `LiveHostBar`
- `LiveActionRail`
- `LiveMessageLayer`
- `AuctionFloatingCard`
- `ProductShelfSheet`
- `BidSheet`
- `AuctionResultModal`

Extraction is optional; preserving current realtime behavior is mandatory.

## Visual Priority

1. Make the auction floating card match auction references before general commerce references.
2. Make the bid sheet feel like a high-stakes auction control, not a generic form.
3. Make terminal result states visually distinct and demo-ready.
4. Keep comments, host bar, action rail, and bottom controls readable at 390x844.

## Floating Auction Card

Required refinements:

- Add explicit auction state header, e.g. `正在竞拍`, `即将开拍`, `已成交`, `已流拍`, `已取消`.
- Include a compact bid-count chip when ranking/bid count is available.
- Show lot/product identifier when available; otherwise use `拍品编号` fallback based on auction id.
- Add a small `拍卖规则` or `出价记录` affordance as visual entry/copy only unless an existing route/action exists.
- Separate current price and countdown into distinct zones.
- Use strong red countdown treatment for urgent state.
- Keep primary CTA as the only dominant action.

Do not:

- Update price from REST bid response.
- Add a fake bid record route unless a real route exists.
- Let the card overlap comments or bottom controls on 390x844.

## Bid Sheet

Required refinements:

- Move timer headline to the top of the sheet:
  - Active: `距竞拍结束仅剩 HH:MM:SS` or `距竞拍结束仅剩 MM:SS`.
  - Pending: `即将开拍`.
  - Terminal: `当前拍品竞拍已结束`.
- Product context:
  - image left
  - title right
  - current bid and my bid split below
- Amount control:
  - large centered numeric amount
  - left/right stepper buttons on the same row
  - increment copy directly below amount
- State chip above amount:
  - no bid/custom high amount: `高于当前价X元`
  - leading: `当前您已是最高价`
  - outbid: `已被超过，立即追回`
  - command error: backend/user-facing error copy
- Primary CTA:
  - active/no bid: `立即出价`
  - active/outbid: `立即追回`
  - leading: disabled or softened with `当前您是最高价`
  - submitting: `提交中...`
  - terminal: disabled with terminal explanation

Do not:

- Hide command errors in comments only.
- Require precision taps smaller than 44px.
- Animate amount changes in a way that shifts layout.

## Product Shelf

Required refinements:

- Use a denser auction inventory sheet.
- Keep current realtime item first.
- Demo rows remain clearly labeled as demo/preview.
- State-specific price labels:
  - no bid active/upcoming: `起拍价`
  - active with bids: `当前最高价`
  - sold/cut-off terminal: `落槌价`
- CTA copy:
  - current active item: `立即出价`
  - upcoming demo: `去看看`
  - terminal demo: `已结束`
  - cut-off demo: `截拍中`

Do not imply true multi-item realtime bidding until a later OpenSpec change adds that contract.

## Message Layer

Required refinements:

- Keep system auction messages visually distinct from ordinary chat.
- Use auction event phrasing:
  - `拍卖助手：恭喜 用户_6523 出价 ¥1280`
  - `系统消息：已触发延时，倒计时重置`
  - `系统消息：您已被超过，请及时追回`
- Outbid message should be prominent in the message stack and mirrored in the bid sheet.

## Result Modal

Required refinements:

- Winner:
  - large celebratory headline
  - product summary
  - final price
  - confirmation/payment route CTA through existing order pages
  - deadline or follow-up copy when available
- Non-winner sold:
  - `落槌定音`/sold result headline
  - final price
  - winner-masked display when available
  - no payment/confirmation CTA
- No bid/cancelled:
  - plain terminal explanation
  - return/continue watching action

Do not add buyer-only order mutation actions inside the live room modal.

## Motion Tokens

Use these as implementation defaults unless Figma later overrides them:

- Sheet enter: 220ms, ease-out, translateY(100% -> 0) plus dim fade.
- Sheet exit: 160ms, ease-in, translateY(0 -> 100%) plus dim fade.
- Price pulse: 220ms, transform scale 1 -> 1.04 -> 1 and color accent.
- Urgency pulse: 700-900ms repeating only on countdown text, disabled under reduced motion.
- Result modal enter: 260ms, ease-out, opacity 0 -> 1 and scale 0.96 -> 1.
- Outbid flash: 300ms accent border/background pulse, plus persistent text state.

All motion must respect `prefers-reduced-motion`.

## Acceptance Gates

Before implementation is considered complete:

- `cd frontend && npm run test -- LiveAuctionRoom`
- `cd frontend && npm run build`
- 390x844 screenshot states from `mobile-screenshot-acceptance.md`
- Manual comparison against Source Batch 01 structure and hierarchy
- Confirm REST bid success still does not mutate visible realtime auction truth
