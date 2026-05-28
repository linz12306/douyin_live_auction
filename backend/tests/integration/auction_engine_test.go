package integration

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"douyin-live/backend/internal/config"
	"douyin-live/backend/internal/handler"
	"douyin-live/backend/internal/middleware"
	"douyin-live/backend/internal/repository"
	"douyin-live/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func setupAuctionServer(t *testing.T) (*gin.Engine, *sql.DB) {
	t.Helper()

	cfg := config.Load()
	db, err := config.NewDB(cfg.DBDSN)
	if err != nil {
		t.Fatalf("Failed to connect to MySQL: %v", err)
	}

	cleanupAuctionTestData(t, db)

	rdb, err := config.NewRedis(cfg.RedisAddr, cfg.RedisPass)
	if err != nil {
		t.Fatalf("Failed to connect to Redis: %v", err)
	}

	userRepo := repository.NewUserRepo(db)
	productRepo := repository.NewProductRepo(db)
	auctionRepo := repository.NewAuctionRepo(db)
	auctionEngineRepo := repository.NewAuctionEngineRepo(db)

	authSvc := service.NewAuthService(userRepo, rdb, cfg)
	productSvc := service.NewProductService(productRepo, auctionRepo)
	auctionSvc := service.NewAuctionService(auctionEngineRepo, rdb)

	authH := handler.NewAuthHandler(authSvc)
	productH := handler.NewProductHandler(productSvc, cfg.ImageDir)
	auctionH := handler.NewAuctionHandler(auctionSvc)

	r := gin.New()
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/register", authH.Register)
		auth.POST("/login", authH.Login)
	}

	products := r.Group("/api/v1/products")
	products.Use(middleware.JWTAuth(cfg))
	{
		products.POST("", middleware.RoleGuard("merchant"), productH.Create)
		products.POST("/:id/publish", middleware.RoleGuard("merchant"), productH.Publish)
	}

	auctions := r.Group("/api/v1/auctions")
	auctions.Use(middleware.JWTAuth(cfg))
	{
		auctions.POST("/:id/bid", middleware.RoleGuard("user"), auctionH.PlaceBid)
		auctions.GET("/:id/rankings", auctionH.Rankings)
		auctions.POST("/:id/activate", middleware.RoleGuard("merchant"), auctionH.Activate)
		auctions.DELETE("/:id", middleware.RoleGuard("merchant"), auctionH.Cancel)
	}

	return r, db
}

func cleanupAuctionTestData(t *testing.T, db *sql.DB) {
	t.Helper()

	_, _ = db.Exec("DELETE FROM orders WHERE auction_id IN (SELECT id FROM auctions WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'auc_mer_%'))")
	_, _ = db.Exec("DELETE FROM auction_logs WHERE auction_id IN (SELECT id FROM auctions WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'auc_mer_%'))")
	_, _ = db.Exec("DELETE FROM bids WHERE auction_id IN (SELECT id FROM auctions WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'auc_mer_%'))")
	_, _ = db.Exec("DELETE FROM auctions WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'auc_mer_%')")
	_, _ = db.Exec("DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'auc_mer_%'))")
	_, _ = db.Exec("DELETE FROM products WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'auc_mer_%')")
	_, _ = db.Exec("DELETE FROM users WHERE username LIKE 'auc_mer_%'")
	_, _ = db.Exec("DELETE FROM users WHERE username LIKE 'auc_usr_%'")
}

func registerAuctionMerchant(t *testing.T, ts *httptest.Server) string {
	t.Helper()

	body, _ := json.Marshal(map[string]string{
		"username":     "auc_mer_" + randomSuffix(),
		"password":     "test123",
		"role":         "merchant",
		"display_name": "Auction Merchant",
	})
	resp, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("register merchant failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected merchant register 201, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode register response: %v", err)
	}
	data := result["data"].(map[string]interface{})
	return data["access_token"].(string)
}

func registerAuctionUser(t *testing.T, ts *httptest.Server) (string, int64) {
	t.Helper()

	username := "auc_usr_" + randomSuffix()
	body, _ := json.Marshal(map[string]string{
		"username":     username,
		"password":     "test123",
		"role":         "user",
		"display_name": "Auction User",
	})
	resp, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("register user failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected user register 201, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode user register response: %v", err)
	}
	data := result["data"].(map[string]interface{})
	return data["access_token"].(string), int64(data["user"].(map[string]interface{})["id"].(float64))
}

func publishPendingAuction(t *testing.T, ts *httptest.Server, merchantToken string) (productID, auctionID int64) {
	t.Helper()

	return publishAuction(t, ts, merchantToken, nil)
}

func publishAuction(t *testing.T, ts *httptest.Server, merchantToken string, ceilingPrice *float64) (productID, auctionID int64) {
	t.Helper()

	createBody, _ := json.Marshal(map[string]interface{}{
		"title":       "Cancelable Product",
		"description": "pending auction cancellation test",
		"image_urls":  []string{"/static/images/test.jpg"},
	})
	createResp, err := makeRequest("POST", ts.URL+"/api/v1/products", merchantToken, createBody)
	if err != nil {
		t.Fatalf("create product failed: %v", err)
	}
	defer createResp.Body.Close()
	if createResp.StatusCode != http.StatusCreated {
		t.Fatalf("expected create product 201, got %d", createResp.StatusCode)
	}

	var createResult map[string]interface{}
	if err := json.NewDecoder(createResp.Body).Decode(&createResult); err != nil {
		t.Fatalf("decode create product response: %v", err)
	}
	product := createResult["data"].(map[string]interface{})["product"].(map[string]interface{})
	productID = int64(product["id"].(float64))

	publishPayload := map[string]interface{}{
		"start_price":         0,
		"bid_increment_type":  "fixed",
		"bid_increment_value": 10,
		"duration_seconds":    300,
		"auto_extend_seconds": 15,
		"max_extend_count":    5,
	}
	if ceilingPrice != nil {
		publishPayload["ceiling_price"] = *ceilingPrice
	}
	publishBody, _ := json.Marshal(publishPayload)
	publishResp, err := makeRequest("POST", ts.URL+fmt.Sprintf("/api/v1/products/%d/publish", productID), merchantToken, publishBody)
	if err != nil {
		t.Fatalf("publish product failed: %v", err)
	}
	defer publishResp.Body.Close()
	if publishResp.StatusCode != http.StatusOK {
		t.Fatalf("expected publish 200, got %d", publishResp.StatusCode)
	}

	var publishResult map[string]interface{}
	if err := json.NewDecoder(publishResp.Body).Decode(&publishResult); err != nil {
		t.Fatalf("decode publish response: %v", err)
	}
	auction := publishResult["data"].(map[string]interface{})["auction"].(map[string]interface{})
	auctionID = int64(auction["id"].(float64))
	return productID, auctionID
}

func activateAuction(t *testing.T, db *sql.DB, auctionID int64) {
	t.Helper()

	_, err := db.Exec(
		`UPDATE auctions
         SET status = 'active', started_at = NOW(), ended_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
         WHERE id = ?`,
		auctionID,
	)
	if err != nil {
		t.Fatalf("activate auction: %v", err)
	}
}

func activateAuctionViaAPI(t *testing.T, ts *httptest.Server, merchantToken string, auctionID int64) {
	t.Helper()

	resp, err := makeRequest("POST", ts.URL+fmt.Sprintf("/api/v1/auctions/%d/activate", auctionID), merchantToken, nil)
	if err != nil {
		t.Fatalf("activate auction request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected activate 200, got %d", resp.StatusCode)
	}
}

func placeBid(t *testing.T, ts *httptest.Server, auctionID int64, userToken string, amount float64) {
	t.Helper()

	resp := requestBid(t, ts, auctionID, userToken, amount)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected bid 200, got %d", resp.StatusCode)
	}
}

func requestBid(t *testing.T, ts *httptest.Server, auctionID int64, userToken string, amount float64) *http.Response {
	t.Helper()

	body, _ := json.Marshal(map[string]float64{"amount": amount})
	resp, err := makeRequest("POST", ts.URL+fmt.Sprintf("/api/v1/auctions/%d/bid", auctionID), userToken, body)
	if err != nil {
		t.Fatalf("place bid failed: %v", err)
	}
	return resp
}

func TestMerchantCanCancelPendingAuction(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	productID, auctionID := publishPendingAuction(t, ts, merchantToken)

	cancelBody, _ := json.Marshal(map[string]string{"reason": "库存异常"})
	resp, err := makeRequest("DELETE", ts.URL+fmt.Sprintf("/api/v1/auctions/%d", auctionID), merchantToken, cancelBody)
	if err != nil {
		t.Fatalf("cancel auction failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected cancel 200, got %d", resp.StatusCode)
	}

	var auctionStatus, productStatus string
	if err := db.QueryRow("SELECT status FROM auctions WHERE id = ?", auctionID).Scan(&auctionStatus); err != nil {
		t.Fatalf("query auction status: %v", err)
	}
	if err := db.QueryRow("SELECT status FROM products WHERE id = ?", productID).Scan(&productStatus); err != nil {
		t.Fatalf("query product status: %v", err)
	}
	if auctionStatus != "cancelled" {
		t.Fatalf("expected auction cancelled, got %s", auctionStatus)
	}
	if productStatus != "cancelled" {
		t.Fatalf("expected product cancelled, got %s", productStatus)
	}

	var logCount int
	if err := db.QueryRow("SELECT COUNT(*) FROM auction_logs WHERE auction_id = ? AND action = 'cancelled'", auctionID).Scan(&logCount); err != nil {
		t.Fatalf("query cancel log: %v", err)
	}
	if logCount != 1 {
		t.Fatalf("expected one cancel audit log, got %d", logCount)
	}
}

func TestMerchantCanActivatePendingAuction(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	productID, auctionID := publishPendingAuction(t, ts, merchantToken)

	activateAuctionViaAPI(t, ts, merchantToken, auctionID)

	var auctionStatus, productStatus string
	var startedSet, endedSet bool
	if err := db.QueryRow("SELECT status, started_at IS NOT NULL, ended_at IS NOT NULL FROM auctions WHERE id = ?", auctionID).Scan(&auctionStatus, &startedSet, &endedSet); err != nil {
		t.Fatalf("query auction activation: %v", err)
	}
	if err := db.QueryRow("SELECT status FROM products WHERE id = ?", productID).Scan(&productStatus); err != nil {
		t.Fatalf("query product status: %v", err)
	}
	if auctionStatus != "active" {
		t.Fatalf("expected auction active, got %s", auctionStatus)
	}
	if productStatus != "active" {
		t.Fatalf("expected product active, got %s", productStatus)
	}
	if !startedSet || !endedSet {
		t.Fatalf("expected started_at and ended_at to be set, got started=%v ended=%v", startedSet, endedSet)
	}
}

func TestMerchantCannotCancelActiveAuctionAfterRecentBid(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, _ := registerAuctionUser(t, ts)
	_, auctionID := publishPendingAuction(t, ts, merchantToken)
	activateAuction(t, db, auctionID)
	placeBid(t, ts, auctionID, userToken, 10)

	cancelBody, _ := json.Marshal(map[string]string{"reason": "价格不合适"})
	resp, err := makeRequest("DELETE", ts.URL+fmt.Sprintf("/api/v1/auctions/%d", auctionID), merchantToken, cancelBody)
	if err != nil {
		t.Fatalf("cancel active auction failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected recent-bid cancel 400, got %d", resp.StatusCode)
	}

	var auctionStatus string
	if err := db.QueryRow("SELECT status FROM auctions WHERE id = ?", auctionID).Scan(&auctionStatus); err != nil {
		t.Fatalf("query auction status: %v", err)
	}
	if auctionStatus != "active" {
		t.Fatalf("expected auction to remain active, got %s", auctionStatus)
	}
}

func TestMerchantCancelActiveAuctionUnfreezesActiveBid(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, userID := registerAuctionUser(t, ts)
	_, auctionID := publishPendingAuction(t, ts, merchantToken)
	activateAuction(t, db, auctionID)
	placeBid(t, ts, auctionID, userToken, 10)

	_, err := db.Exec("UPDATE bids SET created_at = DATE_SUB(NOW(), INTERVAL 31 SECOND) WHERE auction_id = ?", auctionID)
	if err != nil {
		t.Fatalf("age bid: %v", err)
	}

	cancelBody, _ := json.Marshal(map[string]string{"reason": "直播异常"})
	resp, err := makeRequest("DELETE", ts.URL+fmt.Sprintf("/api/v1/auctions/%d", auctionID), merchantToken, cancelBody)
	if err != nil {
		t.Fatalf("cancel active auction failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected cancel 200, got %d", resp.StatusCode)
	}

	var balance, frozen float64
	if err := db.QueryRow("SELECT balance, frozen_amount FROM users WHERE id = ?", userID).Scan(&balance, &frozen); err != nil {
		t.Fatalf("query user wallet: %v", err)
	}
	if balance != 1000000 || frozen != 0 {
		t.Fatalf("expected wallet restored to 1000000/0, got %.2f/%.2f", balance, frozen)
	}

	var bidStatus string
	if err := db.QueryRow("SELECT status FROM bids WHERE auction_id = ?", auctionID).Scan(&bidStatus); err != nil {
		t.Fatalf("query bid status: %v", err)
	}
	if bidStatus != "cancelled" {
		t.Fatalf("expected bid cancelled, got %s", bidStatus)
	}
}

func TestOutbidUnfreezesPreviousBidAndRanksByAmount(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	firstToken, firstUserID := registerAuctionUser(t, ts)
	secondToken, secondUserID := registerAuctionUser(t, ts)
	_, auctionID := publishPendingAuction(t, ts, merchantToken)
	activateAuction(t, db, auctionID)

	placeBid(t, ts, auctionID, firstToken, 10)
	placeBid(t, ts, auctionID, secondToken, 20)

	var firstBalance, firstFrozen, secondBalance, secondFrozen float64
	if err := db.QueryRow("SELECT balance, frozen_amount FROM users WHERE id = ?", firstUserID).Scan(&firstBalance, &firstFrozen); err != nil {
		t.Fatalf("query first wallet: %v", err)
	}
	if err := db.QueryRow("SELECT balance, frozen_amount FROM users WHERE id = ?", secondUserID).Scan(&secondBalance, &secondFrozen); err != nil {
		t.Fatalf("query second wallet: %v", err)
	}
	if firstBalance != 1000000 || firstFrozen != 0 {
		t.Fatalf("expected first wallet unfrozen to 1000000/0, got %.2f/%.2f", firstBalance, firstFrozen)
	}
	if secondBalance != 999980 || secondFrozen != 20 {
		t.Fatalf("expected second wallet frozen to 999980/20, got %.2f/%.2f", secondBalance, secondFrozen)
	}

	var firstBidStatus, secondBidStatus string
	if err := db.QueryRow("SELECT status FROM bids WHERE auction_id = ? AND user_id = ?", auctionID, firstUserID).Scan(&firstBidStatus); err != nil {
		t.Fatalf("query first bid: %v", err)
	}
	if err := db.QueryRow("SELECT status FROM bids WHERE auction_id = ? AND user_id = ?", auctionID, secondUserID).Scan(&secondBidStatus); err != nil {
		t.Fatalf("query second bid: %v", err)
	}
	if firstBidStatus != "outbid" {
		t.Fatalf("expected first bid outbid, got %s", firstBidStatus)
	}
	if secondBidStatus != "active" {
		t.Fatalf("expected second bid active, got %s", secondBidStatus)
	}

	resp, err := makeRequest("GET", ts.URL+fmt.Sprintf("/api/v1/auctions/%d/rankings", auctionID), firstToken, nil)
	if err != nil {
		t.Fatalf("ranking request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected rankings 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode rankings: %v", err)
	}
	items := result["data"].(map[string]interface{})["items"].([]interface{})
	if len(items) != 2 {
		t.Fatalf("expected two ranking rows, got %d", len(items))
	}
	top := items[0].(map[string]interface{})
	if int64(top["user_id"].(float64)) != secondUserID || top["status"].(string) != "active" {
		t.Fatalf("expected second user active bid first in rankings, got %#v", top)
	}
}

func TestCeilingBidSettlesAuctionAndCreatesOrder(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, userID := registerAuctionUser(t, ts)
	ceiling := 20.0
	_, auctionID := publishAuction(t, ts, merchantToken, &ceiling)
	activateAuction(t, db, auctionID)

	placeBid(t, ts, auctionID, userToken, 20)

	var auctionStatus, bidStatus, orderStatus string
	if err := db.QueryRow("SELECT status FROM auctions WHERE id = ?", auctionID).Scan(&auctionStatus); err != nil {
		t.Fatalf("query auction status: %v", err)
	}
	if err := db.QueryRow("SELECT status FROM bids WHERE auction_id = ? AND user_id = ?", auctionID, userID).Scan(&bidStatus); err != nil {
		t.Fatalf("query bid status: %v", err)
	}
	if err := db.QueryRow("SELECT status FROM orders WHERE auction_id = ?", auctionID).Scan(&orderStatus); err != nil {
		t.Fatalf("query order status: %v", err)
	}
	if auctionStatus != "ended_sold" {
		t.Fatalf("expected auction ended_sold, got %s", auctionStatus)
	}
	if bidStatus != "won" {
		t.Fatalf("expected bid won, got %s", bidStatus)
	}
	if orderStatus != "pending_confirm" {
		t.Fatalf("expected order pending_confirm, got %s", orderStatus)
	}

	var balance, frozen float64
	if err := db.QueryRow("SELECT balance, frozen_amount FROM users WHERE id = ?", userID).Scan(&balance, &frozen); err != nil {
		t.Fatalf("query user wallet: %v", err)
	}
	if balance != 999980 || frozen != 0 {
		t.Fatalf("expected winning wallet 999980/0, got %.2f/%.2f", balance, frozen)
	}

	resp := requestBid(t, ts, auctionID, userToken, 30)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected ended auction bid 400, got %d", resp.StatusCode)
	}

	var orderCount int
	if err := db.QueryRow("SELECT COUNT(*) FROM orders WHERE auction_id = ?", auctionID).Scan(&orderCount); err != nil {
		t.Fatalf("query order count: %v", err)
	}
	if orderCount != 1 {
		t.Fatalf("expected one order after repeated bid attempt, got %d", orderCount)
	}
}

func TestBidValidationRejectsInvalidStateLowBidAndInsufficientBalance(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, userID := registerAuctionUser(t, ts)
	_, auctionID := publishPendingAuction(t, ts, merchantToken)

	resp := requestBid(t, ts, auctionID, userToken, 10)
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected pending auction bid 400, got %d", resp.StatusCode)
	}

	activateAuction(t, db, auctionID)
	resp = requestBid(t, ts, auctionID, userToken, 5)
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected low bid 400, got %d", resp.StatusCode)
	}

	if _, err := db.Exec("UPDATE users SET balance = 5, frozen_amount = 0 WHERE id = ?", userID); err != nil {
		t.Fatalf("lower user balance: %v", err)
	}
	resp = requestBid(t, ts, auctionID, userToken, 10)
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected insufficient balance 400, got %d", resp.StatusCode)
	}

	var bidCount int
	if err := db.QueryRow("SELECT COUNT(*) FROM bids WHERE auction_id = ?", auctionID).Scan(&bidCount); err != nil {
		t.Fatalf("query bid count: %v", err)
	}
	if bidCount != 0 {
		t.Fatalf("expected no persisted bids after rejected attempts, got %d", bidCount)
	}
}

func TestBidNearEndTriggersSoftClose(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, _ := registerAuctionUser(t, ts)
	_, auctionID := publishPendingAuction(t, ts, merchantToken)
	activateAuction(t, db, auctionID)
	if _, err := db.Exec("UPDATE auctions SET ended_at = DATE_ADD(NOW(), INTERVAL 10 SECOND), current_extend_count = 0 WHERE id = ?", auctionID); err != nil {
		t.Fatalf("set auction near end: %v", err)
	}

	placeBid(t, ts, auctionID, userToken, 10)

	var extendCount int
	var remainingSeconds int
	if err := db.QueryRow("SELECT current_extend_count, TIMESTAMPDIFF(SECOND, NOW(), ended_at) FROM auctions WHERE id = ?", auctionID).Scan(&extendCount, &remainingSeconds); err != nil {
		t.Fatalf("query extension state: %v", err)
	}
	if extendCount != 1 {
		t.Fatalf("expected one soft-close extension, got %d", extendCount)
	}
	if remainingSeconds < 12 || remainingSeconds > 16 {
		t.Fatalf("expected countdown reset near 15 seconds, got %d", remainingSeconds)
	}
}

func TestRedisBidLockContentionRejectsBid(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, _ := registerAuctionUser(t, ts)
	_, auctionID := publishPendingAuction(t, ts, merchantToken)
	activateAuction(t, db, auctionID)

	cfg := config.Load()
	rdb, err := config.NewRedis(cfg.RedisAddr, cfg.RedisPass)
	if err != nil {
		t.Fatalf("connect redis: %v", err)
	}
	lockKey := fmt.Sprintf("auction:%d:bid_lock", auctionID)
	if err := rdb.Set(context.Background(), lockKey, "held", 5*time.Second).Err(); err != nil {
		t.Fatalf("set bid lock: %v", err)
	}
	defer rdb.Del(context.Background(), lockKey)

	resp := requestBid(t, ts, auctionID, userToken, 10)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("expected locked bid 429, got %d", resp.StatusCode)
	}
}

func TestSettleExpiredAuctionWithoutBidsMarksNoBid(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	productID, auctionID := publishPendingAuction(t, ts, merchantToken)
	activateAuctionViaAPI(t, ts, merchantToken, auctionID)
	if _, err := db.Exec("UPDATE auctions SET ended_at = DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE id = ?", auctionID); err != nil {
		t.Fatalf("expire auction: %v", err)
	}

	auctionSvc := service.NewAuctionService(repository.NewAuctionEngineRepo(db), nil)
	settled, err := auctionSvc.SettleExpired(context.Background())
	if err != nil {
		t.Fatalf("settle expired auctions: %v", err)
	}
	if settled != 1 {
		t.Fatalf("expected one settled auction, got %d", settled)
	}

	var auctionStatus, productStatus string
	if err := db.QueryRow("SELECT status FROM auctions WHERE id = ?", auctionID).Scan(&auctionStatus); err != nil {
		t.Fatalf("query auction status: %v", err)
	}
	if err := db.QueryRow("SELECT status FROM products WHERE id = ?", productID).Scan(&productStatus); err != nil {
		t.Fatalf("query product status: %v", err)
	}
	if auctionStatus != "ended_no_bid" {
		t.Fatalf("expected ended_no_bid, got %s", auctionStatus)
	}
	if productStatus != "ended_no_bid" {
		t.Fatalf("expected product ended_no_bid, got %s", productStatus)
	}
}

func TestSettleExpiredAuctionWithBidCreatesOrder(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	userToken, userID := registerAuctionUser(t, ts)
	_, auctionID := publishPendingAuction(t, ts, merchantToken)
	activateAuctionViaAPI(t, ts, merchantToken, auctionID)
	placeBid(t, ts, auctionID, userToken, 10)
	if _, err := db.Exec("UPDATE auctions SET ended_at = DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE id = ?", auctionID); err != nil {
		t.Fatalf("expire auction: %v", err)
	}

	auctionSvc := service.NewAuctionService(repository.NewAuctionEngineRepo(db), nil)
	settled, err := auctionSvc.SettleExpired(context.Background())
	if err != nil {
		t.Fatalf("settle expired auctions: %v", err)
	}
	if settled != 1 {
		t.Fatalf("expected one settled auction, got %d", settled)
	}

	var auctionStatus, bidStatus, orderStatus string
	if err := db.QueryRow("SELECT status FROM auctions WHERE id = ?", auctionID).Scan(&auctionStatus); err != nil {
		t.Fatalf("query auction status: %v", err)
	}
	if err := db.QueryRow("SELECT status FROM bids WHERE auction_id = ? AND user_id = ?", auctionID, userID).Scan(&bidStatus); err != nil {
		t.Fatalf("query bid status: %v", err)
	}
	if err := db.QueryRow("SELECT status FROM orders WHERE auction_id = ?", auctionID).Scan(&orderStatus); err != nil {
		t.Fatalf("query order status: %v", err)
	}
	if auctionStatus != "ended_sold" {
		t.Fatalf("expected ended_sold, got %s", auctionStatus)
	}
	if bidStatus != "won" {
		t.Fatalf("expected bid won, got %s", bidStatus)
	}
	if orderStatus != "pending_confirm" {
		t.Fatalf("expected pending_confirm order, got %s", orderStatus)
	}

	var balance, frozen float64
	if err := db.QueryRow("SELECT balance, frozen_amount FROM users WHERE id = ?", userID).Scan(&balance, &frozen); err != nil {
		t.Fatalf("query wallet: %v", err)
	}
	if balance != 999990 || frozen != 0 {
		t.Fatalf("expected settled wallet 999990/0, got %.2f/%.2f", balance, frozen)
	}
}

func TestAuctionEngineEndToEndFlow(t *testing.T) {
	r, db := setupAuctionServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerAuctionMerchant(t, ts)
	firstToken, firstUserID := registerAuctionUser(t, ts)
	secondToken, secondUserID := registerAuctionUser(t, ts)
	_, auctionID := publishPendingAuction(t, ts, merchantToken)
	activateAuctionViaAPI(t, ts, merchantToken, auctionID)

	placeBid(t, ts, auctionID, firstToken, 10)
	placeBid(t, ts, auctionID, secondToken, 20)

	if _, err := db.Exec("UPDATE auctions SET ended_at = DATE_SUB(NOW(), INTERVAL 1 SECOND) WHERE id = ?", auctionID); err != nil {
		t.Fatalf("expire auction: %v", err)
	}
	auctionSvc := service.NewAuctionService(repository.NewAuctionEngineRepo(db), nil)
	settled, err := auctionSvc.SettleExpired(context.Background())
	if err != nil {
		t.Fatalf("settle expired auction: %v", err)
	}
	if settled != 1 {
		t.Fatalf("expected one settled auction, got %d", settled)
	}

	var auctionStatus string
	var buyerID int64
	var amount float64
	if err := db.QueryRow("SELECT status FROM auctions WHERE id = ?", auctionID).Scan(&auctionStatus); err != nil {
		t.Fatalf("query auction status: %v", err)
	}
	if err := db.QueryRow("SELECT buyer_id, amount FROM orders WHERE auction_id = ?", auctionID).Scan(&buyerID, &amount); err != nil {
		t.Fatalf("query order: %v", err)
	}
	if auctionStatus != "ended_sold" {
		t.Fatalf("expected ended_sold, got %s", auctionStatus)
	}
	if buyerID != secondUserID || amount != 20 {
		t.Fatalf("expected second user to win order for 20, got buyer=%d amount=%.2f", buyerID, amount)
	}

	var firstFrozen, secondFrozen float64
	if err := db.QueryRow("SELECT frozen_amount FROM users WHERE id = ?", firstUserID).Scan(&firstFrozen); err != nil {
		t.Fatalf("query first frozen: %v", err)
	}
	if err := db.QueryRow("SELECT frozen_amount FROM users WHERE id = ?", secondUserID).Scan(&secondFrozen); err != nil {
		t.Fatalf("query second frozen: %v", err)
	}
	if firstFrozen != 0 || secondFrozen != 0 {
		t.Fatalf("expected no frozen balances after settlement, got first=%.2f second=%.2f", firstFrozen, secondFrozen)
	}
}
