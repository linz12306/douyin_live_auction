package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"douyin-live/backend/internal/realtime"
)

type captureAuctionEventBus struct {
	publishErr error
	ctxErr     error
	events     []realtime.AuctionEvent
}

func (b *captureAuctionEventBus) Publish(ctx context.Context, event realtime.AuctionEvent) error {
	b.ctxErr = ctx.Err()
	b.events = append(b.events, event)
	return b.publishErr
}

func (b *captureAuctionEventBus) Subscribe() (<-chan realtime.AuctionEvent, func()) {
	events := make(chan realtime.AuctionEvent)
	close(events)
	return events, func() {}
}

func TestPublishAuctionEventsUsesDetachedContextAndSwallowsErrors(t *testing.T) {
	bus := &captureAuctionEventBus{publishErr: errors.New("publish failed")}
	svc := &AuctionService{eventBus: bus}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	svc.publishAuctionEvents(ctx, []realtime.AuctionEvent{
		{Type: realtime.EventBidAccepted, AuctionID: 42, Version: 3},
	})

	if len(bus.events) != 1 {
		t.Fatalf("published events = %d, want 1", len(bus.events))
	}
	if bus.ctxErr != nil {
		t.Fatalf("publish context error = %v, want nil", bus.ctxErr)
	}
}

func TestAuctionServiceRecordsBidOutcome(t *testing.T) {
	metrics := NewAuctionMetrics()
	svc := NewAuctionServiceWithMetrics(nil, nil, realtime.NewNoopAuctionEventBus(), metrics)
	expectedErr := errors.New("bid failed")

	got := svc.recordBidMetrics(time.Now().Add(-10*time.Millisecond), expectedErr)

	if got != expectedErr {
		t.Fatalf("returned error = %v, want %v", got, expectedErr)
	}
	snapshot := metrics.Snapshot()
	if snapshot.BidRequestsTotal != 1 || snapshot.BidFailureTotal != 1 {
		t.Fatalf("snapshot = %+v", snapshot)
	}
}

func TestAuctionServiceRecordsLockBusy(t *testing.T) {
	metrics := NewAuctionMetrics()
	svc := NewAuctionServiceWithMetrics(nil, nil, realtime.NewNoopAuctionEventBus(), metrics)

	svc.recordLockBusy(ErrAuctionLockBusy)
	svc.recordLockBusy(errors.New("other error"))

	snapshot := metrics.Snapshot()
	if snapshot.BidLockBusyTotal != 1 {
		t.Fatalf("lock busy total = %d, want 1", snapshot.BidLockBusyTotal)
	}
}
