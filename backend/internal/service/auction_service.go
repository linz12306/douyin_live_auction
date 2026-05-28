package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"time"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/model"
	"douyin-live/backend/internal/repository"

	"github.com/redis/go-redis/v9"
)

var (
	ErrAuctionNotFound      = errors.New("竞拍不存在")
	ErrAuctionNotActive     = errors.New("竞拍未进行中")
	ErrBidTooLow            = errors.New("出价未达到最低加价要求")
	ErrMerchantCannotBid    = errors.New("商家账号不能出价")
	ErrAuctionLockBusy      = errors.New("竞拍繁忙，请稍后重试")
	ErrAuctionAlreadyClosed = errors.New("竞拍已结束")
)

type AuctionService struct {
	repo  *repository.AuctionEngineRepo
	redis *redis.Client
}

func NewAuctionService(repo *repository.AuctionEngineRepo, redis *redis.Client) *AuctionService {
	return &AuctionService{repo: repo, redis: redis}
}

func (s *AuctionService) PlaceBid(ctx context.Context, userID int64, role string, auctionID int64, req *dto.PlaceBidRequest) (*dto.PlaceBidResponse, error) {
	if role != "user" {
		return nil, ErrMerchantCannotBid
	}

	unlock, err := s.acquireBidLock(ctx, auctionID)
	if err != nil {
		return nil, err
	}
	defer unlock()

	now := time.Now()
	result := &dto.PlaceBidResponse{AuctionID: auctionID}

	err = s.repo.WithTx(ctx, func(tx *sql.Tx) error {
		auction, err := s.repo.FindAuctionForUpdate(ctx, tx, auctionID)
		if err != nil {
			return err
		}
		if auction == nil {
			return ErrAuctionNotFound
		}
		if auction.Status != "active" {
			return ErrAuctionNotActive
		}
		if auction.EndedAt != nil && !auction.EndedAt.After(now) {
			return ErrAuctionAlreadyClosed
		}

		currentBase := auction.CurrentPrice
		if currentBase <= 0 {
			currentBase = auction.StartPrice
		}
		minBid := currentBase + calculateIncrement(currentBase, auction.BidIncrementType, auction.BidIncrementValue)
		if req.Amount+0.000001 < minBid {
			return fmt.Errorf("%w: 最低出价 %.2f", ErrBidTooLow, minBid)
		}

		previousBid, err := s.repo.FindActiveBidForUpdate(ctx, tx, auctionID)
		if err != nil {
			return err
		}

		if err := s.repo.FreezeUserBalance(ctx, tx, userID, req.Amount); err != nil {
			return err
		}
		if err := s.repo.InsertAuditLog(ctx, tx, auctionID, userID, "wallet_freeze", fmt.Sprintf(`{"amount":%.2f}`, req.Amount)); err != nil {
			return err
		}

		if previousBid != nil {
			if err := s.repo.MarkBidStatus(ctx, tx, previousBid.ID, "outbid"); err != nil {
				return err
			}
			if err := s.repo.UnfreezeUserBalance(ctx, tx, previousBid.UserID, previousBid.Amount); err != nil {
				return err
			}
			if err := s.repo.InsertAuditLog(ctx, tx, auctionID, previousBid.UserID, "wallet_unfreeze", fmt.Sprintf(`{"bid_id":%d,"amount":%.2f}`, previousBid.ID, previousBid.Amount)); err != nil {
				return err
			}
		}

		bid := &model.Bid{AuctionID: auctionID, UserID: userID, Amount: req.Amount, Status: "active"}
		if err := s.repo.CreateBid(ctx, tx, bid); err != nil {
			return err
		}

		extended, nextEndAt := shouldExtendAuction(auction, now)
		if err := s.repo.UpdateAuctionBidState(ctx, tx, auctionID, userID, req.Amount, extended, nextEndAt); err != nil {
			return err
		}
		if err := s.repo.InsertAuditLog(ctx, tx, auctionID, userID, "bid_placed", fmt.Sprintf(`{"bid_id":%d,"amount":%.2f}`, bid.ID, req.Amount)); err != nil {
			return err
		}
		if extended {
			if err := s.repo.InsertAuditLog(ctx, tx, auctionID, userID, "soft_close_extended", fmt.Sprintf(`{"bid_id":%d}`, bid.ID)); err != nil {
				return err
			}
		}

		settled := auction.CeilingPrice != nil && req.Amount+0.000001 >= *auction.CeilingPrice
		var orderID *int64
		if settled {
			if err := s.repo.MarkBidStatus(ctx, tx, bid.ID, "won"); err != nil {
				return err
			}
			if err := s.repo.SetAuctionSold(ctx, tx, auctionID, now); err != nil {
				return err
			}
			if err := s.repo.DeductFrozenBalance(ctx, tx, userID, req.Amount); err != nil {
				return err
			}
			order := &model.Order{
				AuctionID:  auctionID,
				ProductID:  auction.ProductID,
				MerchantID: auction.MerchantID,
				BuyerID:    userID,
				Amount:     req.Amount,
			}
			if err := s.repo.CreateOrder(ctx, tx, order); err != nil {
				return err
			}
			orderID = &order.ID
			if err := s.repo.InsertAuditLog(ctx, tx, auctionID, userID, "settled_ceiling", fmt.Sprintf(`{"bid_id":%d,"order_id":%d,"amount":%.2f}`, bid.ID, order.ID, req.Amount)); err != nil {
				return err
			}
		}

		result.BidID = bid.ID
		result.Amount = req.Amount
		result.CurrentPrice = req.Amount
		result.HighestBidderID = userID
		result.Status = auction.Status
		if settled {
			result.Status = "ended_sold"
		}
		result.Extended = extended
		result.Settled = settled
		result.OrderID = orderID
		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *AuctionService) Rankings(ctx context.Context, auctionID int64) (*dto.RankingResponse, error) {
	items, err := s.repo.ListRankings(ctx, auctionID, 50)
	if err != nil {
		return nil, err
	}
	return &dto.RankingResponse{AuctionID: auctionID, Items: items}, nil
}

func (s *AuctionService) acquireBidLock(ctx context.Context, auctionID int64) (func(), error) {
	if s.redis == nil {
		return func() {}, nil
	}
	key := fmt.Sprintf("auction:%d:bid_lock", auctionID)
	value := fmt.Sprintf("%d", time.Now().UnixNano())
	ok, err := s.redis.SetNX(ctx, key, value, 5*time.Second).Result()
	if err != nil {
		return func() {}, nil
	}
	if !ok {
		return nil, ErrAuctionLockBusy
	}
	return func() { _ = s.redis.Del(context.Background(), key).Err() }, nil
}

func calculateIncrement(current float64, incrementType string, value float64) float64 {
	if incrementType == "percent" {
		return math.Ceil(current*value/100*100) / 100
	}
	return value
}

func shouldExtendAuction(auction *model.Auction, now time.Time) (bool, *time.Time) {
	if auction.EndedAt == nil || auction.AutoExtendSeconds <= 0 {
		return false, nil
	}
	if auction.CurrentExtendCount >= auction.MaxExtendCount {
		return false, nil
	}
	remaining := auction.EndedAt.Sub(now)
	window := time.Duration(auction.AutoExtendSeconds) * time.Second
	if remaining > window {
		return false, nil
	}
	next := now.Add(window)
	return true, &next
}
