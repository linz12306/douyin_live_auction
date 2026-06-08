## ADDED Requirements

### Requirement: Merchant console visual system
The frontend SHALL provide a cohesive dark merchant console visual system for merchant PC pages.

#### Scenario: Merchant pages share a console language
- **GIVEN** an authenticated merchant opens any merchant PC page
- **WHEN** the page renders
- **THEN** the page uses a consistent dark graphite operational visual style
- **AND** repeated surfaces use compact borders, restrained shadows, and status-driven color
- **AND** the page avoids large decorative purple gradients, glow blobs, marketing heroes, and unrelated entertainment UI

#### Scenario: Merchant console navigation is discoverable
- **GIVEN** an authenticated merchant is using merchant pages
- **WHEN** the merchant needs to move between operating surfaces
- **THEN** dashboard, product management, product publishing, order management, and relevant monitor entry points are visible through a consistent merchant navigation pattern
- **AND** route protection and role behavior remain unchanged

### Requirement: Horizontal live product control list
The merchant product management page SHALL use horizontal live product rows as its primary management layout.

#### Scenario: Merchant scans product rows
- **GIVEN** an authenticated merchant opens `/merchant/products`
- **WHEN** product data loads successfully
- **THEN** products are shown as horizontal operational rows rather than a two-column card gallery
- **AND** each row shows product identity, product status, available auction identifier or monitor entry, and relevant actions
- **AND** the row layout prioritizes scanning product state, price/rule context when available, and next action

#### Scenario: Product list uses only existing data
- **GIVEN** the current product list API does not expose every desired auction metric
- **WHEN** the horizontal product row renders
- **THEN** the row does not require new backend fields
- **AND** unavailable metrics are omitted, shown as unavailable, or deferred to product detail, dashboard, or monitor views
- **AND** no backend route, response field, database schema, or auction behavior is changed for the row layout

#### Scenario: Product list state controls still work
- **GIVEN** the product management page has status tabs, refresh, empty, loading, and error states
- **WHEN** the merchant interacts with the page
- **THEN** existing status filtering and refresh behavior are preserved
- **AND** empty, loading, and error states match the merchant console visual system

#### Scenario: Product row actions are state-aware
- **GIVEN** a product row has draft, pending, active, ended, or cancelled status
- **WHEN** the row renders available actions
- **THEN** it exposes only actions already supported by existing frontend/backend behavior
- **AND** active or auction-backed rows expose monitor navigation when an auction id is available
- **AND** unsafe or unsupported actions are not introduced by the visual redesign

### Requirement: Semantic merchant status language
The merchant UI SHALL make product, auction, and order states visually distinct and semantically clear.

#### Scenario: Product and auction states are distinguishable
- **GIVEN** a merchant page displays product or auction state
- **WHEN** the state is `draft`, `pending`, `active`, `ended_sold`, `ended_no_bid`, or `cancelled`
- **THEN** the UI shows a clear label for that state
- **AND** uses distinct semantic color treatment for inactive, awaiting, realtime/active, sold, no-bid, and cancelled/risk states

#### Scenario: Order states are distinguishable
- **GIVEN** a merchant page displays order state
- **WHEN** the state is `pending_confirm`, `pending_payment`, `paid`, or `cancelled`
- **THEN** the UI shows a clear label for that state
- **AND** uses distinct semantic color treatment for awaiting confirmation, awaiting payment, paid, and cancelled states

### Requirement: Merchant dashboard console alignment
The merchant dashboard SHALL remain a PC operations dashboard while adopting the merchant console visual language.

#### Scenario: Dashboard keeps current data contract
- **GIVEN** an authenticated merchant opens `/merchant/dashboard`
- **WHEN** dashboard data loads
- **THEN** the page displays existing dashboard metrics, product status counts, order status counts, active auctions, recent orders, and analytics sections when available
- **AND** it does not require new dashboard API fields
- **AND** loading, empty, and error states remain visible and recoverable

#### Scenario: Dashboard lists are scan-friendly
- **GIVEN** the dashboard shows active auctions or recent orders
- **WHEN** those sections render
- **THEN** they use compact row/list presentation aligned with the merchant console visual system
- **AND** navigation to product management, order management, and monitors remains visible where currently supported

### Requirement: Merchant realtime monitor console hierarchy
The merchant realtime monitor SHALL keep existing realtime behavior while improving visual hierarchy.

#### Scenario: Monitor uses WebSocket truth
- **GIVEN** an authenticated merchant opens `/merchant/auctions/:id/monitor`
- **WHEN** the monitor connects and receives auction state
- **THEN** current price, countdown, status, extension count, ranking, event feed, and terminal state render from the existing WebSocket-backed store
- **AND** the visual redesign does not add merchant bid controls or alter WebSocket semantics

#### Scenario: Monitor operations stay rule-bound
- **GIVEN** the monitor displays pending, active, ended, no-bid, sold, or cancelled state
- **WHEN** cancellation or terminal controls render
- **THEN** cancellation remains available only through the existing merchant cancellation command and reason flow
- **AND** backend rejection messages are shown without implying successful cancellation
- **AND** terminal states disable mutation actions that no longer apply

### Requirement: Merchant order deal-flow presentation
The merchant order pages SHALL present orders as read-only transaction/deal flow for merchants.

#### Scenario: Merchant scans order rows
- **GIVEN** an authenticated merchant opens `/merchant/orders`
- **WHEN** order data loads successfully
- **THEN** orders are shown in a scan-friendly transaction row or row-card layout
- **AND** each row shows product context, buyer context, amount, status, relevant timestamps when available, and detail navigation

#### Scenario: Merchant order detail remains read-only
- **GIVEN** a merchant opens `/merchant/orders/:id`
- **WHEN** order detail renders
- **THEN** the page emphasizes product, buyer, amount, status, created/confirmed/paid/cancelled timestamps, and cancel reason when present
- **AND** buyer-only confirm, cancel, and pay actions are not shown

### Requirement: Product publishing console presentation
The product create, edit, and detail pages SHALL keep existing behavior while matching the merchant console style.

#### Scenario: Merchant configures product and auction rules
- **GIVEN** an authenticated merchant opens product create or edit
- **WHEN** the form renders
- **THEN** existing product name, description, image upload, live media upload, start price, increment mode, increment value, optional ceiling price, duration, auto-extend seconds, and max extension controls remain available
- **AND** the form is visually organized as product identity, media, live material, auction rule, and action sections

#### Scenario: Product detail keeps existing actions
- **GIVEN** an authenticated merchant opens product detail
- **WHEN** product and auction data render
- **THEN** existing detail, refresh, edit, delete, activate, cancel, and monitor actions remain governed by current product and auction status
- **AND** the page uses the merchant console visual language without changing action semantics

### Requirement: Frontend-only implementation boundary
The merchant UI optimization SHALL remain frontend-only unless explicitly promoted through a later OpenSpec change.

#### Scenario: Implementation needs backend data
- **GIVEN** implementation discovers a desired visual field is unavailable from current frontend data
- **WHEN** the field would require a backend route, response field, database migration, WebSocket message, or business-rule change
- **THEN** implementation stops for that requirement
- **AND** a separate OpenSpec contract is created and validated before backend-dependent UI work continues

#### Scenario: Verification completes without backend changes
- **GIVEN** only frontend files are changed
- **WHEN** the implementation is ready for closeout
- **THEN** frontend tests, frontend build, and diff checks are run
- **AND** backend tests are not required unless backend files were touched
