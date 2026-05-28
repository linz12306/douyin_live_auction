package realtime

import (
	"context"
	"database/sql"
	"math"
	"time"

	"douyin-live/backend/internal/model"
	"douyin-live/backend/internal/repository"
)

type SnapshotProvider struct {
	repo *repository.AuctionEngineRepo
}

func NewSnapshotProvider(repo *repository.AuctionEngineRepo) *SnapshotProvider {
	return &SnapshotProvider{repo: repo}
}

func (p *SnapshotProvider) Snapshot(ctx context.Context, auctionID int64) (*Envelope, error) {
	row, err := p.repo.FindAuctionSnapshot(ctx, auctionID)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, sql.ErrNoRows
	}

	rankings, err := p.repo.ListRankings(ctx, auctionID, 50)
	if err != nil {
		return nil, err
	}

	payload := SnapshotPayload{
		Product: ProductSummary{
			ID:          row.ProductID,
			Title:       row.ProductTitle,
			Description: row.ProductDescription,
			ImageURLs:   row.ImageURLs,
		},
		Status:             row.Status,
		CurrentPrice:       row.CurrentPrice,
		HighestBidderID:    row.HighestBidderID,
		StartedAt:          row.StartedAt,
		EndedAt:            row.EndedAt,
		CurrentExtendCount: row.CurrentExtendCount,
		BidIncrementType:   row.BidIncrementType,
		BidIncrementValue:  row.BidIncrementValue,
		NextBidAmount:      nextBidAmount(row.CurrentPrice, row.BidIncrementType, row.BidIncrementValue),
		Rankings:           toRealtimeRankings(rankings),
	}

	return &Envelope{
		Type:       MessageSnapshot,
		AuctionID:  row.ID,
		Version:    row.Version,
		ServerTime: time.Now(),
		Payload:    payload,
	}, nil
}

func toRealtimeRankings(rankings []model.BidRanking) []RankingItem {
	items := make([]RankingItem, 0, len(rankings))
	for _, ranking := range rankings {
		items = append(items, RankingItem{
			Rank:        ranking.Rank,
			UserID:      ranking.UserID,
			DisplayName: ranking.DisplayName,
			AvatarURL:   ranking.AvatarURL,
			Amount:      ranking.Amount,
			Status:      ranking.Status,
			BidTime:     ranking.CreatedAt,
		})
	}
	return items
}

func nextBidAmount(current float64, incrementType string, value float64) float64 {
	return current + bidIncrement(current, incrementType, value)
}

func bidIncrement(current float64, incrementType string, value float64) float64 {
	if incrementType == "percent" {
		return math.Ceil(current*value/100*100) / 100
	}
	return value
}
