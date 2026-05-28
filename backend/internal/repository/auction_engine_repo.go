package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"douyin-live/backend/internal/model"
)

var ErrInsufficientBalance = errors.New("余额不足")

type AuctionEngineRepo struct {
	db *sql.DB
}

func NewAuctionEngineRepo(db *sql.DB) *AuctionEngineRepo {
	return &AuctionEngineRepo{db: db}
}

func (r *AuctionEngineRepo) WithTx(ctx context.Context, fn func(*sql.Tx) error) error {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *AuctionEngineRepo) FindAuctionForUpdate(ctx context.Context, tx *sql.Tx, auctionID int64) (*model.Auction, error) {
	a := &model.Auction{}
	var ceilingPrice sql.NullFloat64
	var highestBidderID sql.NullInt64
	var cancelReason sql.NullString
	var startedAt sql.NullTime
	var endedAt sql.NullTime
	var cancelledAt sql.NullTime

	err := tx.QueryRowContext(ctx,
		`SELECT id, product_id, merchant_id, start_price, bid_increment_type, bid_increment_value,
                ceiling_price, duration_seconds, auto_extend_seconds, max_extend_count, current_extend_count,
                status, current_price, highest_bidder_id, cancel_reason, version,
                started_at, ended_at, cancelled_at, created_at, updated_at
         FROM auctions WHERE id = ? FOR UPDATE`, auctionID,
	).Scan(&a.ID, &a.ProductID, &a.MerchantID, &a.StartPrice, &a.BidIncrementType, &a.BidIncrementValue,
		&ceilingPrice, &a.DurationSeconds, &a.AutoExtendSeconds, &a.MaxExtendCount, &a.CurrentExtendCount,
		&a.Status, &a.CurrentPrice, &highestBidderID, &cancelReason, &a.Version,
		&startedAt, &endedAt, &cancelledAt, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if ceilingPrice.Valid {
		value := ceilingPrice.Float64
		a.CeilingPrice = &value
	}
	if highestBidderID.Valid {
		value := highestBidderID.Int64
		a.HighestBidderID = &value
	}
	if cancelReason.Valid {
		a.CancelReason = cancelReason.String
	}
	if startedAt.Valid {
		value := startedAt.Time
		a.StartedAt = &value
	}
	if endedAt.Valid {
		value := endedAt.Time
		a.EndedAt = &value
	}
	if cancelledAt.Valid {
		value := cancelledAt.Time
		a.CancelledAt = &value
	}
	return a, nil
}

func (r *AuctionEngineRepo) FindActiveBidForUpdate(ctx context.Context, tx *sql.Tx, auctionID int64) (*model.Bid, error) {
	bid := &model.Bid{}
	err := tx.QueryRowContext(ctx,
		`SELECT id, auction_id, user_id, amount, status, created_at
         FROM bids WHERE auction_id = ? AND status = 'active'
         ORDER BY amount DESC, created_at ASC LIMIT 1 FOR UPDATE`, auctionID,
	).Scan(&bid.ID, &bid.AuctionID, &bid.UserID, &bid.Amount, &bid.Status, &bid.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return bid, err
}

func (r *AuctionEngineRepo) FreezeUserBalance(ctx context.Context, tx *sql.Tx, userID int64, amount float64) error {
	result, err := tx.ExecContext(ctx,
		`UPDATE users
         SET balance = balance - ?, frozen_amount = frozen_amount + ?
         WHERE id = ? AND role = 'user' AND balance >= ?`,
		amount, amount, userID, amount,
	)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrInsufficientBalance
	}
	return nil
}

func (r *AuctionEngineRepo) UnfreezeUserBalance(ctx context.Context, tx *sql.Tx, userID int64, amount float64) error {
	_, err := tx.ExecContext(ctx,
		`UPDATE users
         SET balance = balance + ?, frozen_amount = GREATEST(frozen_amount - ?, 0)
         WHERE id = ?`,
		amount, amount, userID,
	)
	return err
}

func (r *AuctionEngineRepo) DeductFrozenBalance(ctx context.Context, tx *sql.Tx, userID int64, amount float64) error {
	result, err := tx.ExecContext(ctx,
		`UPDATE users
         SET frozen_amount = frozen_amount - ?
         WHERE id = ? AND frozen_amount >= ?`,
		amount, userID, amount,
	)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return fmt.Errorf("冻结余额不足")
	}
	return nil
}

func (r *AuctionEngineRepo) MarkBidStatus(ctx context.Context, tx *sql.Tx, bidID int64, status string) error {
	_, err := tx.ExecContext(ctx, `UPDATE bids SET status = ? WHERE id = ?`, status, bidID)
	return err
}

func (r *AuctionEngineRepo) CreateBid(ctx context.Context, tx *sql.Tx, bid *model.Bid) error {
	result, err := tx.ExecContext(ctx,
		`INSERT INTO bids (auction_id, user_id, amount, status) VALUES (?, ?, ?, ?)`,
		bid.AuctionID, bid.UserID, bid.Amount, bid.Status,
	)
	if err != nil {
		return err
	}
	bid.ID, _ = result.LastInsertId()
	return nil
}

func (r *AuctionEngineRepo) UpdateAuctionBidState(ctx context.Context, tx *sql.Tx, auctionID, bidderID int64, amount float64, extended bool, endedAt *time.Time) error {
	if endedAt != nil {
		_, err := tx.ExecContext(ctx,
			`UPDATE auctions
             SET current_price = ?, highest_bidder_id = ?, current_extend_count = current_extend_count + ?, ended_at = ?, version = version + 1
             WHERE id = ?`,
			amount, bidderID, boolToInt(extended), *endedAt, auctionID,
		)
		return err
	}
	_, err := tx.ExecContext(ctx,
		`UPDATE auctions
         SET current_price = ?, highest_bidder_id = ?, current_extend_count = current_extend_count + ?, version = version + 1
         WHERE id = ?`,
		amount, bidderID, boolToInt(extended), auctionID,
	)
	return err
}

func (r *AuctionEngineRepo) SetAuctionSold(ctx context.Context, tx *sql.Tx, auctionID int64, endedAt time.Time) error {
	_, err := tx.ExecContext(ctx,
		`UPDATE auctions SET status = 'ended_sold', ended_at = ?, version = version + 1 WHERE id = ?`,
		endedAt, auctionID,
	)
	return err
}

func (r *AuctionEngineRepo) CreateOrder(ctx context.Context, tx *sql.Tx, order *model.Order) error {
	result, err := tx.ExecContext(ctx,
		`INSERT INTO orders (auction_id, product_id, merchant_id, buyer_id, amount, status)
         VALUES (?, ?, ?, ?, ?, 'pending_confirm')`,
		order.AuctionID, order.ProductID, order.MerchantID, order.BuyerID, order.Amount,
	)
	if err != nil {
		return err
	}
	order.ID, _ = result.LastInsertId()
	return nil
}

func (r *AuctionEngineRepo) InsertAuditLog(ctx context.Context, tx *sql.Tx, auctionID, userID int64, action, detail string) error {
	_, err := tx.ExecContext(ctx,
		`INSERT INTO auction_logs (auction_id, action, user_id, detail) VALUES (?, ?, ?, ?)`,
		auctionID, action, userID, detail,
	)
	return err
}

func (r *AuctionEngineRepo) ListRankings(ctx context.Context, auctionID int64, limit int) ([]model.BidRanking, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT b.id, b.user_id, u.display_name, u.avatar_url, b.amount, b.status, b.created_at
         FROM bids b
         JOIN users u ON u.id = b.user_id
         WHERE b.auction_id = ?
         ORDER BY b.amount DESC, b.created_at ASC
         LIMIT ?`, auctionID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rankings []model.BidRanking
	rank := 1
	for rows.Next() {
		var item model.BidRanking
		item.Rank = rank
		if err := rows.Scan(&item.BidID, &item.UserID, &item.DisplayName, &item.AvatarURL, &item.Amount, &item.Status, &item.CreatedAt); err != nil {
			return nil, err
		}
		rankings = append(rankings, item)
		rank++
	}
	return rankings, rows.Err()
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
