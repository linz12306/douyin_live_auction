# 实时竞拍大师 —— 当前实现状态报告 v3

> 更新时间：2026-05-29
> 当前依据：`requirements-v3.md`、`AGENTS.md`、`openspec/specs/auction-engine/spec.md`、`openspec/specs/realtime-live-room/spec.md`、`openspec/specs/order-system/spec.md`、`openspec/specs/observability-health/spec.md`、`openspec/changes/archive/2026-05-28-auction-engine-mvp/`、`openspec/changes/archive/2026-05-28-ws-realtime-live-room/`、`openspec/changes/archive/2026-05-29-order-system/`、`openspec/changes/archive/2026-05-29-observability-health/`、`docs/superpowers/plans/2026-05-27-auction-engine-mvp.md`、`docs/superpowers/plans/2026-05-28-ws-realtime-live-room.md`、`docs/superpowers/plans/2026-05-29-order-system.md`、`docs/superpowers/plans/2026-05-29-observability-health.md`

## 1. 当前流程状态

当前执行 `AGENTS.md` 固化的集成流程：

1. Superpowers 探索：已完成，主要产物包括 `docs/superpowers/specs/2026-05-27-auction-engine-mvp-exploration.md`、`docs/superpowers/specs/2026-05-28-ws-realtime-live-room-exploration.md`、`docs/superpowers/specs/2026-05-29-order-system-exploration.md` 和 `docs/superpowers/specs/2026-05-29-observability-health-exploration.md`。
2. OpenSpec 锁规范：已完成；`auction-engine-mvp`、`ws-realtime-live-room`、`order-system` 和 `observability-health` 均已归档。
3. Superpowers 执行：已完成，执行计划为 `docs/superpowers/plans/2026-05-27-auction-engine-mvp.md`、`docs/superpowers/plans/2026-05-28-ws-realtime-live-room.md`、`docs/superpowers/plans/2026-05-29-order-system.md` 和 `docs/superpowers/plans/2026-05-29-observability-health.md`。
4. OpenSpec 校验/归档：已完成，主规范为 `openspec/specs/auction-engine/spec.md`、`openspec/specs/realtime-live-room/spec.md`、`openspec/specs/order-system/spec.md` 和 `openspec/specs/observability-health/spec.md`。
5. Superpowers 记忆沉淀：已更新，本文件和 `memory/2026-05-29.md` 记录当前状态。

## 2. 已有业务代码

已接入主路由的能力：

- 用户认证与资料：注册、登录、刷新、登出、个人资料、头像、改密等主干已存在。
- 商品 CRUD：商品列表/详情、商家创建/编辑/删除、图片上传/删除、发布竞拍主干已存在。
- 竞拍 MVP：已合并并推送到 `master`，出价/排行榜/激活/取消/结算关键路径已有集成测试，后端 `go test ./...` 通过。
- 订单系统：已合并并推送到 `master`，包含中标确认、模拟支付、确认超时/取消退款、用户/商家订单页。
- 可观测性健康检查：已合并并推送到 `master`，`GET /healthz` 返回 DB、Redis、auction_engine 组件状态。
- 前端稳定性补齐：已合并并推送到 `master`，包含页面返回按钮、列表/详情刷新、用户大厅/订单/商家商品页状态刷新。

本次 `auction-engine-mvp` 已新增/接入：

- `backend/internal/dto/auction.go`
- `backend/internal/repository/auction_engine_repo.go`
- `backend/internal/service/auction_service.go`
- `backend/internal/handler/auction_handler.go`
- `backend/cmd/server/main.go` 中接入：
  - `POST /api/v1/auctions/:id/bid`
  - `GET /api/v1/auctions/:id/rankings`
  - `POST /api/v1/auctions/:id/activate`
  - `DELETE /api/v1/auctions/:id`

本次本地补充的验证覆盖：

- pending 竞拍可由所属商家取消，auction/product 状态变为 `cancelled`，写入审计日志。
- active 竞拍在最近 30 秒内有出价时拒绝取消。
- active 竞拍超过取消限制后取消，会解冻 active 出价并把 bid 置为 `cancelled`。
- 用户 A 被用户 B 超价后，A 的冻结余额解冻、bid 变为 `outbid`，B 成为 active bid。
- 排行榜按出价金额降序返回。
- 达到封顶价时 auction 变为 `ended_sold`，bid 变为 `won`，生成 `pending_confirm` 订单，并扣减冻结余额。
- pending 状态出价、低价出价、余额不足出价均被拒绝且不落 bid。
- Soft Close 在临近结束时把倒计时重置到自动延时窗口。
- Redis bid lock 被占用时返回 429，避免并发出价穿透。
- 商家可通过 `POST /api/v1/auctions/:id/activate` 激活 pending 竞拍。
- 后台 settlement worker 会定期推进过期 active 竞拍：无出价变 `ended_no_bid`，有 active bid 变 `ended_sold` 并生成订单。
- 已补完整链路测试：注册 -> 创建商品 -> 发布竞拍 -> 激活 -> 出价 -> 超价 -> 到期结算 -> 订单。

已被纳入本 change 的提前文件：

- `backend/migrations/006_create_bids.sql`
- `backend/migrations/007_create_orders.sql`
- `backend/internal/model/bid.go`
- `backend/internal/model/order.go`

## 3. 仍未完成

- WebSocket/H5 用户端实时竞拍房间已在 `ws-realtime-live-room` change 中接入，包含用户大厅、直播间、实时价格/排行榜、出价和被超越通知。
- 订单系统已在 `order-system` change 中接入，包含中标确认、模拟支付、确认超时/买家取消退款、用户订单列表/详情、商家订单列表/详情。
- 商家看板/运营增强仍是后续 change，不应混进已归档的订单 slice。

## 4. 下一步计划

优先级 1：开启下一阶段 `merchant-admin-lite` / 商家运营看板。

- Task 9 已补端到端实时验证：商家 API setup 创建/发布/激活竞拍，用户 A 从 `/app/auctions` 进入直播间并看到 snapshot 倒计时，用户 A 出价，用户 B 第二浏览器上下文更高价出价，用户 A 收到私有 outbid 通知，当前价和排行榜随 WebSocket 更新，随后用户 A 封顶出价触发真实 `auction_end`，终态状态/消息和禁用出价控件均被验证。
- Playwright 支持 `PLAYWRIGHT_BASE_URL`，Vite dev proxy 支持 `VITE_BACKEND_TARGET`，后端支持显式测试开关 `DISABLE_RATE_LIMIT=1`，便于在已有 8080/3000 服务占用时使用备用端口验证当前后端代码并避免重复 E2E 命中注册限流。
- `ws-realtime-live-room` 已归档到 `openspec/changes/archive/2026-05-28-ws-realtime-live-room/`，持久规范位于 `openspec/specs/realtime-live-room/spec.md`。
- `order-system` 已归档到 `openspec/changes/archive/2026-05-29-order-system/`，持久规范位于 `openspec/specs/order-system/spec.md`。
- `observability-health` 已归档到 `openspec/changes/archive/2026-05-29-observability-health/`，持久规范位于 `openspec/specs/observability-health/spec.md`。
- 已补订单 E2E：商家/买家 API setup 创建中标订单，买家从 `/app/orders` 进入详情，确认订单，模拟支付，最终展示 `已支付`。

优先级 2：商家实时看板/运营增强。

- 可独立规划商家实时监控、运营面板、成交趋势、出价分布和用户活跃度统计。

## 5. 当前开发方式

当前以 `master` 作为唯一稳定基线；`stability-polish` 和 `observability-health` 的临时 worktree/分支已在阶段 0 收口中删除。

- 当前主工作区：`/Users/vivix/Documents/Codex/douyin_live_auction`
- 当前稳定分支：`master`
- Go：`/Users/vivix/.local/go`
- MySQL：`127.0.0.1:3307`，数据库 `auction_db`
- Redis：`127.0.0.1:16379`

最新验证命令：

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction
PLAYWRIGHT_BASE_URL=http://127.0.0.1:13000 npx playwright test tests/e2e/order-system.spec.ts
PLAYWRIGHT_BASE_URL=http://127.0.0.1:13000 npx playwright test tests/e2e/realtime-live-room.spec.ts
npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive
cd backend && /Users/vivix/.local/go/bin/go test ./...
cd frontend && npm run build
git diff --check
```

结果：`order-system` 和 `realtime-live-room` E2E 已在备用端口对 `SERVER_PORT=18080 DISABLE_RATE_LIMIT=1` 的当前后端和 Vite `VITE_BACKEND_TARGET=http://localhost:18080` 验证通过；OpenSpec specs strict validate 通过，后端全量 Go tests 通过，前端测试/构建通过，`git diff --check` 通过。
