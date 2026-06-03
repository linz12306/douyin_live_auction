# Tasks: merchant-live-media

- [x] 1. Superpowers exploration
  - Read `AGENTS.md`, `requirements-v3.md`, current source of truth, project plan, relevant OpenSpec specs/changes, and existing product/live-room/order code.
  - Inspect dirty worktree and record current uncommitted live-room UI draft.
  - Review existing `bids` and `orders` files/migrations per repo instruction.
  - Present brainstorm checkpoint and receive user approval for the recommended one-item live media direction.
  - Create `docs/superpowers/specs/2026-06-03-merchant-live-media-exploration.md`.

- [x] 2. OpenSpec lock
  - Create `openspec/changes/merchant-live-media/proposal.md`.
  - Create `openspec/changes/merchant-live-media/design.md`.
  - Create `openspec/changes/merchant-live-media/tasks.md`.
  - Create spec delta under `openspec/changes/merchant-live-media/specs/merchant-live-media/spec.md`.
  - Run `npx -y @fission-ai/openspec@latest validate merchant-live-media --strict --no-interactive`.
  - Run `git diff --check`.

- [x] 3. Superpowers execution plan
  - Create `docs/superpowers/plans/2026-06-03-merchant-live-media.md`.
  - Translate this OpenSpec into implementation-ready slices.
  - Include owned verification commands for each slice.
  - Decide whether new-product live media is held as a pending local file or uploaded after initial product creation.

- [ ] 4. Backend live media storage and API
  - Add migration/model/repository support for one optional live media object per product.
  - Add live media static directory configuration and serving.
  - Add merchant-scoped upload/replace/delete handlers.
  - Validate media type, extension, ownership, product status, and file size.
  - Keep runtime uploads untracked.
  - Add backend tests for success, validation failure, ownership, status guards, and delete behavior.

- [ ] 5. Product and realtime contracts
  - Extend product detail DTO/API to include optional `live_media`.
  - Extend realtime product summary snapshot to include optional `live_media`.
  - Ensure existing clients remain compatible when the field is absent.
  - Verify lobby/order/dashboard summary images still come from `product_images`.
  - Add backend snapshot, product detail, lobby summary, and order summary tests.

- [ ] 6. Merchant frontend controls
  - Extend product types and product API helpers for live media.
  - Add `直播间素材` controls to `ProductForm`.
  - Support preview, replace, remove, errors, loading state, and readonly state.
  - Preserve existing product image behavior and publish rules.
  - Add focused frontend tests for create/edit/readonly/error flows.

- [ ] 7. Buyer live-room rendering
  - Extend auction types/store expectations for optional live media.
  - Render video live media as muted looping inline scene media.
  - Render image live media as scene media.
  - Preserve current fallback staged scene when no live media exists.
  - Keep bidding controls, comments, shelf, and result modal readable above media.
  - Add focused `LiveAuctionRoom` tests for video, image, and fallback paths.

- [ ] 8. Demo seed and preview verification
  - Update demo seed or fixtures so at least one active auction has product images and live media.
  - Verify `demo_merchant / test123` can see or configure the media area.
  - Verify `demo_buyer_a / test123` sees product images in `/app/auctions` and live media in `/app/auctions/:id`.
  - Capture mobile screenshot smoke if frontend layout changes materially.

- [ ] 9. Final verification
  - Run relevant backend Go tests.
  - Run `cd frontend && npm run test -- ProductForm`.
  - Run `cd frontend && npm run test -- LiveAuctionRoom`.
  - Run `cd frontend && npm run build`.
  - Run `npx -y @fission-ai/openspec@latest validate merchant-live-media --strict --no-interactive`.
  - Run `git diff --check`.
  - Update OpenSpec tasks and Superpowers plan checkboxes with real results.
  - Update memory.
  - Commit and push verified slices unless the user asks to keep them local.
