package handler

import (
	"errors"
	"fmt"
	"net/http"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/repository"
	"douyin-live/backend/internal/service"
	"douyin-live/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AuctionHandler struct {
	svc *service.AuctionService
}

func NewAuctionHandler(svc *service.AuctionService) *AuctionHandler {
	return &AuctionHandler{svc: svc}
}

func (h *AuctionHandler) PlaceBid(c *gin.Context) {
	userID := c.GetInt64("user_id")
	role := c.GetString("role")
	auctionID := getInt64Param(c, "id")

	var req dto.PlaceBidRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	result, err := h.svc.PlaceBid(c.Request.Context(), userID, role, auctionID, &req)
	if err != nil {
		h.handleAuctionError(c, err)
		return
	}
	response.Success(c, http.StatusOK, result)
}

func (h *AuctionHandler) Rankings(c *gin.Context) {
	auctionID := getInt64Param(c, "id")
	result, err := h.svc.Rankings(c.Request.Context(), auctionID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "获取排行榜失败")
		return
	}
	response.Success(c, http.StatusOK, result)
}

func (h *AuctionHandler) handleAuctionError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrAuctionNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	case errors.Is(err, service.ErrAuctionNotActive), errors.Is(err, service.ErrAuctionAlreadyClosed), errors.Is(err, service.ErrBidTooLow):
		response.Error(c, http.StatusBadRequest, err.Error())
	case errors.Is(err, service.ErrMerchantCannotBid):
		response.Error(c, http.StatusForbidden, err.Error())
	case errors.Is(err, service.ErrAuctionLockBusy):
		response.Error(c, http.StatusTooManyRequests, err.Error())
	case errors.Is(err, repository.ErrInsufficientBalance):
		response.Error(c, http.StatusBadRequest, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, fmt.Sprintf("竞拍操作失败: %v", err))
	}
}
