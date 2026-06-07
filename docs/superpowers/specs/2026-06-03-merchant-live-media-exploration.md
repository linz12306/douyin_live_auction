# Merchant Live Media Exploration

## Goal

Give merchants a clear place in the product management flow to provide the visual media used by the buyer H5 live auction room.

The merchant should be able to upload or configure one live-room background image or short video for a product/auction. The buyer live room should use that merchant-controlled media as the simulated live scene, while the discovery lobby, order summaries, and merchant lists continue to use normal product images.

## Workflow Choice

This is full Superpowers + OpenSpec work rather than fast lane. It changes product behavior, media upload validation, storage/API contracts, realtime room snapshot data, and the user-facing H5 live-room acceptance criteria. Per `AGENTS.md`, implementation must wait until the Superpowers exploration and OpenSpec lock pass validation.

## User Brainstorm Checkpoint

The user asked whether the merchant backend has a place where they can upload images or videos for the live room. After preflight, the confirmed direction is:

- Add a merchant-controlled `直播间素材` area to the product create/edit flow.
- Support one image or one short video for the live room.
- Use the configured media in `/app/auctions/:id`.
- Keep normal product images as the source for `/app/auctions` lobby cards and order summaries.
- Do not build a full media library, transcoding, livestream ingestion, editing tool, or scheduling system in this slice.
- Treat the current uncommitted `LiveAuctionRoom.tsx` visual redesign as an implementation draft/baseline, not as finalized business behavior.

## Current Findings

- `requirements-v3.md` already says the live room should use looping video to simulate live atmosphere.
- Merchant product creation currently has only `商品图片` via `frontend/src/pages/merchant/ProductForm.tsx`.
- `frontend/src/components/ImageUploader.tsx` accepts only `jpg/png/webp` and limits each image to 2MB.
- `frontend/src/api/product.ts` only exposes product CRUD, publish, and `/products/:id/images` upload/delete.
- `backend/internal/handler/product_handler.go` uploads product images into `IMAGE_DIR` and serves them under `/static/images`.
- `backend/migrations/003_create_product_images.sql` stores only product image URLs.
- `backend/internal/realtime/message.go` and `snapshot.go` expose `ProductSummary.image_urls`, but no live media field.
- `frontend/src/pages/app/LiveAuctionRoom.tsx` currently derives its scene from `roomProduct.image_urls[0]` or a local fallback.
- `backend/internal/repository/order_repo.go` and merchant dashboard summaries use the first `product_images` row as product summary image.
- `bids` and `orders` migrations/models/services are independent of visual media and should not be changed for this slice.

## Users

- Merchant: wants a direct, low-friction way to decide what buyers see as the live-room visual.
- Buyer: expects the live room to show an immersive media scene tied to the merchant's auction, without losing the real bidding controls.
- Demo presenter: needs seeded/demo auctions to show real product pictures and live-room media reliably.

## Non-Goals

- No real livestream ingestion, RTMP/HLS service, transcoding, thumbnail extraction, or video editing.
- No reusable media library or cross-product asset picker.
- No multi-clip playlist or scheduled media rotation.
- No changes to bidding, wallet freeze/unfreeze, ranking, Soft Close, settlement, orders, payment, or cancellation semantics.
- No use of Douyin marks, copied Douyin assets, or unlicensed third-party creator media.

## Recommended Technical Direction

Add a dedicated live media model/contract separate from `product_images`.

The preferred first slice stores one optional media object per product:

- `media_type`: `image` or `video`
- `media_url`: static URL such as `/static/live-media/...`
- `poster_url`: optional, only for video if implementation can supply it without transcoding
- `created_at` / `updated_at`

The backend should provide merchant-scoped upload/update/delete behavior for draft or pending products. Active or terminal products should not be mutable unless the OpenSpec implementation explicitly decides a safe refresh behavior.

The realtime snapshot should add this as an optional nested product field, for example:

```json
{
  "product": {
    "id": 1,
    "title": "Example",
    "description": "",
    "image_urls": ["/static/images/example.jpg"],
    "live_media": {
      "type": "video",
      "url": "/static/live-media/prod_1_live.mp4",
      "poster_url": "/static/images/example.jpg"
    }
  }
}
```

Existing clients that ignore `live_media` remain compatible.

## Alternatives Considered

### Option 1: Reuse First Product Image

Use `product_images[0]` as the live-room background and add no new upload field.

Pros: fastest and no backend contract change.
Cons: does not satisfy the user's video ask, cannot distinguish lobby card imagery from live-room scene, and makes future live media harder to reason about.

### Option 2: Dedicated One-Item Live Media (Recommended)

Add one separate live-room media object per product/auction.

Pros: matches the user need, keeps product images clean, adds only a small schema/API/snapshot change, and avoids overbuilding.
Cons: requires migration, backend upload validation, frontend form changes, and snapshot/frontend type updates.

### Option 3: Full Merchant Media Library

Build reusable asset management with multiple assets, picking, previews, and later scheduling.

Pros: more flexible for a production merchant workflow.
Cons: too large for the current slice and would distract from the H5 live-room demo.

## Acceptance Criteria

- Merchant product create/edit includes a visible `直播间素材` area.
- Merchant can upload one supported image or video for draft/pending products.
- Upload validation rejects unsupported media types and oversized files with clear feedback.
- Product detail API returns the configured live media.
- WebSocket snapshot includes optional live media in the product summary.
- Buyer live room renders configured video as a muted looping inline background when present.
- Buyer live room renders configured image as the scene background when present.
- Buyer live room falls back to the existing simulated stage/product image when no live media exists.
- `/app/auctions` lobby cards and order/merchant summary imagery continue to use normal product images.
- Bidding, orders, wallet, ranking, settlement, and cancellation behavior do not change.
- Demo seed or fixtures provide at least one auction where `/app/auctions` shows product imagery and `/app/auctions/:id` has merchant-controlled live media.

## Risks

- Browser autoplay can fail if video is not muted or inline. Mitigation: render video with `muted`, `playsInline`, `loop`, and `autoPlay`, with image/fallback scene behind it.
- Uploading large videos can slow local demos. Mitigation: set a conservative size limit and keep this slice to short local static files.
- Mixing live media with product images could confuse order/lobby summaries. Mitigation: separate DB/API fields and tests proving lobby/order summaries still use `product_images`.
- Active-auction media edits could require live snapshot refresh semantics. Mitigation: first slice only permits draft/pending edits unless explicitly widened in implementation.
- Runtime uploads should not be committed. Mitigation: keep generated files under static runtime directories and track only deliberate fixtures chosen during implementation.

## Verification Plan

- OpenSpec strict validation for `merchant-live-media`.
- Backend tests for upload validation, merchant ownership/status guards, product detail live media response, and snapshot live media response.
- Frontend tests for ProductForm live media controls and LiveAuctionRoom media fallback/rendering.
- Required existing checks from the parent task remain: focused live-room/lobby tests, frontend build, and `git diff --check`.
