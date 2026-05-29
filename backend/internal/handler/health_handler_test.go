package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"douyin-live/backend/internal/service"

	"github.com/gin-gonic/gin"
)

func TestHealthHandlerReturnsOKWithoutAuthentication(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := service.NewHealthServiceWithCheckers(
		handlerDBChecker{},
		handlerRedisChecker{},
		service.EngineStatsProviderFunc(func() service.EngineStats {
			return service.EngineStats{ActiveRooms: 1, ConnectedClients: 2, DroppedEvents: 3}
		}),
	)
	router := gin.New()
	router.GET("/healthz", NewHealthHandler(svc).Healthz)

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", rec.Code, rec.Body.String())
	}

	var report service.HealthReport
	if err := json.Unmarshal(rec.Body.Bytes(), &report); err != nil {
		t.Fatalf("decode health response: %v", err)
	}
	if report.Status != service.HealthStatusOK {
		t.Fatalf("report status = %q", report.Status)
	}
	if report.Components.AuctionEngine.ConnectedClients != 2 {
		t.Fatalf("connected clients = %d", report.Components.AuctionEngine.ConnectedClients)
	}
}

func TestHealthHandlerReturnsServiceUnavailableWhenDegraded(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := service.NewHealthServiceWithCheckers(
		handlerDBChecker{err: errors.New("db unavailable")},
		handlerRedisChecker{},
		service.EngineStatsProviderFunc(func() service.EngineStats { return service.EngineStats{} }),
	)
	router := gin.New()
	router.GET("/healthz", NewHealthHandler(svc).Healthz)

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503; body=%s", rec.Code, rec.Body.String())
	}

	var report service.HealthReport
	if err := json.Unmarshal(rec.Body.Bytes(), &report); err != nil {
		t.Fatalf("decode health response: %v", err)
	}
	if report.Status != service.HealthStatusDegraded {
		t.Fatalf("report status = %q", report.Status)
	}
	if report.Components.DB.Status != service.ComponentStatusDown {
		t.Fatalf("db status = %q", report.Components.DB.Status)
	}
}

type handlerDBChecker struct {
	err error
}

func (c handlerDBChecker) PingContext(ctx context.Context) error {
	return c.err
}

type handlerRedisChecker struct {
	err error
}

func (c handlerRedisChecker) Ping(ctx context.Context) error {
	return c.err
}
