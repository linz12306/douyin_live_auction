package dto

import "douyin-live/backend/internal/model"

type PlaceBidRequest struct {
	Amount float64 `json:"amount" binding:"required,gt=0"`
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

type RankingResponse struct {
	AuctionID int64              `json:"auction_id"`
	Items     []model.BidRanking `json:"items"`
}
