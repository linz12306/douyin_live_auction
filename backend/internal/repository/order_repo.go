package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

type OrderRepo struct {
	db *sql.DB
}

type OrderRow struct {
	ID                 int64
	AuctionID          int64
	ProductID          int64
	MerchantID         int64
	BuyerID            int64
	Amount             float64
	Status             string
	CancelReason       string
	ConfirmedAt        *time.Time
	PaidAt             *time.Time
	CancelledAt        *time.Time
	CreatedAt          time.Time
	UpdatedAt          time.Time
	ProductTitle       string
	ProductDescription string
	ProductImageURL    *string
	BuyerDisplayName   string
	BuyerAvatarURL     string
}

type orderQuerier interface {
	QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row
}

func NewOrderRepo(db *sql.DB) *OrderRepo {
	return &OrderRepo{db: db}
}

func (r *OrderRepo) WithTx(ctx context.Context, fn func(*sql.Tx) error) error {
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

func (r *OrderRepo) ListForUser(ctx context.Context, buyerID int64, status string, page, size int) ([]OrderRow, int, error) {
	return r.list(ctx, "o.buyer_id = ?", []interface{}{buyerID}, status, page, size)
}

func (r *OrderRepo) ListForMerchant(ctx context.Context, merchantID int64, status string, page, size int) ([]OrderRow, int, error) {
	return r.list(ctx, "o.merchant_id = ?", []interface{}{merchantID}, status, page, size)
}

func (r *OrderRepo) list(ctx context.Context, scope string, args []interface{}, status string, page, size int) ([]OrderRow, int, error) {
	where := "WHERE " + scope
	queryArgs := append([]interface{}{}, args...)
	if strings.TrimSpace(status) != "" {
		where += " AND o.status = ?"
		queryArgs = append(queryArgs, status)
	}

	var total int
	if err := r.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM orders o "+where, queryArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * size
	rows, err := r.db.QueryContext(ctx, orderSelectSQL()+`
         `+where+`
         ORDER BY o.created_at DESC, o.id DESC
         LIMIT ? OFFSET ?`, append(queryArgs, size, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items, err := scanOrderRows(rows)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *OrderRepo) FindByID(ctx context.Context, orderID int64) (*OrderRow, error) {
	return r.findByID(ctx, r.db, orderID, false)
}

func (r *OrderRepo) FindByIDForUpdate(ctx context.Context, tx *sql.Tx, orderID int64) (*OrderRow, error) {
	return r.findByID(ctx, tx, orderID, true)
}

func (r *OrderRepo) findByID(ctx context.Context, q orderQuerier, orderID int64, forUpdate bool) (*OrderRow, error) {
	query := orderSelectSQL() + ` WHERE o.id = ?`
	if forUpdate {
		query += ` FOR UPDATE`
	}
	row := q.QueryRowContext(ctx, query, orderID)
	return scanOrderRow(row)
}

func (r *OrderRepo) Confirm(ctx context.Context, tx *sql.Tx, orderID int64, now time.Time) error {
	return execExpectAffected(ctx, tx,
		`UPDATE orders
         SET status = 'pending_payment', confirmed_at = ?, updated_at = ?
         WHERE id = ? AND status = 'pending_confirm'`,
		now, now, orderID,
	)
}

func (r *OrderRepo) Pay(ctx context.Context, tx *sql.Tx, orderID int64, now time.Time) error {
	return execExpectAffected(ctx, tx,
		`UPDATE orders
         SET status = 'paid', paid_at = ?, updated_at = ?
         WHERE id = ? AND status = 'pending_payment'`,
		now, now, orderID,
	)
}

func (r *OrderRepo) Cancel(ctx context.Context, tx *sql.Tx, orderID int64, reason string, now time.Time) error {
	return execExpectAffected(ctx, tx,
		`UPDATE orders
         SET status = 'cancelled', cancel_reason = ?, cancelled_at = ?, updated_at = ?
         WHERE id = ? AND status = 'pending_confirm'`,
		reason, now, now, orderID,
	)
}

func (r *OrderRepo) RefundBuyer(ctx context.Context, tx *sql.Tx, buyerID int64, amount float64) error {
	return execExpectAffected(ctx, tx,
		`UPDATE users SET balance = balance + ? WHERE id = ? AND role = 'user'`,
		amount, buyerID,
	)
}

func (r *OrderRepo) ListExpiredPendingConfirmIDs(ctx context.Context, tx *sql.Tx, deadline time.Time, limit int) ([]int64, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := tx.QueryContext(ctx,
		`SELECT id FROM orders
         WHERE status = 'pending_confirm' AND created_at <= ?
         ORDER BY created_at ASC, id ASC
         LIMIT ?
         FOR UPDATE`,
		deadline, limit,
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

func orderSelectSQL() string {
	return `SELECT o.id, o.auction_id, o.product_id, o.merchant_id, o.buyer_id,
                o.amount, o.status, o.cancel_reason, o.confirmed_at, o.paid_at, o.cancelled_at,
                o.created_at, o.updated_at,
                p.title, p.description,
                (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1) AS product_image_url,
                buyer.display_name, buyer.avatar_url
         FROM orders o
         JOIN products p ON p.id = o.product_id
         JOIN users buyer ON buyer.id = o.buyer_id`
}

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanOrderRows(rows *sql.Rows) ([]OrderRow, error) {
	var items []OrderRow
	for rows.Next() {
		item, err := scanOrderRow(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func scanOrderRow(scanner rowScanner) (*OrderRow, error) {
	var row OrderRow
	var cancelReason sql.NullString
	var confirmedAt sql.NullTime
	var paidAt sql.NullTime
	var cancelledAt sql.NullTime
	var productDescription sql.NullString
	var productImageURL sql.NullString
	var buyerDisplayName sql.NullString
	var buyerAvatarURL sql.NullString

	err := scanner.Scan(
		&row.ID, &row.AuctionID, &row.ProductID, &row.MerchantID, &row.BuyerID,
		&row.Amount, &row.Status, &cancelReason, &confirmedAt, &paidAt, &cancelledAt,
		&row.CreatedAt, &row.UpdatedAt,
		&row.ProductTitle, &productDescription, &productImageURL,
		&buyerDisplayName, &buyerAvatarURL,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if cancelReason.Valid {
		row.CancelReason = cancelReason.String
	}
	if confirmedAt.Valid {
		value := confirmedAt.Time
		row.ConfirmedAt = &value
	}
	if paidAt.Valid {
		value := paidAt.Time
		row.PaidAt = &value
	}
	if cancelledAt.Valid {
		value := cancelledAt.Time
		row.CancelledAt = &value
	}
	if productDescription.Valid {
		row.ProductDescription = productDescription.String
	}
	if productImageURL.Valid {
		value := productImageURL.String
		row.ProductImageURL = &value
	}
	if buyerDisplayName.Valid {
		row.BuyerDisplayName = buyerDisplayName.String
	}
	if buyerAvatarURL.Valid {
		row.BuyerAvatarURL = buyerAvatarURL.String
	}

	return &row, nil
}

func execExpectAffected(ctx context.Context, tx *sql.Tx, query string, args ...interface{}) error {
	result, err := tx.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return fmt.Errorf("no rows affected")
	}
	return nil
}
