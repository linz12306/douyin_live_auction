package dto

import "time"

type OrderListQuery struct {
	Status string `form:"status"`
	Page   int    `form:"page"`
	Size   int    `form:"size"`
}

type OrderCancelRequest struct {
	Reason string `json:"reason"`
}

type OrderAvailableActions struct {
	CanConfirm bool `json:"can_confirm"`
	CanPay     bool `json:"can_pay"`
	CanCancel  bool `json:"can_cancel"`
}

type OrderListItem struct {
	ID              int64                 `json:"id"`
	AuctionID       int64                 `json:"auction_id"`
	ProductID       int64                 `json:"product_id"`
	MerchantID      int64                 `json:"merchant_id"`
	BuyerID         int64                 `json:"buyer_id"`
	ProductTitle    string                `json:"product_title"`
	ProductImageURL *string               `json:"product_image_url,omitempty"`
	BuyerName       string                `json:"buyer_name,omitempty"`
	BuyerAvatarURL  string                `json:"buyer_avatar_url,omitempty"`
	Amount          float64               `json:"amount"`
	Status          string                `json:"status"`
	CancelReason    string                `json:"cancel_reason,omitempty"`
	ConfirmDeadline *time.Time            `json:"confirm_deadline,omitempty"`
	CreatedAt       time.Time             `json:"created_at"`
	UpdatedAt       time.Time             `json:"updated_at"`
	ConfirmedAt     *time.Time            `json:"confirmed_at,omitempty"`
	PaidAt          *time.Time            `json:"paid_at,omitempty"`
	CancelledAt     *time.Time            `json:"cancelled_at,omitempty"`
	Actions         OrderAvailableActions `json:"actions"`
}

type OrderDetailResponse struct {
	OrderListItem
	ProductDescription string `json:"product_description"`
}

type OrderListResponse struct {
	Items []OrderListItem `json:"items"`
	Total int             `json:"total"`
	Page  int             `json:"page"`
	Size  int             `json:"size"`
}
