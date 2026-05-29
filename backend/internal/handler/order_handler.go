package handler

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/service"
	"douyin-live/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type OrderHandler struct {
	svc *service.OrderService
}

func NewOrderHandler(svc *service.OrderService) *OrderHandler {
	return &OrderHandler{svc: svc}
}

func (h *OrderHandler) List(c *gin.Context) {
	userID := c.GetInt64("user_id")
	role := c.GetString("role")

	var query dto.OrderListQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		response.Error(c, http.StatusBadRequest, "参数格式错误")
		return
	}

	result, err := h.svc.ListOrders(c.Request.Context(), userID, role, &query)
	if err != nil {
		h.handleOrderError(c, err)
		return
	}
	response.Success(c, http.StatusOK, result)
}

func (h *OrderHandler) Get(c *gin.Context) {
	userID := c.GetInt64("user_id")
	role := c.GetString("role")
	orderID := getInt64Param(c, "id")

	result, err := h.svc.GetOrder(c.Request.Context(), userID, role, orderID)
	if err != nil {
		h.handleOrderError(c, err)
		return
	}
	response.Success(c, http.StatusOK, result)
}

func (h *OrderHandler) Confirm(c *gin.Context) {
	userID := c.GetInt64("user_id")
	orderID := getInt64Param(c, "id")

	result, err := h.svc.ConfirmOrder(c.Request.Context(), userID, orderID)
	if err != nil {
		h.handleOrderError(c, err)
		return
	}
	response.Success(c, http.StatusOK, result)
}

func (h *OrderHandler) Pay(c *gin.Context) {
	userID := c.GetInt64("user_id")
	orderID := getInt64Param(c, "id")

	result, err := h.svc.PayOrder(c.Request.Context(), userID, orderID)
	if err != nil {
		h.handleOrderError(c, err)
		return
	}
	response.Success(c, http.StatusOK, result)
}

func (h *OrderHandler) Cancel(c *gin.Context) {
	userID := c.GetInt64("user_id")
	orderID := getInt64Param(c, "id")

	var req dto.OrderCancelRequest
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	result, err := h.svc.CancelOrder(c.Request.Context(), userID, orderID, req.Reason)
	if err != nil {
		h.handleOrderError(c, err)
		return
	}
	response.Success(c, http.StatusOK, result)
}

func (h *OrderHandler) handleOrderError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrOrderNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	case errors.Is(err, service.ErrOrderForbidden):
		response.Error(c, http.StatusForbidden, err.Error())
	case errors.Is(err, service.ErrOrderInvalidStatus):
		response.Error(c, http.StatusBadRequest, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, fmt.Sprintf("订单操作失败: %v", err))
	}
}
