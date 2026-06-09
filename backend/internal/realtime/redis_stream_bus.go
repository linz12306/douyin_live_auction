package realtime

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	defaultAuctionEventStreamKey = "auction_events"
	redisStreamMaxLenApprox      = 10000
	redisStreamReadCount         = 64
	redisStreamReadBlock         = time.Second
	redisStreamRetryDelay        = 100 * time.Millisecond
	redisStreamSubscriberBuffer  = 4096
)

// RedisStreamAuctionEventBus broadcasts committed auction events across backend
// instances. Each subscriber owns an independent stream cursor; this is not a
// consumer-group queue because every backend must see every event for WS fanout.
type RedisStreamAuctionEventBus struct {
	client    *redis.Client
	streamKey string
	dropped   atomic.Uint64
}

func NewRedisStreamAuctionEventBus(client *redis.Client, streamKey string) *RedisStreamAuctionEventBus {
	if streamKey == "" {
		streamKey = defaultAuctionEventStreamKey
	}
	return &RedisStreamAuctionEventBus{
		client:    client,
		streamKey: streamKey,
	}
}

func (b *RedisStreamAuctionEventBus) Publish(ctx context.Context, event AuctionEvent) error {
	if b == nil || b.client == nil {
		return errors.New("redis stream auction event bus is unavailable")
	}

	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return b.client.XAdd(ctx, &redis.XAddArgs{
		Stream: b.streamKey,
		MaxLen: redisStreamMaxLenApprox,
		Approx: true,
		Values: map[string]any{
			"event": string(payload),
		},
	}).Err()
}

func (b *RedisStreamAuctionEventBus) Subscribe() (<-chan AuctionEvent, func()) {
	events := make(chan AuctionEvent, redisStreamSubscriberBuffer)
	ctx, cancel := context.WithCancel(context.Background())
	lastID := b.lastStreamID(ctx)

	go b.readLoop(ctx, lastID, events)

	var once sync.Once
	unsubscribe := func() {
		once.Do(cancel)
	}

	return events, unsubscribe
}

func (b *RedisStreamAuctionEventBus) DroppedEvents() uint64 {
	return b.dropped.Load()
}

func (b *RedisStreamAuctionEventBus) lastStreamID(ctx context.Context) string {
	if b == nil || b.client == nil {
		return "$"
	}

	messages, err := b.client.XRevRangeN(ctx, b.streamKey, "+", "-", 1).Result()
	if err != nil || len(messages) == 0 {
		return "0"
	}
	return messages[0].ID
}

func (b *RedisStreamAuctionEventBus) readLoop(ctx context.Context, lastID string, out chan<- AuctionEvent) {
	defer close(out)

	for {
		streams, err := b.client.XRead(ctx, &redis.XReadArgs{
			Streams: []string{b.streamKey, lastID},
			Count:   redisStreamReadCount,
			Block:   redisStreamReadBlock,
		}).Result()
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			if err != redis.Nil {
				time.Sleep(redisStreamRetryDelay)
			}
			continue
		}

		for _, stream := range streams {
			for _, message := range stream.Messages {
				lastID = message.ID
				event, ok := decodeRedisStreamAuctionEvent(message)
				if !ok {
					continue
				}
				select {
				case out <- event:
				default:
					b.dropped.Add(1)
				}
			}
		}
	}
}

func decodeRedisStreamAuctionEvent(message redis.XMessage) (AuctionEvent, bool) {
	raw, ok := message.Values["event"]
	if !ok {
		return AuctionEvent{}, false
	}

	payload, ok := raw.(string)
	if !ok {
		return AuctionEvent{}, false
	}

	var event AuctionEvent
	if err := json.Unmarshal([]byte(payload), &event); err != nil {
		return AuctionEvent{}, false
	}
	return event, true
}
