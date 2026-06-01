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
			return service.EngineStats{
				ActiveRooms:          1,
				ConnectedClients:     2,
				DroppedEvents:        3,
				BidRequestsTotal:     4,
				BidSuccessTotal:      3,
				BidFailureTotal:      1,
				BidSuccessRate:       0.75,
				BidAvgLatencyMS:      9.5,
				BidLockBusyTotal:     2,
				WSConnectionsCurrent: 2,
			}
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
	if report.Components.AuctionEngine.BidRequestsTotal != 4 {
		t.Fatalf("bid requests total = %d", report.Components.AuctionEngine.BidRequestsTotal)
	}
	if report.Components.AuctionEngine.BidSuccessRate != 0.75 {
		t.Fatalf("bid success rate = %v", report.Components.AuctionEngine.BidSuccessRate)
	}
	if report.Components.AuctionEngine.WSConnectionsCurrent != 2 {
		t.Fatalf("ws connections current = %d", report.Components.AuctionEngine.WSConnectionsCurrent)
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
