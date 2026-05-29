package integration

import (
	"context"
	"database/sql"
	"errors"
	"net/http/httptest"
	"testing"
	"time"

	"douyin-live/backend/internal/repository"
	"douyin-live/backend/internal/service"
)

func TestOrderBuyerCanConfirmAndPayWithoutWalletMutation(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, userID := registerAuctionUser(t, ts)
	orderID := createSettledOrderViaCeilingBid(t, db, ts, merchantToken, userToken, 20)

	balanceBefore, frozenBefore := readUserWallet(t, db, userID)

	orderSvc := service.NewOrderService(repository.NewOrderRepo(db))
	confirmed, err := orderSvc.ConfirmOrder(context.Background(), userID, orderID)
	if err != nil {
		t.Fatalf("confirm order: %v", err)
	}
	if confirmed.Status != "pending_payment" || confirmed.ConfirmedAt == nil {
		t.Fatalf("expected pending_payment with confirmed_at, got status=%s confirmed_at=%v", confirmed.Status, confirmed.ConfirmedAt)
	}
	assertWallet(t, db, userID, balanceBefore, frozenBefore)

	paid, err := orderSvc.PayOrder(context.Background(), userID, orderID)
	if err != nil {
		t.Fatalf("pay order: %v", err)
	}
	if paid.Status != "paid" || paid.PaidAt == nil {
		t.Fatalf("expected paid with paid_at, got status=%s paid_at=%v", paid.Status, paid.PaidAt)
	}
	assertWallet(t, db, userID, balanceBefore, frozenBefore)
}

func TestOrderBuyerCanCancelPendingConfirmAndRefundOnce(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, userID := registerAuctionUser(t, ts)
	orderID := createSettledOrderViaCeilingBid(t, db, ts, merchantToken, userToken, 20)

	assertWallet(t, db, userID, 999980, 0)

	orderSvc := service.NewOrderService(repository.NewOrderRepo(db))
	cancelled, err := orderSvc.CancelOrder(context.Background(), userID, orderID, "")
	if err != nil {
		t.Fatalf("cancel order: %v", err)
	}
	if cancelled.Status != "cancelled" || cancelled.CancelReason != "buyer_cancelled" || cancelled.CancelledAt == nil {
		t.Fatalf("expected buyer cancelled order, got status=%s reason=%s cancelled_at=%v", cancelled.Status, cancelled.CancelReason, cancelled.CancelledAt)
	}
	assertWallet(t, db, userID, 1000000, 0)

	_, err = orderSvc.CancelOrder(context.Background(), userID, orderID, "")
	if !errors.Is(err, service.ErrOrderInvalidStatus) {
		t.Fatalf("expected invalid status on repeated cancel, got %v", err)
	}
	assertWallet(t, db, userID, 1000000, 0)
}

func TestOrderTimeoutCancelsAndRefundsOnce(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, userID := registerAuctionUser(t, ts)
	orderID := createSettledOrderViaCeilingBid(t, db, ts, merchantToken, userToken, 20)

	if _, err := db.Exec("UPDATE orders SET created_at = NOW() WHERE status = 'pending_confirm'"); err != nil {
		t.Fatalf("normalize pending orders: %v", err)
	}
	if _, err := db.Exec("UPDATE orders SET created_at = DATE_SUB(NOW(), INTERVAL 31 MINUTE) WHERE id = ?", orderID); err != nil {
		t.Fatalf("age order: %v", err)
	}

	orderSvc := service.NewOrderService(repository.NewOrderRepo(db))
	expired, err := orderSvc.ExpirePendingConfirmOrders(context.Background(), time.Now())
	if err != nil {
		t.Fatalf("expire pending orders: %v", err)
	}
	if expired != 1 {
		t.Fatalf("expected one expired order, got %d", expired)
	}

	var status, reason string
	var cancelledSet bool
	if err := db.QueryRow("SELECT status, cancel_reason, cancelled_at IS NOT NULL FROM orders WHERE id = ?", orderID).Scan(&status, &reason, &cancelledSet); err != nil {
		t.Fatalf("query expired order: %v", err)
	}
	if status != "cancelled" || reason != "confirm_timeout" || !cancelledSet {
		t.Fatalf("expected timeout cancellation, got status=%s reason=%s cancelled=%v", status, reason, cancelledSet)
	}
	assertWallet(t, db, userID, 1000000, 0)

	expired, err = orderSvc.ExpirePendingConfirmOrders(context.Background(), time.Now())
	if err != nil {
		t.Fatalf("expire pending orders again: %v", err)
	}
	if expired != 0 {
		t.Fatalf("expected no repeated expiration, got %d", expired)
	}
	assertWallet(t, db, userID, 1000000, 0)
}

func TestOrderRejectsWrongBuyerAndWrongStatusTransitions(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, userID := registerAuctionUser(t, ts)
	_, otherUserID := registerAuctionUser(t, ts)
	orderID := createSettledOrderViaCeilingBid(t, db, ts, merchantToken, userToken, 20)

	orderSvc := service.NewOrderService(repository.NewOrderRepo(db))
	if _, err := orderSvc.ConfirmOrder(context.Background(), otherUserID, orderID); !errors.Is(err, service.ErrOrderForbidden) {
		t.Fatalf("expected forbidden for wrong buyer, got %v", err)
	}
	if _, err := orderSvc.PayOrder(context.Background(), userID, orderID); !errors.Is(err, service.ErrOrderInvalidStatus) {
		t.Fatalf("expected invalid status for pay before confirm, got %v", err)
	}

	if _, err := orderSvc.ConfirmOrder(context.Background(), userID, orderID); err != nil {
		t.Fatalf("confirm order: %v", err)
	}
	if _, err := orderSvc.ConfirmOrder(context.Background(), userID, orderID); !errors.Is(err, service.ErrOrderInvalidStatus) {
		t.Fatalf("expected invalid status for repeated confirm, got %v", err)
	}
	if _, err := orderSvc.CancelOrder(context.Background(), userID, orderID, "changed mind"); !errors.Is(err, service.ErrOrderInvalidStatus) {
		t.Fatalf("expected invalid status for cancel after confirm, got %v", err)
	}
}

func createSettledOrderViaCeilingBid(t *testing.T, db *sql.DB, ts *httptest.Server, merchantToken, userToken string, amount float64) int64 {
	t.Helper()

	ceiling := amount
	_, auctionID := publishAuction(t, ts, merchantToken, &ceiling)
	activateAuction(t, db, auctionID)
	placeBid(t, ts, auctionID, userToken, amount)

	var orderID int64
	if err := db.QueryRow("SELECT id FROM orders WHERE auction_id = ?", auctionID).Scan(&orderID); err != nil {
		t.Fatalf("query settled order: %v", err)
	}
	return orderID
}

func readUserWallet(t *testing.T, db *sql.DB, userID int64) (float64, float64) {
	t.Helper()

	var balance, frozen float64
	if err := db.QueryRow("SELECT balance, frozen_amount FROM users WHERE id = ?", userID).Scan(&balance, &frozen); err != nil {
		t.Fatalf("query wallet: %v", err)
	}
	return balance, frozen
}

func assertWallet(t *testing.T, db *sql.DB, userID int64, wantBalance, wantFrozen float64) {
	t.Helper()

	balance, frozen := readUserWallet(t, db, userID)
	if balance != wantBalance || frozen != wantFrozen {
		t.Fatalf("expected wallet %.2f/%.2f, got %.2f/%.2f", wantBalance, wantFrozen, balance, frozen)
	}
}
