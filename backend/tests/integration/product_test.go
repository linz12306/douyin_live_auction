package integration

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"testing"

	"douyin-live/backend/internal/config"
	"douyin-live/backend/internal/handler"
	"douyin-live/backend/internal/middleware"
	"douyin-live/backend/internal/repository"
	"douyin-live/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func randomSuffix() string {
	return fmt.Sprintf("%d", rand.Intn(99999))
}

func setupProductServer(t *testing.T) (*gin.Engine, *sql.DB) {
	cfg := config.Load()
	db, err := config.NewDB(cfg.DBDSN)
	if err != nil {
		t.Fatalf("Failed to connect to MySQL: %v", err)
	}

	// Clean up test data
	db.Exec("DELETE FROM auction_logs WHERE auction_id IN (SELECT id FROM auctions WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'test_merchant_%'))")
	db.Exec("DELETE FROM auctions WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'test_merchant_%')")
	db.Exec("DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'test_merchant_%'))")
	db.Exec("DELETE FROM products WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'test_merchant_%')")
	db.Exec("DELETE FROM users WHERE username LIKE 'test_merchant_%'")

	rdb, _ := config.NewRedis(cfg.RedisAddr, cfg.RedisPass)

	userRepo := repository.NewUserRepo(db)
	authSvc := service.NewAuthService(userRepo, rdb, cfg)
	productRepo := repository.NewProductRepo(db)
	auctionRepo := repository.NewAuctionRepo(db)
	productSvc := service.NewProductService(productRepo, auctionRepo)

	authH := handler.NewAuthHandler(authSvc)
	productH := handler.NewProductHandler(productSvc, cfg.ImageDir)

	r := gin.New()
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/register", authH.Register)
		auth.POST("/login", authH.Login)
	}

	products := r.Group("/api/v1/products")
	products.Use(middleware.JWTAuth(cfg))
	{
		products.GET("", productH.List)
		products.GET("/:id", productH.Get)
		products.POST("", productH.Create)
		products.PUT("/:id", productH.Update)
		products.DELETE("/:id", productH.Delete)
		products.POST("/:id/images", productH.UploadImage)
		products.POST("/:id/publish", productH.Publish)
	}

	return r, db
}

func registerMerchant(t *testing.T, ts *httptest.Server) string {
	uname := "test_merchant_" + randomSuffix()
	body, _ := json.Marshal(map[string]string{
		"username": uname, "password": "test123",
		"role": "merchant", "display_name": "Test Merchant",
	})
	resp, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(body))
	defer resp.Body.Close()
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	data := result["data"].(map[string]interface{})
	return data["access_token"].(string)
}

func makeRequest(method, url, token string, body []byte) (*http.Response, error) {
	req, _ := http.NewRequest(method, url, bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	return http.DefaultClient.Do(req)
}

func TestCreateAndPublishProduct(t *testing.T) {
	r, _ := setupProductServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	token := registerMerchant(t, ts)

	// Create product
	body, _ := json.Marshal(map[string]interface{}{
		"title": "Test Product", "description": "A test product",
		"image_urls": []string{"/static/images/test.jpg"},
	})
	resp, _ := makeRequest("POST", ts.URL+"/api/v1/products", token, body)
	if resp.StatusCode != 201 {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	resp.Body.Close()
	productData := result["data"].(map[string]interface{})["product"].(map[string]interface{})
	productID := int64(productData["id"].(float64))

	// Publish
	pubBody, _ := json.Marshal(map[string]interface{}{
		"start_price": 0, "bid_increment_type": "fixed",
		"bid_increment_value": 10, "duration_seconds": 300,
		"auto_extend_seconds": 15, "max_extend_count": 5,
	})
	resp2, _ := makeRequest("POST", ts.URL+fmt.Sprintf("/api/v1/products/%d/publish", productID), token, pubBody)
	if resp2.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	resp2.Body.Close()

	// Get detail
	resp3, _ := makeRequest("GET", ts.URL+fmt.Sprintf("/api/v1/products/%d", productID), token, nil)
	var detail map[string]interface{}
	json.NewDecoder(resp3.Body).Decode(&detail)
	resp3.Body.Close()
	data2 := detail["data"].(map[string]interface{})
	if data2["auction"] == nil {
		t.Fatal("expected auction in detail after publish")
	}
}

func TestListProductsByStatus(t *testing.T) {
	r, _ := setupProductServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	token := registerMerchant(t, ts)

	// Create and publish a product
	body, _ := json.Marshal(map[string]interface{}{
		"title": "List Test Product", "description": "desc",
		"image_urls": []string{"/static/images/test.jpg"},
	})
	resp, _ := makeRequest("POST", ts.URL+"/api/v1/products", token, body)
	resp.Body.Close()

	// List all
	resp2, _ := makeRequest("GET", ts.URL+"/api/v1/products", token, nil)
	if resp2.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	var listResult map[string]interface{}
	json.NewDecoder(resp2.Body).Decode(&listResult)
	resp2.Body.Close()
	data := listResult["data"].(map[string]interface{})
	items := data["items"].([]interface{})
	if len(items) == 0 {
		t.Fatal("expected at least 1 product in list")
	}
}

func TestUnauthorizedAccess(t *testing.T) {
	r, _ := setupProductServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	// Try creating without auth
	body, _ := json.Marshal(map[string]string{"title": "test", "image_urls": "[]"})
	resp, _ := http.Post(ts.URL+"/api/v1/products", "application/json", bytes.NewReader(body))
	if resp.StatusCode != 401 {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}
