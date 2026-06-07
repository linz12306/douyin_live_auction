## ADDED Requirements

### Requirement: Merchant live-room media configuration
The system SHALL allow an authenticated merchant to configure one live-room media asset for a product they own before the auction becomes active.

#### Scenario: Merchant uploads image live media for draft product
- **GIVEN** an authenticated merchant owns a draft product
- **WHEN** the merchant uploads a supported image as live-room media
- **THEN** the system stores the media
- **AND** the product has one configured live media object with type `image`
- **AND** the returned live media URL is served from the backend static media route

#### Scenario: Merchant uploads video live media for pending product
- **GIVEN** an authenticated merchant owns a pending product
- **WHEN** the merchant uploads a supported short video as live-room media
- **THEN** the system stores the media
- **AND** the product has one configured live media object with type `video`
- **AND** the returned live media URL is served from the backend static media route

#### Scenario: Live media replacement keeps one asset
- **GIVEN** a product already has configured live media
- **WHEN** the owning merchant uploads a new supported live media file
- **THEN** the previous live media record is replaced
- **AND** product detail returns only the latest live media object

#### Scenario: Merchant removes live media
- **GIVEN** a product has configured live media
- **WHEN** the owning merchant removes the live media
- **THEN** product detail no longer includes a live media object
- **AND** the product's normal product images remain unchanged

### Requirement: Live media upload guards
The system SHALL validate live media uploads by ownership, product status, media type, and file size.

#### Scenario: Non-owner cannot mutate live media
- **GIVEN** a merchant does not own a product
- **WHEN** the merchant uploads, replaces, or deletes live media for that product
- **THEN** the request is rejected
- **AND** the product's live media remains unchanged

#### Scenario: Active or terminal product rejects live media mutation
- **GIVEN** a product status is `active`, `ended_sold`, `ended_no_bid`, or `cancelled`
- **WHEN** the owning merchant uploads, replaces, or deletes live media
- **THEN** the request is rejected
- **AND** the product's live media remains unchanged

#### Scenario: Unsupported live media is rejected
- **GIVEN** an authenticated merchant owns a draft or pending product
- **WHEN** the merchant uploads a file that is not an allowed image or video type
- **THEN** the request is rejected with a clear validation error
- **AND** no live media object is created or replaced

#### Scenario: Oversized live media is rejected
- **GIVEN** an authenticated merchant owns a draft or pending product
- **WHEN** the merchant uploads a supported media type that exceeds the configured size limit
- **THEN** the request is rejected with a clear validation error
- **AND** no live media object is created or replaced

### Requirement: Product live media contract
The product detail API SHALL include optional live-room media separately from product images.

#### Scenario: Product detail includes live media
- **GIVEN** a product has configured live media
- **WHEN** product detail is requested
- **THEN** the response includes `live_media`
- **AND** `live_media` includes media type and media URL
- **AND** normal product images remain in the existing images collection

#### Scenario: Product detail omits absent live media
- **GIVEN** a product has no configured live media
- **WHEN** product detail is requested
- **THEN** the response remains valid
- **AND** the response has no live media object or has it set to null
- **AND** existing product, image, and auction fields remain present

### Requirement: Realtime snapshot live media
The realtime live-room snapshot SHALL expose configured live media as an optional product summary field without changing realtime auction semantics.

#### Scenario: Snapshot includes configured live media
- **GIVEN** an auction product has configured live media
- **WHEN** a buyer connects to the auction WebSocket room and receives a snapshot
- **THEN** the snapshot product summary includes optional `live_media`
- **AND** the live media object includes media type and media URL
- **AND** the snapshot still includes existing product image URLs

#### Scenario: Snapshot remains compatible without live media
- **GIVEN** an auction product has no configured live media
- **WHEN** a buyer receives a snapshot
- **THEN** the snapshot remains valid without live media
- **AND** existing realtime fields for price, ranking, countdown, status, and version remain unchanged

#### Scenario: Live media does not change bidding truth
- **GIVEN** live media is configured for an auction product
- **WHEN** bids, extensions, rankings, or terminal states are processed
- **THEN** auction engine, wallet, bid, order, and WebSocket version semantics remain unchanged
- **AND** live media is not used to calculate price, ranking, settlement, or order state

### Requirement: Merchant live media frontend
The merchant frontend SHALL provide controls for configuring live-room media without replacing normal product image management.

#### Scenario: Merchant sees live media controls
- **GIVEN** an authenticated merchant opens a product create or edit page
- **WHEN** the form renders
- **THEN** the form includes a visible `直播间素材` area
- **AND** the form still includes the existing `商品图片` area
- **AND** the UI distinguishes live-room media from product images used for lobby and order summaries

#### Scenario: Merchant previews and replaces live media
- **GIVEN** a product has configured live media
- **WHEN** the merchant opens the edit form
- **THEN** the current live media is previewed
- **AND** the merchant can replace it when product status allows media mutation

#### Scenario: Merchant cannot edit live media for readonly statuses
- **GIVEN** a product status does not allow live media mutation
- **WHEN** the merchant opens the edit form
- **THEN** the live media area is readonly or disabled
- **AND** the UI does not offer a working replace or delete action

### Requirement: Buyer live-room media rendering
The buyer H5 live room SHALL render merchant-configured live media as the primary scene media when it is available.

#### Scenario: Live room renders configured video
- **GIVEN** a buyer opens `/app/auctions/:id`
- **AND** the WebSocket snapshot includes live media with type `video`
- **WHEN** the live room renders
- **THEN** a muted looping inline video is used as the primary scene media
- **AND** bid controls, status, comments, shelf, and result affordances remain readable above the media

#### Scenario: Live room renders configured image
- **GIVEN** a buyer opens `/app/auctions/:id`
- **AND** the WebSocket snapshot includes live media with type `image`
- **WHEN** the live room renders
- **THEN** the configured image is used as the primary scene media
- **AND** bid controls, status, comments, shelf, and result affordances remain readable above the media

#### Scenario: Live room falls back when live media is absent
- **GIVEN** a buyer opens `/app/auctions/:id`
- **AND** the WebSocket snapshot has no live media
- **WHEN** the live room renders
- **THEN** the room uses the existing staged fallback or product image scene
- **AND** bidding behavior remains available according to realtime auction state

### Requirement: Product summary imagery remains product-image based
The system SHALL keep lobby, order, and merchant summary imagery based on normal product images instead of live-room media.

#### Scenario: Lobby card uses product image
- **GIVEN** a product has both product images and live-room media
- **WHEN** the buyer opens `/app/auctions`
- **THEN** the auction card image is selected from normal product images
- **AND** the card does not use the live-room video as its summary image

#### Scenario: Order summary uses product image
- **GIVEN** a sold auction product has both product images and live-room media
- **WHEN** buyer or merchant order lists are requested
- **THEN** order product image fields are selected from normal product images
- **AND** live-room media does not replace order summary imagery
