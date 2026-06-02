# Design: h5-visual-design-pipeline

## Technical Approach

This change creates a formal design-production and verification pipeline for the buyer H5 live room. It does not implement React UI changes yet. It locks how source material, Figma output, component inventory, motion notes, and screenshot acceptance should drive future React H5 refinements.

The baseline frontend surface is the existing `/app/auctions/:id` live room implemented by `auction-atmosphere`.

## Source Material Intake

The user-provided real-device screenshots or recordings are the visual authority for the first round.

Required intake metadata:

- Device model or viewport size when known.
- Capture date.
- Screen or state represented.
- Recording timestamp for each keyframe when sourced from video.
- Notes about what should be copied structurally versus treated only as inspiration.

If no material is available, workers may only create placeholders, teardown slots, and acceptance checklists. They must not invent exact visual details or claim high-fidelity completion.

## Figma File Structure

When Figma tools are available, create `H5 Douyin-style Live Auction Pipeline` as a design file.

Required pages:

- `00 References`: screenshots, recording keyframes, capture metadata, and annotation frames.
- `01 Teardown`: layout grid, safe areas, layer hierarchy, typography, color palette, spacing, density, and motion rhythm.
- `02 Components`: reusable component frames for host bar, action rail, comment/system messages, auction floating card, product shelf, bid sheet, and result modal.
- `03 Hi-Fi Screens`: high-fidelity live-room state screens.
- `04 Motion Notes`: transition and feedback specifications.

The repo-local template under `docs/design/h5-visual-design-pipeline/` is the fallback and handoff source when Figma cannot be created in-session.

## First-Round High-Fidelity Screens

The first round covers only live-room states:

- Default room with WebSocket snapshot applied.
- Current buyer leading.
- Current buyer outbid.
- Last 10 seconds urgency.
- Soft Close extension.
- Product shelf open.
- Bid sheet open.
- Winner result modal.
- Non-winner sold result modal.
- No-bid or cancelled terminal result.

Auction lobby, profile, search, and discovery pages are deferred to a later OpenSpec change.

## Component Inventory

The component list should map Figma components to React implementation areas:

- Host bar: room identity, online count, connection state, follow/refresh/back controls.
- Right-side action rail: visual atmosphere actions that do not change auction truth.
- Comment/system message layer: public status messages and private outbid feedback.
- Auction floating card: current price, countdown, bid count, status, primary bid entry.
- Product shelf: current realtime item plus clearly labeled demo rows.
- Bid sheet: amount controls, submit state, bid context, leading/outbid/error/terminal states.
- Result modal: winner, non-winner, no-bid, and cancelled outcomes.

Components may be split in React later, but the handoff must preserve the WebSocket truth rules.

## Motion Notes

Motion specifications should include:

- Trigger.
- Duration.
- Easing.
- Affected element.
- Accessible text fallback.
- Reduced-motion or no-animation fallback when needed.

First-round motion targets:

- Price pulse after accepted WebSocket price update.
- Countdown urgency at 10 seconds or less.
- Half-screen shelf and bid sheet transitions.
- Outbid recovery feedback.
- Result modal entrance.
- Bid submitting and error feedback.

## React Handoff Boundary

Future React work should refine the existing `LiveAuctionRoom` rather than replacing it from scratch.

Rules:

- REST bid command can update only local submitting/error state.
- Visible price, ranking, countdown, extension count, leading/outbid state, and terminal state stay WebSocket/store-driven.
- No new backend route or WebSocket message can be introduced by this change.
- Brand-safe visuals only: no Douyin branding, copied assets, or third-party creator/product media.
- Narrow mobile viewport must keep top host bar, action rail, messages, floating card, overlays, and bottom controls readable and usable.

## Verification Strategy

This documentation slice verifies:

- OpenSpec strict validation.
- Whitespace/diff hygiene.

Future React implementation verifies:

- Focused `LiveAuctionRoom` tests.
- Frontend build.
- Mobile screenshots at 390x844.
- Real-device screenshot comparison once user source material is available.
- No incoherent overlap or misleading disabled/visual-only actions.
