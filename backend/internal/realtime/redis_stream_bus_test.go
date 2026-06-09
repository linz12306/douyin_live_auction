package realtime

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"
)

func TestRedisStreamAuctionEventBusBroadcastsToIndependentBackendSubscribers(t *testing.T) {
	client := redis.NewClient(&redis.Options{
		Addr:     getenv("REDIS_ADDR", "127.0.0.1:16380"),
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skipf("redis unavailable: %v", err)
	}
	defer client.Close()

	streamKey := fmt.Sprintf("test:auction_events:%d", time.Now().UnixNano())
	t.Cleanup(func() {
		_ = client.Del(context.Background(), streamKey).Err()
	})

	backendA := NewRedisStreamAuctionEventBus(client, streamKey)
	backendB := NewRedisStreamAuctionEventBus(client, streamKey)
	eventsA, unsubscribeA := backendA.Subscribe()
	defer unsubscribeA()
	eventsB, unsubscribeB := backendB.Subscribe()
	defer unsubscribeB()

	want := AuctionEvent{
		Type:       EventBidAccepted,
		AuctionID:  182,
		Version:    12,
		UserID:     77,
		Amount:     84970,
		Status:     "active",
		OccurredAt: time.Date(2026, 6, 9, 10, 11, 12, 0, time.UTC),
	}

	publishCtx, publishCancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer publishCancel()
	if err := backendA.Publish(publishCtx, want); err != nil {
		t.Fatalf("publish redis stream event: %v", err)
	}

	assertReceivesEvent(t, eventsA, want)
	assertReceivesEvent(t, eventsB, want)
}

func TestRedisStreamAuctionEventBusBuffersBurstySubscriberWithoutDrops(t *testing.T) {
	client := redis.NewClient(&redis.Options{
		Addr:     getenv("REDIS_ADDR", "127.0.0.1:16380"),
		Password: os.Getenv("REDIS_PASSWORD"),
		DB:       0,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skipf("redis unavailable: %v", err)
	}
	defer client.Close()

	streamKey := fmt.Sprintf("test:auction_events:burst:%d", time.Now().UnixNano())
	t.Cleanup(func() {
		_ = client.Del(context.Background(), streamKey).Err()
	})

	bus := NewRedisStreamAuctionEventBus(client, streamKey)
	events, unsubscribe := bus.Subscribe()
	defer unsubscribe()

	const total = 256
	for i := 0; i < total; i++ {
		if err := bus.Publish(ctx, AuctionEvent{
			Type:       EventBidCommandStatus,
			AuctionID:  182,
			Version:    int64(i + 1),
			UserID:     77,
			CommandID:  fmt.Sprintf("cmd-%d", i+1),
			Status:     "active",
			OccurredAt: time.Date(2026, 6, 9, 10, 11, 12, 0, time.UTC),
		}); err != nil {
			t.Fatalf("publish redis stream event %d: %v", i+1, err)
		}
	}

	deadline := time.After(3 * time.Second)
	for len(events)+int(bus.DroppedEvents()) < total {
		select {
		case <-deadline:
			t.Fatalf("timed out waiting for burst delivery progress: buffered=%d dropped=%d total=%d", len(events), bus.DroppedEvents(), total)
		case <-time.After(10 * time.Millisecond):
		}
	}

	if got := bus.DroppedEvents(); got != 0 {
		t.Fatalf("dropped events = %d, want 0 for local burst buffer", got)
	}
	for i := 0; i < total; i++ {
		select {
		case <-events:
		case <-time.After(100 * time.Millisecond):
			t.Fatalf("timed out draining buffered redis stream event %d", i+1)
		}
	}
}

func assertReceivesEvent(t *testing.T, events <-chan AuctionEvent, want AuctionEvent) {
	t.Helper()

	select {
	case got := <-events:
		if got != want {
			t.Fatalf("event = %+v, want %+v", got, want)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for redis stream event")
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
