# H5 Discovery Live Feed Design

Date: 2026-06-02
Change id: `h5-discovery-live-feed`

## Context

The buyer H5 live room now has a Douyin-style visual direction, but the entry route `/app/auctions` is still a conventional auction card grid named `竞拍大厅`. The user selected the second-stage scope as search/discovery first, then chose the `live-feed` direction from the visual companion.

This design upgrades `/app/auctions` into a mobile-first `发现竞拍` entrance that feels like a live-commerce discovery surface while preserving existing backend contracts.

## Goals

- Make `/app/auctions` feel like the upstream entry to the refined H5 live room.
- Keep the first screen strong on 390x844 mobile: search surface, channel chips, hero live card, and secondary auction cards.
- Preserve current user routes:
  - `/app/auctions`
  - `/app/auctions/:id`
  - `/app/orders`
  - `/profile`
- Preserve `listAuctionLobby()` as the only data source for the first implementation.
- Preserve loading, empty, error, refresh, and card entry behavior.

## Non-Goals

- No new backend API.
- No true full-text search endpoint.
- No real hot-ranking algorithm.
- No profile page redesign in this change.
- No WebSocket changes and no change to live-room realtime truth rules.
- No Douyin logo, copied Douyin assets, or unlicensed creator/product media.

## Selected Direction

Use a `直播流入口` layout:

- Top compact status/nav row with visible `订单` and `我的` entries.
- Search bar visual treatment with local input behavior or non-submitting filter affordance.
- Horizontal channel chips such as `推荐`, `正在竞拍`, `快结束`, and category-like labels.
- A large hero live auction card derived from the highest-priority lobby item.
- A two-column feed of remaining auction cards below the hero.
- Strong active-state treatment with Douyin-style red CTA, deep background, image-forward cards, status chips, and prominent current price/countdown.

## Data Model and Behavior

The page continues to call `listAuctionLobby()` and render `AuctionLobbyItem[]`.

First implementation can derive display-only metadata from existing fields:

- `status` -> live/state chip and channel grouping.
- `current_price` -> primary price text.
- `ended_at` -> end time and fast-ending display when available.
- `image_url` -> card visual, with a styled placeholder when absent.
- `title` -> card title and local search matching.

Search and channel chips are front-end affordances only:

- Search may filter currently loaded lobby items by title.
- Channel chips may filter currently loaded items by status or simple derived timing.
- Empty filtered results must clearly say no local matches, not imply backend search failed.

## Components

- `DiscoveryHeader`: title/nav area with orders and profile links.
- `DiscoverySearchBar`: mobile search input affordance.
- `DiscoveryChannelChips`: local filters and active state.
- `HeroLiveAuctionCard`: first/high-priority auction item with image background, status, price, end time, and `进入直播` CTA.
- `AuctionFeedCard`: compact secondary auction card for the two-column feed.
- `LobbyStatePanel`: loading, error, empty, filtered-empty, and refreshing states.

These can be local component functions inside `AuctionLobby.tsx` for the first slice unless the file becomes hard to read.

## Interaction Rules

- Hero and feed card CTAs link to `/app/auctions/:id`.
- `订单` links to `/app/orders`.
- `我的` links to `/profile`.
- Refresh remains available and should not hide content unnecessarily.
- Loading state should retain the discovery visual shell.
- Error state should give retry affordance through the existing refresh/load path.
- Empty state should keep the page feeling like a live-discovery surface, not a blank admin list.

## Visual Acceptance

On 390x844:

- Header, search, chips, hero card, and at least part of the secondary feed are visible.
- Text does not overflow chips, cards, CTAs, or price rows.
- Hero CTA and secondary card CTA have stable tap targets.
- Top navigation entries do not collide with the search bar or chips.
- Missing images still produce polished placeholders.

On desktop:

- The page remains usable as a centered H5-style discovery surface or responsive grid.
- It should not become a merchant-PC dashboard or marketing landing page.

## Verification

- `cd frontend && npm run test -- AuctionLobby`
- `cd frontend && npm run build`
- `npx -y @fission-ai/openspec@latest validate h5-discovery-live-feed --strict --no-interactive`
- `git diff --check`
- Mobile screenshot smoke at 390x844 for default content, loading/empty/error where feasible.

## Open Questions

None for the first implementation slice. Real backend search, real ranking, and personal homepage expansion are intentionally deferred.
