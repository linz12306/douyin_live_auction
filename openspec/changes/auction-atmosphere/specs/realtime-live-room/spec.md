## ADDED Requirements

### Requirement: Douyin-style buyer live room shell
The frontend SHALL render `/app/auctions/:id` as a full-screen mobile-first live commerce auction room while preserving the existing realtime room contract.

#### Scenario: Buyer enters the H5 live commerce room
- **GIVEN** an authenticated buyer opens `/app/auctions/:id`
- **AND** the room has applied a WebSocket snapshot for the route auction
- **WHEN** the live room renders
- **THEN** the first screen shows a full-screen live commerce room shell
- **AND** it includes a host bar, live/status/rule badges, visual scene layer, comments or system messages, right-side atmosphere actions, bottom commerce actions, and a persistent auction floating card
- **AND** the layout remains usable on a narrow mobile viewport without incoherent overlap between host bar, badges, messages, action rail, floating card, or bottom controls

#### Scenario: Live room uses brand-safe visual assets
- **GIVEN** the room renders live commerce atmosphere
- **WHEN** product media is available
- **THEN** the product image remains visible as the primary product media
- **AND** fallback visual scenes are owned, generated, local, or otherwise brand-safe
- **AND** the room does not use Douyin branding, copied Douyin assets, or real third-party creator/brand media

### Requirement: Auction floating card entry
The frontend SHALL provide a persistent auction floating card as the primary entry into realtime bidding.

#### Scenario: Floating card shows realtime auction context
- **GIVEN** the buyer is in a current live auction room
- **WHEN** realtime auction state is available
- **THEN** the floating card shows auction status, current highest price, server-time corrected countdown, bid count when available, and a primary bid action
- **AND** activating the floating card opens the strong-state bid sheet for the current realtime auction item

#### Scenario: Floating card does not mutate realtime truth
- **GIVEN** a buyer activates the floating card or opens the bid sheet
- **WHEN** no WebSocket update has arrived
- **THEN** current price, ranking, countdown, extension count, leading/outbid state, and terminal state remain unchanged

### Requirement: Strong-state bid sheet
The frontend SHALL provide a half-screen bid sheet that exposes current bidding context and command states without replacing WebSocket truth.

#### Scenario: Buyer opens bid sheet during active auction
- **GIVEN** the auction is active
- **WHEN** the buyer opens the bid sheet
- **THEN** the sheet shows product context, current highest price, remaining time, increment amount, buyer bid state, amount controls, command error area, and a dynamic primary CTA
- **AND** no bid, leading, outbid, submitting, validation or balance error, pending, and terminal states have distinct visible text feedback

#### Scenario: REST bid command waits for WebSocket state
- **GIVEN** a buyer submits the next bid or a valid custom bid through the bid sheet
- **WHEN** the REST command succeeds
- **THEN** duplicate submission is prevented while the command is in flight
- **AND** visible current price, ranking, countdown, extension count, leading/outbid state, and terminal state are not updated from the REST response alone
- **AND** those realtime values update only after WebSocket messages are applied

#### Scenario: Bid command error is local feedback
- **GIVEN** a buyer submits a bid through REST
- **WHEN** the REST command fails for validation, balance, or network reasons
- **THEN** the bid sheet shows a visible error
- **AND** realtime current price, ranking, countdown, and terminal state remain unchanged

### Requirement: Product shelf shell
The frontend SHALL provide a half-screen product shelf shell without implying true multi-item realtime bidding.

#### Scenario: Buyer opens product shelf
- **GIVEN** the buyer is in the live room
- **WHEN** the buyer opens the product shelf or cart entry
- **THEN** the shelf shows the current realtime auction item
- **AND** it also shows visual or demo shell rows for `即将开拍`, `竞拍未成交`, and `竞拍结束`
- **AND** only the current auction item opens the realtime bid sheet
- **AND** demo shell rows are labeled so users do not infer true multi-item realtime bidding in this slice

### Requirement: Realtime atmosphere feedback
The frontend SHALL present outbid, leading, urgency, extension, and terminal feedback as visible live-room states.

#### Scenario: Buyer is outbid in the live room
- **GIVEN** a buyer has a prior leading bid in an active room
- **WHEN** a private `outbid` WebSocket notification is applied
- **THEN** the room shows prominent outbid feedback in the system-message layer
- **AND** the bid sheet shows a recovery state with a path to bid again while the auction remains active
- **AND** all realtime price and ranking values match the latest accepted WebSocket state

#### Scenario: Buyer is leading in the live room
- **GIVEN** the authenticated buyer is the current highest bidder according to WebSocket state
- **WHEN** the room or bid sheet renders
- **THEN** the UI indicates `当前您是最高价`
- **AND** the indication remains secondary to server-authoritative current price, countdown, and ranking

#### Scenario: Soft Close extension is visible in the room
- **GIVEN** a valid bid triggers Soft Close extension
- **WHEN** the WebSocket `extended` message has been applied
- **THEN** the room shows the updated countdown using server-time offset
- **AND** shows current extension count
- **AND** shows a system message for the extension

#### Scenario: Last seconds remain operable
- **GIVEN** an active auction has ten seconds or less remaining according to server-time corrected countdown
- **WHEN** the room renders urgency treatment
- **THEN** the countdown is visually emphasized
- **AND** bid controls remain readable and operable
- **AND** the urgency treatment is removed or replaced when an extension or terminal state arrives

### Requirement: In-room result modal
The frontend SHALL show an in-room terminal result modal before routing winners to existing buyer order pages.

#### Scenario: Winner sees order entry
- **GIVEN** the auction ends with status `ended_sold`
- **AND** the authenticated buyer is the winner according to WebSocket state
- **WHEN** the terminal result renders
- **THEN** bid controls are disabled
- **AND** the modal shows success copy, product summary, final price, and an order entry action
- **AND** order confirmation and simulated payment remain on existing buyer order pages

#### Scenario: Non-winner or no-sale outcome is clear
- **GIVEN** the auction ends with `ended_sold`, `ended_no_bid`, or `cancelled`
- **AND** the authenticated buyer is not the winner
- **WHEN** the terminal result renders
- **THEN** bid controls are disabled
- **AND** the modal explains the not-won, no-bid, or cancelled outcome
- **AND** it does not expose buyer-only order mutation actions
