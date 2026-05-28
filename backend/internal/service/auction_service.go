package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	"douyin-live/backend/internal/dto"
	"douyin-live/backend/internal/model"
	"douyin-live/backend/internal/realtime"
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
	ErrCancelBlocked        = errors.New("最后出价后30秒内不可取消")
	ErrCancelReasonRequired = errors.New("取消原因不能为空")
)

type AuctionService struct {
	repo     *repository.AuctionEngineRepo
	redis    *redis.Client
	eventBus realtime.AuctionEventBus
}

func NewAuctionService(repo *repository.AuctionEngineRepo, redis *redis.Client) *AuctionService {
	return NewAuctionServiceWithEvents(repo, redis, realtime.NewNoopAuctionEventBus())
}

func NewAuctionServiceWithEvents(repo *repository.AuctionEngineRepo, redis *redis.Client, bus realtime.AuctionEventBus) *AuctionService {
	if bus == nil {
		bus = realtime.NewNoopAuctionEventBus()
	}
	return &AuctionService{repo: repo, redis: redis, eventBus: bus}
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
	var events []realtime.AuctionEvent

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
			if err := s.repo.SetAuctionSold(ctx, tx, auctionID, auction.ProductID, now); err != nil {
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

		bidEventVersion := int64(auction.Version) + 1
		events = append(events, realtime.AuctionEvent{
			Type:       realtime.EventBidAccepted,
			AuctionID:  auctionID,
			Version:    bidEventVersion,
			UserID:     userID,
			Amount:     req.Amount,
			OccurredAt: now,
		})
		if previousBid != nil {
			previousUserID := previousBid.UserID
			events = append(events, realtime.AuctionEvent{
				Type:           realtime.EventBidOutbid,
				AuctionID:      auctionID,
				Version:        bidEventVersion,
				UserID:         userID,
				PreviousUserID: &previousUserID,
				Amount:         req.Amount,
				PreviousAmount: previousBid.Amount,
				OccurredAt:     now,
			})
		}
		if extended && !settled && nextEndAt != nil {
			committedEndAt := nextEndAt.Round(time.Second)
			events = append(events, realtime.AuctionEvent{
				Type:        realtime.EventAuctionExtended,
				AuctionID:   auctionID,
				Version:     bidEventVersion,
				EndedAt:     &committedEndAt,
				ExtendCount: auction.CurrentExtendCount + 1,
				OccurredAt:  now,
			})
		}
		if settled {
			events = append(events, realtime.AuctionEvent{
				Type:       realtime.EventAuctionEnded,
				AuctionID:  auctionID,
				Version:    bidEventVersion + 1,
				UserID:     userID,
				Amount:     req.Amount,
				Status:     "ended_sold",
				OccurredAt: now,
			})
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

	s.publishAuctionEvents(ctx, events)
	return result, nil
}

func (s *AuctionService) Rankings(ctx context.Context, auctionID int64) (*dto.RankingResponse, error) {
	items, err := s.repo.ListRankings(ctx, auctionID, 50)
	if err != nil {
		return nil, err
	}
	return &dto.RankingResponse{AuctionID: auctionID, Items: items}, nil
}

func (s *AuctionService) Activate(ctx context.Context, merchantID, auctionID int64) error {
	now := time.Now()
	return s.repo.WithTx(ctx, func(tx *sql.Tx) error {
		auction, err := s.repo.FindAuctionForUpdate(ctx, tx, auctionID)
		if err != nil {
			return err
		}
		if auction == nil {
			return ErrAuctionNotFound
		}
		if auction.MerchantID != merchantID {
			return ErrNotOwner
		}
		if auction.Status != "pending" {
			return ErrStatusImmutable
		}

		endedAt := now.Add(time.Duration(auction.DurationSeconds) * time.Second)
		if err := s.repo.ActivateAuction(ctx, tx, auctionID, auction.ProductID, now, endedAt); err != nil {
			return err
		}
		return s.repo.InsertAuditLog(ctx, tx, auctionID, merchantID, "activated", mustJSON(map[string]interface{}{
			"started_at": now.Format(time.RFC3339),
			"ended_at":   endedAt.Format(time.RFC3339),
		}))
	})
}

func (s *AuctionService) SettleExpired(ctx context.Context) (int, error) {
	now := time.Now()
	settled := 0
	var events []realtime.AuctionEvent
	err := s.repo.WithTx(ctx, func(tx *sql.Tx) error {
		auctionIDs, err := s.repo.ListExpiredActiveAuctionIDs(ctx, tx, now)
		if err != nil {
			return err
		}

		for _, auctionID := range auctionIDs {
			auction, err := s.repo.FindAuctionForUpdate(ctx, tx, auctionID)
			if err != nil {
				return err
			}
			if auction == nil || auction.Status != "active" {
				continue
			}

			activeBid, err := s.repo.FindActiveBidForUpdate(ctx, tx, auctionID)
			if err != nil {
				return err
			}
			if activeBid == nil {
				if err := s.repo.SetAuctionNoBid(ctx, tx, auctionID, auction.ProductID, now); err != nil {
					return err
				}
				if err := s.repo.InsertAuditLog(ctx, tx, auctionID, auction.MerchantID, "settled_no_bid", mustJSON(map[string]interface{}{
					"ended_at": now.Format(time.RFC3339),
				})); err != nil {
					return err
				}
				events = append(events, realtime.AuctionEvent{
					Type:       realtime.EventAuctionEnded,
					AuctionID:  auctionID,
					Version:    int64(auction.Version) + 1,
					Status:     "ended_no_bid",
					OccurredAt: now,
				})
				settled++
				continue
			}

			if err := s.repo.MarkBidStatus(ctx, tx, activeBid.ID, "won"); err != nil {
				return err
			}
			if err := s.repo.SetAuctionSold(ctx, tx, auctionID, auction.ProductID, now); err != nil {
				return err
			}
			if err := s.repo.DeductFrozenBalance(ctx, tx, activeBid.UserID, activeBid.Amount); err != nil {
				return err
			}
			order := &model.Order{
				AuctionID:  auctionID,
				ProductID:  auction.ProductID,
				MerchantID: auction.MerchantID,
				BuyerID:    activeBid.UserID,
				Amount:     activeBid.Amount,
			}
			if err := s.repo.CreateOrder(ctx, tx, order); err != nil {
				return err
			}
			if err := s.repo.InsertAuditLog(ctx, tx, auctionID, activeBid.UserID, "settled_time", mustJSON(map[string]interface{}{
				"bid_id":   activeBid.ID,
				"order_id": order.ID,
				"amount":   activeBid.Amount,
			})); err != nil {
				return err
			}
			events = append(events, realtime.AuctionEvent{
				Type:       realtime.EventAuctionEnded,
				AuctionID:  auctionID,
				Version:    int64(auction.Version) + 1,
				UserID:     activeBid.UserID,
				Amount:     activeBid.Amount,
				Status:     "ended_sold",
				OccurredAt: now,
			})
			settled++
		}
		return nil
	})
	if err != nil {
		return settled, err
	}
	s.publishAuctionEvents(ctx, events)
	return settled, nil
}

func (s *AuctionService) Cancel(ctx context.Context, merchantID, auctionID int64, reason string) error {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return ErrCancelReasonRequired
	}
	if len(reason) > 500 {
		return fmt.Errorf("%w: 取消原因不能超过500字符", ErrCancelReasonRequired)
	}

	now := time.Now()
	var events []realtime.AuctionEvent
	err := s.repo.WithTx(ctx, func(tx *sql.Tx) error {
		auction, err := s.repo.FindAuctionForUpdate(ctx, tx, auctionID)
		if err != nil {
			return err
		}
		if auction == nil {
			return ErrAuctionNotFound
		}
		if auction.MerchantID != merchantID {
			return ErrNotOwner
		}

		switch auction.Status {
		case "pending":
		case "active":
			latestBid, err := s.repo.FindLatestBidForUpdate(ctx, tx, auctionID)
			if err != nil {
				return err
			}
			if latestBid != nil && now.Sub(latestBid.CreatedAt) < 30*time.Second {
				return ErrCancelBlocked
			}

			activeBids, err := s.repo.ListActiveBidsForUpdate(ctx, tx, auctionID)
			if err != nil {
				return err
			}
			for _, bid := range activeBids {
				if err := s.repo.UnfreezeUserBalance(ctx, tx, bid.UserID, bid.Amount); err != nil {
					return err
				}
				if err := s.repo.InsertAuditLog(ctx, tx, auctionID, bid.UserID, "wallet_unfreeze", mustJSON(map[string]interface{}{
					"bid_id": bid.ID,
					"amount": bid.Amount,
					"reason": "auction_cancelled",
				})); err != nil {
					return err
				}
			}
			if err := s.repo.CancelAllBids(ctx, tx, auctionID); err != nil {
				return err
			}
		default:
			return ErrStatusImmutable
		}

		if err := s.repo.CancelAuction(ctx, tx, auctionID, auction.ProductID, reason, now); err != nil {
			return err
		}
		if err := s.repo.InsertAuditLog(ctx, tx, auctionID, merchantID, "cancelled", mustJSON(map[string]interface{}{
			"reason": reason,
			"status": auction.Status,
		})); err != nil {
			return err
		}
		events = append(events, realtime.AuctionEvent{
			Type:       realtime.EventAuctionCancelled,
			AuctionID:  auctionID,
			Version:    int64(auction.Version) + 1,
			Status:     "cancelled",
			OccurredAt: now,
		})
		return nil
	})
	if err != nil {
		return err
	}
	s.publishAuctionEvents(ctx, events)
	return nil
}

func (s *AuctionService) publishAuctionEvents(ctx context.Context, events []realtime.AuctionEvent) {
	for _, event := range events {
		if event.OccurredAt.IsZero() {
			event.OccurredAt = time.Now()
		}
		publishCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		err := s.eventBus.Publish(publishCtx, event)
		cancel()
		if err != nil {
			log.Printf("auction event publish failed: type=%s auction_id=%d version=%d: %v", event.Type, event.AuctionID, event.Version, err)
		}
	}
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

func mustJSON(value interface{}) string {
	payload, err := json.Marshal(value)
	if err != nil {
		return "{}"
	}
	return string(payload)
}
