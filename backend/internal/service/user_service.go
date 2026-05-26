package service

import (
	"errors"
	"fmt"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/model"
	"douyin-live/backend/internal/repository"
	"douyin-live/backend/pkg/hash"
)

var (
	ErrWrongPassword    = errors.New("原密码错误")
	ErrPasswordTooShort = errors.New("新密码至少需要6个字符")
)

type UserService struct {
	repo *repository.UserRepo
}

func NewUserService(repo *repository.UserRepo) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) GetProfile(userID int64) (*model.User, error) {
	user, err := s.repo.FindByID(userID)
	if err != nil {
		return nil, fmt.Errorf("find user: %w", err)
	}
	if user == nil {
		return nil, errors.New("用户不存在")
	}
	return user, nil
}

func (s *UserService) GetPublicProfile(userID int64) (*model.User, error) {
	return s.GetProfile(userID)
}

func (s *UserService) UpdateProfile(userID int64, req *dto.UpdateProfileRequest) error {
	if len(req.DisplayName) == 0 || len(req.DisplayName) > 50 {
		return ErrInvalidDisplayName
	}
	return s.repo.UpdateProfile(userID, req.DisplayName)
}

func (s *UserService) ChangePassword(userID int64, req *dto.ChangePasswordRequest) error {
	if len(req.NewPassword) < 6 {
		return ErrPasswordTooShort
	}
	user, err := s.repo.FindByID(userID)
	if err != nil {
		return fmt.Errorf("find user: %w", err)
	}
	if !hash.CheckPassword(req.OldPassword, user.PasswordHash) {
		return ErrWrongPassword
	}
	hashed, err := hash.HashPassword(req.NewPassword)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}
	return s.repo.UpdatePassword(userID, hashed)
}

func (s *UserService) UpdateAvatar(userID int64, avatarURL string) error {
	return s.repo.UpdateAvatar(userID, avatarURL)
}
