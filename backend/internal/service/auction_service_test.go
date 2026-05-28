package service

import (
	"context"
	"errors"
	"testing"

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
