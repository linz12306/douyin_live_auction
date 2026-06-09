package handler

import (
	"errors"
	"fmt"
	"net/http"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/service"
	"douyin-live/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AIHandler struct {
	svc *service.AIService
}

func NewAIHandler(svc *service.AIService) *AIHandler {
	return &AIHandler{svc: svc}
}

func (h *AIHandler) GenerateProductCopy(c *gin.Context) {
	merchantID := c.GetInt64("user_id")
	var req dto.ProductCopyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}
	result, err := h.svc.GenerateProductCopy(c.Request.Context(), merchantID, req)
	if err != nil {
		h.handleAIError(c, err)
		return
	}
	response.Success(c, http.StatusOK, result)
}

func (h *AIHandler) GenerateAuctionReport(c *gin.Context) {
	merchantID := c.GetInt64("user_id")
	auctionID := getInt64Param(c, "id")
	result, err := h.svc.GenerateAuctionReport(c.Request.Context(), merchantID, auctionID)
	if err != nil {
		h.handleAIError(c, err)
		return
	}
	response.Success(c, http.StatusOK, result)
}

func (h *AIHandler) LatestAuctionReport(c *gin.Context) {
	merchantID := c.GetInt64("user_id")
	auctionID := getInt64Param(c, "id")
	result, err := h.svc.LatestAuctionReport(c.Request.Context(), merchantID, auctionID)
	if err != nil {
		h.handleAIError(c, err)
		return
	}
	response.Success(c, http.StatusOK, result)
}

func (h *AIHandler) handleAIError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrAIConfigMissing):
		response.Error(c, http.StatusServiceUnavailable, err.Error())
	case errors.Is(err, service.ErrAIReportNotFound), errors.Is(err, service.ErrAIReportAuctionAbsent):
		response.Error(c, http.StatusNotFound, err.Error())
	case errors.Is(err, service.ErrNotOwner):
		response.Error(c, http.StatusForbidden, err.Error())
	case errors.Is(err, service.ErrAIReportNotTerminal), errors.Is(err, service.ErrAIInvalidOutput):
		response.Error(c, http.StatusBadRequest, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, fmt.Sprintf("AI助手生成失败: %v", err))
	}
}
