package repository

import (
	"context"
	"database/sql"
	"time"
)

type AIGenerationRecord struct {
	ID            int64
	MerchantID    int64
	TargetType    string
	ProductID     *int64
	AuctionID     *int64
	InputSnapshot string
	OutputContent string
	Model         string
	Status        string
	ErrorMessage  *string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type AuctionReportSnapshot struct {
	AuctionID            int64
	ProductID            int64
	MerchantID           int64
	ProductTitle         string
	ProductDescription   string
	Status               string
	StartPrice           float64
	CurrentPrice         float64
	CeilingPrice         *float64
	DurationSeconds      int
	ParticipantCount     int
	BidCount             int
	Last30SecondBidCount int
	StartedAt            *time.Time
	EndedAt              *time.Time
}

type AIRepo struct {
	db *sql.DB
}

func NewAIRepo(db *sql.DB) *AIRepo {
	return &AIRepo{db: db}
}

func (r *AIRepo) SaveGeneration(ctx context.Context, record *AIGenerationRecord) error {
	result, err := r.db.ExecContext(ctx,
		`INSERT INTO ai_generation_records
            (merchant_id, target_type, product_id, auction_id, input_snapshot, output_content, model, status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		record.MerchantID,
		record.TargetType,
		nullableInt64(record.ProductID),
		nullableInt64(record.AuctionID),
		record.InputSnapshot,
		record.OutputContent,
		record.Model,
		record.Status,
		nullableString(record.ErrorMessage),
	)
	if err != nil {
		return err
	}
	record.ID, err = result.LastInsertId()
	return err
}

func (r *AIRepo) LatestSuccessfulAuctionReport(ctx context.Context, merchantID, auctionID int64) (*AIGenerationRecord, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT id, merchant_id, target_type, product_id, auction_id, input_snapshot, output_content,
                model, status, error_message, created_at, updated_at
         FROM ai_generation_records
         WHERE merchant_id = ? AND auction_id = ? AND target_type = 'auction_report' AND status = 'succeeded'
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
		merchantID, auctionID,
	)
	record, err := scanAIGenerationRecord(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return record, err
}

func (r *AIRepo) AuctionReportSnapshot(ctx context.Context, merchantID, auctionID int64) (*AuctionReportSnapshot, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT a.id, a.product_id, a.merchant_id, p.title, p.description, a.status,
                a.start_price, a.current_price, a.ceiling_price, a.duration_seconds,
                COUNT(b.id) AS bid_count,
                COUNT(DISTINCT b.user_id) AS participant_count,
                SUM(CASE
                    WHEN a.ended_at IS NOT NULL AND b.created_at >= DATE_SUB(a.ended_at, INTERVAL 30 SECOND) THEN 1
                    ELSE 0
                END) AS last_30_second_bid_count,
                a.started_at, a.ended_at
         FROM auctions a
         JOIN products p ON p.id = a.product_id
         LEFT JOIN bids b ON b.auction_id = a.id
         WHERE a.id = ? AND a.merchant_id = ?
         GROUP BY a.id, a.product_id, a.merchant_id, p.title, p.description, a.status,
                  a.start_price, a.current_price, a.ceiling_price, a.duration_seconds, a.started_at, a.ended_at`,
		auctionID, merchantID,
	)

	var snapshot AuctionReportSnapshot
	var ceiling sql.NullFloat64
	var startedAt sql.NullTime
	var endedAt sql.NullTime
	var last30 sql.NullInt64
	err := row.Scan(
		&snapshot.AuctionID,
		&snapshot.ProductID,
		&snapshot.MerchantID,
		&snapshot.ProductTitle,
		&snapshot.ProductDescription,
		&snapshot.Status,
		&snapshot.StartPrice,
		&snapshot.CurrentPrice,
		&ceiling,
		&snapshot.DurationSeconds,
		&snapshot.BidCount,
		&snapshot.ParticipantCount,
		&last30,
		&startedAt,
		&endedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if ceiling.Valid {
		value := ceiling.Float64
		snapshot.CeilingPrice = &value
	}
	if startedAt.Valid {
		value := startedAt.Time
		snapshot.StartedAt = &value
	}
	if endedAt.Valid {
		value := endedAt.Time
		snapshot.EndedAt = &value
	}
	if last30.Valid {
		snapshot.Last30SecondBidCount = int(last30.Int64)
	}
	return &snapshot, nil
}

type aiRecordScanner interface {
	Scan(dest ...interface{}) error
}

func scanAIGenerationRecord(row aiRecordScanner) (*AIGenerationRecord, error) {
	var record AIGenerationRecord
	var productID sql.NullInt64
	var auctionID sql.NullInt64
	var errorMessage sql.NullString
	err := row.Scan(
		&record.ID,
		&record.MerchantID,
		&record.TargetType,
		&productID,
		&auctionID,
		&record.InputSnapshot,
		&record.OutputContent,
		&record.Model,
		&record.Status,
		&errorMessage,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if productID.Valid {
		value := productID.Int64
		record.ProductID = &value
	}
	if auctionID.Valid {
		value := auctionID.Int64
		record.AuctionID = &value
	}
	if errorMessage.Valid {
		value := errorMessage.String
		record.ErrorMessage = &value
	}
	return &record, nil
}

func nullableInt64(value *int64) interface{} {
	if value == nil {
		return nil
	}
	return *value
}

func nullableString(value *string) interface{} {
	if value == nil {
		return nil
	}
	return *value
}
