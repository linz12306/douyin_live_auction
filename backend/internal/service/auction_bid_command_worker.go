package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type BidCommandWorkerOptions struct {
	StreamKey   string
	Group       string
	Consumer    string
	Concurrency int
	Block       time.Duration
	LockTTL     time.Duration
}

func (s *AuctionService) StartBidCommandWorker(ctx context.Context, options BidCommandWorkerOptions) {
	if s == nil || s.redis == nil {
		return
	}
	options = normalizeBidCommandWorkerOptions(options)
	if err := s.ensureBidCommandConsumerGroup(ctx, options); err != nil {
		log.Printf("bid command worker group setup failed: %v", err)
		return
	}

	for i := 0; i < options.Concurrency; i++ {
		consumer := fmt.Sprintf("%s-%d", options.Consumer, i+1)
		go s.bidCommandWorkerLoop(ctx, options, consumer)
	}
}

func (s *AuctionService) DrainBidCommandsForAuctionForTest(ctx context.Context, auctionID int64) error {
	return s.drainBidCommandsForAuction(ctx, auctionID, normalizeBidCommandWorkerOptions(BidCommandWorkerOptions{}))
}

func normalizeBidCommandWorkerOptions(options BidCommandWorkerOptions) BidCommandWorkerOptions {
	if options.StreamKey == "" {
		options.StreamKey = defaultBidCommandStreamKey
	}
	if options.Group == "" {
		options.Group = "auction_bid_command_workers"
	}
	if options.Consumer == "" {
		options.Consumer = "auction-bid-command-worker"
	}
	if options.Concurrency <= 0 {
		options.Concurrency = 4
	}
	if options.Block <= 0 {
		options.Block = time.Second
	}
	if options.LockTTL <= 0 {
		options.LockTTL = 10 * time.Second
	}
	return options
}

func (s *AuctionService) ensureBidCommandConsumerGroup(ctx context.Context, options BidCommandWorkerOptions) error {
	err := s.redis.XGroupCreateMkStream(ctx, options.StreamKey, options.Group, "$").Err()
	if err == nil || strings.Contains(err.Error(), "BUSYGROUP") {
		return nil
	}
	return err
}

func (s *AuctionService) bidCommandWorkerLoop(ctx context.Context, options BidCommandWorkerOptions, consumer string) {
	for {
		if ctx.Err() != nil {
			return
		}
		streams, err := s.redis.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    options.Group,
			Consumer: consumer,
			Streams:  []string{options.StreamKey, ">"},
			Count:    16,
			Block:    options.Block,
		}).Result()
		if err != nil {
			if errors.Is(err, redis.Nil) {
				continue
			}
			if ctx.Err() != nil {
				return
			}
			time.Sleep(100 * time.Millisecond)
			continue
		}
		for _, stream := range streams {
			for _, message := range stream.Messages {
				auctionID, ok := bidCommandAuctionID(message)
				if ok {
					if err := s.drainBidCommandsForAuction(ctx, auctionID, options); err != nil {
						log.Printf("bid command drain failed: auction_id=%d err=%v", auctionID, err)
					}
				}
				_ = s.redis.XAck(context.Background(), options.StreamKey, options.Group, message.ID).Err()
			}
		}
	}
}

func bidCommandAuctionID(message redis.XMessage) (int64, bool) {
	raw, ok := message.Values["auction_id"]
	if !ok {
		return 0, false
	}
	switch value := raw.(type) {
	case int64:
		return value, true
	case string:
		id, err := strconv.ParseInt(value, 10, 64)
		return id, err == nil
	default:
		id, err := strconv.ParseInt(fmt.Sprint(value), 10, 64)
		return id, err == nil
	}
}

func (s *AuctionService) drainBidCommandsForAuction(ctx context.Context, auctionID int64, options BidCommandWorkerOptions) error {
	unlock, ok, err := s.acquireBidCommandWorkerLock(ctx, auctionID, options.LockTTL)
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}
	defer unlock()

	for {
		commands, err := s.repo.ListQueuedBidCommandsForAuction(ctx, auctionID, 50)
		if err != nil {
			return err
		}
		if len(commands) == 0 {
			return nil
		}
		for _, command := range commands {
			if err := s.processBidCommand(ctx, command.CommandID); err != nil {
				return err
			}
		}
	}
}

func (s *AuctionService) acquireBidCommandWorkerLock(ctx context.Context, auctionID int64, ttl time.Duration) (func(), bool, error) {
	if s.redis == nil {
		return func() {}, true, nil
	}
	key := fmt.Sprintf("auction:%d:bid_command_worker_lock", auctionID)
	value := fmt.Sprintf("%d", time.Now().UnixNano())
	ok, err := s.redis.SetNX(ctx, key, value, ttl).Result()
	if err != nil {
		return nil, false, err
	}
	if !ok {
		return func() {}, false, nil
	}
	return func() { _ = s.redis.Del(context.Background(), key).Err() }, true, nil
}
