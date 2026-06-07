# Figma File Template: H5 Douyin-style Live Auction Pipeline

This template is the repo-local handoff for the Figma file that should be created when Figma tools are available.

Current status:

- Figma MCP tools were unavailable in this session.
- User-provided Source Batch 01 was supplied in chat and summarized in `source-material-teardown.md`.
- Source Batch 01 image files are not committed to the repo; use the chat attachments or later uploaded Figma/file assets as the visual source.
- This document defines the exact file/page/frame/component structure to create later.

## File

- Name: `H5 Douyin-style Live Auction Pipeline`
- Type: Figma design file
- Purpose: high-fidelity teardown and implementation handoff for the buyer H5 live auction room

## Page 00 References

Create frames:

- `Source Intake Checklist`
- `Live Room Screenshot References`
- `Recording Keyframes`
- `Do Not Copy / Brand Safety Notes`
- `Source Batch 01 Summary`

Each source item should record:

- Device model or viewport size when known.
- Capture date.
- Screen or state.
- Recording timestamp when sourced from video.
- Notes on whether the reference is structural, visual, motion, or copywriting guidance.

Do not paste Douyin logos, copied icons, or third-party creator/product assets as implementation assets.

For Source Batch 01, mirror the reference index from `source-material-teardown.md`:

- R1: beauty live commerce room.
- R2: sneaker auction live room.
- R3: bid sheet close-up.
- R4: product shelf/status table.
- R5: bid sheet state variants.
- R6: ended bid sheet state.
- R7: result modal variants.

## Page 01 Teardown

Create frames:

- `Layout Grid and Safe Areas`
- `Layer Hierarchy`
- `Typography Scale`
- `Color and Surface Palette`
- `Spacing and Density`
- `Motion Rhythm`

Teardown should identify:

- Top host zone height and safe area behavior.
- Right action rail spacing and tap target size.
- Comment/system message max width and stacking.
- Floating auction card position, width, and collision rules.
- Bottom control bar height and keyboard-adjacent behavior.
- Half-screen overlay height, radius, dim layer, and scroll rules.

## Page 02 Components

Create component groups:

- `HostBar`
  - default
  - reconnecting
  - connection error
- `ActionRail`
  - like
  - gift
  - share
  - ranking
  - coupon
- `MessageLayer`
  - default system message
  - outbid private warning
  - extension status
- `AuctionFloatingCard`
  - pending
  - active/default
  - leading
  - outbid
  - urgent
  - terminal
- `ProductShelf`
  - closed trigger
  - open with current realtime item
  - demo upcoming row
  - demo no-bid row
  - demo ended row
- `BidSheet`
  - no bid
  - leading
  - outbid
  - submitting
  - command error
  - terminal
- `ResultModal`
  - winner
  - non-winner sold
  - no bid
  - cancelled

Each component group should include React mapping notes that point future implementation toward `frontend/src/pages/app/LiveAuctionRoom.tsx` or extracted child components if later refactoring is justified.

## Page 03 Hi-Fi Screens

Create 390x844 frames:

- `01 Default Live Room`
- `02 Buyer Leading`
- `03 Buyer Outbid`
- `04 Last 10 Seconds`
- `05 Soft Close Extended`
- `06 Product Shelf Open`
- `07 Bid Sheet Open`
- `08 Winner Result`
- `09 Non-winner Sold Result`
- `10 No-bid or Cancelled Result`

Each frame should include:

- Visible auction state.
- Product media or brand-safe fallback scene.
- Current price.
- Countdown.
- Ranking/message context where relevant.
- Primary action state.
- Notes for any disabled or visual-only action.

## Page 04 Motion Notes

Create rows or cards:

- `Price Pulse`
- `Countdown Urgency`
- `Bid Sheet Enter/Exit`
- `Product Shelf Enter/Exit`
- `Outbid Recovery`
- `Result Modal Enter`
- `Bid Submitting/Error`

Each motion card should include:

- Trigger.
- Duration.
- Easing.
- Affected element.
- End state.
- Accessible text fallback.
- Reduced-motion fallback.

## React Handoff Rules

- Do not introduce new backend APIs.
- Do not introduce new WebSocket message types.
- Keep WebSocket/store as realtime truth for price, ranking, countdown, extension count, leading/outbid state, and terminal state.
- Use REST bid response only for local submitting/error feedback.
- Keep brand-safe visual assets only.
- Keep mobile overlays readable at 390x844 before expanding to profile/search pages.
