package service

import (
	"context"
	"time"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/repository"
)

type MerchantDashboardService struct {
	repo *repository.MerchantDashboardRepo
}

var productDashboardStatuses = []string{"draft", "pending", "active", "ended_sold", "ended_no_bid", "cancelled"}
var orderDashboardStatuses = []string{"pending_confirm", "pending_payment", "paid", "cancelled"}

const dashboardAnalyticsDays = 7

type dashboardBidBucket struct {
	bucket    string
	minAmount float64
	maxAmount *float64
}

var dashboardBidBuckets = []dashboardBidBucket{
	{bucket: "0-99", minAmount: 0, maxAmount: floatPointer(99)},
	{bucket: "100-499", minAmount: 100, maxAmount: floatPointer(499)},
	{bucket: "500-999", minAmount: 500, maxAmount: floatPointer(999)},
	{bucket: "1000-4999", minAmount: 1000, maxAmount: floatPointer(4999)},
	{bucket: "5000+", minAmount: 5000, maxAmount: nil},
}

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
	transactionTrend, err := s.repo.TransactionTrend(ctx, merchantID, dashboardAnalyticsDays)
	if err != nil {
		return nil, err
	}
	bidDistribution, err := s.repo.BidDistribution(ctx, merchantID)
	if err != nil {
		return nil, err
	}
	userActivity, err := s.repo.UserActivity(ctx, merchantID, dashboardAnalyticsDays)
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
		Analytics: dto.DashboardAnalytics{
			TransactionTrend: toDashboardTransactionTrend(transactionTrend, dashboardAnalyticsDays),
			BidDistribution:  toDashboardBidDistribution(bidDistribution),
			UserActivity:     toDashboardUserActivity(userActivity, dashboardAnalyticsDays),
		},
	}, nil
}

func floatPointer(value float64) *float64 {
	return &value
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

func lastDashboardDateLabels(days int) []string {
	if days <= 0 {
		days = dashboardAnalyticsDays
	}
	start := time.Now().UTC().AddDate(0, 0, -days+1)
	labels := make([]string, 0, days)
	for i := 0; i < days; i++ {
		labels = append(labels, start.AddDate(0, 0, i).Format("2006-01-02"))
	}
	return labels
}

func toDashboardTransactionTrend(rows []repository.DashboardTransactionTrendRow, days int) []dto.DashboardTransactionTrendPoint {
	byDate := make(map[string]repository.DashboardTransactionTrendRow, len(rows))
	for _, row := range rows {
		byDate[row.Date] = row
	}

	points := make([]dto.DashboardTransactionTrendPoint, 0, days)
	for _, label := range lastDashboardDateLabels(days) {
		row := byDate[label]
		points = append(points, dto.DashboardTransactionTrendPoint{
			Date:           label,
			PaidAmount:     row.PaidAmount,
			PaidOrderCount: row.PaidOrderCount,
		})
	}
	return points
}

func toDashboardBidDistribution(rows []repository.DashboardBidDistributionRow) []dto.DashboardBidDistributionBucket {
	byBucket := make(map[string]int, len(rows))
	for _, row := range rows {
		byBucket[row.Bucket] = row.BidCount
	}

	buckets := make([]dto.DashboardBidDistributionBucket, 0, len(dashboardBidBuckets))
	for _, bucket := range dashboardBidBuckets {
		buckets = append(buckets, dto.DashboardBidDistributionBucket{
			Bucket:    bucket.bucket,
			MinAmount: bucket.minAmount,
			MaxAmount: bucket.maxAmount,
			BidCount:  byBucket[bucket.bucket],
		})
	}
	return buckets
}

func toDashboardUserActivity(rows []repository.DashboardUserActivityRow, days int) []dto.DashboardUserActivityPoint {
	byDate := make(map[string]repository.DashboardUserActivityRow, len(rows))
	for _, row := range rows {
		byDate[row.Date] = row
	}

	points := make([]dto.DashboardUserActivityPoint, 0, days)
	for _, label := range lastDashboardDateLabels(days) {
		row := byDate[label]
		points = append(points, dto.DashboardUserActivityPoint{
			Date:            label,
			ActiveUserCount: row.ActiveUserCount,
			BidCount:        row.BidCount,
		})
	}
	return points
}
