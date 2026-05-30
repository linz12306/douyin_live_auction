package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"douyin-live/backend/internal/config"
	"douyin-live/backend/internal/handler"
	"douyin-live/backend/internal/repository"
	"douyin-live/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func setupTestServer(t *testing.T) *gin.Engine {
	cfg := config.Load()

	db, err := config.NewDB(cfg.DBDSN)
	if err != nil {
		t.Fatalf("Failed to connect to MySQL: %v", err)
	}
	acquireMySQLTestLock(t, db)

	rdb, err := config.NewRedis(cfg.RedisAddr, cfg.RedisPass)
	if err != nil {
		t.Fatalf("Failed to connect to Redis: %v", err)
	}

	// Clean up test user
	db.Exec("DELETE FROM users WHERE username = ?", "testuser_flow")

	userRepo := repository.NewUserRepo(db)
	authSvc := service.NewAuthService(userRepo, rdb, cfg)
	userSvc := service.NewUserService(userRepo)
	authH := handler.NewAuthHandler(authSvc)
	userH := handler.NewUserHandler(userSvc, cfg.AvatarDir)

	r := gin.New()
	r.POST("/api/v1/auth/register", authH.Register)
	r.POST("/api/v1/auth/login", authH.Login)
	r.POST("/api/v1/auth/refresh", authH.Refresh)
	r.POST("/api/v1/auth/logout", authH.Logout)
	r.GET("/api/v1/users/me", func(c *gin.Context) {
		c.Set("user_id", int64(1))
		userH.GetMe(c)
	})

	return r
}

func TestRegisterLoginRefreshFlow(t *testing.T) {
	r := setupTestServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	// 1. Register
	body, _ := json.Marshal(map[string]string{
		"username":     "testuser_flow",
		"password":     "test123",
		"role":         "user",
		"display_name": "Test User",
	})
	resp, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("register request failed: %v", err)
	}
	if resp.StatusCode != 201 {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	resp.Body.Close()

	data := result["data"].(map[string]interface{})
	accessToken := data["access_token"].(string)
	refreshToken := data["refresh_token"].(string)
	if accessToken == "" || refreshToken == "" {
		t.Fatal("expected non-empty tokens")
	}

	// 2. Login
	body2, _ := json.Marshal(map[string]string{
		"username": "testuser_flow",
		"password": "test123",
	})
	resp2, err := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewReader(body2))
	if err != nil {
		t.Fatalf("login request failed: %v", err)
	}
	if resp2.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp2.StatusCode)
	}
	resp2.Body.Close()

	// 3. Refresh
	body3, _ := json.Marshal(map[string]string{"refresh_token": refreshToken})
	resp3, err := http.Post(ts.URL+"/api/v1/auth/refresh", "application/json", bytes.NewReader(body3))
	if err != nil {
		t.Fatalf("refresh request failed: %v", err)
	}
	if resp3.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp3.StatusCode)
	}
	resp3.Body.Close()

	// 4. Logout
	body4, _ := json.Marshal(map[string]string{"refresh_token": refreshToken})
	resp4, err := http.Post(ts.URL+"/api/v1/auth/logout", "application/json", bytes.NewReader(body4))
	if err != nil {
		t.Fatalf("logout request failed: %v", err)
	}
	if resp4.StatusCode != 200 {
		t.Fatalf("expected 200, got %d", resp4.StatusCode)
	}
	resp4.Body.Close()
}

func TestRegisterDuplicateUsername(t *testing.T) {
	r := setupTestServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	body, _ := json.Marshal(map[string]string{
		"username":     "testuser_flow",
		"password":     "test123",
		"role":         "user",
		"display_name": "Test User",
	})
	resp, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(body))
	resp.Body.Close()

	resp2, _ := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(body))
	if resp2.StatusCode != 409 {
		t.Fatalf("expected 409, got %d", resp2.StatusCode)
	}
	resp2.Body.Close()
}

func TestLoginInvalidPassword(t *testing.T) {
	r := setupTestServer(t)
	ts := httptest.NewServer(r)
	defer ts.Close()

	body, _ := json.Marshal(map[string]string{
		"username": "testuser_flow",
		"password": "wrongpassword",
	})
	resp, err := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("login request failed: %v", err)
	}
	if resp.StatusCode != 401 {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
	resp.Body.Close()
}
