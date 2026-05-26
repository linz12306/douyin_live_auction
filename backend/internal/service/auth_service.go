package service

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"time"

	"douyin-live/backend/internal/config"
	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/model"
	"douyin-live/backend/internal/repository"
	"douyin-live/backend/pkg/hash"
	pkgjwt "douyin-live/backend/pkg/jwt"

	"github.com/redis/go-redis/v9"
)

var (
	ErrUsernameTaken      = errors.New("用户名已被注册")
	ErrInvalidCreds       = errors.New("用户名或密码错误")
	ErrInvalidToken       = errors.New("token 已失效，请重新登录")
	ErrInvalidUsername    = errors.New("用户名格式不正确（4-20位字母数字下划线）")
	ErrInvalidPassword    = errors.New("密码至少需要6个字符")
	ErrInvalidRole        = errors.New("角色只能是 merchant 或 user")
	ErrInvalidDisplayName = errors.New("昵称不能为空且不超过50字符")
)

type AuthService struct {
	repo  *repository.UserRepo
	redis *redis.Client
	cfg   *config.Config
}

func NewAuthService(repo *repository.UserRepo, redis *redis.Client, cfg *config.Config) *AuthService {
	return &AuthService{repo: repo, redis: redis, cfg: cfg}
}

var usernameRe = regexp.MustCompile(`^[a-zA-Z0-9_]{4,20}$`)

func (s *AuthService) Register(req *dto.RegisterRequest) (*model.User, *dto.AuthResponse, error) {
	if !usernameRe.MatchString(req.Username) {
		return nil, nil, ErrInvalidUsername
	}
	if len(req.Password) < 6 {
		return nil, nil, ErrInvalidPassword
	}
	if req.Role != "merchant" && req.Role != "user" {
		return nil, nil, ErrInvalidRole
	}
	if len(req.DisplayName) == 0 || len(req.DisplayName) > 50 {
		return nil, nil, ErrInvalidDisplayName
	}

	existing, err := s.repo.FindByUsername(req.Username)
	if err != nil {
		return nil, nil, fmt.Errorf("check username: %w", err)
	}
	if existing != nil {
		return nil, nil, ErrUsernameTaken
	}

	hashed, err := hash.HashPassword(req.Password)
	if err != nil {
		return nil, nil, fmt.Errorf("hash password: %w", err)
	}

	user := &model.User{
		Username:     req.Username,
		PasswordHash: hashed,
		Role:         req.Role,
		DisplayName:  req.DisplayName,
	}
	if err := s.repo.Create(user); err != nil {
		return nil, nil, fmt.Errorf("create user: %w", err)
	}

	tokens, err := s.generateTokens(user.ID, user.Username, user.Role)
	if err != nil {
		return nil, nil, err
	}
	return user, tokens, nil
}

func (s *AuthService) Login(req *dto.LoginRequest) (*model.User, *dto.AuthResponse, error) {
	user, err := s.repo.FindByUsername(req.Username)
	if err != nil {
		return nil, nil, fmt.Errorf("find user: %w", err)
	}
	if user == nil || !hash.CheckPassword(req.Password, user.PasswordHash) {
		return nil, nil, ErrInvalidCreds
	}

	tokens, err := s.generateTokens(user.ID, user.Username, user.Role)
	if err != nil {
		return nil, nil, err
	}
	return user, tokens, nil
}

func (s *AuthService) Refresh(refreshToken string) (*dto.AuthResponse, error) {
	claims, err := pkgjwt.ParseRefreshToken(refreshToken, s.cfg.JWTSecret)
	if err != nil {
		return nil, ErrInvalidToken
	}

	key := fmt.Sprintf("refresh:%d:%s", claims.UserID, claims.JTI)
	stored, err := s.redis.Get(context.Background(), key).Result()
	if err == redis.Nil || stored != refreshToken {
		return nil, ErrInvalidToken
	}

	// Delete old refresh token (rotation)
	s.redis.Del(context.Background(), key)

	user, err := s.repo.FindByID(claims.UserID)
	if err != nil || user == nil {
		return nil, ErrInvalidToken
	}

	return s.generateTokens(user.ID, user.Username, user.Role)
}

func (s *AuthService) Logout(refreshToken string) error {
	claims, err := pkgjwt.ParseRefreshToken(refreshToken, s.cfg.JWTSecret)
	if err != nil {
		return nil // Non-fatal: token already invalid
	}
	key := fmt.Sprintf("refresh:%d:%s", claims.UserID, claims.JTI)
	s.redis.Del(context.Background(), key)
	return nil
}

func (s *AuthService) generateTokens(userID int64, username, role string) (*dto.AuthResponse, error) {
	accessToken, err := pkgjwt.GenerateAccessToken(userID, username, role, s.cfg.JWTSecret)
	if err != nil {
		return nil, fmt.Errorf("generate access token: %w", err)
	}

	refreshToken, jti, err := pkgjwt.GenerateRefreshToken(userID, s.cfg.JWTSecret)
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}

	key := fmt.Sprintf("refresh:%d:%s", userID, jti)
	if err := s.redis.Set(context.Background(), key, refreshToken, 7*24*time.Hour).Err(); err != nil {
		return nil, fmt.Errorf("store refresh token: %w", err)
	}

	return &dto.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}
