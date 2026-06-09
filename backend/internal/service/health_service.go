package service

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	HealthStatusOK       = "ok"
	HealthStatusDegraded = "degraded"

	ComponentStatusOK   = "ok"
	ComponentStatusDown = "down"

	defaultHealthTimeout = 500 * time.Millisecond
)

type DBChecker interface {
	PingContext(ctx context.Context) error
}

type RedisChecker interface {
	Ping(ctx context.Context) error
}

type EngineStatsProvider interface {
	Stats() EngineStats
}

type EngineStatsProviderFunc func() EngineStats

func (f EngineStatsProviderFunc) Stats() EngineStats {
	return f()
}

type EngineStats struct {
	ActiveRooms               int
	ConnectedClients          int
	DroppedEvents             uint64
	BidRequestsTotal          uint64
	BidSuccessTotal           uint64
	BidFailureTotal           uint64
	BidSuccessRate            float64
	BidAvgLatencyMS           float64
	BidLockBusyTotal          uint64
	BidLockDegradedTotal      uint64
	WSConnectionsCurrent      int
	BidCommandEnqueueTotal    uint64
	BidCommandProcessingTotal uint64
	BidCommandAcceptedTotal   uint64
	BidCommandRejectedTotal   uint64
	BidCommandFailedTotal     uint64
}

type HealthReport struct {
	Status     string           `json:"status"`
	CheckedAt  time.Time        `json:"checked_at"`
	Components HealthComponents `json:"components"`
}

type HealthComponents struct {
	DB            HealthComponent        `json:"db"`
	Redis         HealthComponent        `json:"redis"`
	AuctionEngine AuctionEngineComponent `json:"auction_engine"`
}

type HealthComponent struct {
	Status    string `json:"status"`
	LatencyMS int64  `json:"latency_ms"`
	Message   string `json:"message,omitempty"`
}

type AuctionEngineComponent struct {
	Status                    string  `json:"status"`
	ActiveRooms               int     `json:"active_rooms"`
	ConnectedClients          int     `json:"connected_clients"`
	DroppedEvents             uint64  `json:"dropped_events"`
	BidRequestsTotal          uint64  `json:"bid_requests_total"`
	BidSuccessTotal           uint64  `json:"bid_success_total"`
	BidFailureTotal           uint64  `json:"bid_failure_total"`
	BidSuccessRate            float64 `json:"bid_success_rate"`
	BidAvgLatencyMS           float64 `json:"bid_avg_latency_ms"`
	BidLockBusyTotal          uint64  `json:"bid_lock_busy_total"`
	BidLockDegradedTotal      uint64  `json:"bid_lock_degraded_total"`
	WSConnectionsCurrent      int     `json:"ws_connections_current"`
	BidCommandEnqueueTotal    uint64  `json:"bid_command_enqueue_total"`
	BidCommandProcessingTotal uint64  `json:"bid_command_processing_total"`
	BidCommandAcceptedTotal   uint64  `json:"bid_command_accepted_total"`
	BidCommandRejectedTotal   uint64  `json:"bid_command_rejected_total"`
	BidCommandFailedTotal     uint64  `json:"bid_command_failed_total"`
	Message                   string  `json:"message,omitempty"`
}

type HealthService struct {
	db      DBChecker
	redis   RedisChecker
	engine  EngineStatsProvider
	timeout time.Duration
	now     func() time.Time
}

func NewHealthService(db *sql.DB, rdb *redis.Client, engine EngineStatsProvider) *HealthService {
	return NewHealthServiceWithCheckers(db, redisClientChecker{client: rdb}, engine)
}

func NewHealthServiceWithCheckers(db DBChecker, redis RedisChecker, engine EngineStatsProvider) *HealthService {
	return newHealthServiceWithCheckers(db, redis, engine, defaultHealthTimeout, time.Now)
}

func newHealthServiceWithCheckers(db DBChecker, redis RedisChecker, engine EngineStatsProvider, timeout time.Duration, now func() time.Time) *HealthService {
	if timeout <= 0 {
		timeout = defaultHealthTimeout
	}
	if now == nil {
		now = time.Now
	}
	return &HealthService{db: db, redis: redis, engine: engine, timeout: timeout, now: now}
}

func (s *HealthService) Check(ctx context.Context) HealthReport {
	report := HealthReport{
		Status:    HealthStatusOK,
		CheckedAt: s.now().UTC(),
		Components: HealthComponents{
			DB:            s.checkDB(ctx),
			Redis:         s.checkRedis(ctx),
			AuctionEngine: s.checkAuctionEngine(),
		},
	}

	if report.Components.DB.Status != ComponentStatusOK ||
		report.Components.Redis.Status != ComponentStatusOK ||
		report.Components.AuctionEngine.Status != ComponentStatusOK {
		report.Status = HealthStatusDegraded
	}

	return report
}

func (s *HealthService) checkDB(ctx context.Context) HealthComponent {
	if s.db == nil {
		return HealthComponent{Status: ComponentStatusDown, Message: "ping failed"}
	}
	checkCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()

	start := time.Now()
	err := s.db.PingContext(checkCtx)
	return componentFromPing(start, err)
}

func (s *HealthService) checkRedis(ctx context.Context) HealthComponent {
	if s.redis == nil {
		return HealthComponent{Status: ComponentStatusDown, Message: "ping failed"}
	}
	checkCtx, cancel := context.WithTimeout(ctx, s.timeout)
	defer cancel()

	start := time.Now()
	err := s.redis.Ping(checkCtx)
	return componentFromPing(start, err)
}

func (s *HealthService) checkAuctionEngine() AuctionEngineComponent {
	if s.engine == nil {
		return AuctionEngineComponent{Status: ComponentStatusDown, Message: "runtime unavailable"}
	}
	stats := s.engine.Stats()
	return AuctionEngineComponent{
		Status:                    ComponentStatusOK,
		ActiveRooms:               stats.ActiveRooms,
		ConnectedClients:          stats.ConnectedClients,
		DroppedEvents:             stats.DroppedEvents,
		BidRequestsTotal:          stats.BidRequestsTotal,
		BidSuccessTotal:           stats.BidSuccessTotal,
		BidFailureTotal:           stats.BidFailureTotal,
		BidSuccessRate:            stats.BidSuccessRate,
		BidAvgLatencyMS:           stats.BidAvgLatencyMS,
		BidLockBusyTotal:          stats.BidLockBusyTotal,
		BidLockDegradedTotal:      stats.BidLockDegradedTotal,
		WSConnectionsCurrent:      stats.WSConnectionsCurrent,
		BidCommandEnqueueTotal:    stats.BidCommandEnqueueTotal,
		BidCommandProcessingTotal: stats.BidCommandProcessingTotal,
		BidCommandAcceptedTotal:   stats.BidCommandAcceptedTotal,
		BidCommandRejectedTotal:   stats.BidCommandRejectedTotal,
		BidCommandFailedTotal:     stats.BidCommandFailedTotal,
	}
}

func componentFromPing(start time.Time, err error) HealthComponent {
	component := HealthComponent{
		Status:    ComponentStatusOK,
		LatencyMS: time.Since(start).Milliseconds(),
	}
	if err != nil {
		component.Status = ComponentStatusDown
		component.Message = "ping failed"
	}
	return component
}

type redisClientChecker struct {
	client *redis.Client
}

func (c redisClientChecker) Ping(ctx context.Context) error {
	if c.client == nil {
		return errors.New("redis client is nil")
	}
	return c.client.Ping(ctx).Err()
}
