package model

import "time"

type ProductImage struct {
	ID        int64     `json:"id"`
	ProductID int64     `json:"product_id"`
	ImageURL  string    `json:"image_url"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}
