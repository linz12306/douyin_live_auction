# fix-self-outbid-notification Exploration

## Goal

Fix the realtime auction-room bug where a single user who raises their own bid receives an outbid notification saying they have been surpassed.

## Non-Goals

- Do not change bid validation, minimum increment rules, wallet freeze/unfreeze accounting, rankings, or WebSocket envelope shape.
- Do not add a new frontend message type.
- Do not redesign the auction event bus.

## Users and Scenarios

- As a bidder, when I raise my own highest bid, I should see the accepted bid price update, but I should not be told that I was outbid.
- As a bidder, when another user places a valid higher bid over mine, I should still receive the private outbid notification.

## Acceptance Criteria

- A same-user rebid publishes `bid.accepted` for realtime room price/ranking updates.
- A same-user rebid does not publish `bid.outbid`.
- A different-user higher bid continues to publish `bid.outbid` with `PreviousUserID` set to the previous bidder.
- Existing wallet behavior remains unchanged: the previous active bid is marked `outbid`, its frozen amount is released, and the new higher amount is frozen.

## Root Cause

`AuctionService.PlaceBid` creates a `bid.outbid` event whenever any previous active bid exists. It does not check whether the previous active bid belongs to the same user placing the new bid, so a self-rebid produces a private outbid event addressed back to the bidder.

## Technical Direction

Add a backend integration test for same-user rebid event publication, then gate `bid.outbid` event creation on `previousBid.UserID != userID`. This fixes the source of the incorrect private message while preserving the existing `price_update` broadcast path.

## Risks

- If frontend state relies on an outbid message for self-rebid updates, removing it could expose a missing `price_update` path. Existing accepted-bid tests and room behavior should cover this.
- Wallet accounting must not be changed by the event-only fix.
