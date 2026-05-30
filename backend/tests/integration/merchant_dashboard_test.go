package integration

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMerchantDashboardReturnsScopedOperationalSummary(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	otherMerchantToken := registerAuctionMerchant(t, ts)
	userToken, _ := registerAuctionUser(t, ts)

	createDraftProduct(t, ts, merchantToken, "Dashboard Draft")
	_, activeAuctionID := publishPendingAuction(t, ts, merchantToken)
	activateAuctionViaAPI(t, ts, merchantToken, activeAuctionID)
	placeBid(t, ts, activeAuctionID, userToken, 10)

	paidOrderID := createPaidDashboardOrder(t, db, ts, merchantToken, userToken, 20)
	pendingOrderID := createPendingDashboardOrder(t, db, ts, merchantToken, userToken, 40)
	otherPaidOrderID := createPaidDashboardOrder(t, db, ts, otherMerchantToken, userToken, 60)

	resp, err := makeRequest("GET", ts.URL+"/api/v1/merchant/dashboard", merchantToken, nil)
	if err != nil {
		t.Fatalf("dashboard request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected dashboard 200, got %d", resp.StatusCode)
	}

	data := decodeAPIData(t, resp)
	summary := data["transaction_summary"].(map[string]interface{})
	if summary["total_paid_amount"] != float64(20) || summary["paid_order_count"] != float64(1) || summary["average_paid_price"] != float64(20) {
		t.Fatalf("expected paid-only transaction summary, got %#v", summary)
	}

	productCounts := statusCounts(data["product_status_counts"])
	if productCounts["draft"] != 1 || productCounts["active"] != 1 || productCounts["ended_sold"] != 2 || productCounts["pending"] != 0 {
		t.Fatalf("unexpected product counts: %#v", productCounts)
	}

	orderCounts := statusCounts(data["order_status_counts"])
	if orderCounts["paid"] != 1 || orderCounts["pending_confirm"] != 1 || orderCounts["pending_payment"] != 0 || orderCounts["cancelled"] != 0 {
		t.Fatalf("unexpected order counts: %#v", orderCounts)
	}

	activeAuctions := data["active_auctions"].([]interface{})
	if len(activeAuctions) != 1 {
		t.Fatalf("expected one active auction, got %#v", activeAuctions)
	}
	active := activeAuctions[0].(map[string]interface{})
	if int64(active["auction_id"].(float64)) != activeAuctionID || active["bid_count"] != float64(1) || active["current_price"] != float64(10) {
		t.Fatalf("unexpected active auction summary: %#v", active)
	}

	recentOrders := data["recent_orders"].([]interface{})
	if len(recentOrders) != 2 {
		t.Fatalf("expected two scoped recent orders, got %#v", recentOrders)
	}
	recentIDs := map[int64]bool{}
	for _, item := range recentOrders {
		row := item.(map[string]interface{})
		recentIDs[int64(row["id"].(float64))] = true
		if int64(row["id"].(float64)) == otherPaidOrderID {
			t.Fatalf("recent orders leaked other merchant order: %#v", recentOrders)
		}
	}
	if !recentIDs[paidOrderID] || !recentIDs[pendingOrderID] {
		t.Fatalf("recent orders missing scoped orders, got ids %#v", recentIDs)
	}
}

func TestMerchantDashboardRejectsUserRole(t *testing.T) {
	r, _ := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	userToken, _ := registerAuctionUser(t, ts)
	resp, err := makeRequest("GET", ts.URL+"/api/v1/merchant/dashboard", userToken, nil)
	if err != nil {
		t.Fatalf("dashboard user request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected user dashboard 403, got %d", resp.StatusCode)
	}
}

func createPaidDashboardOrder(t *testing.T, db *sql.DB, ts *httptest.Server, merchantToken, userToken string, amount float64) int64 {
	t.Helper()

	orderID := createPendingDashboardOrder(t, db, ts, merchantToken, userToken, amount)
	confirmResp, err := makeRequest("POST", ts.URL+fmt.Sprintf("/api/v1/orders/%d/confirm", orderID), userToken, nil)
	if err != nil {
		t.Fatalf("confirm dashboard order: %v", err)
	}
	confirmResp.Body.Close()
	if confirmResp.StatusCode != http.StatusOK {
		t.Fatalf("expected confirm 200, got %d", confirmResp.StatusCode)
	}

	payResp, err := makeRequest("POST", ts.URL+fmt.Sprintf("/api/v1/orders/%d/pay", orderID), userToken, nil)
	if err != nil {
		t.Fatalf("pay dashboard order: %v", err)
	}
	payResp.Body.Close()
	if payResp.StatusCode != http.StatusOK {
		t.Fatalf("expected pay 200, got %d", payResp.StatusCode)
	}
	return orderID
}

func createPendingDashboardOrder(t *testing.T, db *sql.DB, ts *httptest.Server, merchantToken, userToken string, amount float64) int64 {
	t.Helper()

	ceiling := amount
	_, auctionID := publishAuction(t, ts, merchantToken, &ceiling)
	activateAuctionViaAPI(t, ts, merchantToken, auctionID)
	placeBid(t, ts, auctionID, userToken, amount)

	var orderID int64
	if err := db.QueryRow("SELECT id FROM orders WHERE auction_id = ?", auctionID).Scan(&orderID); err != nil {
		t.Fatalf("query dashboard order: %v", err)
	}
	return orderID
}

func createDraftProduct(t *testing.T, ts *httptest.Server, merchantToken string, title string) int64 {
	t.Helper()

	body, _ := json.Marshal(map[string]interface{}{
		"title":       title,
		"description": "dashboard draft product",
		"image_urls":  []string{"/static/images/dashboard-draft.jpg"},
	})
	resp, err := makeRequest("POST", ts.URL+"/api/v1/products", merchantToken, body)
	if err != nil {
		t.Fatalf("create draft product: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected create draft 201, got %d", resp.StatusCode)
	}

	data := decodeAPIData(t, resp)
	product := data["product"].(map[string]interface{})
	return int64(product["id"].(float64))
}

func statusCounts(value interface{}) map[string]int {
	items := value.([]interface{})
	counts := make(map[string]int, len(items))
	for _, item := range items {
		row := item.(map[string]interface{})
		counts[row["status"].(string)] = int(row["count"].(float64))
	}
	return counts
}
