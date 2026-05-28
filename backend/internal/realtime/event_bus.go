package realtime

import (
	"context"
	"sync"
	"time"
)

type AuctionEventType string

const (
	EventBidAccepted      AuctionEventType = "bid.accepted"
	EventBidOutbid        AuctionEventType = "bid.outbid"
	EventAuctionExtended  AuctionEventType = "auction.extended"
	EventAuctionEnded     AuctionEventType = "auction.ended"
	EventAuctionCancelled AuctionEventType = "auction.cancelled"
)

type AuctionEvent struct {
	Type           AuctionEventType
	AuctionID      int64
	Version        int64
	UserID         int64
	PreviousUserID *int64
	Amount         float64
	PreviousAmount float64
	Status         string
	EndedAt        *time.Time
	ExtendCount    int
	OccurredAt     time.Time
}

type AuctionEventBus interface {
	Publish(ctx context.Context, event AuctionEvent) error
	Subscribe() (<-chan AuctionEvent, func())
}

type InMemoryAuctionEventBus struct {
	mu          sync.RWMutex
	subscribers map[chan AuctionEvent]struct{}
}

func NewInMemoryAuctionEventBus() *InMemoryAuctionEventBus {
	return &InMemoryAuctionEventBus{
		subscribers: make(map[chan AuctionEvent]struct{}),
	}
}

func (b *InMemoryAuctionEventBus) Publish(ctx context.Context, event AuctionEvent) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	b.mu.RLock()
	defer b.mu.RUnlock()

	for subscriber := range b.subscribers {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case subscriber <- event:
		default:
		}
	}

	return nil
}

func (b *InMemoryAuctionEventBus) Subscribe() (<-chan AuctionEvent, func()) {
	events := make(chan AuctionEvent, 16)

	b.mu.Lock()
	b.subscribers[events] = struct{}{}
	b.mu.Unlock()

	var once sync.Once
	unsubscribe := func() {
		once.Do(func() {
			b.mu.Lock()
			delete(b.subscribers, events)
			b.mu.Unlock()
		})
	}

	return events, unsubscribe
}
