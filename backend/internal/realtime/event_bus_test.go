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
	case got, ok := <-events:
		if ok {
			t.Fatalf("received event after unsubscribe: %+v", got)
		}
	case <-time.After(50 * time.Millisecond):
		t.Fatal("timed out waiting for closed subscriber channel")
	}
}

func TestInMemoryAuctionEventBusDropsForSlowSubscriber(t *testing.T) {
	bus := NewInMemoryAuctionEventBus()
	events, unsubscribe := bus.Subscribe()
	defer unsubscribe()

	for i := 0; i < subscriberBufferSize; i++ {
		if err := bus.Publish(context.Background(), AuctionEvent{
			Type:       EventBidAccepted,
			AuctionID:  42,
			Version:    int64(i + 1),
			OccurredAt: time.Date(2026, 5, 28, 10, 11, 12, 0, time.UTC),
		}); err != nil {
			t.Fatalf("publish event %d: %v", i, err)
		}
	}

	if err := bus.Publish(context.Background(), AuctionEvent{
		Type:       EventBidAccepted,
		AuctionID:  42,
		Version:    int64(subscriberBufferSize + 1),
		OccurredAt: time.Date(2026, 5, 28, 10, 11, 12, 0, time.UTC),
	}); err != nil {
		t.Fatalf("publish event with full subscriber buffer: %v", err)
	}

	if got := bus.DroppedEvents(); got != 1 {
		t.Fatalf("dropped events = %d, want 1", got)
	}

	for i := 0; i < subscriberBufferSize; i++ {
		select {
		case <-events:
		case <-time.After(100 * time.Millisecond):
			t.Fatalf("timed out draining buffered event %d", i)
		}
	}

	select {
	case got := <-events:
		t.Fatalf("received dropped event: %+v", got)
	default:
	}
}

func TestInMemoryAuctionEventBusUnsubscribeClosesChannel(t *testing.T) {
	bus := NewInMemoryAuctionEventBus()
	events, unsubscribe := bus.Subscribe()

	unsubscribe()

	select {
	case _, ok := <-events:
		if ok {
			t.Fatal("subscriber channel is still open after unsubscribe")
		}
	case <-time.After(50 * time.Millisecond):
		t.Fatal("timed out waiting for subscriber channel to close")
	}
}

func TestInMemoryAuctionEventBusUnsubscribeIsIdempotent(t *testing.T) {
	bus := NewInMemoryAuctionEventBus()
	events, unsubscribe := bus.Subscribe()

	unsubscribe()
	unsubscribe()

	select {
	case _, ok := <-events:
		if ok {
			t.Fatal("subscriber channel is still open after repeated unsubscribe")
		}
	case <-time.After(50 * time.Millisecond):
		t.Fatal("timed out waiting for subscriber channel to close")
	}
}

func TestInMemoryAuctionEventBusPublishReturnsContextError(t *testing.T) {
	bus := NewInMemoryAuctionEventBus()
	events, unsubscribe := bus.Subscribe()
	defer unsubscribe()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if err := bus.Publish(ctx, AuctionEvent{
		Type:       EventBidAccepted,
		AuctionID:  42,
		Version:    1,
		OccurredAt: time.Date(2026, 5, 28, 10, 11, 12, 0, time.UTC),
	}); err != context.Canceled {
		t.Fatalf("publish error = %v, want %v", err, context.Canceled)
	}

	select {
	case got := <-events:
		t.Fatalf("received event after canceled publish: %+v", got)
	default:
	}
}
