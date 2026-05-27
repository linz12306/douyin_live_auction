package model

import "time"

type Order struct {
	ID           int64      `json:"id"`
	AuctionID    int64      `json:"auction_id"`
	ProductID    int64      `json:"product_id"`
	MerchantID   int64      `json:"merchant_id"`
	BuyerID      int64      `json:"buyer_id"`
	Amount       float64    `json:"amount"`
	Status       string     `json:"status"`
	CancelReason string     `json:"cancel_reason"`
	ConfirmedAt  *time.Time `json:"confirmed_at"`
	PaidAt       *time.Time `json:"paid_at"`
	CancelledAt  *time.Time `json:"cancelled_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
