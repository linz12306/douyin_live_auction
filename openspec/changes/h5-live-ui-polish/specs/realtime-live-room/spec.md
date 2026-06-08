## ADDED Requirements

### Requirement: Buyer live room mobile layout polish
The frontend SHALL keep the buyer H5 live room critical controls readable and operable on narrow mobile viewports.

#### Scenario: Live room layers do not overlap on mobile
- **GIVEN** an authenticated buyer opens `/app/auctions/:id` on a 390x844 viewport
- **AND** the room has applied a WebSocket snapshot for the route auction
- **WHEN** the live room renders the active auction first screen
- **THEN** the host bar, live/status badges, ranking or message layer, action rail, auction floating card, and bottom controls remain readable
- **AND** the primary bid entry remains visible and tappable
- **AND** no critical action is hidden by another fixed live-room layer

#### Scenario: Live room overlays remain usable
- **GIVEN** the buyer is in the live room on a narrow mobile viewport
- **WHEN** the buyer opens the bid sheet, product shelf, or terminal result modal
- **THEN** the overlay remains scrollable when content exceeds available height
- **AND** close and primary action controls remain reachable
- **AND** the overlay visually supersedes lower room layers without incoherent overlap

### Requirement: Buyer live room polished action controls
The frontend SHALL present live-room actions as polished, clearly tappable controls with stable accessible labels.

#### Scenario: Live room action controls have clear hierarchy
- **GIVEN** the buyer is in an active live auction room
- **WHEN** the room renders action rail controls, bottom controls, floating card action, bid sheet controls, and shelf controls
- **THEN** primary bid or recover actions use stronger filled or elevated styling than secondary actions
- **AND** icon-like actions include accessible labels and visible short labels or values
- **AND** disabled states remain readable and clearly non-interactive

#### Scenario: Bid sheet amount controls remain stable
- **GIVEN** the buyer opens the bid sheet
- **WHEN** the amount input and stepper controls render
- **THEN** increase, decrease, primary bid, and custom bid actions have stable tap targets
- **AND** button labels fit within their containers on mobile
- **AND** amount changes do not resize the surrounding layout enough to hide the submit action

### Requirement: Buyer live room feedback motion
The frontend SHALL provide lightweight click and realtime-state feedback without changing auction truth outside WebSocket state.

#### Scenario: Click feedback does not imply accepted bid
- **GIVEN** a buyer taps a live-room control or submits a bid command
- **WHEN** the frontend shows press, submitting, or local feedback
- **THEN** the feedback is visibly a command or interaction state
- **AND** visible current price, ranking, countdown, extension count, leading/outbid state, and terminal state remain unchanged until WebSocket state changes

#### Scenario: WebSocket price update triggers price feedback
- **GIVEN** the live room is showing current price from WebSocket state
- **WHEN** a newer `price_update` WebSocket message is applied
- **THEN** the visible current price updates from the message
- **AND** the price display shows a brief visual feedback state
- **AND** the next bid CTA remains derived from WebSocket/store state

#### Scenario: Last seconds urgency keeps bidding operable
- **GIVEN** an active auction has ten seconds or less remaining according to server-time corrected countdown
- **WHEN** urgency feedback renders
- **THEN** the countdown receives stronger visual treatment
- **AND** the floating card and bid sheet entry remain readable and operable
- **AND** urgency feedback is removed or replaced after an extension or terminal WebSocket update changes the state

#### Scenario: Leading and outbid feedback are visible but non-blocking
- **GIVEN** the live room applies WebSocket state showing the authenticated buyer is leading or has been outbid
- **WHEN** the room renders feedback for that state
- **THEN** leading feedback is celebratory and includes visible text
- **AND** outbid feedback is prominent and includes visible recovery copy
- **AND** neither state hides current price, countdown, ranking context, or the available next action

### Requirement: Buyer discovery CTA polish
The frontend SHALL keep the buyer discovery entrance CTAs visually consistent with the polished H5 live-room experience without changing its data contract.

#### Scenario: Discovery page actions remain tappable
- **GIVEN** an authenticated buyer opens `/app/auctions`
- **WHEN** lobby data, loading, error, empty, or filtered-empty states render
- **THEN** refresh, order, profile, filter, and live-room entry actions remain visibly tappable
- **AND** CTA text fits within its container on mobile
- **AND** the page continues to use the existing lobby data contract without new backend fields
