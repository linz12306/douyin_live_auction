# Mobile Screenshot QA: H5 Live Room Refinement

Date: 2026-06-02

## Scope

This QA pass checks the first React H5 visual refinement of `LiveAuctionRoom` against Source Batch 01 and the live-room-only scope of `h5-visual-design-pipeline`.

It does not close the Figma requirement. The actual high-fidelity Figma file is still pending because Figma MCP tools were unavailable in this session.

## Captured Screenshots

The visual smoke pass used mocked buyer auth and mocked live-room store data so the UI could be checked without changing backend API, WebSocket, auction, order, wallet, or payment semantics.

- 390x844 main live room: `/tmp/h5-live-room-refined-mobile-fixed.png`
- 390x844 bid sheet: `/tmp/h5-live-room-refined-bid-sheet.png`
- 390x844 product shelf: `/tmp/h5-live-room-refined-shelf.png`
- 1200x900 desktop smoke: `/tmp/h5-live-room-refined-desktop.png`

These `/tmp` files are local validation artifacts, not tracked design assets. Persistent structure and acceptance rules remain in:

- `docs/design/h5-visual-design-pipeline/visual-reference-board.html`
- `docs/design/h5-visual-design-pipeline/mobile-screenshot-acceptance.md`
- `docs/design/h5-visual-design-pipeline/react-h5-refinement-brief.md`

## Passed Checks

- Main live-room visual hierarchy now has a compact host area, badge stack, message layer, right rail, bottom controls, and a white auction control card.
- Auction floating card follows the R2 reference direction: status header, bid-count chip, lot id, product identity, purple current-price zone, separated countdown zone, and red bid CTA.
- Bid sheet follows the R3/R5/R6 direction: timer headline, current/my bid split, state chip, large centered amount, edge steppers, increment copy, and pink primary action.
- Product shelf follows the R4 direction: dense white rows, image-left/content-right structure, state chips, price labels, and state-specific CTAs.
- Result modal follows the R7 direction with stronger winner/sold hierarchy while preserving the existing buyer order route entry.
- Text wrapping issue in the floating auction card price area was found during the 390x844 pass and fixed before the final screenshot.
- Existing accessibility anchors and tests remain intact, including `aria-label` bid controls and sr-only shelf/result headings.

## Remaining Visual Review Items

- Compare the 390x844 main screenshot directly with the user's real-device references in a side-by-side review.
- Capture the full terminal-state matrix after backend or deterministic mock fixtures can drive winner, non-winner sold, no-bid, cancelled, pending, active, leading, outbid, urgency, and extension states.
- Add real motion timing capture for price jump, countdown urgency, bid sheet entrance, shelf entrance, result modal entrance, and reduced-motion fallback.
- Create or update the actual Figma high-fidelity file once Figma tools or a user-provided Figma file/link is available.

## Recommended Next Step

Open a second-stage change only after this live-room refinement is accepted:

- Suggested change id: `h5-profile-search-expansion`
- Scope: personal homepage and search/discovery page visual expansion.
- Constraint: reuse the live-room visual tokens and interaction density; do not change auction, order, wallet, payment, or WebSocket semantics.
