package model

import "time"

const (
	BidCommandStatusQueued     = "queued"
	BidCommandStatusProcessing = "processing"
	BidCommandStatusAccepted   = "accepted"
	BidCommandStatusRejected   = "rejected"
	BidCommandStatusFailed     = "failed"
)

type BidCommand struct {
	ID                  int64
	CommandID           string
	AuctionID           int64
	UserID              int64
	IdempotencyKey      *string
	CoreIdempotencyKey string
	Amount              float64
	Status              string
	FailureReason       *string
	BidID               *int64
	OrderID             *int64
	AuctionVersion      *int64
	Attempts            int
	ProcessingStartedAt *time.Time
	ProcessedAt         *time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
}
