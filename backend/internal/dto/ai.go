package dto

import "time"

type ProductCopyRequest struct {
	Title             string   `json:"title"`
	Description       string   `json:"description"`
	StartPrice        float64  `json:"start_price"`
	BidIncrementType  string   `json:"bid_increment_type"`
	BidIncrementValue float64  `json:"bid_increment_value"`
	CeilingPrice      *float64 `json:"ceiling_price"`
	DurationSeconds   int      `json:"duration_seconds"`
}

type ProductCopyDraft struct {
	Title         string   `json:"title"`
	Description   string   `json:"description"`
	SellingPoints []string `json:"selling_points"`
	LiveScript    string   `json:"live_script"`
}

type ProductCopyResponse struct {
	RecordID int64            `json:"record_id"`
	Model    string           `json:"model"`
	Draft    ProductCopyDraft `json:"draft"`
}

type AuctionReportMetrics struct {
	AuctionID            int64    `json:"auction_id"`
	ProductID            int64    `json:"product_id"`
	ProductTitle         string   `json:"product_title"`
	ProductDescription   string   `json:"product_description"`
	Status               string   `json:"status"`
	StartPrice           float64  `json:"start_price"`
	FinalPrice           float64  `json:"final_price"`
	ParticipantCount     int      `json:"participant_count"`
	BidCount             int      `json:"bid_count"`
	DurationSeconds      int      `json:"duration_seconds"`
	Last30SecondBidCount int      `json:"last_30_second_bid_count"`
	Last30SecondBidShare float64  `json:"last_30_second_bid_share"`
	StartedAt            *string  `json:"started_at,omitempty"`
	EndedAt              *string  `json:"ended_at,omitempty"`
	CeilingPrice         *float64 `json:"ceiling_price,omitempty"`
}

type AuctionReportResponse struct {
	RecordID  int64                `json:"record_id"`
	Model     string               `json:"model"`
	Report    string               `json:"report"`
	Metrics   AuctionReportMetrics `json:"metrics"`
	CreatedAt time.Time            `json:"created_at"`
}

type AICommentaryPayload struct {
	Event      string `json:"event"`
	Commentary string `json:"commentary"`
}
