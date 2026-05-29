# Observability Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unauthenticated `GET /healthz` backend health checks for MySQL, Redis, and the in-process auction/realtime runtime.

**Architecture:** Implement a focused health service that pings dependencies with bounded contexts, reports sanitized component states, and reads lightweight realtime runtime stats. Expose it through a small Gin handler wired outside authenticated API groups.

**Tech Stack:** Go 1.26.3, Gin, `database/sql`, go-redis v9, existing realtime hub/event bus.

---

## File Structure

- Create `backend/internal/service/health_service.go`: health response structs, checker interfaces, DB/Redis ping checks, auction-engine runtime stats mapping.
- Create `backend/internal/service/health_service_test.go`: service tests with fake DB/Redis checkers and fake engine stats.
- Modify `backend/internal/realtime/hub.go`: add concurrency-safe `Stats()` method and `HubStats` type.
- Modify `backend/internal/realtime/hub_test.go`: cover active room/client stats.
- Create `backend/internal/handler/health_handler.go`: map health report status to HTTP 200/503 and write JSON.
- Create `backend/internal/handler/health_handler_test.go`: route-level tests proving `/healthz` is unauthenticated and degraded responses map to 503.
- Modify `backend/cmd/server/main.go`: construct health service and register `GET /healthz`.
- Update `openspec/changes/observability-health/tasks.md`: mark implemented tasks only after verification.
- Update `projects/proj-1779447357476-ryiijf/memory/2026-05-29.md` and `projects/proj-1779447357476-ryiijf/memory/long-term.md`: record result after final verification.

## Task 1: Health Service

**Files:**
- Create: `backend/internal/service/health_service.go`
- Create: `backend/internal/service/health_service_test.go`

- [x] **Step 1: Write failing service tests**

Create `backend/internal/service/health_service_test.go`:

```go
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
			ActiveRooms:      2,
			ConnectedClients: 3,
			DroppedEvents:    4,
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
```

- [x] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/service -run TestHealth
```

Expected: FAIL because `HealthService`, `DBChecker`, `RedisChecker`, `EngineStatsProvider`, `EngineStats`, and health constants do not exist yet.

- [x] **Step 3: Implement health service**

Create `backend/internal/service/health_service.go`:

```go
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
	ActiveRooms      int
	ConnectedClients int
	DroppedEvents    uint64
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
	Status           string `json:"status"`
	ActiveRooms      int    `json:"active_rooms"`
	ConnectedClients int    `json:"connected_clients"`
	DroppedEvents    uint64 `json:"dropped_events"`
	Message          string `json:"message,omitempty"`
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
		Status:           ComponentStatusOK,
		ActiveRooms:      stats.ActiveRooms,
		ConnectedClients: stats.ConnectedClients,
		DroppedEvents:    stats.DroppedEvents,
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
```

- [x] **Step 4: Run service tests to verify they pass**

Run:

```bash
cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/service -run TestHealth
```

Expected: PASS.

## Task 2: Realtime Runtime Stats

**Files:**
- Modify: `backend/internal/realtime/hub.go`
- Modify: `backend/internal/realtime/hub_test.go`

- [x] **Step 1: Write failing hub stats test**

Append to `backend/internal/realtime/hub_test.go`:

```go
func TestHubStatsCountsRoomsAndClients(t *testing.T) {
	hub := NewHub(nil, nil)

	unregisterFirst := hub.Register(1, 101, make(chan Envelope, 1))
	defer unregisterFirst()
	unregisterSecond := hub.Register(1, 102, make(chan Envelope, 1))
	defer unregisterSecond()
	unregisterThird := hub.Register(2, 201, make(chan Envelope, 1))
	defer unregisterThird()

	stats := hub.Stats()

	if stats.ActiveRooms != 2 {
		t.Fatalf("active rooms = %d, want 2", stats.ActiveRooms)
	}
	if stats.ConnectedClients != 3 {
		t.Fatalf("connected clients = %d, want 3", stats.ConnectedClients)
	}
}
```

- [x] **Step 2: Run realtime tests to verify they fail**

Run:

```bash
cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/realtime -run TestHubStatsCountsRoomsAndClients
```

Expected: FAIL because `Hub.Stats` does not exist.

- [x] **Step 3: Implement hub stats**

Add to `backend/internal/realtime/hub.go` after `hubClient`:

```go
type HubStats struct {
	ActiveRooms      int
	ConnectedClients int
}
```

Add this method near the other `Hub` methods:

```go
func (h *Hub) Stats() HubStats {
	h.mu.RLock()
	defer h.mu.RUnlock()

	stats := HubStats{ActiveRooms: len(h.rooms)}
	for _, clients := range h.rooms {
		stats.ConnectedClients += len(clients)
	}
	return stats
}
```

- [x] **Step 4: Run realtime stats tests**

Run:

```bash
cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/realtime -run 'TestHubStatsCountsRoomsAndClients|TestInMemoryAuctionEventBusDropsForSlowSubscriber'
```

Expected: PASS.

## Task 3: Health Handler And Route

**Files:**
- Create: `backend/internal/handler/health_handler.go`
- Create: `backend/internal/handler/health_handler_test.go`
- Modify: `backend/cmd/server/main.go`

- [x] **Step 1: Write failing handler tests**

Create `backend/internal/handler/health_handler_test.go`:

```go
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
```

- [x] **Step 2: Run handler tests to verify they fail**

Run:

```bash
cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/handler -run TestHealth
```

Expected: FAIL because `NewHealthHandler` and `Healthz` do not exist.

- [x] **Step 3: Implement health handler**

Create `backend/internal/handler/health_handler.go`:

```go
package handler

import (
	"net/http"

	"douyin-live/backend/internal/service"

	"github.com/gin-gonic/gin"
)

type HealthHandler struct {
	svc *service.HealthService
}

func NewHealthHandler(svc *service.HealthService) *HealthHandler {
	return &HealthHandler{svc: svc}
}

func (h *HealthHandler) Healthz(c *gin.Context) {
	report := h.svc.Check(c.Request.Context())
	status := http.StatusOK
	if report.Status != service.HealthStatusOK {
		status = http.StatusServiceUnavailable
	}
	c.JSON(status, report)
}
```

- [x] **Step 4: Wire route in server main**

Modify `backend/cmd/server/main.go` after realtime/auction construction:

```go
	healthSvc := service.NewHealthService(db, rdb, service.EngineStatsProviderFunc(func() service.EngineStats {
		hubStats := realtimeHub.Stats()
		return service.EngineStats{
			ActiveRooms:      hubStats.ActiveRooms,
			ConnectedClients: hubStats.ConnectedClients,
			DroppedEvents:    eventBus.DroppedEvents(),
		}
	}))
	healthH := handler.NewHealthHandler(healthSvc)
```

Modify router setup after `r := gin.Default()`:

```go
	r.GET("/healthz", healthH.Healthz)
```

- [x] **Step 5: Run handler tests**

Run:

```bash
cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/handler -run TestHealth
```

Expected: PASS.

## Task 4: Focused Verification And Manual Interface Check

**Files:**
- Update: `openspec/changes/observability-health/tasks.md`
- Update: `docs/superpowers/plans/2026-05-29-observability-health.md`

- [x] **Step 1: Run focused package tests**

Run:

```bash
cd backend && /Users/vivix/.local/go/bin/go test -count=1 ./internal/service ./internal/realtime ./internal/handler -run 'TestHealth|TestHubStatsCountsRoomsAndClients|TestInMemoryAuctionEventBusDropsForSlowSubscriber'
```

Expected: PASS.

- [x] **Step 2: Run backend full test suite**

Run:

```bash
cd backend && /Users/vivix/.local/go/bin/go test ./...
```

Expected: PASS.

- [x] **Step 3: Run OpenSpec strict validation**

Run:

```bash
npx -y @fission-ai/openspec@latest validate observability-health --strict --no-interactive
npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive
```

Expected: both commands PASS.

- [x] **Step 4: Run diff whitespace check**

Run:

```bash
git diff --check
```

Expected: no output and exit code 0.

- [x] **Step 5: Run `/healthz` interface validation**

Start backend on a spare port:

```bash
cd backend && SERVER_PORT=18080 DISABLE_RATE_LIMIT=1 /Users/vivix/.local/go/bin/go run ./cmd/server
```

From another command:

```bash
curl -s -i http://127.0.0.1:18080/healthz
```

Expected: HTTP 200 with JSON containing `status`, `checked_at`, `components.db`, `components.redis`, and `components.auction_engine`.

- [x] **Step 6: Update task and plan checkboxes**

Update `openspec/changes/observability-health/tasks.md` so completed implementation tasks are checked and verification commands/results are recorded.

Update this plan's checkboxes for the steps actually completed.

- [x] **Step 7: Commit verified implementation slice**

Run:

```bash
git status --short
git add backend/internal/service/health_service.go backend/internal/service/health_service_test.go backend/internal/realtime/hub.go backend/internal/realtime/hub_test.go backend/internal/handler/health_handler.go backend/internal/handler/health_handler_test.go backend/cmd/server/main.go openspec/changes/observability-health/tasks.md docs/superpowers/plans/2026-05-29-observability-health.md
git commit -m "feat(observability): add health endpoint"
```

Expected: commit succeeds.

## Task 5: Memory, Final Verification, And Push

**Files:**
- Update: `projects/proj-1779447357476-ryiijf/memory/2026-05-29.md`
- Update: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [x] **Step 1: Update memory**

Record:

- branch/worktree
- implemented `/healthz` behavior
- response status rules
- verification commands and results
- commit hash
- push result

- [x] **Step 2: Run final verification after memory update**

Run:

```bash
npx -y @fission-ai/openspec@latest validate observability-health --strict --no-interactive
npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive
cd backend && /Users/vivix/.local/go/bin/go test ./...
git diff --check
```

Expected: all commands PASS.

- [x] **Step 3: Commit memory/docs slice if memory changed after implementation commit**

Run:

```bash
git status --short
git add projects/proj-1779447357476-ryiijf/memory/2026-05-29.md projects/proj-1779447357476-ryiijf/memory/long-term.md openspec/changes/observability-health/tasks.md docs/superpowers/plans/2026-05-29-observability-health.md
git commit -m "docs(observability): record health verification"
```

Expected: commit succeeds if tracked docs changed.

- [ ] **Step 4: Push branch**

Run:

```bash
git push origin codex/observability-health
```

Expected: branch pushes unless blocked by the local pre-push/DLP hook. If blocked, report the exact hook result and leave commits local.

Result: attempted twice with `git push origin codex/observability-health` and `git push --porcelain origin codex/observability-health`. Both failed with `error: failed to push some refs to 'github.com:linz12306/douyin_live_auction.git'`. The local global hook created `/tmp/douyin_live_auction_push_forbidden`, so the branch remains local and ahead of origin.
