# Proposal: fix-self-outbid-notification

## Why

When only one user is bidding and they raise their own bid, the live room currently shows "您已被超过" even though no other bidder surpassed them. This violates the realtime-room requirement that private `outbid` notifications are only for the user whose bid was replaced by another bidder.

## What Changes

- Clarify the private outbid notification spec with a same-user rebid scenario.
- Add a backend integration test proving same-user rebids publish `bid.accepted` but not `bid.outbid`.
- Change auction service event publishing so `bid.outbid` is emitted only when the previous active bid belongs to a different user.

## Non-Goals

- No change to bid amount validation.
- No change to wallet freeze/unfreeze persistence.
- No change to WebSocket message envelope or frontend routing.

## Impact

- Backend auction event publication behavior changes for self-rebids.
- Existing different-user outbid behavior remains required and tested.
