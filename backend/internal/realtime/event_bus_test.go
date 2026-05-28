package realtime

import (
	"context"
	"testing"
	"time"
)

func TestInMemoryAuctionEventBusPublishesToSubscribers(t *testing.T) {
	bus := NewInMemoryAuctionEventBus()
	events, unsubscribe := bus.Subscribe()
	defer unsubscribe()

	want := AuctionEvent{
		Type:       EventBidAccepted,
		AuctionID:  42,
		Version:    3,
		UserID:     99,
		Amount:     188.8,
		OccurredAt: time.Date(2026, 5, 28, 10, 11, 12, 0, time.UTC),
	}

	if err := bus.Publish(context.Background(), want); err != nil {
		t.Fatalf("publish event: %v", err)
	}

	select {
	case got := <-events:
		if got != want {
			t.Fatalf("event = %+v, want %+v", got, want)
		}
	case <-time.After(100 * time.Millisecond):
		t.Fatal("timed out waiting for published event")
	}
}

func TestInMemoryAuctionEventBusUnsubscribeStopsDelivery(t *testing.T) {
	bus := NewInMemoryAuctionEventBus()
	events, unsubscribe := bus.Subscribe()

	unsubscribe()

	if err := bus.Publish(context.Background(), AuctionEvent{
		Type:       EventAuctionEnded,
		AuctionID:  42,
		Version:    4,
		OccurredAt: time.Date(2026, 5, 28, 10, 11, 12, 0, time.UTC),
	}); err != nil {
		t.Fatalf("publish event: %v", err)
	}

	select {
	case got := <-events:
		t.Fatalf("received event after unsubscribe: %+v", got)
	case <-time.After(50 * time.Millisecond):
	}
}
