package dto

import "time"

type DashboardStatusCount struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}

type DashboardTransactionSummary struct {
	TotalPaidAmount  float64 `json:"total_paid_amount"`
	PaidOrderCount   int     `json:"paid_order_count"`
	AveragePaidPrice float64 `json:"average_paid_price"`
}

type DashboardActiveAuction struct {
	AuctionID       int64      `json:"auction_id"`
	ProductID       int64      `json:"product_id"`
	ProductTitle    string     `json:"product_title"`
	CurrentPrice    float64    `json:"current_price"`
	HighestBidderID *int64     `json:"highest_bidder_id,omitempty"`
	BidCount        int        `json:"bid_count"`
	StartedAt       *time.Time `json:"started_at,omitempty"`
	EndedAt         *time.Time `json:"ended_at,omitempty"`
}

type DashboardRecentOrder struct {
	ID              int64      `json:"id"`
	AuctionID       int64      `json:"auction_id"`
	ProductID       int64      `json:"product_id"`
	ProductTitle    string     `json:"product_title"`
	ProductImageURL *string    `json:"product_image_url,omitempty"`
	BuyerID         int64      `json:"buyer_id"`
	BuyerName       string     `json:"buyer_name"`
	BuyerAvatarURL  string     `json:"buyer_avatar_url"`
	Amount          float64    `json:"amount"`
	Status          string     `json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	ConfirmedAt     *time.Time `json:"confirmed_at,omitempty"`
	PaidAt          *time.Time `json:"paid_at,omitempty"`
	CancelledAt     *time.Time `json:"cancelled_at,omitempty"`
}

type DashboardTransactionTrendPoint struct {
	Date           string  `json:"date"`
	PaidAmount     float64 `json:"paid_amount"`
	PaidOrderCount int     `json:"paid_order_count"`
}

type DashboardBidDistributionBucket struct {
	Bucket    string   `json:"bucket"`
	MinAmount float64  `json:"min_amount"`
	MaxAmount *float64 `json:"max_amount,omitempty"`
	BidCount  int      `json:"bid_count"`
}

type DashboardUserActivityPoint struct {
	Date            string `json:"date"`
	ActiveUserCount int    `json:"active_user_count"`
	BidCount        int    `json:"bid_count"`
}

type DashboardAnalytics struct {
	TransactionTrend []DashboardTransactionTrendPoint `json:"transaction_trend"`
	BidDistribution  []DashboardBidDistributionBucket `json:"bid_distribution"`
	UserActivity     []DashboardUserActivityPoint     `json:"user_activity"`
}

type MerchantDashboardResponse struct {
	ProductStatusCounts []DashboardStatusCount      `json:"product_status_counts"`
	OrderStatusCounts   []DashboardStatusCount      `json:"order_status_counts"`
	TransactionSummary  DashboardTransactionSummary `json:"transaction_summary"`
	ActiveAuctions      []DashboardActiveAuction    `json:"active_auctions"`
	RecentOrders        []DashboardRecentOrder      `json:"recent_orders"`
	Analytics           DashboardAnalytics          `json:"analytics"`
}
