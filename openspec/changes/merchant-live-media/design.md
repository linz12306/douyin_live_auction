# Design: merchant-live-media

## Overview

`merchant-live-media` adds one optional merchant-configured media object to a product. The media is dedicated to the buyer live room and remains separate from the existing product image gallery.

The intended flow is:

```text
Merchant ProductForm -> live media upload API -> live media DB row/static file
Product detail API -> ProductForm edit preview
Realtime snapshot -> buyer LiveAuctionRoom media scene
```

## Data Model

Add one live media record per product.

Recommended schema:

```sql
CREATE TABLE product_live_media (
    product_id BIGINT PRIMARY KEY,
    media_type ENUM('image','video') NOT NULL,
    media_url VARCHAR(255) NOT NULL,
    poster_url VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
```

Rationale:

- `product_id` as primary key enforces the one-live-media rule.
- A separate table prevents live-room video from being treated as product gallery or order summary imagery.
- `poster_url` is optional. The first implementation can use the first product image as the visual fallback for videos without generating a poster.

## Backend API

The implementation should follow existing product ownership patterns.

Recommended routes:

- `POST /api/v1/products/:id/live-media`
  - Merchant-only.
  - Multipart field: `media`.
  - Replaces the existing live media for that product.
  - Returns the saved live media object.
- `DELETE /api/v1/products/:id/live-media`
  - Merchant-only.
  - Removes the configured live media row.

Allowed statuses:

- `draft`
- `pending`

Rejected statuses:

- `active`
- `ended_sold`
- `ended_no_bid`
- `cancelled`

Reason: changing media during an active auction would require additional realtime refresh semantics. This slice keeps live media stable once the auction is running.

## Upload Validation

Image files:

- MIME/extension: `image/jpeg`, `image/png`, `image/webp`
- Max size: keep the existing product image limit or raise only if implementation proves necessary. Recommended first limit: 2MB.

Video files:

- MIME/extension: `video/mp4`, `video/webm`
- Max size: conservative local-demo limit. Recommended first limit: 20MB.

Filename generation should follow the current static upload pattern and avoid trusting user-provided filenames beyond extension validation.

Runtime uploads should remain untracked. Only intentional fixtures may be committed.

## Static Serving

Add a dedicated live media directory and route, for example:

- Filesystem env/default: `LIVE_MEDIA_DIR=./static/live-media`
- Public route: `/static/live-media`

This keeps runtime videos separate from product gallery images and makes cleanup/debugging clearer.

## DTO And Snapshot Contract

Product detail responses should include optional live media:

```json
{
  "product": {},
  "images": [],
  "live_media": {
    "type": "image",
    "url": "/static/live-media/prod_1_123.webp",
    "poster_url": null
  },
  "auction": {}
}
```

Realtime snapshot product summary should add the same optional field:

```json
{
  "product": {
    "id": 1,
    "title": "拍品",
    "description": "",
    "image_urls": ["/static/images/prod.jpg"],
    "live_media": {
      "type": "video",
      "url": "/static/live-media/prod_1_123.mp4",
      "poster_url": "/static/images/prod.jpg"
    }
  }
}
```

The field is optional and additive. Existing snapshot consumers remain compatible.

## Frontend Merchant UX

`ProductForm` should add a `直播间素材` area near product images.

Expected controls:

- Empty state upload button.
- Preview for image.
- Video preview or video filename/thumbnail-style panel for video.
- Replace action.
- Remove action.
- Clear copy explaining that this controls the buyer live-room scene, while `商品图片` controls lobby/order cards.
- Disabled/readonly state when product status is not `draft` or `pending`.

For new products, implementation may choose one of two safe flows:

- Upload live media only after product creation returns an id.
- Or hold a pending local file and upload it after product creation, mirroring current pending product images.

The implementation plan should choose one flow and test it.

## Frontend Buyer Live Room

`LiveAuctionRoom` should render media priority:

1. `product.live_media.type === 'video'`: muted looping inline video as scene media.
2. `product.live_media.type === 'image'`: configured image as scene media.
3. Existing staged fallback using product image or local fallback asset.

Video element requirements:

- `autoPlay`
- `muted`
- `loop`
- `playsInline`
- `poster` when available

The existing staged overlays, bidding controls, comments, shelf, and result modal remain visible and readable above the media scene.

## Demo Seed

Demo data should produce:

- At least one active auction with normal product image for `/app/auctions`.
- Live media for the same auction so `/app/auctions/:id` can show merchant-controlled visual media.

If committing a real binary video is too heavy, use a small brand-safe fixture or image-backed live media for the committed seed, and keep runtime-uploaded videos ignored.

## Bids And Orders Review

This change should not alter:

- `bids` migration/model/repository/service behavior.
- `orders` migration/model/repository/service behavior.
- Auction settlement and order creation.
- Wallet freeze/unfreeze/refund.

Order and dashboard product summaries should keep selecting the first `product_images` record.

## Testing Strategy

Backend:

- Merchant can upload supported image live media for own draft/pending product.
- Merchant can upload supported video live media for own draft/pending product.
- Unsupported type and oversize media are rejected.
- Non-owner cannot upload or delete.
- Active/terminal products reject live media mutation.
- Product detail includes `live_media`.
- Realtime snapshot includes optional `product.live_media`.
- Lobby/order summary image still comes from `product_images`.

Frontend:

- `ProductForm` renders live media controls and readonly state.
- New product flow uploads pending live media after product creation if that flow is chosen.
- Edit flow previews/replaces/removes live media.
- `LiveAuctionRoom` renders configured video/image media when present.
- `LiveAuctionRoom` falls back when no live media exists.

Verification:

- `cd frontend && npm run test -- LiveAuctionRoom`
- `cd frontend && npm run test -- ProductForm`
- `cd frontend && npm run build`
- Relevant backend Go tests.
- `npx -y @fission-ai/openspec@latest validate merchant-live-media --strict --no-interactive`
- `git diff --check`

## Risks And Mitigations

- Video autoplay can fail: render muted/inline/looping and keep fallback imagery behind it.
- Large local videos can slow demos: enforce a conservative upload limit.
- Separate media concepts can confuse merchants: use explicit copy and previews in ProductForm.
- Runtime files can pollute git: keep uploads ignored and only track deliberate fixtures.
- Snapshot contract changes can break tests: keep the field optional and update tests with backward-compatible expectations.
