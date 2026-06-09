package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"douyin-live/backend/internal/realtime"
)

func TestAICommentaryServicePublishesSuccessfulKeyEvent(t *testing.T) {
	bus := realtime.NewInMemoryAuctionEventBus()
	llm := &fakeLLMClient{response: "价格突破关键位，竞拍热度正在升温！"}
	ai := NewAIService(&fakeAIStore{}, llm, "test-model")
	svc := NewAICommentaryService(bus, ai)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go svc.Run(ctx)
	time.Sleep(20 * time.Millisecond)

	events, unsubscribe := bus.Subscribe()
	defer unsubscribe()

	if err := bus.Publish(context.Background(), realtime.AuctionEvent{
		Type:       realtime.EventBidAccepted,
		AuctionID:  8,
		Version:    3,
		Amount:     1200,
		OccurredAt: time.Now(),
	}); err != nil {
		t.Fatalf("publish bid event: %v", err)
	}

	deadline := time.After(2 * time.Second)
	for {
		select {
		case event := <-events:
			if event.Type != realtime.EventAICommentary {
				continue
			}
			if event.Commentary == "" || event.Status != "first_bid" {
				t.Fatalf("commentary event = %+v", event)
			}
			return
		case <-deadline:
			t.Fatal("timed out waiting for ai commentary event")
		}
	}
}

func TestAICommentaryServiceDoesNotPublishFakeOutputOnModelFailure(t *testing.T) {
	bus := realtime.NewInMemoryAuctionEventBus()
	llm := &fakeLLMClient{err: errors.New("model down")}
	ai := NewAIService(&fakeAIStore{}, llm, "test-model")
	svc := NewAICommentaryService(bus, ai)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go svc.Run(ctx)
	time.Sleep(20 * time.Millisecond)

	events, unsubscribe := bus.Subscribe()
	defer unsubscribe()

	if err := bus.Publish(context.Background(), realtime.AuctionEvent{
		Type:       realtime.EventAuctionEnded,
		AuctionID:  8,
		Version:    5,
		Status:     "ended_sold",
		Amount:     5600,
		OccurredAt: time.Now(),
	}); err != nil {
		t.Fatalf("publish end event: %v", err)
	}

	deadline := time.After(300 * time.Millisecond)
	for {
		select {
		case event := <-events:
			if event.Type == realtime.EventAICommentary {
				t.Fatalf("unexpected fake commentary event = %+v", event)
			}
		case <-deadline:
			return
		}
	}
}
