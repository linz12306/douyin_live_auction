# Tasks: fix-self-outbid-notification

- [x] 1. Lock spec
  - Add same-user rebid scenario under private outbid notification.
  - Validate the OpenSpec change with `openspec validate fix-self-outbid-notification --strict`.

- [x] 2. Add failing integration test
  - In `backend/tests/integration/auction_engine_test.go`, add a test where one user bids 10, subscribes to auction events, then the same user bids 20.
  - Assert the next event is `bid.accepted`.
  - Assert no further event is published, specifically no `bid.outbid`.

- [x] 3. Implement event guard
  - In `backend/internal/service/auction_service.go`, emit `EventBidOutbid` only when `previousBid.UserID != userID`.

- [x] 4. Verify and sync
  - Run the focused integration tests for same-user and different-user outbid behavior.
  - Run `openspec validate fix-self-outbid-notification --strict`.
  - Mark tasks complete after verification.
  - Restart the local backend service so the running demo uses the fix.
