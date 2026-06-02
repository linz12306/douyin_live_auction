# Proposal: h5-visual-design-pipeline

## Why

The buyer H5 live room now has a Douyin-style implementation direction, but future visual refinement needs a stronger production pipeline. The project needs real-device screenshots or recordings as the visual authority, a high-fidelity Figma teardown and screen set, a component inventory, motion notes, and mobile screenshot acceptance before further React polishing.

Without this pipeline, future UI changes risk becoming subjective visual tweaks that are hard to verify and hard to extend into profile/search pages.

## What Changes

- Add a frontend design-pipeline specification for the buyer H5 live room.
- Define source-material intake for user-provided real-device screenshots and recordings.
- Define the Figma file structure for high-fidelity teardown and live-room state screens.
- Define the first-round component inventory and motion note requirements.
- Define React H5 handoff boundaries for refining the existing `LiveAuctionRoom`.
- Define mobile screenshot acceptance criteria for 390x844 and real-device comparison.
- Defer profile/search expansion until the live-room pipeline is proven.

## Compatibility Decisions

- No backend API changes.
- No new WebSocket message types.
- No auction, order, wallet, payment, cancellation, or settlement semantic changes.
- No requirement to copy Douyin branding, icons, or third-party media.
- Existing `auction-atmosphere` implementation remains the React baseline.
- Figma file creation is required when Figma tools are available; otherwise repo-local templates are the fallback.

## Impact

- Documentation:
  - Add Superpowers exploration and implementation plan.
  - Add OpenSpec change files.
  - Add repo-local Figma handoff and screenshot acceptance templates.
- Figma:
  - Create a new design file later when Figma tools are available or a target file is provided.
- Frontend:
  - Future implementation should refine `/app/auctions/:id` against the high-fidelity design.
- Testing:
  - OpenSpec validation and diff checks for this slice.
  - Future React work uses focused `LiveAuctionRoom` tests, build, and screenshot checks.

## Out Of Scope

- Implementing new React UI changes in this planning slice.
- Creating exact high-fidelity visuals before the user provides source screenshots or recordings.
- Adding profile, search, discovery, or lobby redesigns in the first round.
- Introducing new backend contracts or realtime semantics.
