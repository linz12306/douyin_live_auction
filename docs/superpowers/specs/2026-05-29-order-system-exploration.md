# order-system Exploration

> 日期：2026-05-29
> Change ID：`order-system`
> 权威依据：`requirements-v3.md`、`progress-report-v3.md`、`openspec/specs/auction-engine/spec.md`、`openspec/specs/realtime-live-room/spec.md`

## Preflight

- 当前工作区：`/Users/vivix/Documents/Codex/douyin_live_auction_worktrees/order-system`
- 当前分支：`codex/order-system`
- `git status --short --branch`：干净，仅显示当前分支。
- Superpowers 可用：已读取 `using-superpowers`、`brainstorming`、`writing-plans` 技能说明。
- OpenSpec 可用性：本地 `openspec` 命令未安装；`npx -y @fission-ai/openspec@latest --version` 可用，版本 `1.3.1`。
- 已读项目上下文：
  - `AGENTS.md`
  - `projects/proj-1779447357476-ryiijf/outputs/current-source-of-truth.md`
  - `projects/proj-1779447357476-ryiijf/outputs/progress-report-v3.md`
  - `projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`
  - `projects/proj-1779447357476-ryiijf/project.md`
  - `openspec/specs/auction-engine/spec.md`
  - `openspec/specs/realtime-live-room/spec.md`
  - `docs/superpowers/plans/2026-05-27-auction-engine-mvp.md`
  - `docs/superpowers/plans/2026-05-28-ws-realtime-live-room.md`
  - 已归档 `auction-engine-mvp` 和 `ws-realtime-live-room` 的 design/tasks。

## Existing Bids, Orders, And Migrations Review

`bids` / `orders` 相关文件已纳入前序 `auction-engine-mvp`，本 change 将基于它们继续，不把它们当作无关脏工作：

- `backend/migrations/006_create_bids.sql`
  - `bids.status` 支持 `active`、`outbid`、`won`、`cancelled`。
  - 已有 auction/user 外键和 auction amount、user、status 索引。
- `backend/migrations/007_create_orders.sql`
  - `orders.status` 支持 `pending_confirm`、`pending_payment`、`paid`、`cancelled`。
  - 已有 `auction_id UNIQUE`，避免重复订单。
  - 已有 `cancel_reason`、`confirmed_at`、`paid_at`、`cancelled_at`。
  - 已有 buyer、merchant、status 索引。
- `backend/internal/model/order.go`
  - 字段可以承载本阶段订单状态、取消原因和时间戳。
- `backend/internal/repository/auction_engine_repo.go`
  - 当前 `CreateOrder` 只负责生成 `pending_confirm`。
  - 当前 `SettleExpired` 和封顶价成交会在生成订单时调用 `DeductFrozenBalance`，即中标金额已经从 `frozen_amount` 转扣。
- `backend/tests/integration/auction_engine_test.go`
  - 已覆盖封顶成交和时间成交创建 `pending_confirm` 订单。
  - 已验证成交后中标用户 `frozen_amount = 0`，余额已经扣减。

关键衔接结论：order-system 不应在模拟支付时再次扣款。由于现有 auction-engine 已在成交生成 `pending_confirm` 时转扣冻结金额，本阶段确认只是买家确认订单，模拟支付只是把状态从 `pending_payment` 推进到 `paid`。如果买家未确认超时或在确认前取消，order-system 需要通过补偿退款把 `amount` 加回买家 `balance`，且必须保证只退款一次。

## Goal

构建中标后的订单闭环：

- 买家看到由 auction-engine 生成的 `pending_confirm` 订单。
- 买家在 30 分钟内确认订单，订单进入 `pending_payment`。
- 买家执行模拟支付，订单进入 `paid`。
- 买家确认前取消或超过 30 分钟未确认，订单进入 `cancelled` 并退款。
- 买家可查看自己的订单列表和详情。
- 商家可查看自己成交订单列表和详情。
- 前端提供必要入口、状态展示和可执行动作。

## Non-goals

- 不接入真实支付渠道、退款渠道或物流履约。
- 不新增钱包流水表，除非实现阶段发现现有 `users.balance` / `frozen_amount` 无法满足一致性。
- 不重写 auction-engine 成交流程，不改变已有 `pending_confirm` 订单生成契约。
- 不把订单超时取消反向修改 `auctions.status` 或 `products.status`。竞拍历史仍记录为 `ended_sold`，订单状态表达买家未确认导致的交易取消。
- 不实现商家数据看板图表，这属于后续 `merchant-admin` / analytics slice。

## Users And Scenarios

### Buyer

1. 买家中标后进入订单列表，看到 `待确认` 订单、商品信息、成交价和确认截止时间。
2. 买家打开订单详情，确认订单后状态变为 `待支付`。
3. 买家点击模拟支付，订单状态变为 `已支付`。
4. 买家在确认前取消，订单变为 `已取消`，金额退回余额。
5. 买家超过 30 分钟未确认，后台任务取消订单并退回余额。
6. 买家不能确认、支付或查看别人的订单。

### Merchant

1. 商家打开订单管理，看到自己商品产生的订单。
2. 商家打开订单详情，看到买家信息、商品信息、成交金额、状态和关键时间。
3. 商家不能查看其他商家的订单，不能代替买家确认或支付。

## Acceptance Criteria

- `pending_confirm -> pending_payment -> paid` 状态流转受角色和所有权保护。
- `pending_confirm -> cancelled` 支持买家取消和确认超时两种原因。
- 取消和超时退款只对 `pending_confirm` 生效，且在并发/重复调用时不会重复退款。
- 支付接口不会二次扣减买家余额。
- 列表和详情接口按当前登录角色自动隔离数据：
  - user 只看 `buyer_id = current_user`。
  - merchant 只看 `merchant_id = current_user`。
- 前端用户端至少有 `/app/orders` 和 `/app/orders/:id`。
- 前端商家端至少有 `/merchant/orders` 和 `/merchant/orders/:id` 或等价详情入口。
- E2E 覆盖中标订单从 `pending_confirm` 到 `paid` 的可演示路径。

## Technical Direction

- 后端新增 `OrderRepo`、`OrderService`、`OrderHandler`，保持现有 handler -> service -> repository 分层。
- 新增订单 DTO，列表项和详情统一包含商品摘要、金额、状态、取消原因、确认/支付/取消时间、确认截止时间。
- 订单状态变更使用 DB transaction 和 `SELECT ... FOR UPDATE` 锁住订单行。
- 退款通过 `UPDATE users SET balance = balance + ?` 完成，只在订单从 `pending_confirm` 成功变成 `cancelled` 的同一个事务内执行。
- 超时 worker 使用 `created_at <= now - 30 minutes` 查找 `pending_confirm` 订单，批量取消并退款。
- 前端新增订单 API/types/pages，并在用户大厅和商家商品管理页增加入口。

## Risks

- 现有 auction-engine 已提前扣款，和需求文本中的“确认超时余额全部解冻”存在语义差异。处理方式是补偿退款，并在设计中明确支付不二次扣款。
- 订单超时 worker 和用户手动取消可能并发，需要行锁和状态条件保证单次退款。
- 订单详情需要联表商品、图片、买家/商家信息，字段应保持够用，不引入过宽响应。
- 前端订单入口若过度改造导航，容易扩大范围。本阶段只加必要入口和状态展示。

## Open Questions Resolved For This Change

- 超时取消是否改 auction/product 状态：不改。订单取消表示交易失败，竞拍结果仍保留历史 `ended_sold`。
- 模拟支付是否扣余额：不扣。扣款已在 auction-engine 成交时完成。
- 是否支持买家主动取消：支持，仅限 `pending_confirm`。
- 是否需要新增 migration：当前 schema 足够，优先不新增 migration。
