package realtime

import "time"

const (
	MessageSnapshot    = "snapshot"
	MessagePriceUpdate = "price_update"
	MessageExtended    = "extended"
	MessageAuctionEnd  = "auction_end"
	MessageOutbid      = "outbid"
)

type Envelope struct {
	Type       string      `json:"type"`
	AuctionID  int64       `json:"auction_id"`
	Version    int64       `json:"version"`
	ServerTime time.Time   `json:"server_time"`
	Payload    interface{} `json:"payload"`
}

type ProductSummary struct {
	ID          int64    `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	ImageURLs   []string `json:"image_urls"`
}

type RankingItem struct {
	Rank        int       `json:"rank"`
	UserID      int64     `json:"user_id"`
	DisplayName string    `json:"display_name"`
	AvatarURL   string    `json:"avatar_url"`
	Amount      float64   `json:"amount"`
	Status      string    `json:"status"`
	BidTime     time.Time `json:"bid_time"`
}

type SnapshotPayload struct {
	Product            ProductSummary `json:"product"`
	Status             string         `json:"status"`
	CurrentPrice       float64        `json:"current_price"`
	HighestBidderID    *int64         `json:"highest_bidder_id"`
	StartedAt          *time.Time     `json:"started_at"`
	EndedAt            *time.Time     `json:"ended_at"`
	CurrentExtendCount int            `json:"current_extend_count"`
	BidIncrementType   string         `json:"bid_increment_type"`
	BidIncrementValue  float64        `json:"bid_increment_value"`
	NextBidAmount      float64        `json:"next_bid_amount"`
	Rankings           []RankingItem  `json:"rankings"`
}

type PriceUpdatePayload struct {
	CurrentPrice    float64       `json:"current_price"`
	HighestBidderID int64         `json:"highest_bidder_id"`
	Rankings        []RankingItem `json:"rankings"`
}

type ExtendedPayload struct {
	EndedAt            time.Time `json:"ended_at"`
	CurrentExtendCount int       `json:"current_extend_count"`
}

type AuctionEndPayload struct {
	Status          string  `json:"status"`
	WinnerID        *int64  `json:"winner_id"`
	FinalPrice      float64 `json:"final_price"`
	CancelReason    string  `json:"cancel_reason,omitempty"`
	TerminalMessage string  `json:"terminal_message"`
}

type OutbidPayload struct {
	PreviousAmount float64 `json:"previous_amount"`
	NewAmount      float64 `json:"new_amount"`
	NewBidderID    int64   `json:"new_bidder_id"`
}
