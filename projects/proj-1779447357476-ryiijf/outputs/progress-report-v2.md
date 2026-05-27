# 实时竞拍大师 —— 当前实现状态报告 v2

> 更新时间：2026-05-27
> 依据：当前 GitHub `master` 分支、`AGENTS.md`、`requirements-v3.md`、`project.md`、`openspec/changes/auction-engine-mvp/`

---

## 1. 当前业务代码进度

### 已接入主路由的后端能力

- `user-auth` 已有主干实现并接入 `backend/cmd/server/main.go`：
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`
  - JWT 中间件、角色字段、注册默认余额字段已存在。
- `users` 资料能力已接入：
  - `GET /api/v1/users/me`
  - `PUT /api/v1/users/me`
  - `PUT /api/v1/users/me/password`
  - `POST /api/v1/users/me/avatar`
  - `GET /api/v1/users/:id`
- `product-crud` 已有主干实现并接入：
  - `GET /api/v1/products`
  - `GET /api/v1/products/:id`
  - `POST /api/v1/products`（商家）
  - `PUT /api/v1/products/:id`（商家）
  - `DELETE /api/v1/products/:id`（商家）
  - `POST /api/v1/products/:id/images`（商家）
  - `DELETE /api/v1/products/:id/images/:image_id`（商家）
  - `POST /api/v1/products/:id/publish`（商家）

### 已存在的数据结构/迁移

- `001_create_users.sql`：用户、角色、头像、余额、冻结金额。
- `002_create_products.sql`、`003_create_product_images.sql`、`004_create_auctions.sql`、`005_create_auction_logs.sql`：商品、图片、竞拍、审计日志。
- `006_create_bids.sql`、`007_create_orders.sql`：已被提前加入，但尚未纳入完整业务实现，需要在 `auction-engine-mvp` 下审查/修正。
- `backend/internal/model/bid.go`、`backend/internal/model/order.go`：已被提前加入，但目前只是模型定义，尚无完整服务/仓储/路由闭环。

### 尚未实现的核心业务能力

- 还没有 `AuctionService` 或 `PlaceBid` 等出价服务。
- 还没有 `/api/v1/auctions/:id/bid` 出价 API。
- 还没有 `/api/v1/auctions/:id/rankings` 排行榜 API。
- 还没有商家取消竞拍 API。
- 还没有余额冻结/解冻/扣款的完整事务封装。
- 还没有竞拍状态机、Soft Close、封顶价自动成交、时间到结算、订单生成。
- 还没有 WebSocket 实时通信和 H5 竞拍用户端。

### 当前阶段判断

项目已完成或接近完成：`user-auth`、`product-crud` 主干。

项目正在进入：`auction-engine-mvp` 规范锁定后实施阶段。

当前还不能称为“能出价的最小闭环”，因为出价、冻结、结算和订单生成尚未实现。

---

## 2. 已补齐的规范/执行文档

已新增仓库级 agent 规约：

- `AGENTS.md`
  - 固定流程：Superpowers exploration -> OpenSpec lock -> Superpowers execution -> OpenSpec verification/archive -> Superpowers memory。

已新增 OpenSpec 配置和变更：

- `openspec/config.yaml`
- `openspec/changes/auction-engine-mvp/proposal.md`
- `openspec/changes/auction-engine-mvp/design.md`
- `openspec/changes/auction-engine-mvp/tasks.md`
- `openspec/changes/auction-engine-mvp/specs/auction-engine/spec.md`

已新增 Superpowers 配套文档：

- `docs/superpowers/specs/2026-05-27-auction-engine-mvp-exploration.md`
- `docs/superpowers/plans/2026-05-27-auction-engine-mvp.md`

OpenSpec 校验：

```bash
npx -y @fission-ai/openspec@latest validate auction-engine-mvp --strict --no-interactive
```

结果：

```text
Change 'auction-engine-mvp' is valid
```

说明：校验是在临时目录按同结构运行；远端文件已通过 GitHub connector 写入并读回确认。

---

## 3. 下一步执行计划

下一步必须从 `openspec/changes/auction-engine-mvp/tasks.md` 的第 1 项开始，不直接跳到业务编码。

1. 审查并处理提前加入的 `bids/orders` 文件
   - 检查 `006_create_bids.sql`、`007_create_orders.sql`、`model/bid.go`、`model/order.go` 是否满足 OpenSpec。
   - 若满足，纳入本 change；若不满足，通过本 change 修正。

2. 完成 schema/model 定稿
   - 确认 bids、orders、auctions 字段足够支撑状态机、Soft Close、封顶成交、订单生成。

3. 实现钱包事务能力
   - 基于现有 `users.balance` 和 `users.frozen_amount` 实现 freeze / unfreeze / deduct。
   - 当前 MVP 不新建 wallets 表，除非先修改 OpenSpec design。

4. 实现 auction repository 和 service
   - active bid 查询、插入出价、更新旧出价、排行榜、状态更新、订单创建。
   - 出价服务要包含 Redis 锁 + DB 事务 + audit log。

5. 接 API 和测试
   - `POST /api/v1/auctions/:id/bid`
   - `GET /api/v1/auctions/:id/rankings`
   - `DELETE /api/v1/auctions/:id`
   - 运行 `go test ./...` 和聚焦 auction integration tests。

---

## 4. 未来规划

1. `auction-engine-mvp`：后端出价闭环
   - 目标：API 层能跑通注册 -> 创建商品 -> 发布竞拍 -> 激活 -> 出价 -> 被超越解冻 -> 结算 -> 订单。

2. `ws-realtime`：实时通信
   - WebSocket Hub、房间隔离、断线重连、状态快照、价格/排名/结束广播。

3. `user-h5`：用户端竞拍体验
   - 竞拍大厅、详情页、出价交互、倒计时、排行榜、动画反馈。

4. `merchant-admin-polish`：商家端增强
   - 竞拍监控、取消竞拍、订单查看、数据看板。

5. `order-system`：订单确认和模拟支付
   - 中标确认、模拟支付、超时取消、成交记录。

6. 收尾
   - 全链路测试、并发压测、README、方案文档、演示脚本/视频准备。

---

## 5. 开发方式建议

### 当前实际方式

当前我是在“云端/远端 GitHub connector”方式开发和写文档：

- 能读写 GitHub 私有仓库文件。
- 适合补文档、建 OpenSpec、做小范围远端修改。
- 不适合完整业务开发后的本地编译、数据库迁移和集成测试。

### 推荐后续方式

正式进入 `auction-engine-mvp` 业务实现后，建议拉到本地开发：

- 需要本地 checkout 才能稳定运行 `go test ./...`。
- 需要本地 MySQL/Redis 才能验证迁移、事务、锁、并发出价。
- 需要本地分支做一组提交，而不是通过 connector 分散写入多个远端提交。

当前本机 `/Users/vivix/Documents/Codex` 下没有 `douyin_live_auction` checkout。此前直接 `git clone https://github.com/linz12306/douyin_live_auction.git` 因私有仓库认证失败。下一步建议先配置 GitHub CLI / SSH key / PAT 后 clone 到本地，再进入实现阶段。

推荐路径：

```bash
cd /Users/vivix/Documents/Codex
git clone git@github.com:linz12306/douyin_live_auction.git
cd douyin_live_auction
```

如果 SSH 未配置，也可以先完成 `gh auth login` 后再 clone。
