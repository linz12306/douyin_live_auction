package model

import "time"

type Product struct {
	ID          int64     `json:"id"`
	MerchantID  int64     `json:"merchant_id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
