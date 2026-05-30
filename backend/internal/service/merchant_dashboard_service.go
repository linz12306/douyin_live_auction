package service

import (
	"context"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/repository"
)

type MerchantDashboardService struct {
	repo *repository.MerchantDashboardRepo
}

var productDashboardStatuses = []string{"draft", "pending", "active", "ended_sold", "ended_no_bid", "cancelled"}
var orderDashboardStatuses = []string{"pending_confirm", "pending_payment", "paid", "cancelled"}

func NewMerchantDashboardService(repo *repository.MerchantDashboardRepo) *MerchantDashboardService {
	return &MerchantDashboardService{repo: repo}
}

func (s *MerchantDashboardService) GetDashboard(ctx context.Context, merchantID int64) (*dto.MerchantDashboardResponse, error) {
	productCounts, err := s.repo.ProductStatusCounts(ctx, merchantID)
	if err != nil {
		return nil, err
	}
	orderCounts, err := s.repo.OrderStatusCounts(ctx, merchantID)
	if err != nil {
		return nil, err
	}
	summary, err := s.repo.TransactionSummary(ctx, merchantID)
	if err != nil {
		return nil, err
	}
	activeAuctions, err := s.repo.ActiveAuctions(ctx, merchantID, 5)
	if err != nil {
		return nil, err
	}
	recentOrders, err := s.repo.RecentOrders(ctx, merchantID, 5)
	if err != nil {
		return nil, err
	}

	return &dto.MerchantDashboardResponse{
		ProductStatusCounts: normalizeDashboardCounts(productCounts, productDashboardStatuses),
		OrderStatusCounts:   normalizeDashboardCounts(orderCounts, orderDashboardStatuses),
		TransactionSummary: dto.DashboardTransactionSummary{
			TotalPaidAmount:  summary.TotalPaidAmount,
			PaidOrderCount:   summary.PaidOrderCount,
			AveragePaidPrice: summary.AveragePaidPrice,
		},
		ActiveAuctions: toDashboardActiveAuctions(activeAuctions),
		RecentOrders:   toDashboardRecentOrders(recentOrders),
	}, nil
}

func normalizeDashboardCounts(rows []repository.DashboardStatusCountRow, statuses []string) []dto.DashboardStatusCount {
	byStatus := make(map[string]int, len(rows))
	for _, row := range rows {
		byStatus[row.Status] = row.Count
	}

	counts := make([]dto.DashboardStatusCount, 0, len(statuses))
	for _, status := range statuses {
		counts = append(counts, dto.DashboardStatusCount{
			Status: status,
			Count:  byStatus[status],
		})
	}
	return counts
}

func toDashboardActiveAuctions(rows []repository.DashboardActiveAuctionRow) []dto.DashboardActiveAuction {
	items := make([]dto.DashboardActiveAuction, 0, len(rows))
	for _, row := range rows {
		items = append(items, dto.DashboardActiveAuction{
			AuctionID:       row.AuctionID,
			ProductID:       row.ProductID,
			ProductTitle:    row.ProductTitle,
			CurrentPrice:    row.CurrentPrice,
			HighestBidderID: row.HighestBidderID,
			BidCount:        row.BidCount,
			StartedAt:       row.StartedAt,
			EndedAt:         row.EndedAt,
		})
	}
	return items
}

func toDashboardRecentOrders(rows []repository.DashboardRecentOrderRow) []dto.DashboardRecentOrder {
	items := make([]dto.DashboardRecentOrder, 0, len(rows))
	for _, row := range rows {
		items = append(items, dto.DashboardRecentOrder{
			ID:              row.ID,
			AuctionID:       row.AuctionID,
			ProductID:       row.ProductID,
			ProductTitle:    row.ProductTitle,
			ProductImageURL: row.ProductImageURL,
			BuyerID:         row.BuyerID,
			BuyerName:       row.BuyerName,
			BuyerAvatarURL:  row.BuyerAvatarURL,
			Amount:          row.Amount,
			Status:          row.Status,
			CreatedAt:       row.CreatedAt,
			UpdatedAt:       row.UpdatedAt,
			ConfirmedAt:     row.ConfirmedAt,
			PaidAt:          row.PaidAt,
			CancelledAt:     row.CancelledAt,
		})
	}
	return items
}
