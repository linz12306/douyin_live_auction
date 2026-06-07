# Proposal: merchant-live-media

## Why

The buyer H5 live room is moving toward a Douyin-style live commerce experience, but merchants currently only control normal product images. There is no merchant-facing place to provide the image or video that appears as the live-room scene.

This creates two problems:

- Merchants cannot stage the live-room visual themselves.
- The buyer room must fake atmosphere from product images or local fallback art, which limits demo quality and does not match `requirements-v3.md`'s simulated looping live video direction.

## What Changes

- Add a merchant-controlled `直播间素材` concept separate from product gallery images.
- Let merchants configure one live-room image or one short live-room video for a draft/pending product.
- Store and serve live media through backend static file handling.
- Add live media to product detail responses and the realtime room product snapshot as an optional field.
- Update the buyer live room to render configured live media first, then fall back to the current staged scene/product image.
- Keep `/app/auctions` lobby cards, order summaries, and merchant summaries using normal product images.
- Seed or fixture at least one demo auction with product imagery and live media.

## Compatibility Decisions

- The new snapshot field is optional and additive.
- Existing clients may ignore `product.live_media`.
- Normal product image upload and `product_images` remain the source for lobby/order summary imagery.
- Bidding, ranking, WebSocket message ordering, Soft Close, settlement, orders, wallet, and payment semantics do not change.
- This slice implements short local static media only. It does not introduce livestream ingestion, transcoding, generated posters, a media library, playlists, or scheduling.

## Impact

- Backend:
  - Add a migration/model/repository path for one live media object per product.
  - Add merchant-scoped upload/update/delete or replace behavior.
  - Add static serving for the live media directory.
  - Extend product detail and realtime snapshot DTOs.
- Frontend:
  - Add merchant form controls for `直播间素材`.
  - Add API/types for product live media.
  - Update H5 live room media rendering.
- Demo:
  - Update demo seed or fixture path so the discovery page has product images and the live room has live media.
- Tests:
  - Backend upload/ownership/status/snapshot tests.
  - Frontend ProductForm and LiveAuctionRoom tests.
  - Existing required build/diff/OpenSpec checks.

## Out Of Scope

- Real livestream push/pull infrastructure.
- Video transcoding, compression, thumbnail extraction, or poster generation.
- Multi-asset merchant media library.
- Multi-video playlist or scheduled live-room media rotation.
- Active auction media replacement with live push semantics.
- Changes to auction engine, bids, orders, wallet, payment, cancellation, or settlement.
