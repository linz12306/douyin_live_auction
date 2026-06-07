package dto

import (
	"time"

	"douyin-live/backend/internal/model"
)

type CreateProductRequest struct {
	Title       string   `json:"title" binding:"required"`
	Description string   `json:"description"`
	ImageURLs   []string `json:"image_urls" binding:"max=9"`
}

type UpdateProductRequest struct {
	Title       string `json:"title" binding:"required"`
	Description string `json:"description"`
}

type PublishRequest struct {
	StartPrice        float64  `json:"start_price" binding:"gte=0"`
	BidIncrementType  string   `json:"bid_increment_type" binding:"required,oneof=fixed percent"`
	BidIncrementValue float64  `json:"bid_increment_value" binding:"required"`
	CeilingPrice      *float64 `json:"ceiling_price"`
	DurationSeconds   int      `json:"duration_seconds" binding:"required"`
	AutoExtendSeconds int      `json:"auto_extend_seconds"`
	MaxExtendCount    int      `json:"max_extend_count"`
}

type CancelRequest struct {
	Reason string `json:"reason"`
}

type ProductListQuery struct {
	Status string `form:"status"`
	Page   int    `form:"page"`
	Size   int    `form:"size"`
}

type ProductDetailResponse struct {
	Product   model.Product           `json:"product"`
	Images    []model.ProductImage    `json:"images"`
	LiveMedia *model.ProductLiveMedia `json:"live_media,omitempty"`
	Auction   *model.Auction          `json:"auction"`
}

type AuctionLobbyItem struct {
	ProductID    int64      `json:"product_id"`
	AuctionID    int64      `json:"auction_id"`
	Title        string     `json:"title"`
	ImageURL     *string    `json:"image_url,omitempty"`
	Status       string     `json:"status"`
	CurrentPrice float64    `json:"current_price"`
	EndedAt      *time.Time `json:"ended_at,omitempty"`
}
