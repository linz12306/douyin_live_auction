# Douyin-Style Frontend Experience Design

## Purpose

This document captures the frontend design direction confirmed during the June 1, 2026 brainstorm for the live auction MVP.

The product direction is:

- User H5 should strongly resemble a Douyin-style live commerce room.
- Merchant PC should remain a clear operations dashboard, not an entertainment UI.
- The implementation should prioritize a demo-ready auction loop while preserving clean future expansion boundaries.

## Confirmed Direction

Use approach A: demo loop first with an extensible structure.

The first implementation target should make the H5 auction experience visually and behaviorally feel like a live commerce room:

- Full-screen live-room shell.
- Preset simulated live-room scenes.
- Persistent auction floating card.
- Half-screen bid sheet.
- Half-screen product shelf shell.
- In-room result modal.
- Order confirmation and simulated payment through the existing order pages.

The merchant side should use a balanced PC operations dashboard:

- Summary metrics.
- Active auction monitoring entry points.
- Recent orders.
- Analytics charts when backend contracts are available.

## User H5 Experience

### Live-Room Shell

The H5 auction room should be a full-screen live room, not a traditional auction detail page.

Required visual layers:

- Top host bar with host avatar, room name, follow action, online count, and close action.
- Secondary badges for live status, hourly rank, commerce rank, and auction rules.
- Central simulated live-room scene.
- Left-bottom comments and system messages.
- Right-side atmosphere actions such as like, gift, share, popularity ranking, and coupon entry.
- Bottom comment input and commerce actions such as cart/product shelf, coupon, more, and gift.

The UI should avoid Douyin logos or real creator/brand assets. Use owned or generated scene assets.

### Live Visual Source

Use preset simulated live-room scenes as the first version's visual source.

Recommended scene categories:

- Beauty/skincare room.
- Sneaker or trendy collectible room.
- Jewelry or collectible auction room.

The actual auction product remains represented by the auction card, product shelf, bid sheet, and result modal. The scene itself is ambience.

### Product Shelf Model

Use a multi-item product shelf shell while keeping only the current auction item fully real in the first version.

The product shelf should feel like a Douyin commerce drawer:

- `竞拍中`
- `即将开拍`
- `竞拍未成交`
- `竞拍结束`

Only the current auction item needs to be backed by realtime bidding in the first implementation package. Other shelf rows may be visual/demo shell items unless a later OpenSpec change adds true multi-item live room semantics.

### Copy Strategy

Use mixed copy:

- Live room, shelf, and bid CTA copy should follow Douyin-like commerce language.
- Order detail, confirmation, and payment copy should remain formal and business-clear.

Examples:

- Shelf and live room: `竞拍中`, `即将开拍`, `当前最高价`, `起拍价`, `落槌价`, `立即出价`, `去看看`, `已结束`.
- Order workflow: `待确认`, `待支付`, `已支付`, `已取消`, `确认订单`, `模拟支付`.

### Auction Floating Card

The current auction item should appear as a persistent lower-right floating card.

It should show:

- Auction status.
- Auction or lot number.
- Current highest price.
- Countdown.
- Bid count when available.
- Main action button.

The floating card is the primary entry to the bid sheet.

### Half-Screen Bid Sheet

Use a strong-state half-screen bid sheet.

The bid sheet should show:

- Remaining time using server-time corrected countdown.
- Product image and title.
- Current price.
- My bid state.
- Increment amount.
- Add/subtract controls.
- Dynamic primary CTA.

Supported visible states:

- No bid yet: CTA `立即出价`.
- Current user leading: show `当前您是最高价`; primary action disabled or softened.
- Outbid: show a strong outbid state and CTA `立即追回`.
- Submitting: disable duplicate action and show progress.
- Balance or validation error: show command error without changing realtime price.
- Ended: disable bidding and explain the terminal state.

### Result Flow

Use an in-room result modal, then route to order detail for business actions.

Result modal states:

- Winner: show `恭喜竞拍成功`, product summary, final price, confirm deadline, and `去确认订单`.
- Not winner: show a not-won message and `继续看拍品`.
- No bid / cancelled: show terminal explanation and return actions.

Order confirmation and simulated payment should happen on `/app/orders/:id`, not inside the live room modal.

## Merchant PC Experience

Merchant PC should be a balanced operations dashboard.

### Dashboard

`/merchant/dashboard` should contain:

- Top summary metrics: completed amount, paid orders, average price, active auctions, and pending order counts.
- Center area for active auctions with monitor entry points.
- Recent orders with buyer, product, amount, status, and timestamps.
- Analytics charts for transaction trend, bid distribution, and user activity when API contracts are available.

### Product Publishing

Product publishing should clearly cover both product content and auction rule setup.

Product fields:

- Name.
- Multiple images.
- Description.

Auction rule fields:

- Start price.
- Increment mode.
- Increment value.
- Optional ceiling price.
- Auction duration.
- Soft Close seconds.
- Max extension count.

State rules:

- Draft and pending auctions may allow edits according to existing backend rules.
- Active auctions should route operators to monitoring and restrict unsafe edits.
- Ended or cancelled auctions should be read-only.

### Auction Monitor

The merchant monitor remains a PC command surface, not a Douyin-like live room.

It should show:

- Product summary.
- Current price.
- Countdown.
- Status.
- Extension count.
- Connection state.
- Rankings.
- Bid event feed.
- Terminal result.
- Cancellation controls when allowed.

Cancellation should follow existing backend rules:

- Pending can be cancelled directly.
- Active cannot be cancelled within 30 seconds of the latest bid.
- Cancellation requires a reason.
- Backend rejection must be shown clearly without implying success.

### Merchant Orders

Merchant order views are read-only inspection surfaces.

They should show:

- Buyer display information.
- Product summary.
- Amount.
- Status.
- Timestamps.
- Cancel reason when applicable.

Merchant pages must not expose buyer-only confirm, cancel, or pay actions.

## Data Flow And State Rules

The frontend should preserve the existing realtime architecture.

Rules:

- WebSocket snapshot/messages are the realtime truth source after room connection.
- REST initializes non-realtime surfaces and submits commands.
- REST bid success must not directly update visible realtime price, ranking, countdown, extension count, or terminal state.
- The UI should wait for WebSocket updates before changing realtime auction truth.
- Stale WebSocket versions must be ignored.
- Countdown must use server time offset, not local-only time.

Important H5 states:

- Connection: connecting, online, reconnecting, error, closed.
- Auction item: upcoming, active, extending, sold, no-bid, cancelled.
- My bid: no bid, leading, outbid, won, lost.
- Command: idle, submitting, validation error, balance error, terminal-disabled.
- Empty/error: no auctions, no shelf items, no orders, network failure, WebSocket failure.

## Parallel Work Packages

### `auction-atmosphere`

Owns the H5 live-room experience:

- Full-screen live room shell.
- Preset live scenes.
- Auction floating card.
- Product shelf shell.
- Strong-state bid sheet.
- In-room result modal.
- Comments/system message presentation.
- Like/gift/share atmosphere controls as visual/demo affordances.

Must not change backend auction, wallet, order, settlement, or WebSocket semantics without an OpenSpec update.

### `merchant-analytics`

Owns merchant dashboard analytics:

- Transaction trend.
- Bid distribution.
- User activity.
- Chart loading, empty, and error states.

If existing dashboard APIs are insufficient, this package must lock backend API contracts before implementation.

### `demo-materials`

Owns demo readiness:

- Presenter runbook.
- Visual checkpoints.
- Demo screenshots or route cards.
- E2E expectations for the user H5 live loop and merchant monitor.

The demo path should highlight the confirmed H5 flow:

1. Merchant monitors active auction.
2. Buyer enters Douyin-style live room.
3. Buyer opens bid sheet and bids.
4. Another buyer outbids.
5. First buyer sees outbid state and recovers.
6. Auction ends.
7. Winner sees in-room result modal.
8. Winner confirms and pays through order detail.

### `perf-observability`

Owns read-only health and metrics surfaces:

- `/healthz` display if a frontend entry is needed.
- Auction metrics only from documented API or measured output.
- No inferred performance claims from business pages.

## Acceptance Checklist

- User H5 looks and behaves like a live commerce room.
- User H5 does not use Douyin branding or real third-party creator assets.
- Current auction remains WebSocket-authoritative.
- Multi-item shelf is visually present, but true multi-item realtime bidding is not implied in version one.
- Bid sheet shows strong user state, especially leading and outbid.
- Result is shown in-room before routing to order detail.
- Merchant PC remains operational and information-dense.
- Future work is split cleanly across `auction-atmosphere`, `merchant-analytics`, `demo-materials`, and `perf-observability`.

## Next Step

Update `frontend-experience-roadmap` to reflect this confirmed design, then validate the OpenSpec change again.
