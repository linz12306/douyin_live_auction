package service

import (
	"context"
	"log"
	"sync"
	"time"

	"douyin-live/backend/internal/realtime"
)

type AICommentaryService struct {
	bus    realtime.AuctionEventBus
	ai     *AIService
	mu     sync.Mutex
	states map[int64]commentaryAuctionState
}

type commentaryAuctionState struct {
	seenBid       bool
	lastMilestone int
}

func NewAICommentaryService(bus realtime.AuctionEventBus, ai *AIService) *AICommentaryService {
	return &AICommentaryService{bus: bus, ai: ai, states: make(map[int64]commentaryAuctionState)}
}

func (s *AICommentaryService) Run(ctx context.Context) {
	if s == nil || s.bus == nil || s.ai == nil {
		<-ctx.Done()
		return
	}
	events, unsubscribe := s.bus.Subscribe()
	defer unsubscribe()

	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-events:
			if !ok {
				return
			}
			label, ok := s.commentaryLabel(event)
			if !ok {
				continue
			}
			go s.generateAndPublish(event, label)
		}
	}
}

func (s *AICommentaryService) commentaryLabel(event realtime.AuctionEvent) (string, bool) {
	switch event.Type {
	case realtime.EventBidAccepted:
		s.mu.Lock()
		defer s.mu.Unlock()
		state := s.states[event.AuctionID]
		if !state.seenBid {
			state.seenBid = true
			state.lastMilestone = int(event.Amount / 1000)
			s.states[event.AuctionID] = state
			return "first_bid", true
		}
		milestone := int(event.Amount / 1000)
		if milestone > 0 && milestone > state.lastMilestone {
			state.lastMilestone = milestone
			s.states[event.AuctionID] = state
			return "price_milestone", true
		}
		s.states[event.AuctionID] = state
		return "", false
	case realtime.EventAuctionExtended:
		return "soft_close_extension", true
	case realtime.EventAuctionEnded:
		return "auction_end", true
	case realtime.EventAuctionCancelled:
		return "auction_cancelled", true
	default:
		return "", false
	}
}

func (s *AICommentaryService) generateAndPublish(event realtime.AuctionEvent, label string) {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	commentary, err := s.ai.GenerateCommentary(ctx, event, label)
	if err != nil {
		log.Printf("ai commentary skipped: auction_id=%d event=%s err=%v", event.AuctionID, label, err)
		return
	}

	publishCtx, publishCancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer publishCancel()
	err = s.bus.Publish(publishCtx, realtime.AuctionEvent{
		Type:       realtime.EventAICommentary,
		AuctionID:  event.AuctionID,
		Version:    event.Version,
		Status:     label,
		Commentary: commentary,
		OccurredAt: time.Now(),
	})
	if err != nil {
		log.Printf("ai commentary publish failed: auction_id=%d err=%v", event.AuctionID, err)
	}
}
