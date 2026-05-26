package repository

import (
	"database/sql"
	"douyin-live/backend/internal/model"
)

type UserRepo struct {
	db *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) Create(user *model.User) error {
	result, err := r.db.Exec(
		`INSERT INTO users (username, password_hash, role, display_name, balance, frozen_amount)
		 VALUES (?, ?, ?, ?, 1000000.00, 0.00)`,
		user.Username, user.PasswordHash, user.Role, user.DisplayName,
	)
	if err != nil {
		return err
	}
	user.ID, _ = result.LastInsertId()
	return nil
}

func (r *UserRepo) FindByUsername(username string) (*model.User, error) {
	user := &model.User{}
	err := r.db.QueryRow(
		`SELECT id, username, password_hash, role, display_name, avatar_url,
		        balance, frozen_amount, created_at, updated_at
		 FROM users WHERE username = ?`, username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role,
		&user.DisplayName, &user.AvatarURL, &user.Balance, &user.FrozenAmount,
		&user.CreatedAt, &user.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (r *UserRepo) FindByID(id int64) (*model.User, error) {
	user := &model.User{}
	err := r.db.QueryRow(
		`SELECT id, username, password_hash, role, display_name, avatar_url,
		        balance, frozen_amount, created_at, updated_at
		 FROM users WHERE id = ?`, id,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role,
		&user.DisplayName, &user.AvatarURL, &user.Balance, &user.FrozenAmount,
		&user.CreatedAt, &user.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return user, err
}

func (r *UserRepo) UpdateProfile(id int64, displayName string) error {
	_, err := r.db.Exec(
		`UPDATE users SET display_name = ? WHERE id = ?`,
		displayName, id,
	)
	return err
}

func (r *UserRepo) UpdateAvatar(id int64, avatarURL string) error {
	_, err := r.db.Exec(
		`UPDATE users SET avatar_url = ? WHERE id = ?`,
		avatarURL, id,
	)
	return err
}

func (r *UserRepo) UpdatePassword(id int64, passwordHash string) error {
	_, err := r.db.Exec(
		`UPDATE users SET password_hash = ? WHERE id = ?`,
		passwordHash, id,
	)
	return err
}
