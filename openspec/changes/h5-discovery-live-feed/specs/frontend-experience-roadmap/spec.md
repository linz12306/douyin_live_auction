## ADDED Requirements

### Requirement: Buyer H5 discovery live feed
The frontend SHALL provide a mobile-first buyer discovery entrance on `/app/auctions` that visually leads into the Douyin-style live auction room while preserving existing lobby data contracts.

#### Scenario: Buyer opens discovery entrance
- **GIVEN** an authenticated buyer opens `/app/auctions`
- **WHEN** lobby data loads successfully
- **THEN** the page presents a `发现竞拍` style H5 discovery surface
- **AND** it includes visible entries to buyer orders and profile
- **AND** it includes a search affordance, channel chips, a hero auction/live card, and secondary auction feed cards
- **AND** every auction entry routes to the existing `/app/auctions/:id` live room

#### Scenario: Discovery uses existing lobby data
- **GIVEN** the discovery page needs auction content
- **WHEN** the first implementation renders cards, filters, or hero selection
- **THEN** it uses the existing `listAuctionLobby()` response and `AuctionLobbyItem` fields
- **AND** it does not require new backend search, ranking, participant-count, view-count, merchant, category, or WebSocket fields

#### Scenario: Buyer filters loaded discovery content
- **GIVEN** loaded lobby items are visible
- **WHEN** the buyer enters local search text or selects a channel chip
- **THEN** the page may filter currently loaded items by title, status, or locally derived timing
- **AND** the UI distinguishes local no-match results from API loading, API error, or truly empty lobby states
- **AND** the page does not imply that local filtering is a backend-wide search

#### Scenario: Discovery states remain usable
- **GIVEN** the discovery page is loading, refreshing, empty, filtered-empty, or failed
- **WHEN** each state renders on a 390x844 viewport
- **THEN** the page keeps a coherent H5 discovery shell
- **AND** text, chips, cards, actions, and navigation do not overlap
- **AND** error and refresh affordances remain visible and operable

#### Scenario: Discovery avoids unsupported semantics
- **GIVEN** the discovery page follows Douyin-style live commerce references
- **WHEN** it renders search, chips, ranking-like copy, images, or live-state decoration
- **THEN** it avoids Douyin branding, copied Douyin assets, and unlicensed media
- **AND** it does not introduce or imply changed auction, order, wallet, payment, WebSocket, or settlement semantics
