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
	snapshot, err := p.repo.BuildAuctionSnapshot(ctx, auctionID, 50)
	if err != nil {
		return nil, err
	}
	var row *repository.AuctionSnapshotRow
	var rankings []model.BidRanking
	if snapshot != nil {
		row = snapshot.Row
		rankings = snapshot.Rankings
	}
	if row == nil {
		return nil, sql.ErrNoRows
	}

	payload := SnapshotPayload{
		Product: ProductSummary{
			ID:          row.ProductID,
			Title:       row.ProductTitle,
			Description: row.ProductDescription,
			ImageURLs:   row.ImageURLs,
			LiveMedia:   toProductLiveMediaSummary(row.LiveMedia),
		},
		Status:             row.Status,
		CurrentPrice:       row.CurrentPrice,
		HighestBidderID:    row.HighestBidderID,
		StartedAt:          row.StartedAt,
		EndedAt:            row.EndedAt,
		CurrentExtendCount: row.CurrentExtendCount,
		BidIncrementType:   row.BidIncrementType,
		BidIncrementValue:  row.BidIncrementValue,
		NextBidAmount:      nextBidAmount(row.CurrentPrice, row.StartPrice, row.BidIncrementType, row.BidIncrementValue),
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

func toProductLiveMediaSummary(media *model.ProductLiveMedia) *ProductLiveMediaSummary {
	if media == nil {
		return nil
	}
	return &ProductLiveMediaSummary{
		Type:      media.MediaType,
		URL:       media.MediaURL,
		PosterURL: media.PosterURL,
	}
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

func nextBidAmount(current, startPrice float64, incrementType string, value float64) float64 {
	base := current
	if base <= 0 {
		base = startPrice
	}
	return base + bidIncrement(base, incrementType, value)
}

func bidIncrement(current float64, incrementType string, value float64) float64 {
	if incrementType == "percent" {
		return math.Ceil(current*value/100*100) / 100
	}
	return value
}
