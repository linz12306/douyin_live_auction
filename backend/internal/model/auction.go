package model

import "time"

type Auction struct {
	ID                  int64      `json:"id"`
	ProductID           int64      `json:"product_id"`
	MerchantID          int64      `json:"merchant_id"`
	StartPrice          float64    `json:"start_price"`
	BidIncrementType    string     `json:"bid_increment_type"`
	BidIncrementValue   float64    `json:"bid_increment_value"`
	CeilingPrice        *float64   `json:"ceiling_price"`
	DurationSeconds     int        `json:"duration_seconds"`
	AutoExtendSeconds   int        `json:"auto_extend_seconds"`
	MaxExtendCount      int        `json:"max_extend_count"`
	CurrentExtendCount  int        `json:"current_extend_count"`
	Status              string     `json:"status"`
	CurrentPrice        float64    `json:"current_price"`
	HighestBidderID     *int64     `json:"highest_bidder_id"`
	CancelReason        string     `json:"cancel_reason"`
	Version             int        `json:"version"`
	StartedAt           *time.Time `json:"started_at"`
	EndedAt             *time.Time `json:"ended_at"`
	CancelledAt         *time.Time `json:"cancelled_at"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}
