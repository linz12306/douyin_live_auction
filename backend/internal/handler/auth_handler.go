package handler

import (
	"net/http"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/service"
	"douyin-live/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req dto.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	user, tokens, err := h.svc.Register(&req)
	if err != nil {
		switch err {
		case service.ErrUsernameTaken:
			response.Error(c, http.StatusConflict, err.Error())
		case service.ErrInvalidUsername, service.ErrInvalidPassword,
			service.ErrInvalidRole, service.ErrInvalidDisplayName:
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			response.Error(c, http.StatusInternalServerError, "注册失败，请稍后重试")
		}
		return
	}

	response.Success(c, http.StatusCreated, gin.H{
		"access_token":  tokens.AccessToken,
		"refresh_token": tokens.RefreshToken,
		"user":          userToResponse(user),
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	user, tokens, err := h.svc.Login(&req)
	if err != nil {
		if err == service.ErrInvalidCreds {
			response.Error(c, http.StatusUnauthorized, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, "登录失败，请稍后重试")
		return
	}

	response.Success(c, http.StatusOK, gin.H{
		"access_token":  tokens.AccessToken,
		"refresh_token": tokens.RefreshToken,
		"user":          userToResponse(user),
	})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req dto.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	tokens, err := h.svc.Refresh(req.RefreshToken)
	if err != nil {
		if err == service.ErrInvalidToken {
			response.Error(c, http.StatusUnauthorized, err.Error())
			return
		}
		response.Error(c, http.StatusInternalServerError, "刷新失败，请稍后重试")
		return
	}

	response.Success(c, http.StatusOK, tokens)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	var req dto.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	h.svc.Logout(req.RefreshToken)
	response.Success(c, http.StatusOK, nil)
}
