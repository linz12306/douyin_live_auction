# Design: fix-self-outbid-notification

## Current Behavior

`AuctionService.PlaceBid` stores accepted bids and appends domain events after the database transaction logic has prepared the new state. The current implementation appends `EventBidOutbid` whenever `previousBid != nil`.

For a same-user rebid, `previousBid` is present and `previousBid.UserID == userID`. The service still emits `EventBidOutbid`, and `RealtimeHub` routes that event privately to `PreviousUserID`, which is the current bidder.

## Desired Behavior

Same-user rebid:

- Persist the higher bid normally.
- Continue publishing `EventBidAccepted` so the room receives the price/ranking update.
- Do not publish `EventBidOutbid`, because no other bidder surpassed the user.

Different-user higher bid:

- Preserve current behavior.
- Publish `EventBidAccepted`.
- Publish `EventBidOutbid` with `PreviousUserID` set to the previous bidder.

## Implementation

Add a condition at event construction time:

```go
if previousBid != nil && previousBid.UserID != userID {
    // append EventBidOutbid
}
```

This keeps persistence and wallet operations unchanged, and narrows only the private notification event.

## Verification

- `openspec validate fix-self-outbid-notification --strict`
- Focused backend integration test for same-user rebid events.
- Existing backend integration test for different-user outbid events.
