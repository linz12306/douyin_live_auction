## ADDED Requirements

### Requirement: Buyer live room Motion animations
The frontend SHALL use Motion for React to provide high-quality non-blocking animation feedback for important buyer live-room realtime states.

#### Scenario: WebSocket price update animates visible price
- **GIVEN** the buyer live room is showing current price from WebSocket/store state
- **WHEN** a newer `price_update` WebSocket message changes the current price
- **THEN** the visible price updates from the message
- **AND** the price display shows brief feedback
- **AND** the next bid CTA remains derived from WebSocket/store state

#### Scenario: REST bid success does not imply accepted bid
- **GIVEN** a buyer submits a bid command through REST
- **WHEN** the REST request succeeds
- **THEN** the frontend may clear command/submitting state
- **AND** it does not show accepted-bid celebration
- **AND** visible current price, ranking, countdown, leading/outbid state, and terminal state remain unchanged until WebSocket/store state changes

#### Scenario: WebSocket-confirmed leading state celebrates the buyer
- **GIVEN** the authenticated buyer is not initially the highest bidder
- **WHEN** WebSocket/store state changes so the authenticated buyer becomes the highest bidder
- **THEN** the room shows a brief bid-success celebration
- **AND** the persistent leading state receives warm celebratory emphasis
- **AND** current price, countdown, and bid controls remain readable

#### Scenario: Private outbid warning is prominent and non-blocking
- **GIVEN** the buyer receives a private `outbid` WebSocket notification while the auction is active
- **WHEN** the room renders outbid feedback
- **THEN** the room shows prominent warning and recovery emphasis
- **AND** no modal blocks the buyer from bidding again

#### Scenario: Final countdown uses heartbeat urgency
- **GIVEN** an active auction has ten seconds or less remaining according to server-time corrected countdown
- **WHEN** the countdown renders
- **THEN** the countdown receives heartbeat-style urgency feedback
- **AND** bid controls remain readable and operable
- **AND** the urgency feedback stops when extension or terminal WebSocket state removes the urgent condition

#### Scenario: Reduced-motion preference is respected
- **GIVEN** the user prefers reduced motion
- **WHEN** live-room animation feedback would render
- **THEN** decorative movement is reduced or suppressed
- **AND** visible text/state feedback remains available
