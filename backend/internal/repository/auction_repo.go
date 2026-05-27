package repository

import (
	"database/sql"
	"douyin-live/backend/internal/model"
)

type AuctionRepo struct {
	db *sql.DB
}

func NewAuctionRepo(db *sql.DB) *AuctionRepo {
	return &AuctionRepo{db: db}
}

func (r *AuctionRepo) Create(auction *model.Auction) error {
	result, err := r.db.Exec(
		`INSERT INTO auctions (product_id, merchant_id, start_price, bid_increment_type, bid_increment_value,
         ceiling_price, duration_seconds, auto_extend_seconds, max_extend_count, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
		auction.ProductID, auction.MerchantID, auction.StartPrice,
		auction.BidIncrementType, auction.BidIncrementValue,
		auction.CeilingPrice, auction.DurationSeconds,
		auction.AutoExtendSeconds, auction.MaxExtendCount,
	)
	if err != nil {
		return err
	}
	auction.ID, _ = result.LastInsertId()
	return nil
}

func (r *AuctionRepo) FindByProductID(productID int64) (*model.Auction, error) {
	a := &model.Auction{}
	err := r.db.QueryRow(
		`SELECT id, product_id, merchant_id, start_price, bid_increment_type, bid_increment_value,
                ceiling_price, duration_seconds, auto_extend_seconds, max_extend_count, current_extend_count,
                status, current_price, highest_bidder_id, cancel_reason, version,
                started_at, ended_at, cancelled_at, created_at, updated_at
         FROM auctions WHERE product_id = ?`, productID,
	).Scan(&a.ID, &a.ProductID, &a.MerchantID, &a.StartPrice, &a.BidIncrementType, &a.BidIncrementValue,
		&a.CeilingPrice, &a.DurationSeconds, &a.AutoExtendSeconds, &a.MaxExtendCount, &a.CurrentExtendCount,
		&a.Status, &a.CurrentPrice, &a.HighestBidderID, &a.CancelReason, &a.Version,
		&a.StartedAt, &a.EndedAt, &a.CancelledAt, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return a, err
}

func (r *AuctionRepo) InsertLog(auctionID, userID int64, action string, detail string) error {
	_, err := r.db.Exec(
		`INSERT INTO auction_logs (auction_id, action, user_id, detail) VALUES (?, ?, ?, ?)`,
		auctionID, action, userID, detail,
	)
	return err
}
