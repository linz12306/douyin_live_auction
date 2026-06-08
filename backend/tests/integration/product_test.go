package integration

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"douyin-live/backend/internal/config"
	"douyin-live/backend/internal/handler"
	"douyin-live/backend/internal/middleware"
	"douyin-live/backend/internal/repository"
	"douyin-live/backend/internal/service"

	"github.com/gin-gonic/gin"
)

var suffixCounter int64

func randomSuffix() string {
	return fmt.Sprintf("%05d", atomic.AddInt64(&suffixCounter, 1)%100000)
}

type productTestServer struct {
	router       *gin.Engine
	db           *sql.DB
	imageDir     string
	liveMediaDir string
}

func setupProductServer(t *testing.T) (*gin.Engine, *sql.DB) {
	srv := setupProductServerWithDirs(t)
	return srv.router, srv.db
}

func setupProductServerWithDirs(t *testing.T) productTestServer {
	t.Helper()

	cfg := config.Load()
	cfg.ImageDir = t.TempDir()
	cfg.LiveMediaDir = t.TempDir()
	db, err := config.NewDB(cfg.DBDSN)
	if err != nil {
		t.Fatalf("Failed to connect to MySQL: %v", err)
	}
	acquireMySQLTestLock(t, db)

	// Clean up test data
	db.Exec("DELETE FROM auction_logs WHERE auction_id IN (SELECT id FROM auctions WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'test_merchant_%'))")
	db.Exec("DELETE FROM auctions WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'test_merchant_%')")
	db.Exec("DELETE FROM product_live_media WHERE product_id IN (SELECT id FROM products WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'test_merchant_%'))")
	db.Exec("DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'test_merchant_%'))")
	db.Exec("DELETE FROM products WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'test_merchant_%')")
	db.Exec("DELETE FROM users WHERE username LIKE 'test_merchant_%'")
	db.Exec("DELETE FROM users WHERE username LIKE 'test_user_%'")

	rdb, _ := config.NewRedis(cfg.RedisAddr, cfg.RedisPass)

	userRepo := repository.NewUserRepo(db)
	authSvc := service.NewAuthService(userRepo, rdb, cfg)
	productRepo := repository.NewProductRepo(db)
	auctionRepo := repository.NewAuctionRepo(db)
	productSvc := service.NewProductService(productRepo, auctionRepo)

	authH := handler.NewAuthHandler(authSvc)
	productH := handler.NewProductHandler(productSvc, cfg.ImageDir, cfg.LiveMediaDir)

	r := gin.New()
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/register", authH.Register)
		auth.POST("/login", authH.Login)
	}
	r.Static("/static/images", cfg.ImageDir)
	r.Static("/static/live-media", cfg.LiveMediaDir)

	products := r.Group("/api/v1/products")
	products.Use(middleware.JWTAuth(cfg))
	{
		products.GET("", productH.List)
		products.GET("/:id", productH.Get)
		products.POST("", productH.Create)
		products.PUT("/:id", productH.Update)
		products.DELETE("/:id", productH.Delete)
		products.POST("/:id/images", productH.UploadImage)
		products.POST("/:id/live-media", productH.UploadLiveMedia)
		products.DELETE("/:id/live-media", productH.DeleteLiveMedia)
		products.POST("/:id/publish", productH.Publish)
	}

	return productTestServer{router: r, db: db, imageDir: cfg.ImageDir, liveMediaDir: cfg.LiveMediaDir}
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

func registerUser(t *testing.T, ts *httptest.Server) string {
	uname := "test_user_" + randomSuffix()
	body, _ := json.Marshal(map[string]string{
		"username": uname, "password": "test123",
		"role": "user", "display_name": "Test User",
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

func createLiveMediaDraftProduct(t *testing.T, ts *httptest.Server, token, title string) int64 {
	t.Helper()

	body, _ := json.Marshal(map[string]interface{}{
		"title":       title,
		"description": "desc",
		"image_urls":  []string{"/static/images/test.jpg"},
	})
	resp, err := makeRequest("POST", ts.URL+"/api/v1/products", token, body)
	if err != nil {
		t.Fatalf("create draft product failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected create 201, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode create product response: %v", err)
	}
	productData := result["data"].(map[string]interface{})["product"].(map[string]interface{})
	return int64(productData["id"].(float64))
}

func uploadMultipartFile(t *testing.T, url, token, fieldName, filename, contentType string, content []byte) *http.Response {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	partHeader := make(textproto.MIMEHeader)
	partHeader.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, fieldName, filename))
	partHeader.Set("Content-Type", contentType)
	part, err := writer.CreatePart(partHeader)
	if err != nil {
		t.Fatalf("create multipart part: %v", err)
	}
	if _, err := io.Copy(part, bytes.NewReader(content)); err != nil {
		t.Fatalf("write multipart part: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, url, &body)
	if err != nil {
		t.Fatalf("create upload request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("upload multipart file: %v", err)
	}
	return resp
}

func validWebPContent(label string) []byte {
	content := append([]byte("RIFF\x1a\x00\x00\x00WEBPVP8 "), []byte(label)...)
	return append(content, make([]byte, 20)...)
}

func validMP4Content(label string) []byte {
	content := append([]byte("\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom"), []byte(label)...)
	return append(content, make([]byte, 20)...)
}

func decodeLiveMediaURL(t *testing.T, resp *http.Response) string {
	t.Helper()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode live media response: %v", err)
	}
	data := result["data"].(map[string]interface{})
	mediaURL, ok := data["url"].(string)
	if !ok || !strings.HasPrefix(mediaURL, "/static/live-media/") {
		t.Fatalf("expected live media static url, got %#v", data["url"])
	}
	return mediaURL
}

func liveMediaFilePath(t *testing.T, liveMediaDir, mediaURL string) string {
	t.Helper()

	filename := strings.TrimPrefix(mediaURL, "/static/live-media/")
	if filename == mediaURL || filename == "" || filename != filepath.Base(filename) {
		t.Fatalf("unexpected live media url %q", mediaURL)
	}
	return filepath.Join(liveMediaDir, filename)
}

func assertFileExists(t *testing.T, path string) {
	t.Helper()
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected file %s to exist: %v", path, err)
	}
}

func assertFileRemoved(t *testing.T, path string) {
	t.Helper()
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("expected file %s to be removed, stat err=%v", path, err)
	}
}

func createAndPublishProduct(t *testing.T, ts *httptest.Server, token, title, imageURL string) (int64, int64) {
	body, _ := json.Marshal(map[string]interface{}{
		"title": title, "description": "desc",
		"image_urls": []string{imageURL},
	})
	resp, _ := makeRequest("POST", ts.URL+"/api/v1/products", token, body)
	if resp.StatusCode != 201 {
		t.Fatalf("expected create 201, got %d", resp.StatusCode)
	}
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	resp.Body.Close()
	productData := result["data"].(map[string]interface{})["product"].(map[string]interface{})
	productID := int64(productData["id"].(float64))

	pubBody, _ := json.Marshal(map[string]interface{}{
		"start_price": 20, "bid_increment_type": "fixed",
		"bid_increment_value": 10, "duration_seconds": 300,
		"auto_extend_seconds": 15, "max_extend_count": 5,
	})
	resp2, _ := makeRequest("POST", ts.URL+fmt.Sprintf("/api/v1/products/%d/publish", productID), token, pubBody)
	if resp2.StatusCode != 200 {
		t.Fatalf("expected publish 200, got %d", resp2.StatusCode)
	}
	var publishResult map[string]interface{}
	json.NewDecoder(resp2.Body).Decode(&publishResult)
	resp2.Body.Close()
	auction := publishResult["data"].(map[string]interface{})["auction"].(map[string]interface{})
	return productID, int64(auction["id"].(float64))
}

func TestMerchantUploadsProductLiveMedia(t *testing.T) {
	r, _ := setupProductServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerMerchant(t, ts)
	draftProductID := createLiveMediaDraftProduct(t, ts, merchantToken, "Upload Live Image")

	imageResp := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", draftProductID), merchantToken, "media", "scene.webp", "image/webp", validWebPContent("image bytes"))
	defer imageResp.Body.Close()
	if imageResp.StatusCode != http.StatusOK {
		t.Fatalf("expected image upload 200, got %d", imageResp.StatusCode)
	}
	var imageResult map[string]interface{}
	if err := json.NewDecoder(imageResp.Body).Decode(&imageResult); err != nil {
		t.Fatalf("decode image upload response: %v", err)
	}
	imageData := imageResult["data"].(map[string]interface{})
	if imageData["type"] != "image" {
		t.Fatalf("expected image type, got %#v", imageData["type"])
	}
	imageURL, ok := imageData["url"].(string)
	if !ok || !strings.HasPrefix(imageURL, "/static/live-media/") {
		t.Fatalf("expected live media static url, got %#v", imageData["url"])
	}

	pendingProductID, _ := createAndPublishProduct(t, ts, merchantToken, "Upload Live Video", "/static/images/video-test.jpg")
	videoResp := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", pendingProductID), merchantToken, "media", "scene.mp4", "video/mp4", validMP4Content("video bytes"))
	defer videoResp.Body.Close()
	if videoResp.StatusCode != http.StatusOK {
		t.Fatalf("expected video upload 200, got %d", videoResp.StatusCode)
	}
	var videoResult map[string]interface{}
	if err := json.NewDecoder(videoResp.Body).Decode(&videoResult); err != nil {
		t.Fatalf("decode video upload response: %v", err)
	}
	videoData := videoResult["data"].(map[string]interface{})
	if videoData["type"] != "video" {
		t.Fatalf("expected video type, got %#v", videoData["type"])
	}
	videoURL, ok := videoData["url"].(string)
	if !ok || !strings.HasPrefix(videoURL, "/static/live-media/") {
		t.Fatalf("expected live media static url, got %#v", videoData["url"])
	}
}

func TestProductLiveMediaReplacementRemovesOldFile(t *testing.T) {
	srv := setupProductServerWithDirs(t)
	ts := httptest.NewServer(srv.router)
	defer ts.Close()

	merchantToken := registerMerchant(t, ts)
	productID := createLiveMediaDraftProduct(t, ts, merchantToken, "Replace Live Media")

	firstResp := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", productID), merchantToken, "media", "first.webp", "image/webp", validWebPContent("first image"))
	defer firstResp.Body.Close()
	if firstResp.StatusCode != http.StatusOK {
		t.Fatalf("expected first upload 200, got %d", firstResp.StatusCode)
	}
	firstURL := decodeLiveMediaURL(t, firstResp)
	firstPath := liveMediaFilePath(t, srv.liveMediaDir, firstURL)
	assertFileExists(t, firstPath)

	secondResp := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", productID), merchantToken, "media", "second.webp", "image/webp", validWebPContent("second image"))
	defer secondResp.Body.Close()
	if secondResp.StatusCode != http.StatusOK {
		t.Fatalf("expected second upload 200, got %d", secondResp.StatusCode)
	}
	secondURL := decodeLiveMediaURL(t, secondResp)
	if secondURL == firstURL {
		t.Fatal("expected replacement upload to use a new URL")
	}
	secondPath := liveMediaFilePath(t, srv.liveMediaDir, secondURL)

	assertFileRemoved(t, firstPath)
	assertFileExists(t, secondPath)

	detailResp, err := makeRequest("GET", ts.URL+fmt.Sprintf("/api/v1/products/%d", productID), merchantToken, nil)
	if err != nil {
		t.Fatalf("get product detail failed: %v", err)
	}
	defer detailResp.Body.Close()
	if detailResp.StatusCode != http.StatusOK {
		t.Fatalf("expected detail 200, got %d", detailResp.StatusCode)
	}
	var detail map[string]interface{}
	if err := json.NewDecoder(detailResp.Body).Decode(&detail); err != nil {
		t.Fatalf("decode detail response: %v", err)
	}
	liveMedia := detail["data"].(map[string]interface{})["live_media"].(map[string]interface{})
	if liveMedia["url"] != secondURL {
		t.Fatalf("expected DB row to point at replacement URL %q, got %#v", secondURL, liveMedia["url"])
	}
}

func TestProductLiveMediaDeleteRemovesFileAndKeepsImages(t *testing.T) {
	srv := setupProductServerWithDirs(t)
	ts := httptest.NewServer(srv.router)
	defer ts.Close()

	merchantToken := registerMerchant(t, ts)
	productID := createLiveMediaDraftProduct(t, ts, merchantToken, "Delete Live Media")

	uploadResp := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", productID), merchantToken, "media", "delete.webp", "image/webp", validWebPContent("delete image"))
	defer uploadResp.Body.Close()
	if uploadResp.StatusCode != http.StatusOK {
		t.Fatalf("expected upload 200, got %d", uploadResp.StatusCode)
	}
	mediaURL := decodeLiveMediaURL(t, uploadResp)
	mediaPath := liveMediaFilePath(t, srv.liveMediaDir, mediaURL)
	assertFileExists(t, mediaPath)

	deleteResp, err := makeRequest("DELETE", ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", productID), merchantToken, nil)
	if err != nil {
		t.Fatalf("delete live media failed: %v", err)
	}
	defer deleteResp.Body.Close()
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("expected delete 200, got %d", deleteResp.StatusCode)
	}
	assertFileRemoved(t, mediaPath)

	detailResp, err := makeRequest("GET", ts.URL+fmt.Sprintf("/api/v1/products/%d", productID), merchantToken, nil)
	if err != nil {
		t.Fatalf("get product detail failed: %v", err)
	}
	defer detailResp.Body.Close()
	var detail map[string]interface{}
	if err := json.NewDecoder(detailResp.Body).Decode(&detail); err != nil {
		t.Fatalf("decode detail response: %v", err)
	}
	data := detail["data"].(map[string]interface{})
	if data["live_media"] != nil {
		t.Fatalf("expected live_media to be absent after delete, got %#v", data["live_media"])
	}
	images := data["images"].([]interface{})
	if len(images) != 1 {
		t.Fatalf("expected one product image to remain, got %d", len(images))
	}
	image := images[0].(map[string]interface{})
	if image["image_url"] != "/static/images/test.jpg" {
		t.Fatalf("expected product image unchanged, got %#v", image["image_url"])
	}
}

func TestDeleteDraftProductRemovesLiveMediaFile(t *testing.T) {
	srv := setupProductServerWithDirs(t)
	ts := httptest.NewServer(srv.router)
	defer ts.Close()

	merchantToken := registerMerchant(t, ts)
	productID := createLiveMediaDraftProduct(t, ts, merchantToken, "Delete Product Live Media")

	uploadResp := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", productID), merchantToken, "media", "product-delete.webp", "image/webp", validWebPContent("product delete"))
	defer uploadResp.Body.Close()
	if uploadResp.StatusCode != http.StatusOK {
		t.Fatalf("expected upload 200, got %d", uploadResp.StatusCode)
	}
	mediaURL := decodeLiveMediaURL(t, uploadResp)
	mediaPath := liveMediaFilePath(t, srv.liveMediaDir, mediaURL)
	assertFileExists(t, mediaPath)

	deleteResp, err := makeRequest("DELETE", ts.URL+fmt.Sprintf("/api/v1/products/%d", productID), merchantToken, nil)
	if err != nil {
		t.Fatalf("delete product failed: %v", err)
	}
	defer deleteResp.Body.Close()
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("expected delete product 200, got %d", deleteResp.StatusCode)
	}
	assertFileRemoved(t, mediaPath)
}

func TestProductLiveMediaOversizedFilesRejected(t *testing.T) {
	r, _ := setupProductServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerMerchant(t, ts)
	productID := createLiveMediaDraftProduct(t, ts, merchantToken, "Oversized Live Media")

	oversizedImage := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", productID), merchantToken, "media", "large.webp", "image/webp", bytes.Repeat([]byte("i"), 2*1024*1024+1))
	defer oversizedImage.Body.Close()
	if oversizedImage.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected oversized image rejected, got %d", oversizedImage.StatusCode)
	}

	oversizedVideo := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", productID), merchantToken, "media", "large.mp4", "video/mp4", bytes.Repeat([]byte("v"), 20*1024*1024+1))
	defer oversizedVideo.Body.Close()
	if oversizedVideo.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected oversized video rejected, got %d", oversizedVideo.StatusCode)
	}
}

func TestProductLiveMediaStaticServing(t *testing.T) {
	srv := setupProductServerWithDirs(t)
	ts := httptest.NewServer(srv.router)
	defer ts.Close()

	merchantToken := registerMerchant(t, ts)
	productID := createLiveMediaDraftProduct(t, ts, merchantToken, "Served Live Media")
	content := validWebPContent("served live media bytes")

	uploadResp := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", productID), merchantToken, "media", "served.webp", "image/webp", content)
	defer uploadResp.Body.Close()
	if uploadResp.StatusCode != http.StatusOK {
		t.Fatalf("expected upload 200, got %d", uploadResp.StatusCode)
	}
	mediaURL := decodeLiveMediaURL(t, uploadResp)
	assertFileExists(t, liveMediaFilePath(t, srv.liveMediaDir, mediaURL))

	staticResp, err := http.Get(ts.URL + mediaURL)
	if err != nil {
		t.Fatalf("get static live media failed: %v", err)
	}
	defer staticResp.Body.Close()
	if staticResp.StatusCode != http.StatusOK {
		t.Fatalf("expected static file 200, got %d", staticResp.StatusCode)
	}
	body, err := io.ReadAll(staticResp.Body)
	if err != nil {
		t.Fatalf("read static live media response: %v", err)
	}
	if !bytes.Equal(body, content) {
		t.Fatalf("expected static file body %q, got %q", string(content), string(body))
	}
}

func TestProductLiveMediaGuards(t *testing.T) {
	r, db := setupProductServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	ownerToken := registerMerchant(t, ts)
	otherToken := registerMerchant(t, ts)
	productID := createLiveMediaDraftProduct(t, ts, ownerToken, "Guarded Live Media")

	nonOwner := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", productID), otherToken, "media", "scene.webp", "image/webp", validWebPContent("image"))
	defer nonOwner.Body.Close()
	if nonOwner.StatusCode != http.StatusForbidden {
		t.Fatalf("expected non-owner forbidden, got %d", nonOwner.StatusCode)
	}

	badType := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", productID), ownerToken, "media", "scene.txt", "text/plain", []byte("plain"))
	defer badType.Body.Close()
	if badType.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected bad type rejected, got %d", badType.StatusCode)
	}

	activeProductID, activeAuctionID := createAndPublishProduct(t, ts, ownerToken, "Active Live Media", "/static/images/active-live.jpg")
	_, err := db.Exec(
		`UPDATE products p
         JOIN auctions a ON a.product_id = p.id
         SET p.status = 'active', a.status = 'active', a.started_at = NOW()
         WHERE a.id = ?`,
		activeAuctionID,
	)
	if err != nil {
		t.Fatalf("activate live media product: %v", err)
	}
	active := uploadMultipartFile(t, ts.URL+fmt.Sprintf("/api/v1/products/%d/live-media", activeProductID), ownerToken, "media", "scene.webp", "image/webp", validWebPContent("image"))
	defer active.Body.Close()
	if active.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected active product mutation rejected, got %d", active.StatusCode)
	}
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

func TestProductDetailIncludesLiveMedia(t *testing.T) {
	r, db := setupProductServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerMerchant(t, ts)
	productID, _ := createAndPublishProduct(t, ts, merchantToken, "Live Media Product", "/static/images/live-media-product.jpg")

	_, err := db.Exec(`
		INSERT INTO product_live_media (product_id, media_type, media_url, poster_url)
		VALUES (?, 'image', '/static/live-media/live-room.webp', NULL)
		ON DUPLICATE KEY UPDATE media_type = VALUES(media_type), media_url = VALUES(media_url), poster_url = VALUES(poster_url)
	`, productID)
	if err != nil {
		t.Fatalf("insert live media: %v", err)
	}

	resp, err := makeRequest("GET", ts.URL+fmt.Sprintf("/api/v1/products/%d", productID), merchantToken, nil)
	if err != nil {
		t.Fatalf("get product detail failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected detail 200, got %d", resp.StatusCode)
	}

	var detail map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&detail); err != nil {
		t.Fatalf("decode detail response: %v", err)
	}
	data := detail["data"].(map[string]interface{})
	liveMedia, ok := data["live_media"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected live_media object, got %#v", data["live_media"])
	}
	if liveMedia["type"] != "image" {
		t.Fatalf("expected image live media, got %#v", liveMedia["type"])
	}
	if liveMedia["url"] != "/static/live-media/live-room.webp" {
		t.Fatalf("unexpected live media url %#v", liveMedia["url"])
	}
}

func TestUserListsActiveAuctionLobbyRows(t *testing.T) {
	r, db := setupProductServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerMerchant(t, ts)
	userToken := registerUser(t, ts)

	activeProductID, activeAuctionID := createAndPublishProduct(t, ts, merchantToken, "Active Lobby Product", "/static/images/active.jpg")
	_, pendingAuctionID := createAndPublishProduct(t, ts, merchantToken, "Pending Lobby Product", "/static/images/pending.jpg")

	_, err := db.Exec(
		`UPDATE products p
         JOIN auctions a ON a.product_id = p.id
         SET p.status = 'active', a.status = 'active', a.started_at = NOW(),
             a.ended_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE), a.current_price = 30
         WHERE a.id = ?`,
		activeAuctionID,
	)
	if err != nil {
		t.Fatalf("activate lobby auction: %v", err)
	}

	resp, err := makeRequest("GET", ts.URL+"/api/v1/products?status=active&page=1&size=20", userToken, nil)
	if err != nil {
		t.Fatalf("list lobby rows failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected list 200, got %d", resp.StatusCode)
	}

	var listResult map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&listResult); err != nil {
		t.Fatalf("decode lobby list response: %v", err)
	}
	data := listResult["data"].(map[string]interface{})
	items, ok := data["items"].([]interface{})
	if !ok {
		t.Fatalf("expected lobby items array, got %T", data["items"])
	}

	foundActive := false
	for _, rawItem := range items {
		item := rawItem.(map[string]interface{})
		if int64(item["auction_id"].(float64)) == pendingAuctionID {
			t.Fatal("pending auction should not be visible in lobby")
		}
		if int64(item["product_id"].(float64)) != activeProductID {
			continue
		}

		foundActive = true
		if int64(item["auction_id"].(float64)) != activeAuctionID {
			t.Fatalf("expected auction_id %d, got %v", activeAuctionID, item["auction_id"])
		}
		if item["title"] != "Active Lobby Product" {
			t.Fatalf("expected active title, got %v", item["title"])
		}
		if item["image_url"] != "/static/images/active.jpg" {
			t.Fatalf("expected first image url, got %v", item["image_url"])
		}
		if item["status"] != "active" {
			t.Fatalf("expected active auction status, got %v", item["status"])
		}
		if item["current_price"].(float64) != 30 {
			t.Fatalf("expected current price 30, got %v", item["current_price"])
		}
		if item["ended_at"] == nil {
			t.Fatal("expected ended_at in lobby row")
		}
	}
	if !foundActive {
		t.Fatalf("expected active product %d in lobby items, got %d items", activeProductID, len(items))
	}
}

func TestUserLobbyUsesUTCComparisonForActiveAuctions(t *testing.T) {
	r, db := setupProductServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerMerchant(t, ts)
	userToken := registerUser(t, ts)

	activeProductID, activeAuctionID := createAndPublishProduct(t, ts, merchantToken, "UTC Lobby Product", "/static/images/utc.jpg")

	_, err := db.Exec(
		`UPDATE products p
         JOIN auctions a ON a.product_id = p.id
         SET p.status = 'active', a.status = 'active', a.started_at = UTC_TIMESTAMP(),
             a.ended_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE), a.current_price = 42
         WHERE a.id = ?`,
		activeAuctionID,
	)
	if err != nil {
		t.Fatalf("activate utc lobby auction: %v", err)
	}

	resp, err := makeRequest("GET", ts.URL+"/api/v1/products?status=active&page=1&size=20", userToken, nil)
	if err != nil {
		t.Fatalf("list utc lobby rows failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected list 200, got %d", resp.StatusCode)
	}

	var listResult map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&listResult); err != nil {
		t.Fatalf("decode utc lobby list response: %v", err)
	}
	data := listResult["data"].(map[string]interface{})
	items, ok := data["items"].([]interface{})
	if !ok {
		t.Fatalf("expected lobby items array containing UTC active product %d, got %#v", activeProductID, data["items"])
	}

	for _, rawItem := range items {
		item := rawItem.(map[string]interface{})
		if int64(item["product_id"].(float64)) == activeProductID {
			return
		}
	}
	t.Fatalf("expected UTC active product %d in lobby items, got %d items", activeProductID, len(items))
}

func TestMerchantListsProductsWithAuctionIDs(t *testing.T) {
	r, _ := setupProductServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken := registerMerchant(t, ts)
	productID, auctionID := createAndPublishProduct(t, ts, merchantToken, "Merchant Monitor Product", "/static/images/monitor.jpg")

	resp, err := makeRequest("GET", ts.URL+"/api/v1/products?page=1&size=20", merchantToken, nil)
	if err != nil {
		t.Fatalf("list merchant products failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected merchant product list 200, got %d", resp.StatusCode)
	}

	var listResult map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&listResult); err != nil {
		t.Fatalf("decode merchant product list response: %v", err)
	}
	data := listResult["data"].(map[string]interface{})
	items := data["items"].([]interface{})

	for _, rawItem := range items {
		item := rawItem.(map[string]interface{})
		if int64(item["id"].(float64)) != productID {
			continue
		}
		rawAuctionID, ok := item["auction_id"].(float64)
		if !ok {
			t.Fatalf("expected auction_id on merchant list row, got %#v", item["auction_id"])
		}
		if int64(rawAuctionID) != auctionID {
			t.Fatalf("expected auction_id %d, got %#v", auctionID, item["auction_id"])
		}
		if item["image_url"] != "/static/images/monitor.jpg" {
			t.Fatalf("expected merchant list image_url, got %#v", item["image_url"])
		}
		return
	}
	t.Fatalf("expected product %d in merchant list", productID)
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
