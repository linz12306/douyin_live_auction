package handler

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"douyin-live/backend/internal/config"
	"douyin-live/backend/internal/middleware"
	"douyin-live/backend/internal/realtime"
	"douyin-live/backend/internal/repository"
	"douyin-live/backend/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func TestRealtimeHandlerMissingTokenFails(t *testing.T) {
	setup := setupRealtimeHandlerServer(t)
	ts := httptest.NewServer(setup.router)
	defer ts.Close()

	_, resp, err := websocket.DefaultDialer.Dial(wsURL(ts.URL, fmt.Sprintf("/ws/auctions/%d", setup.auctionID)), nil)
	if err == nil {
		t.Fatal("expected websocket dial to fail without token")
	}
	if resp == nil {
		t.Fatal("expected HTTP response for failed websocket dial")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", resp.StatusCode)
	}
}

func TestRealtimeHandlerValidTokenConnectsAndFirstMessageIsSnapshot(t *testing.T) {
	setup := setupRealtimeHandlerServer(t)
	ts := httptest.NewServer(setup.router)
	defer ts.Close()

	conn := dialRealtime(t, ts.URL, setup.auctionID, setup.userAToken)
	defer conn.Close()

	msg := readEnvelope(t, conn)
	assertSnapshotEnvelope(t, msg, setup.auctionID)
}

func TestRealtimeSnapshotIncludesLiveMedia(t *testing.T) {
	setup := setupRealtimeHandlerServer(t)
	ts := httptest.NewServer(setup.router)
	defer ts.Close()

	insertRealtimeLiveMedia(t, setup.db, setup.auctionID)

	conn := dialRealtime(t, ts.URL, setup.auctionID, setup.userAToken)
	defer conn.Close()

	msg := readEnvelope(t, conn)
	assertSnapshotEnvelope(t, msg, setup.auctionID)

	payload := msg.Payload.(map[string]interface{})
	product := payload["product"].(map[string]interface{})
	liveMedia, ok := product["live_media"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected product live_media object, got %T", product["live_media"])
	}
	if liveMedia["type"] != "video" {
		t.Fatalf("expected video live media, got %#v", liveMedia["type"])
	}
	if liveMedia["url"] != "/static/live-media/realtime.mp4" {
		t.Fatalf("unexpected live media url %#v", liveMedia["url"])
	}
	if liveMedia["poster_url"] != "/static/live-media/realtime-poster.jpg" {
		t.Fatalf("unexpected live media poster_url %#v", liveMedia["poster_url"])
	}
}

func TestRealtimeHandlerReconnectReceivesFreshSnapshot(t *testing.T) {
	setup := setupRealtimeHandlerServer(t)
	ts := httptest.NewServer(setup.router)
	defer ts.Close()

	first := dialRealtime(t, ts.URL, setup.auctionID, setup.userAToken)
	firstSnapshot := readEnvelope(t, first)
	assertSnapshotEnvelope(t, firstSnapshot, setup.auctionID)
	_ = first.Close()

	second := dialRealtime(t, ts.URL, setup.auctionID, setup.userAToken)
	defer second.Close()
	secondSnapshot := readEnvelope(t, second)
	assertSnapshotEnvelope(t, secondSnapshot, setup.auctionID)
}

func TestRealtimeHandlerBroadcastsPriceUpdateToSameAuctionWebSocketClients(t *testing.T) {
	setup := setupRealtimeHandlerServer(t)
	ts := httptest.NewServer(setup.router)
	defer ts.Close()

	first := dialRealtime(t, ts.URL, setup.auctionID, setup.userAToken)
	defer first.Close()
	firstSnapshot := readEnvelope(t, first)
	assertSnapshotEnvelope(t, firstSnapshot, setup.auctionID)

	second := dialRealtime(t, ts.URL, setup.auctionID, setup.userBToken)
	defer second.Close()
	secondSnapshot := readEnvelope(t, second)
	assertSnapshotEnvelope(t, secondSnapshot, setup.auctionID)

	updateRealtimeAuctionPrice(t, setup.db, setup.auctionID, setup.userAID, 120)
	expectedVersion := firstSnapshot.Version + 1
	if err := setup.bus.Publish(context.Background(), realtime.AuctionEvent{
		Type:       realtime.EventBidAccepted,
		AuctionID:  setup.auctionID,
		Version:    expectedVersion,
		UserID:     setup.userAID,
		Amount:     120,
		OccurredAt: time.Now(),
	}); err != nil {
		t.Fatalf("publish bid accepted event: %v", err)
	}

	firstUpdate := readEnvelope(t, first)
	assertEnvelopeType(t, firstUpdate, realtime.MessagePriceUpdate)
	if firstUpdate.Version != expectedVersion {
		t.Fatalf("expected price_update version to match snapshot-backed payload version %d, got %d", expectedVersion, firstUpdate.Version)
	}
	secondUpdate := readEnvelope(t, second)
	assertEnvelopeType(t, secondUpdate, realtime.MessagePriceUpdate)
	if secondUpdate.Version != secondSnapshot.Version+1 {
		t.Fatalf("expected price_update version to match snapshot-backed payload version %d, got %d", secondSnapshot.Version+1, secondUpdate.Version)
	}
}

func TestRealtimeHandlerSendsPrivateOutbidOnlyToPreviousBidder(t *testing.T) {
	setup := setupRealtimeHandlerServer(t)
	ts := httptest.NewServer(setup.router)
	defer ts.Close()

	userA := dialRealtime(t, ts.URL, setup.auctionID, setup.userAToken)
	defer userA.Close()
	assertSnapshotEnvelope(t, readEnvelope(t, userA), setup.auctionID)

	userB := dialRealtime(t, ts.URL, setup.auctionID, setup.userBToken)
	defer userB.Close()
	assertSnapshotEnvelope(t, readEnvelope(t, userB), setup.auctionID)

	previousUserID := setup.userAID
	if err := setup.bus.Publish(context.Background(), realtime.AuctionEvent{
		Type:           realtime.EventBidOutbid,
		AuctionID:      setup.auctionID,
		Version:        11,
		UserID:         setup.userBID,
		PreviousUserID: &previousUserID,
		Amount:         150,
		PreviousAmount: 120,
		OccurredAt:     time.Now(),
	}); err != nil {
		t.Fatalf("publish outbid event: %v", err)
	}

	assertEnvelopeType(t, readEnvelope(t, userA), realtime.MessageOutbid)
	assertNoWebSocketEnvelope(t, userB)
}

func TestRealtimeHandlerDeliversQueuedOutbidWithSnapshotVersionAfterInitialSnapshot(t *testing.T) {
	setup := setupRealtimeHandlerServer(t)
	ts := httptest.NewServer(setup.router)
	defer ts.Close()

	previousUserID := setup.userAID
	setup.realtimeH.snapshots = snapshotHook{
		base: setup.snapshots,
		afterSnapshot: func(snapshot *realtime.Envelope) {
			setup.hub.SendToUser(setup.auctionID, previousUserID, realtime.Envelope{
				Type:       realtime.MessageOutbid,
				AuctionID:  setup.auctionID,
				Version:    snapshot.Version,
				ServerTime: time.Now(),
				Payload: realtime.OutbidPayload{
					PreviousAmount: 100,
					NewAmount:      120,
					NewBidderID:    setup.userBID,
				},
			})
		},
	}

	conn := dialRealtime(t, ts.URL, setup.auctionID, setup.userAToken)
	defer conn.Close()

	snapshot := readEnvelope(t, conn)
	assertSnapshotEnvelope(t, snapshot, setup.auctionID)

	outbid := readEnvelope(t, conn)
	assertEnvelopeType(t, outbid, realtime.MessageOutbid)
	if outbid.Version != snapshot.Version {
		t.Fatalf("expected queued outbid version %d, got %d", snapshot.Version, outbid.Version)
	}
}

type realtimeHandlerSetup struct {
	router     *gin.Engine
	db         *sql.DB
	bus        *realtime.InMemoryAuctionEventBus
	hub        *realtime.Hub
	snapshots  *realtime.SnapshotProvider
	realtimeH  *RealtimeHandler
	userAToken string
	userAID    int64
	userBToken string
	userBID    int64
	auctionID  int64
}

func setupRealtimeHandlerServer(t *testing.T) *realtimeHandlerSetup {
	t.Helper()

	gin.SetMode(gin.TestMode)
	cfg := config.Load()
	db, err := config.NewDB(cfg.DBDSN)
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	acquireMySQLTestLock(t, db)
	cleanupRealtimeHandlerTestData(t, db)
	t.Cleanup(func() {
		cleanupRealtimeHandlerTestData(t, db)
		_ = db.Close()
	})

	rdb, err := config.NewRedis(cfg.RedisAddr, cfg.RedisPass)
	if err != nil {
		t.Fatalf("connect test redis: %v", err)
	}
	t.Cleanup(func() { _ = rdb.Close() })

	userRepo := repository.NewUserRepo(db)
	productRepo := repository.NewProductRepo(db)
	auctionRepo := repository.NewAuctionRepo(db)
	auctionEngineRepo := repository.NewAuctionEngineRepo(db)

	authSvc := service.NewAuthService(userRepo, rdb, cfg)
	productSvc := service.NewProductService(productRepo, auctionRepo)
	auctionSvc := service.NewAuctionService(auctionEngineRepo, rdb)
	bus := realtime.NewInMemoryAuctionEventBus()
	snapshots := realtime.NewSnapshotProvider(auctionEngineRepo)
	hub := realtime.NewHub(bus, snapshots)
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go hub.Run(ctx)

	authH := NewAuthHandler(authSvc)
	productH := NewProductHandler(productSvc, cfg.ImageDir, cfg.LiveMediaDir)
	auctionH := NewAuctionHandler(auctionSvc)
	realtimeH := NewRealtimeHandler(hub, snapshots, cfg)

	r := gin.New()
	auth := r.Group("/api/v1/auth")
	{
		auth.POST("/register", authH.Register)
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
		auctions.POST("/:id/activate", middleware.RoleGuard("merchant"), auctionH.Activate)
	}
	r.GET("/ws/auctions/:id", realtimeH.AuctionRoom)

	ts := httptest.NewServer(r)
	defer ts.Close()

	merchantToken, _ := registerRealtimeUser(t, ts.URL, "rt_mer_", "merchant")
	userAToken, userAID := registerRealtimeUser(t, ts.URL, "rt_usr_", "user")
	userBToken, userBID := registerRealtimeUser(t, ts.URL, "rt_usr_", "user")
	auctionID := publishRealtimeAuction(t, ts.URL, merchantToken)
	activateRealtimeAuction(t, ts.URL, merchantToken, auctionID)

	return &realtimeHandlerSetup{
		router:     r,
		db:         db,
		bus:        bus,
		hub:        hub,
		snapshots:  snapshots,
		realtimeH:  realtimeH,
		userAToken: userAToken,
		userAID:    userAID,
		userBToken: userBToken,
		userBID:    userBID,
		auctionID:  auctionID,
	}
}

type snapshotHook struct {
	base          *realtime.SnapshotProvider
	afterSnapshot func(snapshot *realtime.Envelope)
}

func (s snapshotHook) Snapshot(ctx context.Context, auctionID int64) (*realtime.Envelope, error) {
	snapshot, err := s.base.Snapshot(ctx, auctionID)
	if err != nil {
		return nil, err
	}
	if s.afterSnapshot != nil {
		s.afterSnapshot(snapshot)
	}
	return snapshot, nil
}

func registerRealtimeUser(t *testing.T, baseURL, prefix, role string) (string, int64) {
	t.Helper()

	body, _ := json.Marshal(map[string]string{
		"username":     prefix + fmt.Sprint(time.Now().UnixNano()%1_000_000_000),
		"password":     "test123",
		"role":         role,
		"display_name": role + " user",
	})
	resp, err := http.Post(baseURL+"/api/v1/auth/register", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("register realtime user: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected register 201, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("decode register response: %v", err)
	}
	data := result["data"].(map[string]interface{})
	user := data["user"].(map[string]interface{})
	return data["access_token"].(string), int64(user["id"].(float64))
}

func publishRealtimeAuction(t *testing.T, baseURL, token string) int64 {
	t.Helper()

	createBody, _ := json.Marshal(map[string]interface{}{
		"title":       "Realtime Product",
		"description": "websocket snapshot test",
		"image_urls":  []string{"/static/images/realtime.jpg"},
	})
	createResp := realtimeRequest(t, "POST", baseURL+"/api/v1/products", token, createBody)
	defer createResp.Body.Close()
	if createResp.StatusCode != http.StatusCreated {
		t.Fatalf("expected create product 201, got %d", createResp.StatusCode)
	}
	var createResult map[string]interface{}
	if err := json.NewDecoder(createResp.Body).Decode(&createResult); err != nil {
		t.Fatalf("decode create product response: %v", err)
	}
	product := createResult["data"].(map[string]interface{})["product"].(map[string]interface{})
	productID := int64(product["id"].(float64))

	publishBody, _ := json.Marshal(map[string]interface{}{
		"start_price":         0,
		"bid_increment_type":  "fixed",
		"bid_increment_value": 10,
		"duration_seconds":    300,
		"auto_extend_seconds": 15,
		"max_extend_count":    5,
	})
	publishResp := realtimeRequest(t, "POST", fmt.Sprintf("%s/api/v1/products/%d/publish", baseURL, productID), token, publishBody)
	defer publishResp.Body.Close()
	if publishResp.StatusCode != http.StatusOK {
		t.Fatalf("expected publish 200, got %d", publishResp.StatusCode)
	}
	var publishResult map[string]interface{}
	if err := json.NewDecoder(publishResp.Body).Decode(&publishResult); err != nil {
		t.Fatalf("decode publish response: %v", err)
	}
	auction := publishResult["data"].(map[string]interface{})["auction"].(map[string]interface{})
	return int64(auction["id"].(float64))
}

func activateRealtimeAuction(t *testing.T, baseURL, token string, auctionID int64) {
	t.Helper()

	resp := realtimeRequest(t, "POST", fmt.Sprintf("%s/api/v1/auctions/%d/activate", baseURL, auctionID), token, nil)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected activate 200, got %d", resp.StatusCode)
	}
}

func updateRealtimeAuctionPrice(t *testing.T, db *sql.DB, auctionID int64, bidderID int64, amount float64) {
	t.Helper()

	result, err := db.Exec(
		`UPDATE auctions
		 SET current_price = ?, highest_bidder_id = ?, version = version + 1
		 WHERE id = ?`,
		amount,
		bidderID,
		auctionID,
	)
	if err != nil {
		t.Fatalf("update realtime auction price: %v", err)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		t.Fatalf("read updated auction rows: %v", err)
	}
	if rows != 1 {
		t.Fatalf("expected to update 1 auction row, updated %d", rows)
	}
}

func insertRealtimeLiveMedia(t *testing.T, db *sql.DB, auctionID int64) {
	t.Helper()

	var productID int64
	if err := db.QueryRow(`SELECT product_id FROM auctions WHERE id = ?`, auctionID).Scan(&productID); err != nil {
		t.Fatalf("find realtime auction product: %v", err)
	}
	_, err := db.Exec(
		`INSERT INTO product_live_media (product_id, media_type, media_url, poster_url)
		 VALUES (?, 'video', '/static/live-media/realtime.mp4', '/static/live-media/realtime-poster.jpg')
		 ON DUPLICATE KEY UPDATE media_type = VALUES(media_type), media_url = VALUES(media_url), poster_url = VALUES(poster_url)`,
		productID,
	)
	if err != nil {
		t.Fatalf("insert realtime live media: %v", err)
	}
}

func realtimeRequest(t *testing.T, method, url, token string, body []byte) *http.Response {
	t.Helper()

	req, err := http.NewRequest(method, url, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s failed: %v", method, url, err)
	}
	return resp
}

func cleanupRealtimeHandlerTestData(t *testing.T, db *sql.DB) {
	t.Helper()

	_, _ = db.Exec("DELETE FROM orders WHERE auction_id IN (SELECT id FROM auctions WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'rt_mer_%'))")
	_, _ = db.Exec("DELETE FROM auction_logs WHERE auction_id IN (SELECT id FROM auctions WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'rt_mer_%'))")
	_, _ = db.Exec("DELETE FROM bids WHERE auction_id IN (SELECT id FROM auctions WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'rt_mer_%'))")
	_, _ = db.Exec("DELETE FROM auctions WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'rt_mer_%')")
	_, _ = db.Exec("DELETE FROM product_live_media WHERE product_id IN (SELECT id FROM products WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'rt_mer_%'))")
	_, _ = db.Exec("DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'rt_mer_%'))")
	_, _ = db.Exec("DELETE FROM products WHERE merchant_id IN (SELECT id FROM users WHERE username LIKE 'rt_mer_%')")
	_, _ = db.Exec("DELETE FROM users WHERE username LIKE 'rt_mer_%'")
	_, _ = db.Exec("DELETE FROM users WHERE username LIKE 'rt_usr_%'")
}

func wsURL(baseURL, path string) string {
	return "ws" + strings.TrimPrefix(baseURL, "http") + path
}

func dialRealtime(t *testing.T, baseURL string, auctionID int64, token string) *websocket.Conn {
	t.Helper()

	conn, resp, err := websocket.DefaultDialer.Dial(wsURL(baseURL, fmt.Sprintf("/ws/auctions/%d?token=%s", auctionID, token)), nil)
	if err != nil {
		if resp != nil {
			defer resp.Body.Close()
			t.Fatalf("expected websocket connect, got status %d: %v", resp.StatusCode, err)
		}
		t.Fatalf("expected websocket connect: %v", err)
	}
	return conn
}

func readEnvelope(t *testing.T, conn *websocket.Conn) realtime.Envelope {
	t.Helper()

	if err := conn.SetReadDeadline(time.Now().Add(time.Second)); err != nil {
		t.Fatalf("set read deadline: %v", err)
	}
	defer func() {
		_ = conn.SetReadDeadline(time.Time{})
	}()

	var msg realtime.Envelope
	if err := conn.ReadJSON(&msg); err != nil {
		t.Fatalf("read websocket message: %v", err)
	}
	return msg
}

func assertEnvelopeType(t *testing.T, msg realtime.Envelope, expectedType string) {
	t.Helper()

	if msg.Type != expectedType {
		t.Fatalf("expected message type %q, got %q", expectedType, msg.Type)
	}
}

func assertSnapshotEnvelope(t *testing.T, msg realtime.Envelope, auctionID int64) {
	t.Helper()

	assertEnvelopeType(t, msg, realtime.MessageSnapshot)
	if msg.AuctionID != auctionID {
		t.Fatalf("expected auction id %d, got %d", auctionID, msg.AuctionID)
	}
	if msg.Version == 0 {
		t.Fatal("expected snapshot version to be nonzero")
	}
	if msg.ServerTime.IsZero() {
		t.Fatal("expected snapshot server_time to be nonzero")
	}

	payload, ok := msg.Payload.(map[string]interface{})
	if !ok {
		t.Fatalf("expected snapshot payload object, got %T", msg.Payload)
	}
	if payload["status"] != "active" {
		t.Fatalf("expected active snapshot status, got %#v", payload["status"])
	}
	if payload["current_price"] == nil {
		t.Fatal("expected current_price in snapshot payload")
	}
	if nextBid, ok := payload["next_bid_amount"].(float64); !ok || nextBid <= 0 {
		t.Fatalf("expected positive next_bid_amount, got %#v", payload["next_bid_amount"])
	}

	product, ok := payload["product"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected product payload object, got %T", payload["product"])
	}
	if product["id"] == nil {
		t.Fatal("expected product id in snapshot payload")
	}
	if product["title"] != "Realtime Product" {
		t.Fatalf("expected product title, got %#v", product["title"])
	}
	if _, ok := product["image_urls"].([]interface{}); !ok {
		t.Fatalf("expected product image_urls array, got %T", product["image_urls"])
	}
	if _, ok := payload["rankings"].([]interface{}); !ok {
		t.Fatalf("expected rankings array, got %T", payload["rankings"])
	}
}

func assertNoWebSocketEnvelope(t *testing.T, conn *websocket.Conn) {
	t.Helper()

	if err := conn.SetReadDeadline(time.Now().Add(150 * time.Millisecond)); err != nil {
		t.Fatalf("set read deadline: %v", err)
	}
	var msg realtime.Envelope
	err := conn.ReadJSON(&msg)
	if err == nil {
		t.Fatalf("expected no websocket message, got %#v", msg)
	}
	if netErr, ok := err.(net.Error); !ok || !netErr.Timeout() {
		t.Fatalf("expected read timeout with no message, got %v", err)
	}
	_ = conn.SetReadDeadline(time.Time{})
}
