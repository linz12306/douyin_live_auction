# fix-self-outbid-notification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent self-rebids from producing private outbid notifications while preserving accepted bid updates and different-user outbid notifications.

**Architecture:** Keep the fix at the backend auction domain-event source. `AuctionService` continues to persist the same bid and wallet state, but only emits `EventBidOutbid` when the replacement bidder differs from the previous bidder.

**Tech Stack:** Go 1.24, Gin integration tests, in-memory realtime event bus, OpenSpec.

---

## File Map

- Modify: `openspec/changes/fix-self-outbid-notification/specs/realtime-live-room/spec.md` to lock the expected behavior.
- Modify: `backend/tests/integration/auction_engine_test.go` to add the regression test.
- Modify: `backend/internal/service/auction_service.go` to guard `EventBidOutbid`.
- Modify: `openspec/changes/fix-self-outbid-notification/tasks.md` to sync task status after verification.

## Tasks

- [x] **Step 1: Validate OpenSpec lock**

Run:

```powershell
openspec validate fix-self-outbid-notification --strict
```

Expected: validation succeeds.

- [x] **Step 2: Write failing test**

Add `TestSameUserRebidDoesNotPublishOutbidEvent` near existing realtime event integration tests.

Expected behavior:

```go
placeBid(t, ts, auctionID, userToken, 10)
events, unsubscribe := eventBus.Subscribe()
defer unsubscribe()

placeBid(t, ts, auctionID, userToken, 20)

event := requireNextAuctionEvent(t, events, realtime.EventBidAccepted)
if event.UserID != userID || event.Amount != 20 {
    t.Fatalf("unexpected accepted event: %+v", event)
}
assertNoAuctionEvent(t, events)
```

- [x] **Step 3: Verify test fails**

Run:

```powershell
Set-Location backend
$env:GOPROXY='https://goproxy.cn,direct'
go test ./tests/integration -run TestSameUserRebidDoesNotPublishOutbidEvent -count=1
```

Expected before fix: failure from `assertNoAuctionEvent` showing a `bid.outbid` event.

- [x] **Step 4: Implement minimal fix**

Change `AuctionService.PlaceBid` event construction from:

```go
if previousBid != nil {
```

to:

```go
if previousBid != nil && previousBid.UserID != userID {
```

- [x] **Step 5: Verify focused behavior**

Run:

```powershell
Set-Location backend
$env:GOPROXY='https://goproxy.cn,direct'
go test ./tests/integration -run "TestSameUserRebidDoesNotPublishOutbidEvent|TestOutbidPublishesRealtimeEvent" -count=1
```

Expected: both tests pass.

- [x] **Step 6: Sync docs and restart**

Mark OpenSpec tasks complete, rerun OpenSpec validation, and restart the local backend process so `http://127.0.0.1:3000` talks to the fixed backend.

## Verification Results

- `openspec validate fix-self-outbid-notification --strict` passed before implementation.
- `cd backend; $env:GOPROXY='https://goproxy.cn,direct'; go test ./tests/integration -run TestSameUserRebidDoesNotPublishOutbidEvent -count=1` failed before the fix with an unexpected `bid.outbid` event.
- `cd backend; $env:GOPROXY='https://goproxy.cn,direct'; go test ./tests/integration -run "TestSameUserRebidDoesNotPublishOutbidEvent|TestOutbidPublishesRealtimeEvent" -count=1` passed after the fix.
- `cd backend; $env:GOPROXY='https://goproxy.cn,direct'; go test ./internal/realtime ./internal/service ./tests/integration -count=1` passed.
- `openspec validate fix-self-outbid-notification --strict` passed after implementation.
- `git diff --check` passed with existing Windows line-ending warnings for touched Go files.
- Local backend restarted on `http://127.0.0.1:8080`; frontend remained available on `http://127.0.0.1:3000`.
