package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/realtime"
	"douyin-live/backend/internal/repository"
)

var (
	ErrAIConfigMissing       = errors.New("AI服务未配置")
	ErrAIInvalidOutput       = errors.New("AI模型返回格式不符合要求")
	ErrAIReportNotFound      = errors.New("AI竞拍报告不存在")
	ErrAIReportNotTerminal   = errors.New("竞拍未结束，暂不能生成AI报告")
	ErrAIReportAuctionAbsent = errors.New("竞拍不存在")
)

type aiGenerationStore interface {
	SaveGeneration(ctx context.Context, record *repository.AIGenerationRecord) error
	LatestSuccessfulAuctionReport(ctx context.Context, merchantID, auctionID int64) (*repository.AIGenerationRecord, error)
	AuctionReportSnapshot(ctx context.Context, merchantID, auctionID int64) (*repository.AuctionReportSnapshot, error)
}

type AIService struct {
	store  aiGenerationStore
	client LLMClient
	model  string
}

func NewAIService(store aiGenerationStore, client LLMClient, model string) *AIService {
	return &AIService{store: store, client: client, model: model}
}

func (s *AIService) GenerateProductCopy(ctx context.Context, merchantID int64, req dto.ProductCopyRequest) (*dto.ProductCopyResponse, error) {
	if err := s.ensureReady(); err != nil {
		return nil, err
	}
	input, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	content, err := s.client.Generate(ctx, LLMRequest{
		Messages: []LLMMessage{
			{Role: "system", Content: "你是抖音直播竞拍商家的中文商品文案助手。只返回严格JSON，不要Markdown。JSON字段必须是 title, description, selling_points, live_script。"},
			{Role: "user", Content: "根据以下商品和竞拍规则生成直播竞拍商品文案草稿，语气专业、有成交氛围，但不要承诺保值或投资收益。\n" + string(input)},
		},
		JSONResponse: true,
	})
	if err != nil {
		return nil, err
	}

	draft, err := parseProductCopyDraft(content)
	if err != nil {
		return nil, err
	}
	output, err := json.Marshal(draft)
	if err != nil {
		return nil, err
	}

	record := &repository.AIGenerationRecord{
		MerchantID:    merchantID,
		TargetType:    "product_copy",
		InputSnapshot: string(input),
		OutputContent: string(output),
		Model:         s.model,
		Status:        "succeeded",
	}
	if err := s.store.SaveGeneration(ctx, record); err != nil {
		return nil, err
	}
	return &dto.ProductCopyResponse{RecordID: record.ID, Model: s.model, Draft: draft}, nil
}

func (s *AIService) GenerateAuctionReport(ctx context.Context, merchantID, auctionID int64) (*dto.AuctionReportResponse, error) {
	if err := s.ensureReady(); err != nil {
		return nil, err
	}
	snapshot, err := s.store.AuctionReportSnapshot(ctx, merchantID, auctionID)
	if err != nil {
		return nil, err
	}
	if snapshot == nil {
		return nil, ErrAIReportAuctionAbsent
	}
	if !isTerminalAuctionStatus(snapshot.Status) {
		return nil, ErrAIReportNotTerminal
	}
	metrics := toAuctionReportMetrics(snapshot)
	input, err := json.Marshal(metrics)
	if err != nil {
		return nil, err
	}

	report, err := s.client.Generate(ctx, LLMRequest{Messages: []LLMMessage{
		{Role: "system", Content: "你是直播竞拍数据分析师。用中文输出简洁的赛后分析报告，包含数据解读、竞拍热度判断和下一场运营建议。不要编造输入中没有的数据。"},
		{Role: "user", Content: "请基于以下JSON生成竞拍分析报告，控制在180字以内：\n" + string(input)},
	}})
	if err != nil {
		return nil, err
	}
	report = strings.TrimSpace(report)
	if report == "" {
		return nil, ErrAIInvalidOutput
	}

	record := &repository.AIGenerationRecord{
		MerchantID:    merchantID,
		TargetType:    "auction_report",
		ProductID:     &snapshot.ProductID,
		AuctionID:     &snapshot.AuctionID,
		InputSnapshot: string(input),
		OutputContent: report,
		Model:         s.model,
		Status:        "succeeded",
	}
	if err := s.store.SaveGeneration(ctx, record); err != nil {
		return nil, err
	}
	return &dto.AuctionReportResponse{RecordID: record.ID, Model: s.model, Report: report, Metrics: metrics, CreatedAt: time.Now()}, nil
}

func (s *AIService) LatestAuctionReport(ctx context.Context, merchantID, auctionID int64) (*dto.AuctionReportResponse, error) {
	record, err := s.store.LatestSuccessfulAuctionReport(ctx, merchantID, auctionID)
	if err != nil {
		return nil, err
	}
	if record == nil {
		return nil, ErrAIReportNotFound
	}
	var metrics dto.AuctionReportMetrics
	_ = json.Unmarshal([]byte(record.InputSnapshot), &metrics)
	return &dto.AuctionReportResponse{
		RecordID:  record.ID,
		Model:     record.Model,
		Report:    record.OutputContent,
		Metrics:   metrics,
		CreatedAt: record.CreatedAt,
	}, nil
}

func (s *AIService) GenerateCommentary(ctx context.Context, event realtime.AuctionEvent, label string) (string, error) {
	if err := s.ensureReady(); err != nil {
		return "", err
	}
	input, err := json.Marshal(map[string]interface{}{
		"event":      label,
		"auction_id": event.AuctionID,
		"amount":     event.Amount,
		"status":     event.Status,
		"version":    event.Version,
	})
	if err != nil {
		return "", err
	}
	content, err := s.client.Generate(ctx, LLMRequest{Messages: []LLMMessage{
		{Role: "system", Content: "你是抖音直播竞拍间的AI实时解说员。用一句中文短句烘托竞拍氛围，不超过32字，不要编造用户姓名。"},
		{Role: "user", Content: string(input)},
	}})
	if err != nil {
		return "", err
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return "", ErrAIInvalidOutput
	}
	return content, nil
}

func (s *AIService) ensureReady() error {
	if s == nil || s.client == nil || strings.TrimSpace(s.model) == "" {
		return ErrAIConfigMissing
	}
	return nil
}

func parseProductCopyDraft(content string) (dto.ProductCopyDraft, error) {
	cleaned := strings.TrimSpace(content)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	var draft dto.ProductCopyDraft
	if err := json.Unmarshal([]byte(cleaned), &draft); err != nil {
		return draft, fmt.Errorf("%w: %v", ErrAIInvalidOutput, err)
	}
	draft.Title = strings.TrimSpace(draft.Title)
	draft.Description = strings.TrimSpace(draft.Description)
	draft.LiveScript = strings.TrimSpace(draft.LiveScript)
	points := make([]string, 0, len(draft.SellingPoints))
	for _, point := range draft.SellingPoints {
		if trimmed := strings.TrimSpace(point); trimmed != "" {
			points = append(points, trimmed)
		}
	}
	draft.SellingPoints = points
	if draft.Title == "" || draft.Description == "" || draft.LiveScript == "" || len(draft.SellingPoints) == 0 {
		return draft, ErrAIInvalidOutput
	}
	return draft, nil
}

func isTerminalAuctionStatus(status string) bool {
	return status == "ended_sold" || status == "ended_no_bid" || status == "cancelled"
}

func toAuctionReportMetrics(snapshot *repository.AuctionReportSnapshot) dto.AuctionReportMetrics {
	duration := snapshot.DurationSeconds
	if snapshot.StartedAt != nil && snapshot.EndedAt != nil && snapshot.EndedAt.After(*snapshot.StartedAt) {
		duration = int(snapshot.EndedAt.Sub(*snapshot.StartedAt).Seconds())
	}
	share := 0.0
	if snapshot.BidCount > 0 {
		share = float64(snapshot.Last30SecondBidCount) / float64(snapshot.BidCount)
	}
	var startedAt *string
	if snapshot.StartedAt != nil {
		value := snapshot.StartedAt.Format(time.RFC3339)
		startedAt = &value
	}
	var endedAt *string
	if snapshot.EndedAt != nil {
		value := snapshot.EndedAt.Format(time.RFC3339)
		endedAt = &value
	}
	return dto.AuctionReportMetrics{
		AuctionID:            snapshot.AuctionID,
		ProductID:            snapshot.ProductID,
		ProductTitle:         snapshot.ProductTitle,
		ProductDescription:   snapshot.ProductDescription,
		Status:               snapshot.Status,
		StartPrice:           snapshot.StartPrice,
		FinalPrice:           snapshot.CurrentPrice,
		ParticipantCount:     snapshot.ParticipantCount,
		BidCount:             snapshot.BidCount,
		DurationSeconds:      duration,
		Last30SecondBidCount: snapshot.Last30SecondBidCount,
		Last30SecondBidShare: share,
		StartedAt:            startedAt,
		EndedAt:              endedAt,
		CeilingPrice:         snapshot.CeilingPrice,
	}
}
