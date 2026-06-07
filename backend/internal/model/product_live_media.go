package model

import "time"

type ProductLiveMedia struct {
	ProductID int64     `json:"product_id"`
	MediaType string    `json:"type"`
	MediaURL  string    `json:"url"`
	PosterURL *string   `json:"poster_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
