package repository

import (
	"context"
	"database/sql"
	"time"
)

type MerchantDashboardRepo struct {
	db *sql.DB
}

type DashboardStatusCountRow struct {
	Status string
	Count  int
}

type DashboardTransactionRow struct {
	TotalPaidAmount  float64
	PaidOrderCount   int
	AveragePaidPrice float64
}

type DashboardActiveAuctionRow struct {
	AuctionID       int64
	ProductID       int64
	ProductTitle    string
	CurrentPrice    float64
	HighestBidderID *int64
	BidCount        int
	StartedAt       *time.Time
	EndedAt         *time.Time
}

type DashboardRecentOrderRow struct {
	ID              int64
	AuctionID       int64
	ProductID       int64
	ProductTitle    string
	ProductImageURL *string
	BuyerID         int64
	BuyerName       string
	BuyerAvatarURL  string
	Amount          float64
	Status          string
	CreatedAt       time.Time
	UpdatedAt       time.Time
	ConfirmedAt     *time.Time
	PaidAt          *time.Time
	CancelledAt     *time.Time
}

func NewMerchantDashboardRepo(db *sql.DB) *MerchantDashboardRepo {
	return &MerchantDashboardRepo{db: db}
}

func (r *MerchantDashboardRepo) ProductStatusCounts(ctx context.Context, merchantID int64) ([]DashboardStatusCountRow, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT status, COUNT(*)
         FROM products
         WHERE merchant_id = ?
         GROUP BY status`,
		merchantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var counts []DashboardStatusCountRow
	for rows.Next() {
		var item DashboardStatusCountRow
		if err := rows.Scan(&item.Status, &item.Count); err != nil {
			return nil, err
		}
		counts = append(counts, item)
	}
	return counts, rows.Err()
}

func (r *MerchantDashboardRepo) OrderStatusCounts(ctx context.Context, merchantID int64) ([]DashboardStatusCountRow, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT status, COUNT(*)
         FROM orders
         WHERE merchant_id = ?
         GROUP BY status`,
		merchantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var counts []DashboardStatusCountRow
	for rows.Next() {
		var item DashboardStatusCountRow
		if err := rows.Scan(&item.Status, &item.Count); err != nil {
			return nil, err
		}
		counts = append(counts, item)
	}
	return counts, rows.Err()
}

func (r *MerchantDashboardRepo) TransactionSummary(ctx context.Context, merchantID int64) (DashboardTransactionRow, error) {
	var row DashboardTransactionRow
	err := r.db.QueryRowContext(ctx,
		`SELECT COALESCE(SUM(amount), 0), COUNT(*), COALESCE(AVG(amount), 0)
         FROM orders
         WHERE merchant_id = ? AND status = 'paid'`,
		merchantID,
	).Scan(&row.TotalPaidAmount, &row.PaidOrderCount, &row.AveragePaidPrice)
	return row, err
}

func (r *MerchantDashboardRepo) ActiveAuctions(ctx context.Context, merchantID int64, limit int) ([]DashboardActiveAuctionRow, error) {
	if limit <= 0 || limit > 20 {
		limit = 5
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT a.id, a.product_id, p.title, a.current_price, a.highest_bidder_id,
                COUNT(b.id) AS bid_count, a.started_at, a.ended_at
         FROM auctions a
         JOIN products p ON p.id = a.product_id
         LEFT JOIN bids b ON b.auction_id = a.id
         WHERE a.merchant_id = ? AND a.status = 'active'
         GROUP BY a.id, a.product_id, p.title, a.current_price, a.highest_bidder_id, a.started_at, a.ended_at
         ORDER BY a.ended_at ASC, a.id DESC
         LIMIT ?`,
		merchantID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []DashboardActiveAuctionRow
	for rows.Next() {
		var item DashboardActiveAuctionRow
		var highestBidderID sql.NullInt64
		var startedAt sql.NullTime
		var endedAt sql.NullTime
		if err := rows.Scan(
			&item.AuctionID, &item.ProductID, &item.ProductTitle, &item.CurrentPrice,
			&highestBidderID, &item.BidCount, &startedAt, &endedAt,
		); err != nil {
			return nil, err
		}
		if highestBidderID.Valid {
			value := highestBidderID.Int64
			item.HighestBidderID = &value
		}
		if startedAt.Valid {
			value := startedAt.Time
			item.StartedAt = &value
		}
		if endedAt.Valid {
			value := endedAt.Time
			item.EndedAt = &value
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *MerchantDashboardRepo) RecentOrders(ctx context.Context, merchantID int64, limit int) ([]DashboardRecentOrderRow, error) {
	if limit <= 0 || limit > 20 {
		limit = 5
	}
	rows, err := r.db.QueryContext(ctx,
		`SELECT o.id, o.auction_id, o.product_id, p.title,
                (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1) AS product_image_url,
                o.buyer_id, buyer.display_name, buyer.avatar_url,
                o.amount, o.status, o.created_at, o.updated_at,
                o.confirmed_at, o.paid_at, o.cancelled_at
         FROM orders o
         JOIN products p ON p.id = o.product_id
         JOIN users buyer ON buyer.id = o.buyer_id
         WHERE o.merchant_id = ?
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT ?`,
		merchantID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []DashboardRecentOrderRow
	for rows.Next() {
		var item DashboardRecentOrderRow
		var productImageURL sql.NullString
		var buyerName sql.NullString
		var buyerAvatarURL sql.NullString
		var confirmedAt sql.NullTime
		var paidAt sql.NullTime
		var cancelledAt sql.NullTime
		if err := rows.Scan(
			&item.ID, &item.AuctionID, &item.ProductID, &item.ProductTitle, &productImageURL,
			&item.BuyerID, &buyerName, &buyerAvatarURL,
			&item.Amount, &item.Status, &item.CreatedAt, &item.UpdatedAt,
			&confirmedAt, &paidAt, &cancelledAt,
		); err != nil {
			return nil, err
		}
		if productImageURL.Valid {
			value := productImageURL.String
			item.ProductImageURL = &value
		}
		if buyerName.Valid {
			item.BuyerName = buyerName.String
		}
		if buyerAvatarURL.Valid {
			item.BuyerAvatarURL = buyerAvatarURL.String
		}
		if confirmedAt.Valid {
			value := confirmedAt.Time
			item.ConfirmedAt = &value
		}
		if paidAt.Valid {
			value := paidAt.Time
			item.PaidAt = &value
		}
		if cancelledAt.Valid {
			value := cancelledAt.Time
			item.CancelledAt = &value
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
