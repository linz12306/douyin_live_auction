package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

type fakeDBChecker struct {
	err   error
	block bool
}

func (c fakeDBChecker) PingContext(ctx context.Context) error {
	if c.block {
		<-ctx.Done()
		return ctx.Err()
	}
	return c.err
}

type fakeRedisChecker struct {
	err   error
	block bool
}

func (c fakeRedisChecker) Ping(ctx context.Context) error {
	if c.block {
		<-ctx.Done()
		return ctx.Err()
	}
	return c.err
}

type fakeEngineStatsProvider struct {
	stats EngineStats
}

func (p fakeEngineStatsProvider) Stats() EngineStats {
	return p.stats
}

func testHealthService(db DBChecker, redis RedisChecker, engine EngineStatsProvider) *HealthService {
	return newHealthServiceWithCheckers(
		db,
		redis,
		engine,
		10*time.Millisecond,
		func() time.Time { return time.Date(2026, 5, 29, 10, 0, 0, 0, time.UTC) },
	)
}

func TestHealthServiceReportsHealthyComponents(t *testing.T) {
	svc := testHealthService(
		fakeDBChecker{},
		fakeRedisChecker{},
		fakeEngineStatsProvider{stats: EngineStats{
			ActiveRooms:          2,
			ConnectedClients:     3,
			DroppedEvents:        4,
			BidRequestsTotal:     10,
			BidSuccessTotal:      8,
			BidFailureTotal:      2,
			BidSuccessRate:       0.8,
			BidAvgLatencyMS:      12.5,
			BidLockBusyTotal:     3,
			WSConnectionsCurrent: 3,
		}},
	)

	report := svc.Check(context.Background())

	if report.Status != HealthStatusOK {
		t.Fatalf("status = %q, want %q", report.Status, HealthStatusOK)
	}
	if report.CheckedAt.Format(time.RFC3339) != "2026-05-29T10:00:00Z" {
		t.Fatalf("checked_at = %s", report.CheckedAt.Format(time.RFC3339))
	}
	if report.Components.DB.Status != ComponentStatusOK {
		t.Fatalf("db status = %q", report.Components.DB.Status)
	}
	if report.Components.Redis.Status != ComponentStatusOK {
		t.Fatalf("redis status = %q", report.Components.Redis.Status)
	}
	engine := report.Components.AuctionEngine
	if engine.Status != ComponentStatusOK {
		t.Fatalf("engine status = %q", engine.Status)
	}
	if engine.ActiveRooms != 2 || engine.ConnectedClients != 3 || engine.DroppedEvents != 4 {
		t.Fatalf("engine stats = %+v", engine)
	}
	if engine.BidRequestsTotal != 10 || engine.BidSuccessTotal != 8 || engine.BidFailureTotal != 2 {
		t.Fatalf("engine bid counts = %+v", engine)
	}
	if engine.BidSuccessRate != 0.8 {
		t.Fatalf("engine success rate = %v", engine.BidSuccessRate)
	}
	if engine.BidAvgLatencyMS != 12.5 {
		t.Fatalf("engine avg latency = %v", engine.BidAvgLatencyMS)
	}
	if engine.BidLockBusyTotal != 3 {
		t.Fatalf("engine lock busy total = %d", engine.BidLockBusyTotal)
	}
	if engine.WSConnectionsCurrent != 3 {
		t.Fatalf("engine ws connections current = %d", engine.WSConnectionsCurrent)
	}
}

func TestHealthServiceReportsDBFailureWithSanitizedMessage(t *testing.T) {
	svc := testHealthService(
		fakeDBChecker{err: errors.New("root:secret@tcp(127.0.0.1:3307)/auction_db failed")},
		fakeRedisChecker{},
		fakeEngineStatsProvider{},
	)

	report := svc.Check(context.Background())

	if report.Status != HealthStatusDegraded {
		t.Fatalf("status = %q, want degraded", report.Status)
	}
	if report.Components.DB.Status != ComponentStatusDown {
		t.Fatalf("db status = %q", report.Components.DB.Status)
	}
	if report.Components.DB.Message != "ping failed" {
		t.Fatalf("db message = %q", report.Components.DB.Message)
	}
	if strings.Contains(report.Components.DB.Message, "secret") {
		t.Fatalf("db message leaked raw error: %q", report.Components.DB.Message)
	}
	if report.Components.Redis.Status != ComponentStatusOK {
		t.Fatalf("redis status = %q", report.Components.Redis.Status)
	}
}

func TestHealthServiceReportsRedisFailureWithSanitizedMessage(t *testing.T) {
	svc := testHealthService(
		fakeDBChecker{},
		fakeRedisChecker{err: errors.New("redis password hunter2 refused")},
		fakeEngineStatsProvider{},
	)

	report := svc.Check(context.Background())

	if report.Status != HealthStatusDegraded {
		t.Fatalf("status = %q, want degraded", report.Status)
	}
	if report.Components.Redis.Status != ComponentStatusDown {
		t.Fatalf("redis status = %q", report.Components.Redis.Status)
	}
	if report.Components.Redis.Message != "ping failed" {
		t.Fatalf("redis message = %q", report.Components.Redis.Message)
	}
	if strings.Contains(report.Components.Redis.Message, "hunter2") {
		t.Fatalf("redis message leaked raw error: %q", report.Components.Redis.Message)
	}
	if report.Components.DB.Status != ComponentStatusOK {
		t.Fatalf("db status = %q", report.Components.DB.Status)
	}
}

func TestHealthServiceBoundsSlowDependency(t *testing.T) {
	svc := testHealthService(
		fakeDBChecker{block: true},
		fakeRedisChecker{},
		fakeEngineStatsProvider{},
	)

	start := time.Now()
	report := svc.Check(context.Background())
	elapsed := time.Since(start)

	if elapsed > 100*time.Millisecond {
		t.Fatalf("health check took %s, want bounded", elapsed)
	}
	if report.Status != HealthStatusDegraded {
		t.Fatalf("status = %q, want degraded", report.Status)
	}
	if report.Components.DB.Status != ComponentStatusDown {
		t.Fatalf("db status = %q", report.Components.DB.Status)
	}
}

func TestHealthServiceReportsMissingEngineRuntime(t *testing.T) {
	svc := testHealthService(fakeDBChecker{}, fakeRedisChecker{}, nil)

	report := svc.Check(context.Background())

	if report.Status != HealthStatusDegraded {
		t.Fatalf("status = %q, want degraded", report.Status)
	}
	if report.Components.AuctionEngine.Status != ComponentStatusDown {
		t.Fatalf("engine status = %q", report.Components.AuctionEngine.Status)
	}
	if report.Components.AuctionEngine.Message != "runtime unavailable" {
		t.Fatalf("engine message = %q", report.Components.AuctionEngine.Message)
	}
}
