# H5 Visual Design Pipeline Exploration

## Context

The project already has a Douyin-style buyer live room implementation package through `auction-atmosphere`. That slice reshaped `/app/auctions/:id` into a full-screen H5 live-commerce room with a host bar, atmosphere controls, auction floating card, product shelf, strong-state bid sheet, realtime feedback, and terminal result modal.

The next need is not a blind UI rewrite. It is a formal visual production and acceptance pipeline so future refinements can be calibrated against user-provided real-device screenshots or recordings, expressed in a high-fidelity Figma file, mapped to React H5 components, and verified by mobile screenshots.

## Confirmed Direction

- Workflow: real-device screenshots/recordings -> Figma visual teardown -> component list -> React H5 implementation -> motion restoration -> mobile screenshot acceptance -> later profile/search expansion.
- This is full OpenSpec work, not fast lane, because it changes frontend design acceptance criteria, design deliverables, and later implementation boundaries.
- Source material: the user will provide the real-device screenshots or recordings.
- Figma collaboration: Codex should create a new Figma design file when Figma tools are available.
- Figma fidelity: high-fidelity design, not only annotation docs.
- First implementation target: live room full-state set only.
- Deferred scope: profile, search, discovery/lobby expansion starts after the live-room pipeline is proven.

## First-Round Screen Scope

The first Figma and React acceptance pass covers only `/app/auctions/:id` states:

- Default live room with realtime snapshot applied.
- Buyer leading state.
- Buyer outbid state.
- Last-10-second urgency state.
- Soft Close extension state.
- Product shelf half-screen.
- Bid sheet half-screen.
- Winner result modal.
- Non-winner sold result modal.
- No-bid or cancelled terminal result.

Auction lobby, profile, search, and discovery surfaces remain second-stage work unless a later OpenSpec change expands them.

## Figma Delivery Model

When Figma tools are available, create a design file named `H5 Douyin-style Live Auction Pipeline`.

Required pages:

- `00 References`: user-provided screenshots, recording keyframes, capture metadata, and teardown notes.
- `01 Teardown`: layout grids, color sampling, type scale, spacing, visual hierarchy, density, and motion rhythm notes.
- `02 Components`: host bar, right-side action rail, comment/system message layer, auction floating card, product shelf, bid sheet, and result modal components.
- `03 Hi-Fi Screens`: the first-round live-room state set.
- `04 Motion Notes`: price pulse, countdown urgency, half-screen transitions, result modal, outbid recovery, and bid feedback.

If screenshots or recordings are not available, create only the structure, placeholders, and acceptance checklist. Do not invent exact visual details.

## Technical Direction

React implementation should refine the existing `LiveAuctionRoom` surface rather than replacing it from scratch.

Rules:

- No new backend API.
- No new WebSocket message type.
- No auction, order, wallet, or payment semantic changes.
- REST bid submission controls only local submitting/error state.
- WebSocket/store remains the source of truth for price, ranking, countdown, extension count, leading/outbid state, and terminal result.
- New frontend components or visual tokens are allowed if they keep the current route and data-flow contract.

## Risks

- Figma tools are not available in the current session; repo-local templates and OpenSpec docs are the fallback.
- Real-device source material has not been provided yet; high-fidelity detail must wait for that input.
- Douyin-style must mean interaction rhythm, density, and hierarchy, not copied Douyin branding or third-party assets.
- Mobile screenshot acceptance can only be final after both source material and React implementation are available.

## Acceptance Criteria

- OpenSpec locks the design-pipeline workflow and first-round screen scope.
- Superpowers plan gives future workers implementation-ready steps.
- Repo-local Figma handoff template documents the exact page/frame/component/state structure.
- Verification commands and screenshot acceptance criteria are explicit.
- Missing Figma tools and missing source material are recorded instead of silently skipped.
