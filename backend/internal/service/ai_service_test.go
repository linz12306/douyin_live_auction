package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/repository"
)

type fakeLLMClient struct {
	response string
	err      error
	requests []LLMRequest
}

func (c *fakeLLMClient) Generate(ctx context.Context, req LLMRequest) (string, error) {
	c.requests = append(c.requests, req)
	return c.response, c.err
}

type fakeAIStore struct {
	saved          []*repository.AIGenerationRecord
	latest         *repository.AIGenerationRecord
	reportSnapshot *repository.AuctionReportSnapshot
}

func (s *fakeAIStore) SaveGeneration(ctx context.Context, record *repository.AIGenerationRecord) error {
	record.ID = int64(len(s.saved) + 1)
	now := time.Now()
	record.CreatedAt = now
	record.UpdatedAt = now
	s.saved = append(s.saved, record)
	return nil
}

func (s *fakeAIStore) LatestSuccessfulAuctionReport(ctx context.Context, merchantID, auctionID int64) (*repository.AIGenerationRecord, error) {
	return s.latest, nil
}

func (s *fakeAIStore) AuctionReportSnapshot(ctx context.Context, merchantID, auctionID int64) (*repository.AuctionReportSnapshot, error) {
	return s.reportSnapshot, nil
}

func TestAIServiceRejectsMissingConfig(t *testing.T) {
	svc := NewAIService(&fakeAIStore{}, &fakeLLMClient{response: `{}`}, "")

	_, err := svc.GenerateProductCopy(context.Background(), 1, dto.ProductCopyRequest{Title: "和田玉手镯"})

	if !errors.Is(err, ErrAIConfigMissing) {
		t.Fatalf("err = %v, want ErrAIConfigMissing", err)
	}
}

func TestAIServiceGeneratesAndSavesProductCopy(t *testing.T) {
	store := &fakeAIStore{}
	llm := &fakeLLMClient{response: `{
		"title":"温润和田玉手镯",
		"description":"玉质细腻，适合直播间重点展示。",
		"selling_points":["温润油性","佩戴收藏皆宜"],
		"live_script":"各位看这只手镯，光泽非常舒服。"
	}`}
	svc := NewAIService(store, llm, "test-model")

	result, err := svc.GenerateProductCopy(context.Background(), 9, dto.ProductCopyRequest{
		Title:             "和田玉手镯",
		Description:       "老坑料",
		StartPrice:        1000,
		BidIncrementType:  "fixed",
		BidIncrementValue: 100,
		DurationSeconds:   300,
	})

	if err != nil {
		t.Fatalf("GenerateProductCopy err = %v", err)
	}
	if result.RecordID != 1 || result.Model != "test-model" {
		t.Fatalf("result metadata = %+v", result)
	}
	if result.Draft.Title != "温润和田玉手镯" || len(result.Draft.SellingPoints) != 2 {
		t.Fatalf("draft = %+v", result.Draft)
	}
	if len(store.saved) != 1 {
		t.Fatalf("saved records = %d, want 1", len(store.saved))
	}
	saved := store.saved[0]
	if saved.MerchantID != 9 || saved.TargetType != "product_copy" || saved.Status != "succeeded" {
		t.Fatalf("saved record = %+v", saved)
	}
	if !strings.Contains(saved.InputSnapshot, "和田玉手镯") || !strings.Contains(saved.OutputContent, "live_script") {
		t.Fatalf("saved content missing expected JSON: %+v", saved)
	}
	if len(llm.requests) != 1 {
		t.Fatalf("llm requests = %d, want 1", len(llm.requests))
	}
}

func TestAIServiceGeneratesAuctionReportWithMetrics(t *testing.T) {
	started := time.Date(2026, 6, 9, 12, 0, 0, 0, time.UTC)
	ended := started.Add(5 * time.Minute)
	store := &fakeAIStore{reportSnapshot: &repository.AuctionReportSnapshot{
		AuctionID:            77,
		ProductID:            18,
		MerchantID:           4,
		ProductTitle:         "和田玉手镯",
		ProductDescription:   "细腻油润",
		Status:               "ended_sold",
		StartPrice:           1000,
		CurrentPrice:         5600,
		DurationSeconds:      300,
		ParticipantCount:     38,
		BidCount:             126,
		Last30SecondBidCount: 53,
		StartedAt:            &started,
		EndedAt:              &ended,
	}}
	llm := &fakeLLMClient{response: "本场竞拍共有38位用户参与，成交价较起拍价提升明显，最后30秒竞争激烈。"}
	svc := NewAIService(store, llm, "test-model")

	result, err := svc.GenerateAuctionReport(context.Background(), 4, 77)

	if err != nil {
		t.Fatalf("GenerateAuctionReport err = %v", err)
	}
	if result.RecordID != 1 || result.Metrics.ParticipantCount != 38 || result.Metrics.BidCount != 126 {
		t.Fatalf("result = %+v", result)
	}
	if result.Metrics.Last30SecondBidShare < 0.42 || result.Metrics.Last30SecondBidShare > 0.421 {
		t.Fatalf("last30 share = %v", result.Metrics.Last30SecondBidShare)
	}
	if len(store.saved) != 1 {
		t.Fatalf("saved records = %d, want 1", len(store.saved))
	}
	saved := store.saved[0]
	if saved.TargetType != "auction_report" || saved.AuctionID == nil || *saved.AuctionID != 77 || saved.ProductID == nil || *saved.ProductID != 18 {
		t.Fatalf("saved report record = %+v", saved)
	}
	if !strings.Contains(saved.InputSnapshot, `"participant_count":38`) {
		t.Fatalf("input snapshot = %s", saved.InputSnapshot)
	}
}

func TestAIServiceRejectsActiveAuctionReport(t *testing.T) {
	store := &fakeAIStore{reportSnapshot: &repository.AuctionReportSnapshot{AuctionID: 77, Status: "active"}}
	svc := NewAIService(store, &fakeLLMClient{response: "should not call"}, "test-model")

	_, err := svc.GenerateAuctionReport(context.Background(), 4, 77)

	if !errors.Is(err, ErrAIReportNotTerminal) {
		t.Fatalf("err = %v, want ErrAIReportNotTerminal", err)
	}
	if len(store.saved) != 0 {
		t.Fatalf("saved records = %d, want 0", len(store.saved))
	}
}
