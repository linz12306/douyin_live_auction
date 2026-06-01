# 实时竞拍大师 —— 当前实现状态报告 v3

> 更新时间：2026-06-01
> 当前依据：`requirements-v3.md`、`AGENTS.md`、`openspec/specs/auction-engine/spec.md`、`openspec/specs/realtime-live-room/spec.md`、`openspec/specs/order-system/spec.md`、`openspec/specs/observability-health/spec.md`、`openspec/specs/merchant-dashboard/spec.md`、`openspec/specs/merchant-auction-monitor/spec.md`、`openspec/specs/demo-readiness/spec.md`、`openspec/changes/archive/2026-05-28-auction-engine-mvp/`、`openspec/changes/archive/2026-05-28-ws-realtime-live-room/`、`openspec/changes/archive/2026-05-29-order-system/`、`openspec/changes/archive/2026-05-29-observability-health/`、`openspec/changes/archive/2026-05-31-merchant-dashboard/`、`openspec/changes/archive/2026-05-31-merchant-auction-monitor/`、`openspec/changes/archive/2026-05-31-demo-readiness/`、`docs/superpowers/plans/2026-05-27-auction-engine-mvp.md`、`docs/superpowers/plans/2026-05-28-ws-realtime-live-room.md`、`docs/superpowers/plans/2026-05-29-order-system.md`、`docs/superpowers/plans/2026-05-29-observability-health.md`、`docs/superpowers/plans/2026-05-30-merchant-dashboard.md`、`docs/superpowers/plans/2026-05-30-merchant-auction-monitor.md`、`docs/superpowers/plans/2026-05-31-demo-readiness.md`

## 1. 当前流程状态

当前执行 `AGENTS.md` 固化的集成流程：

1. Superpowers 探索：核心 change 均有对应探索记录，覆盖竞拍引擎、实时直播间、订单、健康检查、商家看板、商家竞拍监控和演示准备。
2. OpenSpec 锁规范：已完成并归档 `auction-engine-mvp`、`ws-realtime-live-room`、`order-system`、`observability-health`、`merchant-dashboard`、`merchant-auction-monitor` 和 `demo-readiness`。
3. Superpowers 执行：上述 change 均有执行计划和验证记录，位于 `docs/superpowers/plans/`。
4. OpenSpec 校验/归档：持久规范已更新到 `openspec/specs/`，包括 auction engine、realtime live room、order system、observability health、merchant dashboard、merchant auction monitor 和 demo readiness。
5. Superpowers 记忆沉淀：已更新 `memory/2026-05-29.md`、`memory/2026-05-30.md`、`memory/2026-05-31.md`、`memory/2026-06-01.md` 和 `memory/long-term.md`。

## 2. 已有业务代码

已接入主路由的能力：

- 用户认证与资料：注册、登录、刷新、登出、个人资料、头像、改密等主干已存在。
- 商品 CRUD：商品列表/详情、商家创建/编辑/删除、图片上传/删除、发布竞拍主干已存在。
- 竞拍 MVP：已完成并归档，出价/排行榜/激活/取消/结算关键路径已有集成测试。
- 订单系统：已完成并归档，包含中标确认、模拟支付、确认超时/取消退款、用户/商家订单页。
- 可观测性健康检查：已完成并归档，`GET /healthz` 返回 DB、Redis、auction_engine 组件状态。
- 前端稳定性补齐：已完成并归档，包含页面返回按钮、列表/详情刷新、用户大厅/订单/商家商品页状态刷新。
- 商家运营看板：已完成并归档，`GET /api/v1/merchant/dashboard` 和 `/merchant/dashboard` 提供商家自有商品、竞拍、订单和成交指标。
- 商家竞拍监控：已完成并归档，`/merchant/auctions/:id/monitor` 复用 `/ws/auctions/:id` 实时流展示价格、排行、事件和终态。
- 演示准备：已完成并归档，包含 `npm run demo:seed`、`docs/demo-readiness.md` 和 `tests/e2e/demo-readiness.spec.ts`。

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

当前报告已与已归档 changes 对齐，没有未归档的 `merchant-dashboard`、`merchant-auction-monitor` 或 `demo-readiness` 工作遗留。后续若继续做成交趋势、出价分布、用户活跃度、结构化日志或运营增强，应作为新的 OpenSpec change 开启。

## 4. 下一步计划

优先级 1：演示和验收。

- 使用 `docs/demo-readiness.md` 启动本地依赖、后端、前端和 demo seed。
- 使用 demo 账号演示商家看板、商家竞拍监控、买家直播间出价、私有 outbid、成交、确认订单和模拟支付。
- 需要自动化回归时，可用后端 `SERVER_PORT=18080 DISABLE_RATE_LIMIT=1 REDIS_ADDR=127.0.0.1:16380` 和前端 `VITE_BACKEND_TARGET=http://127.0.0.1:18080` 跑 `npm run test:e2e:demo`。

优先级 2：新的商家运营增强 change。

- 可独立规划成交趋势、出价分布、用户活跃度、结构化日志、竞拍引擎指标、WebSocket/锁竞争指标。

## 5. 当前开发方式

当前文档/材料收口在独立 worktree 和 topic branch 上进行，不合并 `master`，不打开 PR。

- 当前工作区：`/Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials`
- 当前分支：`codex/demo-materials`
- Go：`/Users/vivix/.local/go`
- MySQL：`127.0.0.1:3307`，数据库 `auction_db`
- Redis：`127.0.0.1:16380`

最新验证命令：

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials
PLAYWRIGHT_BASE_URL=http://127.0.0.1:13000 npx playwright test tests/e2e/order-system.spec.ts
PLAYWRIGHT_BASE_URL=http://127.0.0.1:13000 npx playwright test tests/e2e/realtime-live-room.spec.ts
npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive
cd backend && /Users/vivix/.local/go/bin/go test ./...
cd frontend && npm run build
git diff --check
```

结果：历史行为变更 slice 已通过各自记录的后端、前端、E2E、OpenSpec 和 diff 检查。本次 `codex/demo-materials` 只改 Markdown/OpenSpec 文本/记忆材料，验证使用 OpenSpec specs strict validate 和 `git diff --check`；无需重新运行前后端测试，因为没有修改 Go/TypeScript 业务代码、路由、接口、状态机、迁移或 E2E 逻辑。
