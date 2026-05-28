# 实时竞拍大师 —— 当前实现状态报告 v3

> 更新时间：2026-05-28
> 当前依据：`requirements-v3.md`、`AGENTS.md`、`openspec/specs/auction-engine/spec.md`、`openspec/changes/archive/2026-05-28-auction-engine-mvp/`、`docs/superpowers/plans/2026-05-27-auction-engine-mvp.md`

## 1. 当前流程状态

当前执行 `AGENTS.md` 固化的集成流程：

1. Superpowers 探索：已完成，产物为 `docs/superpowers/specs/2026-05-27-auction-engine-mvp-exploration.md`。
2. OpenSpec 锁规范：已完成，产物在 `openspec/changes/auction-engine-mvp/`；2026-05-27 运行过 `openspec validate auction-engine-mvp --strict --no-interactive`，结果为 valid。
3. Superpowers 执行：已完成，执行计划为 `docs/superpowers/plans/2026-05-27-auction-engine-mvp.md`。
4. OpenSpec 校验/归档：已完成，主规范为 `openspec/specs/auction-engine/spec.md`，归档目录为 `openspec/changes/archive/2026-05-28-auction-engine-mvp/`。
5. Superpowers 记忆沉淀：已更新，本文件和 `memory/2026-05-28.md` 记录当前状态。

## 2. 已有业务代码

已接入主路由的能力：

- 用户认证与资料：注册、登录、刷新、登出、个人资料、头像、改密等主干已存在。
- 商品 CRUD：商品列表/详情、商家创建/编辑/删除、图片上传/删除、发布竞拍主干已存在。
- 竞拍 MVP：已合并并推送到 `master`，出价/排行榜/激活/取消/结算关键路径已有集成测试，后端 `go test ./...` 通过。

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

- WebSocket/H5/商家看板/订单支付属于后续 change，不应混进当前 MVP。
- 当前商家商品端已有创建/上传/发布基础体验；用户端实时竞拍房间还未接入。
- 订单已由成交生成，但订单确认、模拟支付、履约展示仍是后续 change。

## 4. 下一步计划

优先级 1：开启 `ws-realtime-live-room`。

- 用 Superpowers exploration 先定义用户端实时竞拍体验、WebSocket 消息模型和端到端验收。
- 用 OpenSpec 锁定 `ws-realtime-live-room` 的 proposal/design/tasks/spec。
- 第一批实现建议覆盖：拍卖详情页、出价按钮、排行榜/当前价/倒计时刷新、WebSocket 广播。

优先级 2：订单/支付/履约。

- `order-system`：中标确认、模拟支付、超时取消。

## 5. 当前开发方式

当前已经切换为本地 checkout 开发：

- 仓库路径：`/Users/vivix/Documents/Codex/douyin_live_auction`
- 当前分支：`master`
- Go：`/Users/vivix/.local/go`
- MySQL：`127.0.0.1:3307`，数据库 `auction_db`
- Redis：`127.0.0.1:16379`

最新验证命令：

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction
npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive
cd backend && go test ./...
cd frontend && npm run build
```

结果：OpenSpec spec valid，后端测试通过，前端构建通过。
