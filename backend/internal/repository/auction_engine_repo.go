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

type AuctionSnapshotRow struct {
	ID                 int64
	ProductID          int64
	MerchantID         int64
	StartPrice         float64
	BidIncrementType   string
	BidIncrementValue  float64
	CeilingPrice       *float64
	DurationSeconds    int
	AutoExtendSeconds  int
	MaxExtendCount     int
	CurrentExtendCount int
	Status             string
	CurrentPrice       float64
	HighestBidderID    *int64
	CancelReason       string
	Version            int64
	StartedAt          *time.Time
	EndedAt            *time.Time
	CancelledAt        *time.Time
	CreatedAt          time.Time
	UpdatedAt          time.Time
	ProductTitle       string
	ProductDescription string
	ImageURLs          []string
}

type AuctionSnapshot struct {
	Row      *AuctionSnapshotRow
	Rankings []model.BidRanking
}

type auctionSnapshotQuerier interface {
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
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

func (r *AuctionEngineRepo) FindAuctionSnapshot(ctx context.Context, auctionID int64) (*AuctionSnapshotRow, error) {
	row, err := r.readAuctionSnapshotRow(ctx, r.db, auctionID)
	if err != nil || row == nil {
		return row, err
	}

	images, err := r.findAuctionSnapshotImages(ctx, r.db, row.ProductID)
	if err != nil {
		return nil, err
	}
	row.ImageURLs = images
	return row, nil
}

func (r *AuctionEngineRepo) BuildAuctionSnapshot(ctx context.Context, auctionID int64, limit int) (*AuctionSnapshot, error) {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	row, err := r.readAuctionSnapshotRow(ctx, tx, auctionID)
	if err != nil || row == nil {
		return nil, err
	}

	images, err := r.findAuctionSnapshotImages(ctx, tx, row.ProductID)
	if err != nil {
		return nil, err
	}
	row.ImageURLs = images

	rankings, err := r.listRankings(ctx, tx, auctionID, limit)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &AuctionSnapshot{Row: row, Rankings: rankings}, nil
}

func (r *AuctionEngineRepo) readAuctionSnapshotRow(ctx context.Context, q auctionSnapshotQuerier, auctionID int64) (*AuctionSnapshotRow, error) {
	row := &AuctionSnapshotRow{}
	var ceilingPrice sql.NullFloat64
	var highestBidderID sql.NullInt64
	var cancelReason sql.NullString
	var startedAt sql.NullTime
	var endedAt sql.NullTime
	var cancelledAt sql.NullTime
	var productDescription sql.NullString

	err := q.QueryRowContext(ctx,
		`SELECT a.id, a.product_id, a.merchant_id, a.start_price, a.bid_increment_type, a.bid_increment_value,
                a.ceiling_price, a.duration_seconds, a.auto_extend_seconds, a.max_extend_count, a.current_extend_count,
                a.status, a.current_price, a.highest_bidder_id, a.cancel_reason, a.version,
                a.started_at, a.ended_at, a.cancelled_at, a.created_at, a.updated_at,
                p.title, p.description
         FROM auctions a
         JOIN products p ON p.id = a.product_id
         WHERE a.id = ?`, auctionID,
	).Scan(&row.ID, &row.ProductID, &row.MerchantID, &row.StartPrice, &row.BidIncrementType, &row.BidIncrementValue,
		&ceilingPrice, &row.DurationSeconds, &row.AutoExtendSeconds, &row.MaxExtendCount, &row.CurrentExtendCount,
		&row.Status, &row.CurrentPrice, &highestBidderID, &cancelReason, &row.Version,
		&startedAt, &endedAt, &cancelledAt, &row.CreatedAt, &row.UpdatedAt,
		&row.ProductTitle, &productDescription)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if ceilingPrice.Valid {
		value := ceilingPrice.Float64
		row.CeilingPrice = &value
	}
	if highestBidderID.Valid {
		value := highestBidderID.Int64
		row.HighestBidderID = &value
	}
	if cancelReason.Valid {
		row.CancelReason = cancelReason.String
	}
	if startedAt.Valid {
		value := startedAt.Time
		row.StartedAt = &value
	}
	if endedAt.Valid {
		value := endedAt.Time
		row.EndedAt = &value
	}
	if cancelledAt.Valid {
		value := cancelledAt.Time
		row.CancelledAt = &value
	}
	if productDescription.Valid {
		row.ProductDescription = productDescription.String
	}

	return row, nil
}

func (r *AuctionEngineRepo) findAuctionSnapshotImages(ctx context.Context, q auctionSnapshotQuerier, productID int64) ([]string, error) {
	rows, err := q.QueryContext(ctx,
		`SELECT image_url FROM product_images WHERE product_id = ? ORDER BY sort_order, id`, productID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var imageURLs []string
	for rows.Next() {
		var imageURL string
		if err := rows.Scan(&imageURL); err != nil {
			return nil, err
		}
		imageURLs = append(imageURLs, imageURL)
	}
	return imageURLs, rows.Err()
}

func (r *AuctionEngineRepo) ListExpiredActiveAuctionIDs(ctx context.Context, tx *sql.Tx, now time.Time) ([]int64, error) {
	rows, err := tx.QueryContext(ctx,
		`SELECT id FROM auctions
         WHERE status = 'active' AND ended_at IS NOT NULL AND ended_at <= ?
         ORDER BY ended_at ASC
         FOR UPDATE`, now,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
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

func (r *AuctionEngineRepo) FindLatestBidForUpdate(ctx context.Context, tx *sql.Tx, auctionID int64) (*model.Bid, error) {
	bid := &model.Bid{}
	err := tx.QueryRowContext(ctx,
		`SELECT id, auction_id, user_id, amount, status, created_at
         FROM bids WHERE auction_id = ?
         ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`, auctionID,
	).Scan(&bid.ID, &bid.AuctionID, &bid.UserID, &bid.Amount, &bid.Status, &bid.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return bid, err
}

func (r *AuctionEngineRepo) ListActiveBidsForUpdate(ctx context.Context, tx *sql.Tx, auctionID int64) ([]model.Bid, error) {
	rows, err := tx.QueryContext(ctx,
		`SELECT id, auction_id, user_id, amount, status, created_at
         FROM bids WHERE auction_id = ? AND status = 'active'
         FOR UPDATE`, auctionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bids []model.Bid
	for rows.Next() {
		var bid model.Bid
		if err := rows.Scan(&bid.ID, &bid.AuctionID, &bid.UserID, &bid.Amount, &bid.Status, &bid.CreatedAt); err != nil {
			return nil, err
		}
		bids = append(bids, bid)
	}
	return bids, rows.Err()
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

func (r *AuctionEngineRepo) CancelAllBids(ctx context.Context, tx *sql.Tx, auctionID int64) error {
	_, err := tx.ExecContext(ctx, `UPDATE bids SET status = 'cancelled' WHERE auction_id = ?`, auctionID)
	return err
}

func (r *AuctionEngineRepo) CreateBid(ctx context.Context, tx *sql.Tx, bid *model.Bid) error {
	result, err := tx.ExecContext(ctx,
		`INSERT INTO bids (auction_id, user_id, amount, status, created_at) VALUES (?, ?, ?, ?, ?)`,
		bid.AuctionID, bid.UserID, bid.Amount, bid.Status, bid.CreatedAt,
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

func (r *AuctionEngineRepo) ActivateAuction(ctx context.Context, tx *sql.Tx, auctionID, productID int64, startedAt, endedAt time.Time) error {
	if _, err := tx.ExecContext(ctx,
		`UPDATE auctions
         SET status = 'active', started_at = ?, ended_at = ?, version = version + 1
         WHERE id = ?`,
		startedAt, endedAt, auctionID,
	); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `UPDATE products SET status = 'active' WHERE id = ?`, productID)
	return err
}

func (r *AuctionEngineRepo) CancelAuction(ctx context.Context, tx *sql.Tx, auctionID, productID int64, reason string, cancelledAt time.Time) error {
	if _, err := tx.ExecContext(ctx,
		`UPDATE auctions
         SET status = 'cancelled', cancel_reason = ?, cancelled_at = ?, version = version + 1
         WHERE id = ?`,
		reason, cancelledAt, auctionID,
	); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `UPDATE products SET status = 'cancelled' WHERE id = ?`, productID)
	return err
}

func (r *AuctionEngineRepo) SetAuctionSold(ctx context.Context, tx *sql.Tx, auctionID, productID int64, endedAt time.Time) error {
	if _, err := tx.ExecContext(ctx,
		`UPDATE auctions SET status = 'ended_sold', ended_at = ?, version = version + 1 WHERE id = ?`,
		endedAt, auctionID,
	); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `UPDATE products SET status = 'ended_sold' WHERE id = ?`, productID)
	return err
}

func (r *AuctionEngineRepo) SetAuctionNoBid(ctx context.Context, tx *sql.Tx, auctionID, productID int64, endedAt time.Time) error {
	if _, err := tx.ExecContext(ctx,
		`UPDATE auctions SET status = 'ended_no_bid', ended_at = ?, version = version + 1 WHERE id = ?`,
		endedAt, auctionID,
	); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `UPDATE products SET status = 'ended_no_bid' WHERE id = ?`, productID)
	return err
}

func (r *AuctionEngineRepo) CreateOrder(ctx context.Context, tx *sql.Tx, order *model.Order) error {
	result, err := tx.ExecContext(ctx,
		`INSERT INTO orders (auction_id, product_id, merchant_id, buyer_id, amount, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending_confirm', ?, ?)`,
		order.AuctionID, order.ProductID, order.MerchantID, order.BuyerID, order.Amount, order.CreatedAt, order.UpdatedAt,
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
	return r.listRankings(ctx, r.db, auctionID, limit)
}

func (r *AuctionEngineRepo) listRankings(ctx context.Context, q auctionSnapshotQuerier, auctionID int64, limit int) ([]model.BidRanking, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	rows, err := q.QueryContext(ctx,
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
