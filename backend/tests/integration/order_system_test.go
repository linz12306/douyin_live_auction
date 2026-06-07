package integration

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
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

	now := time.Now()
	if _, err := db.Exec("UPDATE orders SET created_at = ? WHERE status = 'pending_confirm'", now); err != nil {
		t.Fatalf("normalize pending orders: %v", err)
	}
	if _, err := db.Exec("UPDATE orders SET created_at = ? WHERE id = ?", now.Add(-31*time.Minute), orderID); err != nil {
		t.Fatalf("age order: %v", err)
	}

	orderSvc := service.NewOrderService(repository.NewOrderRepo(db))
	expired, err := orderSvc.ExpirePendingConfirmOrders(context.Background(), now)
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

func TestOrderAPIBuyerListsConfirmsPaysOrder(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, userID := registerAuctionUser(t, ts)
	orderID := createSettledOrderViaCeilingBid(t, db, ts, merchantToken, userToken, 20)
	balanceBefore, frozenBefore := readUserWallet(t, db, userID)

	listResp, err := makeRequest("GET", ts.URL+"/api/v1/orders?status=pending_confirm&page=1&size=20", userToken, nil)
	if err != nil {
		t.Fatalf("list buyer orders: %v", err)
	}
	defer listResp.Body.Close()
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("expected buyer order list 200, got %d", listResp.StatusCode)
	}
	listData := decodeAPIData(t, listResp)
	if !apiItemsContainOrderID(listData, orderID) {
		t.Fatalf("expected buyer list to include order %d, got %#v", orderID, listData)
	}

	detailResp, err := makeRequest("GET", ts.URL+fmt.Sprintf("/api/v1/orders/%d", orderID), userToken, nil)
	if err != nil {
		t.Fatalf("get buyer order detail: %v", err)
	}
	defer detailResp.Body.Close()
	if detailResp.StatusCode != http.StatusOK {
		t.Fatalf("expected buyer order detail 200, got %d", detailResp.StatusCode)
	}

	confirmResp, err := makeRequest("POST", ts.URL+fmt.Sprintf("/api/v1/orders/%d/confirm", orderID), userToken, nil)
	if err != nil {
		t.Fatalf("confirm order request: %v", err)
	}
	defer confirmResp.Body.Close()
	if confirmResp.StatusCode != http.StatusOK {
		t.Fatalf("expected confirm 200, got %d", confirmResp.StatusCode)
	}
	confirmData := decodeAPIData(t, confirmResp)
	if confirmData["status"] != "pending_payment" {
		t.Fatalf("expected pending_payment after confirm, got %#v", confirmData)
	}
	assertWallet(t, db, userID, balanceBefore, frozenBefore)

	payResp, err := makeRequest("POST", ts.URL+fmt.Sprintf("/api/v1/orders/%d/pay", orderID), userToken, nil)
	if err != nil {
		t.Fatalf("pay order request: %v", err)
	}
	defer payResp.Body.Close()
	if payResp.StatusCode != http.StatusOK {
		t.Fatalf("expected pay 200, got %d", payResp.StatusCode)
	}
	payData := decodeAPIData(t, payResp)
	if payData["status"] != "paid" {
		t.Fatalf("expected paid after pay, got %#v", payData)
	}
	assertWallet(t, db, userID, balanceBefore, frozenBefore)
}

func TestOrderAPIMerchantListsAndViewsOwnOrders(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, _ := registerAuctionUser(t, ts)
	orderID := createSettledOrderViaCeilingBid(t, db, ts, merchantToken, userToken, 20)

	listResp, err := makeRequest("GET", ts.URL+"/api/v1/orders?page=1&size=20", merchantToken, nil)
	if err != nil {
		t.Fatalf("list merchant orders: %v", err)
	}
	defer listResp.Body.Close()
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("expected merchant order list 200, got %d", listResp.StatusCode)
	}
	listData := decodeAPIData(t, listResp)
	if !apiItemsContainOrderID(listData, orderID) {
		t.Fatalf("expected merchant list to include order %d, got %#v", orderID, listData)
	}

	detailResp, err := makeRequest("GET", ts.URL+fmt.Sprintf("/api/v1/orders/%d", orderID), merchantToken, nil)
	if err != nil {
		t.Fatalf("get merchant order detail: %v", err)
	}
	defer detailResp.Body.Close()
	if detailResp.StatusCode != http.StatusOK {
		t.Fatalf("expected merchant detail 200, got %d", detailResp.StatusCode)
	}
	detailData := decodeAPIData(t, detailResp)
	actions, ok := detailData["actions"].(map[string]interface{})
	if !ok || actions["can_confirm"] != false || actions["can_pay"] != false || actions["can_cancel"] != false {
		t.Fatalf("expected merchant detail without buyer actions, got %#v", detailData)
	}
}

func TestOrderAPIUsesProductImageWhenLiveMediaExists(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, _ := registerAuctionUser(t, ts)
	ceiling := float64(20)
	productID, auctionID := publishAuction(t, ts, merchantToken, &ceiling)
	if _, err := db.Exec(
		`INSERT INTO product_live_media (product_id, media_type, media_url, poster_url)
		 VALUES (?, 'image', '/static/live-media/order-room.webp', NULL)`,
		productID,
	); err != nil {
		t.Fatalf("insert live media: %v", err)
	}
	activateAuction(t, db, auctionID)
	placeBid(t, ts, auctionID, userToken, 20)

	var orderID int64
	if err := db.QueryRow("SELECT id FROM orders WHERE auction_id = ?", auctionID).Scan(&orderID); err != nil {
		t.Fatalf("query settled order: %v", err)
	}

	listResp, err := makeRequest("GET", ts.URL+"/api/v1/orders?page=1&size=20", userToken, nil)
	if err != nil {
		t.Fatalf("list buyer orders: %v", err)
	}
	defer listResp.Body.Close()
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("expected buyer order list 200, got %d", listResp.StatusCode)
	}
	listItem := apiItemForOrderID(decodeAPIData(t, listResp), orderID)
	if listItem["product_image_url"] != "/static/images/test.jpg" {
		t.Fatalf("expected order list product image, got %#v", listItem["product_image_url"])
	}

	detailResp, err := makeRequest("GET", ts.URL+fmt.Sprintf("/api/v1/orders/%d", orderID), userToken, nil)
	if err != nil {
		t.Fatalf("get buyer order detail: %v", err)
	}
	defer detailResp.Body.Close()
	if detailResp.StatusCode != http.StatusOK {
		t.Fatalf("expected buyer order detail 200, got %d", detailResp.StatusCode)
	}
	detailData := decodeAPIData(t, detailResp)
	if detailData["product_image_url"] != "/static/images/test.jpg" {
		t.Fatalf("expected order detail product image, got %#v", detailData["product_image_url"])
	}
}

func TestOrderAPIScopesOrdersByRole(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, _ := registerAuctionUser(t, ts)
	otherUserToken, _ := registerAuctionUser(t, ts)
	otherMerchantToken := registerAuctionMerchant(t, ts)
	orderID := createSettledOrderViaCeilingBid(t, db, ts, merchantToken, userToken, 20)

	wrongBuyerResp, err := makeRequest("GET", ts.URL+fmt.Sprintf("/api/v1/orders/%d", orderID), otherUserToken, nil)
	if err != nil {
		t.Fatalf("wrong buyer detail request: %v", err)
	}
	defer wrongBuyerResp.Body.Close()
	if wrongBuyerResp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected wrong buyer 403, got %d", wrongBuyerResp.StatusCode)
	}

	wrongBuyerListResp, err := makeRequest("GET", ts.URL+"/api/v1/orders?page=1&size=20", otherUserToken, nil)
	if err != nil {
		t.Fatalf("wrong buyer list request: %v", err)
	}
	defer wrongBuyerListResp.Body.Close()
	if wrongBuyerListResp.StatusCode != http.StatusOK {
		t.Fatalf("expected wrong buyer list 200, got %d", wrongBuyerListResp.StatusCode)
	}
	if apiItemsContainOrderID(decodeAPIData(t, wrongBuyerListResp), orderID) {
		t.Fatalf("wrong buyer list should not include order %d", orderID)
	}

	wrongMerchantResp, err := makeRequest("GET", ts.URL+fmt.Sprintf("/api/v1/orders/%d", orderID), otherMerchantToken, nil)
	if err != nil {
		t.Fatalf("wrong merchant detail request: %v", err)
	}
	defer wrongMerchantResp.Body.Close()
	if wrongMerchantResp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected wrong merchant 403, got %d", wrongMerchantResp.StatusCode)
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

func decodeAPIData(t *testing.T, resp *http.Response) map[string]interface{} {
	t.Helper()

	var envelope map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		t.Fatalf("decode API response: %v", err)
	}
	data, ok := envelope["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected response data object, got %#v", envelope)
	}
	return data
}

func apiItemsContainOrderID(data map[string]interface{}, orderID int64) bool {
	return apiItemForOrderID(data, orderID) != nil
}

func apiItemForOrderID(data map[string]interface{}, orderID int64) map[string]interface{} {
	items, ok := data["items"].([]interface{})
	if !ok {
		return nil
	}
	for _, raw := range items {
		item, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		if int64(item["id"].(float64)) == orderID {
			return item
		}
	}
	return nil
}
