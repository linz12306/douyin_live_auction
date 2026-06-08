package repository

import (
	"database/sql"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/model"
)

type ProductRepo struct {
	db *sql.DB
}

func NewProductRepo(db *sql.DB) *ProductRepo {
	return &ProductRepo{db: db}
}

func (r *ProductRepo) Create(product *model.Product, images []string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		`INSERT INTO products (merchant_id, title, description, status) VALUES (?, ?, ?, 'draft')`,
		product.MerchantID, product.Title, product.Description,
	)
	if err != nil {
		return err
	}
	product.ID, _ = result.LastInsertId()

	for i, url := range images {
		_, err := tx.Exec(
			`INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)`,
			product.ID, url, i,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *ProductRepo) FindByID(id int64) (*model.Product, error) {
	p := &model.Product{}
	err := r.db.QueryRow(
		`SELECT id, merchant_id, title, description, status, created_at, updated_at
         FROM products WHERE id = ?`, id,
	).Scan(&p.ID, &p.MerchantID, &p.Title, &p.Description, &p.Status, &p.CreatedAt, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return p, err
}

func (r *ProductRepo) FindImages(productID int64) ([]model.ProductImage, error) {
	rows, err := r.db.Query(
		`SELECT id, product_id, image_url, sort_order, created_at
         FROM product_images WHERE product_id = ? ORDER BY sort_order`, productID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var images []model.ProductImage
	for rows.Next() {
		var img model.ProductImage
		if err := rows.Scan(&img.ID, &img.ProductID, &img.ImageURL, &img.SortOrder, &img.CreatedAt); err != nil {
			return nil, err
		}
		images = append(images, img)
	}
	return images, nil
}

func (r *ProductRepo) FindLiveMedia(productID int64) (*model.ProductLiveMedia, error) {
	media := &model.ProductLiveMedia{}
	var posterURL sql.NullString
	err := r.db.QueryRow(
		`SELECT product_id, media_type, media_url, poster_url, created_at, updated_at
         FROM product_live_media WHERE product_id = ?`, productID,
	).Scan(&media.ProductID, &media.MediaType, &media.MediaURL, &posterURL, &media.CreatedAt, &media.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if posterURL.Valid {
		value := posterURL.String
		media.PosterURL = &value
	}
	return media, nil
}

func (r *ProductRepo) ListByMerchant(merchantID int64, status string, page, size int) ([]model.Product, int, error) {
	var total int
	args := []interface{}{merchantID}
	where := "WHERE p.merchant_id = ?"
	if status != "" {
		where += " AND p.status = ?"
		args = append(args, status)
	}

	r.db.QueryRow("SELECT COUNT(*) FROM products p "+where, args...).Scan(&total)

	offset := (page - 1) * size
	rows, err := r.db.Query(
		`SELECT p.id, p.merchant_id, p.title, p.description, p.status, p.created_at, p.updated_at, a.id,
                (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1) AS image_url
         FROM products p
         LEFT JOIN auctions a ON a.product_id = p.id
         `+where+`
         ORDER BY p.created_at DESC
         LIMIT ? OFFSET ?`,
		append(args, size, offset)...,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var products []model.Product
	for rows.Next() {
		var p model.Product
		var auctionID sql.NullInt64
		var imageURL sql.NullString
		if err := rows.Scan(&p.ID, &p.MerchantID, &p.Title, &p.Description, &p.Status, &p.CreatedAt, &p.UpdatedAt, &auctionID, &imageURL); err != nil {
			return nil, 0, err
		}
		if auctionID.Valid {
			p.AuctionID = &auctionID.Int64
		}
		if imageURL.Valid {
			p.ImageURL = &imageURL.String
		}
		products = append(products, p)
	}
	return products, total, nil
}

func (r *ProductRepo) ListAuctionLobby(page, size int) ([]dto.AuctionLobbyItem, int, error) {
	where := `WHERE p.status = 'active' AND a.status = 'active' AND a.ended_at > UTC_TIMESTAMP()`

	var total int
	if err := r.db.QueryRow("SELECT COUNT(*) FROM products p JOIN auctions a ON a.product_id = p.id " + where).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * size
	rows, err := r.db.Query(
		`SELECT p.id, a.id, p.title,
                (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1) AS image_url,
                a.status, a.current_price, a.ended_at
         FROM products p
         JOIN auctions a ON a.product_id = p.id
         `+where+`
         ORDER BY a.ended_at ASC, a.id DESC
         LIMIT ? OFFSET ?`,
		size, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []dto.AuctionLobbyItem
	for rows.Next() {
		var item dto.AuctionLobbyItem
		var imageURL sql.NullString
		var endedAt sql.NullTime
		if err := rows.Scan(
			&item.ProductID, &item.AuctionID, &item.Title, &imageURL,
			&item.Status, &item.CurrentPrice, &endedAt,
		); err != nil {
			return nil, 0, err
		}
		if imageURL.Valid {
			item.ImageURL = &imageURL.String
		}
		if endedAt.Valid {
			item.EndedAt = &endedAt.Time
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *ProductRepo) Update(p *model.Product) error {
	_, err := r.db.Exec(
		`UPDATE products SET title = ?, description = ? WHERE id = ?`,
		p.Title, p.Description, p.ID,
	)
	return err
}

func (r *ProductRepo) UpdateStatus(id int64, status string) error {
	_, err := r.db.Exec(`UPDATE products SET status = ? WHERE id = ?`, status, id)
	return err
}

func (r *ProductRepo) UpsertLiveMedia(productID int64, mediaType, mediaURL string, posterURL *string) error {
	_, err := r.db.Exec(
		`INSERT INTO product_live_media (product_id, media_type, media_url, poster_url)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE media_type = VALUES(media_type), media_url = VALUES(media_url), poster_url = VALUES(poster_url)`,
		productID, mediaType, mediaURL, posterURL,
	)
	return err
}

func (r *ProductRepo) DeleteLiveMedia(productID int64) error {
	_, err := r.db.Exec(`DELETE FROM product_live_media WHERE product_id = ?`, productID)
	return err
}

func (r *ProductRepo) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM products WHERE id = ?`, id)
	return err
}

func (r *ProductRepo) AddImage(productID int64, url string) error {
	var maxOrder int
	r.db.QueryRow(`SELECT COALESCE(MAX(sort_order), -1) FROM product_images WHERE product_id = ?`, productID).Scan(&maxOrder)
	_, err := r.db.Exec(
		`INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)`,
		productID, url, maxOrder+1,
	)
	return err
}

func (r *ProductRepo) DeleteImage(imageID int64) error {
	_, err := r.db.Exec(`DELETE FROM product_images WHERE id = ?`, imageID)
	return err
}

func (r *ProductRepo) CountImages(productID int64) (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM product_images WHERE product_id = ?`, productID).Scan(&count)
	return count, err
}
