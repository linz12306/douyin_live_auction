## ADDED Requirements

### Requirement: Buyer H5 end-to-end journey
The frontend SHALL define and preserve a mobile-first buyer journey from authentication through auction participation and post-win order completion.

#### Scenario: Buyer reaches auction lobby after authentication
- **GIVEN** an authenticated account with role `user`
- **WHEN** the buyer navigates from auth or profile into the H5 auction area
- **THEN** the buyer has a visible route to `/app/auctions`
- **AND** the route is protected from merchant-only accounts

#### Scenario: Buyer scans auction lobby
- **GIVEN** an authenticated buyer opens `/app/auctions`
- **WHEN** auction lobby data is loading, empty, successful, or failed
- **THEN** the page shows a matching loading, empty, content, or error state
- **AND** content items show product image when available, auction status, current price, end time when available, and room entry action
- **AND** the page provides visible entries to buyer orders and profile

#### Scenario: Buyer enters live room
- **GIVEN** an authenticated buyer opens `/app/auctions/:id`
- **WHEN** the room has loaded its initial REST and WebSocket state
- **THEN** the first screen prioritizes product or simulated live visual context, current price, countdown, auction status, connection status, bid action, ranking, and recent realtime messages
- **AND** the layout remains usable on a narrow mobile viewport without overlapping text, controls, ranking, or notification content

#### Scenario: Buyer completes post-win order
- **GIVEN** the buyer wins an auction and an order exists
- **WHEN** the buyer follows the order entry from the terminal result or opens `/app/orders`
- **THEN** the buyer can see `pending_confirm`, `pending_payment`, `paid`, and `cancelled` states
- **AND** only `pending_confirm` exposes confirm and buyer cancellation actions
- **AND** only `pending_payment` exposes simulated payment action
- **AND** terminal order states show no mutation actions

### Requirement: Realtime auction atmosphere
The H5 live room SHALL provide realtime atmosphere and feedback states without replacing WebSocket as the auction truth source.

#### Scenario: Bid submission waits for realtime truth
- **GIVEN** a buyer is connected to a live auction room
- **WHEN** the buyer submits the next bid or a valid custom bid through REST
- **THEN** the bid control shows a submitting state and prevents duplicate submission
- **AND** visible current price, ranking, countdown, extension count, and terminal state are updated from WebSocket messages rather than the REST bid response alone

#### Scenario: Buyer is outbid
- **GIVEN** a buyer has the leading bid in an active room
- **WHEN** another buyer submits a higher accepted bid
- **THEN** the outbid buyer sees a prominent private outbid state
- **AND** the state includes accessible text feedback and a clear path to bid again while the auction remains active
- **AND** the new price and ranking are consistent with the latest accepted WebSocket message

#### Scenario: Buyer is leading
- **GIVEN** a buyer submits or receives confirmation of the leading bid through WebSocket
- **WHEN** the auction is still active
- **THEN** the room indicates the buyer is currently leading
- **AND** the indication remains secondary to server-authoritative current price, countdown, and ranking

#### Scenario: Soft Close extension is visible
- **GIVEN** an active auction has remaining time inside the auto-extend window
- **WHEN** a valid bid triggers a Soft Close extension
- **THEN** the room visibly resets the countdown using server-time offset
- **AND** shows the current extension count
- **AND** does not display a stale expired state while the WebSocket version has advanced

#### Scenario: Last seconds increase urgency
- **GIVEN** an active auction has ten seconds or less remaining according to server-time corrected countdown
- **WHEN** the room is visible
- **THEN** the countdown urgency is visually emphasized
- **AND** bid controls remain readable and operable
- **AND** the urgency treatment is removed or replaced when an extension or terminal state arrives

#### Scenario: Auction terminal result is clear
- **GIVEN** the room receives `ended_sold`, `ended_no_bid`, or `cancelled`
- **WHEN** the terminal state is rendered
- **THEN** bid actions are disabled
- **AND** winners receive a visible order entry
- **AND** non-winners receive a clear not-won or terminal explanation without buyer-only order mutation actions

### Requirement: Merchant PC operations journey
The frontend SHALL define and preserve a merchant PC journey from product operation through realtime monitoring, cancellation, orders, and dashboard review.

#### Scenario: Merchant reaches operating surfaces after authentication
- **GIVEN** an authenticated account with role `merchant`
- **WHEN** the merchant navigates after auth or profile
- **THEN** the merchant has visible paths to product management, dashboard, auction monitor entries for products with auctions, and order management
- **AND** merchant routes are protected from user-only accounts

#### Scenario: Merchant publishes and monitors an auction
- **GIVEN** a merchant has a product with an auction
- **WHEN** the merchant opens `/merchant/auctions/:id/monitor`
- **THEN** the monitor displays product context, current price, countdown, status, extension count, connection state, ranking, and realtime event feed
- **AND** the monitor uses the existing auction WebSocket state as its realtime truth source

#### Scenario: Merchant cancels an abnormal auction through existing rules
- **GIVEN** the monitor is showing a pending or active auction
- **WHEN** the merchant opens cancellation controls
- **THEN** the UI requires a cancellation reason
- **AND** explains that pending auctions can be cancelled directly
- **AND** explains that active auctions cannot be cancelled within 30 seconds of the latest bid
- **AND** surfaces backend rejection messages without implying the auction was cancelled

#### Scenario: Merchant inspects order results
- **GIVEN** an auction has settled into an order
- **WHEN** the merchant opens merchant order list or detail
- **THEN** the merchant sees product context, buyer display information, amount, status, and timestamps
- **AND** the merchant view does not show buyer-only confirm, cancel, or pay actions

### Requirement: Merchant analytics package boundary
The frontend SHALL define the `merchant-analytics` package as the owner of charted merchant dashboard views and their data-state behavior.

#### Scenario: Merchant views analytics dashboard
- **GIVEN** an authenticated merchant opens `/merchant/dashboard`
- **WHEN** analytics data is available
- **THEN** the dashboard shows completed transaction metrics, product status counts, order status counts, active auctions, recent orders, and charted views for transaction trend, bid distribution, and user activity
- **AND** all analytics are scoped to the current merchant

#### Scenario: Analytics data is empty or unavailable
- **GIVEN** the merchant dashboard has zero or unavailable analytics data
- **WHEN** the dashboard renders chart areas
- **THEN** each chart area has a clear zero-data, loading, or error state
- **AND** existing summary and navigation surfaces remain usable

#### Scenario: Analytics needs new backend data
- **GIVEN** chart requirements cannot be satisfied by the existing merchant dashboard API
- **WHEN** implementation work begins
- **THEN** the worker must define and validate an OpenSpec API contract before frontend implementation depends on new response fields

### Requirement: Demo materials package boundary
The frontend roadmap SHALL define the `demo-materials` package as the owner of presenter-facing demo documentation and readiness checks.

#### Scenario: Presenter follows demo route
- **GIVEN** local MySQL, Redis, backend, and frontend services are running
- **WHEN** the presenter follows the demo materials
- **THEN** the materials identify exact accounts, commands, service URLs, route sequence, and expected visual checkpoints
- **AND** the route covers merchant dashboard, merchant monitor, buyer lobby, two-buyer bidding, private outbid, terminal sold result, buyer order confirmation, and simulated payment

#### Scenario: Demo page is not ready
- **GIVEN** a demo checkpoint fails because data, service health, WebSocket, or route state is not ready
- **WHEN** the presenter consults the materials
- **THEN** the materials provide a troubleshooting step tied to an actual route, command, or health check

#### Scenario: Demo readiness automation is present
- **GIVEN** the project includes a demo readiness E2E check
- **WHEN** the check runs
- **THEN** it verifies the documented core presenter path rather than unrelated UI details
- **AND** it uses local-only data and test configuration

### Requirement: Perf observability frontend boundary
The frontend roadmap SHALL define `perf-observability` as a read-only frontend boundary for health, metrics, and load-test visibility when a UI is needed.

#### Scenario: Health status is displayed
- **GIVEN** a read-only health UI is implemented
- **WHEN** it loads health data
- **THEN** it uses a documented health source such as `/healthz`
- **AND** displays healthy, degraded, unavailable, and loading states without changing auction, wallet, order, or merchant data

#### Scenario: Auction metrics are displayed
- **GIVEN** a metrics UI displays active auctions, bid success rate, average latency, WebSocket connections, or lock contention
- **WHEN** the UI renders those values
- **THEN** every value comes from a documented API, script output, or fixture source
- **AND** missing metric data is shown as unavailable rather than inferred from buyer or merchant business pages

#### Scenario: Metrics API is missing
- **GIVEN** desired observability metrics do not have a stable API contract
- **WHEN** implementation work starts
- **THEN** the worker must define and validate the API contract before building frontend UI that depends on it

### Requirement: Parallel implementation boundaries
The roadmap SHALL allow later frontend packages to be implemented in parallel without shared-state ambiguity.

#### Scenario: Package owns a distinct surface
- **GIVEN** a future worker starts `auction-atmosphere`, `merchant-analytics`, `demo-materials`, or `perf-observability`
- **WHEN** the worker scopes the implementation plan
- **THEN** the plan identifies owned files, shared files, upstream dependencies, and owned verification
- **AND** the plan does not modify unrelated package surfaces unless the OpenSpec change is updated first

#### Scenario: Shared realtime store change is needed
- **GIVEN** a future package needs to alter shared live-room store behavior used by buyer room and merchant monitor
- **WHEN** the behavior changes visible state semantics
- **THEN** the worker must coordinate the buyer and merchant scenarios in OpenSpec before implementation
- **AND** verification covers both `/app/auctions/:id` and `/merchant/auctions/:id/monitor`

#### Scenario: Backend contract expansion is needed
- **GIVEN** a future package needs a new REST field, REST route, WebSocket message type, or metrics endpoint
- **WHEN** implementation begins
- **THEN** the backend contract must be captured in OpenSpec before frontend code depends on it
- **AND** verification includes both contract-level checks and frontend rendering checks
