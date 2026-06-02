# Design: h5-discovery-live-feed

## Overview

`/app/auctions` becomes `发现竞拍`, a buyer H5 discovery page that visually bridges the buyer journey into the refined Douyin-style live room.

The first implementation remains intentionally contract-light: it uses existing lobby data and derives local presentation states. This gives the product a stronger entry experience without blocking on backend search or ranking work.

## Page Structure

1. Header/nav
   - Compact top row.
   - Visible links to buyer orders and profile.
   - Page title `发现竞拍`.

2. Search surface
   - Mobile search input with placeholder like `搜索直播 / 拍品 / 商家`.
   - First implementation filters loaded item titles locally.
   - It must not claim to search all backend inventory.

3. Channel chips
   - Recommended chips: `推荐`, `正在竞拍`, `快结束`, `待开拍`, plus optional category-like display chips if derived locally.
   - Chips filter currently loaded lobby items.
   - `推荐` shows the unfiltered feed.

4. Hero live card
   - Uses the first priority item after local filtering.
   - Active auctions should sort before pending/terminal states for hero selection where feasible.
   - Shows image or polished placeholder, status chip, current price, end time/timing copy, title, and `进入直播` action.

5. Secondary feed
   - Remaining items render as compact two-column cards on mobile where space permits.
   - Cards show image/placeholder, status, title, current price, time copy, and room entry action.

6. State panels
   - Loading, error, empty, filtered-empty, and refreshing states fit the discovery shell.
   - Error retains retry affordance through the existing load path.

## Data and Contracts

Existing API:

- `listAuctionLobby(): Promise<AuctionLobbyItem[]>`

Existing item fields:

- `product_id`
- `auction_id`
- `title`
- `image_url`
- `status`
- `current_price`
- `ended_at`

The page must not depend on fields outside this contract for the first implementation. If later search, category, participant count, view count, merchant identity, or ranking data is required, that must be covered by a separate OpenSpec API change before UI depends on it.

## Visual Direction

- Deep immersive H5 background.
- Douyin-style red primary action.
- Image-forward hero card.
- Dense but readable chips and cards.
- Status-specific chips for `pending`, `active`, `ended_sold`, `ended_no_bid`, and `cancelled`.
- Prominent price hierarchy.
- Polished placeholders for missing product images.

The page must avoid Douyin logo/brand usage and copied third-party assets.

## Accessibility and Mobile Constraints

- Search input has an accessible label.
- Buttons/links remain keyboard reachable.
- CTA tap targets remain stable on 390x844.
- Text wraps within cards and chips without overlapping.
- Filtered-empty and API-empty states are distinguishable.

## Verification Strategy

- Focused tests:
  - Existing polling behavior remains.
  - Visibility refresh behavior remains.
  - Local search/filter behavior renders expected matches and filtered-empty state.
  - Primary card link continues to `/app/auctions/:id`.
- Build:
  - `cd frontend && npm run build`
- Spec:
  - `npx -y @fission-ai/openspec@latest validate h5-discovery-live-feed --strict --no-interactive`
- Visual:
  - 390x844 screenshot of populated page.
  - 390x844 screenshot of filtered-empty or empty state where feasible.

## Risks

- Search affordance could be mistaken for backend search.
  - Mitigation: copy and tests must treat it as local filtering only.
- Hero card may over-emphasize terminal auctions if data has no active items.
  - Mitigation: active-first local prioritization where feasible, with status chips for honesty.
- The page could become visually detached from the live room.
  - Mitigation: reuse the H5 live-room visual tokens: deep background, red action, image-forward commerce cards, and compact chip density.
