package handler

import (
	"net/http"

	"douyin-live/backend/internal/service"

	"github.com/gin-gonic/gin"
)

type HealthHandler struct {
	svc *service.HealthService
}

func NewHealthHandler(svc *service.HealthService) *HealthHandler {
	return &HealthHandler{svc: svc}
}

func (h *HealthHandler) Healthz(c *gin.Context) {
	report := h.svc.Check(c.Request.Context())
	status := http.StatusOK
	if report.Status != service.HealthStatusOK {
		status = http.StatusServiceUnavailable
	}
	c.JSON(status, report)
}
