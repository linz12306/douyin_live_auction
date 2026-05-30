## MODIFIED Requirements

### Requirement: Private outbid notification
The system SHALL send a private `outbid` message only to the user whose previous active bid was replaced by a different user.

#### Scenario: Previous bidder receives outbid
- **GIVEN** user A is the current highest bidder and is connected to the auction room
- **AND** user B is connected to the same auction room
- **WHEN** user B places a valid higher bid
- **THEN** user A receives an `outbid` message
- **AND** user B does not receive user A's private `outbid` message

#### Scenario: Same user raises own bid without outbid notification
- **GIVEN** user A is the current highest bidder and is connected to the auction room
- **WHEN** user A places another valid higher bid on the same auction
- **THEN** the room receives the accepted bid update
- **AND** user A does not receive an `outbid` message for that self-rebid
