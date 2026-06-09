package realtime

import (
	"context"
	"sync"
	"sync/atomic"
	"time"
)

const subscriberBufferSize = 16

type AuctionEventType string

const (
	EventBidAccepted      AuctionEventType = "bid.accepted"
	EventBidOutbid        AuctionEventType = "bid.outbid"
	EventAuctionExtended  AuctionEventType = "auction.extended"
	EventAuctionEnded     AuctionEventType = "auction.ended"
	EventAuctionCancelled AuctionEventType = "auction.cancelled"
	EventAICommentary     AuctionEventType = "ai.commentary"
	EventBidCommandStatus AuctionEventType = "bid_command.status"
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
	Commentary     string
	CommandID      string
	CommandStatus  string
	FailureReason  *string
	BidID          *int64
	OrderID        *int64
	OccurredAt     time.Time
}

type AuctionEventBus interface {
	// Publish delivers event to current subscribers on a best-effort basis.
	// Delivery is non-blocking; subscribers with full buffers do not receive the
	// event, and in-memory buses count those drops via DroppedEvents.
	Publish(ctx context.Context, event AuctionEvent) error
	// Subscribe returns a buffered event channel and an idempotent unsubscribe
	// function. Unsubscribe removes and closes the subscriber channel.
	Subscribe() (<-chan AuctionEvent, func())
}

type NoopAuctionEventBus struct{}

func NewNoopAuctionEventBus() *NoopAuctionEventBus {
	return &NoopAuctionEventBus{}
}

func (b *NoopAuctionEventBus) Publish(ctx context.Context, event AuctionEvent) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return nil
	}
}

func (b *NoopAuctionEventBus) Subscribe() (<-chan AuctionEvent, func()) {
	events := make(chan AuctionEvent)
	close(events)
	return events, func() {}
}

// InMemoryAuctionEventBus is a concurrency-safe best-effort event bus.
// Slow subscribers are isolated by dropping events when their buffers are full.
type InMemoryAuctionEventBus struct {
	mu          sync.RWMutex
	subscribers map[chan AuctionEvent]struct{}
	dropped     atomic.Uint64
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
			b.dropped.Add(1)
		}
	}

	return nil
}

func (b *InMemoryAuctionEventBus) DroppedEvents() uint64 {
	return b.dropped.Load()
}

func (b *InMemoryAuctionEventBus) Subscribe() (<-chan AuctionEvent, func()) {
	events := make(chan AuctionEvent, subscriberBufferSize)

	b.mu.Lock()
	b.subscribers[events] = struct{}{}
	b.mu.Unlock()

	var once sync.Once
	unsubscribe := func() {
		once.Do(func() {
			b.mu.Lock()
			delete(b.subscribers, events)
			close(events)
			b.mu.Unlock()
		})
	}

	return events, unsubscribe
}
