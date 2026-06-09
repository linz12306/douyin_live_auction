package dto

import (
	"time"

	"douyin-live/backend/internal/model"
)

type PlaceBidRequest struct {
	Amount         float64 `json:"amount" binding:"required,gt=0"`
	IdempotencyKey string  `json:"-"`
}

type PlaceBidResponse struct {
	AuctionID       int64   `json:"auction_id"`
	BidID           int64   `json:"bid_id"`
	Amount          float64 `json:"amount"`
	CurrentPrice    float64 `json:"current_price"`
	HighestBidderID int64   `json:"highest_bidder_id"`
	Status          string  `json:"status"`
	Extended        bool    `json:"extended"`
	Settled         bool    `json:"settled"`
	OrderID         *int64  `json:"order_id,omitempty"`
}

type BidCommandResponse struct {
	CommandID      string     `json:"command_id"`
	AuctionID      int64      `json:"auction_id"`
	Amount         float64    `json:"amount"`
	Status         string     `json:"status"`
	FailureReason  *string    `json:"failure_reason,omitempty"`
	BidID          *int64     `json:"bid_id,omitempty"`
	OrderID        *int64     `json:"order_id,omitempty"`
	AuctionVersion *int64     `json:"auction_version,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	ProcessedAt    *time.Time `json:"processed_at,omitempty"`
}

type RankingResponse struct {
	AuctionID int64              `json:"auction_id"`
	Items     []model.BidRanking `json:"items"`
}
