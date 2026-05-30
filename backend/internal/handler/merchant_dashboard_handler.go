package handler

import (
	"fmt"
	"net/http"

	"douyin-live/backend/internal/service"
	"douyin-live/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type MerchantDashboardHandler struct {
	svc *service.MerchantDashboardService
}

func NewMerchantDashboardHandler(svc *service.MerchantDashboardService) *MerchantDashboardHandler {
	return &MerchantDashboardHandler{svc: svc}
}

func (h *MerchantDashboardHandler) Get(c *gin.Context) {
	merchantID := c.GetInt64("user_id")
	result, err := h.svc.GetDashboard(c.Request.Context(), merchantID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, fmt.Sprintf("获取商家看板失败: %v", err))
		return
	}
	response.Success(c, http.StatusOK, result)
}
