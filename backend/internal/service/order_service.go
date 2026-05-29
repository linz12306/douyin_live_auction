package service

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/repository"
)

var (
	ErrOrderNotFound      = errors.New("订单不存在")
	ErrOrderForbidden     = errors.New("无权操作此订单")
	ErrOrderInvalidStatus = errors.New("当前订单状态不允许此操作")
)

const OrderConfirmTimeout = 30 * time.Minute

type OrderService struct {
	repo *repository.OrderRepo
}

func NewOrderService(repo *repository.OrderRepo) *OrderService {
	return &OrderService{repo: repo}
}

func (s *OrderService) ListOrders(ctx context.Context, userID int64, role string, query *dto.OrderListQuery) (*dto.OrderListResponse, error) {
	if query == nil {
		query = &dto.OrderListQuery{}
	}
	normalizeOrderListQuery(query)

	var rows []repository.OrderRow
	var total int
	var err error
	switch role {
	case "user":
		rows, total, err = s.repo.ListForUser(ctx, userID, query.Status, query.Page, query.Size)
	case "merchant":
		rows, total, err = s.repo.ListForMerchant(ctx, userID, query.Status, query.Page, query.Size)
	default:
		return nil, ErrOrderForbidden
	}
	if err != nil {
		return nil, err
	}

	items := make([]dto.OrderListItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, toOrderListItem(row, role))
	}
	return &dto.OrderListResponse{Items: items, Total: total, Page: query.Page, Size: query.Size}, nil
}

func (s *OrderService) GetOrder(ctx context.Context, userID int64, role string, orderID int64) (*dto.OrderDetailResponse, error) {
	row, err := s.repo.FindByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, ErrOrderNotFound
	}
	if !canViewOrder(*row, userID, role) {
		return nil, ErrOrderForbidden
	}
	return toOrderDetail(*row, role), nil
}

func (s *OrderService) ConfirmOrder(ctx context.Context, userID int64, orderID int64) (*dto.OrderDetailResponse, error) {
	if err := s.repo.WithTx(ctx, func(tx *sql.Tx) error {
		row, err := s.repo.FindByIDForUpdate(ctx, tx, orderID)
		if err != nil {
			return err
		}
		if row == nil {
			return ErrOrderNotFound
		}
		if row.BuyerID != userID {
			return ErrOrderForbidden
		}
		if row.Status != "pending_confirm" || time.Now().After(confirmDeadline(row.CreatedAt)) {
			return ErrOrderInvalidStatus
		}
		if err := s.repo.Confirm(ctx, tx, orderID, time.Now()); err != nil {
			return ErrOrderInvalidStatus
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return s.GetOrder(ctx, userID, "user", orderID)
}

func (s *OrderService) PayOrder(ctx context.Context, userID int64, orderID int64) (*dto.OrderDetailResponse, error) {
	if err := s.repo.WithTx(ctx, func(tx *sql.Tx) error {
		row, err := s.repo.FindByIDForUpdate(ctx, tx, orderID)
		if err != nil {
			return err
		}
		if row == nil {
			return ErrOrderNotFound
		}
		if row.BuyerID != userID {
			return ErrOrderForbidden
		}
		if row.Status != "pending_payment" {
			return ErrOrderInvalidStatus
		}
		if err := s.repo.Pay(ctx, tx, orderID, time.Now()); err != nil {
			return ErrOrderInvalidStatus
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return s.GetOrder(ctx, userID, "user", orderID)
}

func (s *OrderService) CancelOrder(ctx context.Context, userID int64, orderID int64, reason string) (*dto.OrderDetailResponse, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		reason = "buyer_cancelled"
	}
	if len(reason) > 500 {
		reason = reason[:500]
	}

	if err := s.repo.WithTx(ctx, func(tx *sql.Tx) error {
		row, err := s.repo.FindByIDForUpdate(ctx, tx, orderID)
		if err != nil {
			return err
		}
		if row == nil {
			return ErrOrderNotFound
		}
		if row.BuyerID != userID {
			return ErrOrderForbidden
		}
		if row.Status != "pending_confirm" {
			return ErrOrderInvalidStatus
		}
		now := time.Now()
		if err := s.repo.Cancel(ctx, tx, orderID, reason, now); err != nil {
			return ErrOrderInvalidStatus
		}
		return s.repo.RefundBuyer(ctx, tx, row.BuyerID, row.Amount)
	}); err != nil {
		return nil, err
	}
	return s.GetOrder(ctx, userID, "user", orderID)
}

func (s *OrderService) ExpirePendingConfirmOrders(ctx context.Context, now time.Time) (int, error) {
	expired := 0
	deadline := now.Add(-OrderConfirmTimeout)
	err := s.repo.WithTx(ctx, func(tx *sql.Tx) error {
		ids, err := s.repo.ListExpiredPendingConfirmIDs(ctx, tx, deadline, 100)
		if err != nil {
			return err
		}
		for _, orderID := range ids {
			row, err := s.repo.FindByIDForUpdate(ctx, tx, orderID)
			if err != nil {
				return err
			}
			if row == nil || row.Status != "pending_confirm" {
				continue
			}
			if err := s.repo.Cancel(ctx, tx, orderID, "confirm_timeout", now); err != nil {
				return err
			}
			if err := s.repo.RefundBuyer(ctx, tx, row.BuyerID, row.Amount); err != nil {
				return err
			}
			expired++
		}
		return nil
	})
	return expired, err
}

func normalizeOrderListQuery(query *dto.OrderListQuery) {
	query.Status = strings.TrimSpace(query.Status)
	if query.Page <= 0 {
		query.Page = 1
	}
	if query.Size <= 0 || query.Size > 50 {
		query.Size = 20
	}
}

func canViewOrder(row repository.OrderRow, userID int64, role string) bool {
	switch role {
	case "user":
		return row.BuyerID == userID
	case "merchant":
		return row.MerchantID == userID
	default:
		return false
	}
}

func toOrderDetail(row repository.OrderRow, role string) *dto.OrderDetailResponse {
	item := toOrderListItem(row, role)
	return &dto.OrderDetailResponse{
		OrderListItem:      item,
		ProductDescription: row.ProductDescription,
	}
}

func toOrderListItem(row repository.OrderRow, role string) dto.OrderListItem {
	var deadline *time.Time
	if row.Status == "pending_confirm" {
		value := confirmDeadline(row.CreatedAt)
		deadline = &value
	}

	return dto.OrderListItem{
		ID:              row.ID,
		AuctionID:       row.AuctionID,
		ProductID:       row.ProductID,
		MerchantID:      row.MerchantID,
		BuyerID:         row.BuyerID,
		ProductTitle:    row.ProductTitle,
		ProductImageURL: row.ProductImageURL,
		BuyerName:       row.BuyerDisplayName,
		BuyerAvatarURL:  row.BuyerAvatarURL,
		Amount:          row.Amount,
		Status:          row.Status,
		CancelReason:    row.CancelReason,
		ConfirmDeadline: deadline,
		CreatedAt:       row.CreatedAt,
		UpdatedAt:       row.UpdatedAt,
		ConfirmedAt:     row.ConfirmedAt,
		PaidAt:          row.PaidAt,
		CancelledAt:     row.CancelledAt,
		Actions:         availableOrderActions(row.Status, role),
	}
}

func availableOrderActions(status, role string) dto.OrderAvailableActions {
	if role != "user" {
		return dto.OrderAvailableActions{}
	}
	return dto.OrderAvailableActions{
		CanConfirm: status == "pending_confirm",
		CanPay:     status == "pending_payment",
		CanCancel:  status == "pending_confirm",
	}
}

func confirmDeadline(createdAt time.Time) time.Time {
	return createdAt.Add(OrderConfirmTimeout)
}
