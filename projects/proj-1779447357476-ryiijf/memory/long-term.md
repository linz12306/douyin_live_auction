# 项目长期记忆

> 更新时间：2026-05-29

## 用户偏好

- 使用中文沟通。
- 优先快速推进核心业务闭环，标准登录/资料等通用能力不做过度优化。
- 非轻量功能遵守 `AGENTS.md`：Superpowers exploration -> OpenSpec lock -> Superpowers execution -> OpenSpec verification/archive -> Superpowers memory。
- 小型 UI 接线、文档整理、分支/worktree 收口可走 fast-lane，但必须说明范围、做最小改动并验证。

## 当前仓库状态

- 主仓库：`/Users/vivix/Documents/Codex/douyin_live_auction`
- 当前长期保留分支：`master`
- 当前权威需求：`projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`
- 当前进度报告：`projects/proj-1779447357476-ryiijf/outputs/progress-report-v3.md`
- 旧版 `requirements-v1/v2` 和 `progress-report-v1/v2` 已清理；如需追溯历史，使用 Git 历史。

## 本地开发环境

- Go：`/Users/vivix/.local/go/bin/go`
- MySQL：`127.0.0.1:3307`，数据库 `auction_db`
- Redis：`127.0.0.1:16379`
- 常用测试端口：后端 `18080`，前端 `13000`
- 前端代理可用 `VITE_BACKEND_TARGET=http://localhost:18080`
- 后端本地验证可用 `SERVER_PORT=18080 DISABLE_RATE_LIMIT=1`

## 已完成并归档

- `auction-engine-mvp`
  - 归档：`openspec/changes/archive/2026-05-28-auction-engine-mvp/`
  - 持久规范：`openspec/specs/auction-engine/spec.md`
  - 覆盖：开拍、出价、余额冻结/解冻、排行榜、取消、Soft Close、封顶/到期结算、订单生成。

- `ws-realtime-live-room`
  - 归档：`openspec/changes/archive/2026-05-28-ws-realtime-live-room/`
  - 持久规范：`openspec/specs/realtime-live-room/spec.md`
  - 覆盖：用户大厅、直播间、WebSocket snapshot/广播、排行榜实时更新、私有 outbid 通知、竞拍结束通知。

- `order-system`
  - 归档：`openspec/changes/archive/2026-05-29-order-system/`
  - 持久规范：`openspec/specs/order-system/spec.md`
  - 覆盖：用户订单列表/详情、商家订单列表/详情、确认订单、模拟支付、确认超时/取消退款。

## 当前进行中

- `observability-health`
  - 分支/worktree：`/Users/vivix/Documents/Codex/douyin_live_auction_worktrees/observability-health`，`codex/observability-health`
  - Active OpenSpec：`openspec/changes/observability-health/`
  - Superpowers exploration：`docs/superpowers/specs/2026-05-29-observability-health-exploration.md`
  - Superpowers plan：`docs/superpowers/plans/2026-05-29-observability-health.md`
  - 已实现：`GET /healthz`，返回 DB、Redis、竞拍引擎/realtime runtime 健康状态。
  - 响应规则：全部健康返回 HTTP 200 + `status: "ok"`；任一必需组件降级返回 HTTP 503 + `status: "degraded"`。
  - 范围控制：未引入 Prometheus/OpenTelemetry/外部日志系统，未改动出价、订单、钱包或 WebSocket 业务语义。
  - 当前状态：实现和 memory/docs commit 已完成，OpenSpec strict、后端测试和 `/healthz` 接口验证通过；push 被本机全局 pre-push hook 阻止，生成了 `/tmp/douyin_live_auction_push_forbidden`。

## 关键业务决策

- 竞拍成交生成 `pending_confirm` 订单时，auction engine 已经扣减中标冻结金额。
- 模拟支付只改变订单状态，不再次扣款。
- 买家确认前取消或确认超时只退款一次，由订单服务在锁定 `pending_confirm` 订单后处理。
- 订单取消/超时不改写 `auctions` 和 `products` 的 `ended_sold` 历史状态。
- 用户端实时竞拍页以 WebSocket 为实时真理源，REST 只做初始化或动作提交。
- `/healthz` 只暴露短消息和轻量 runtime stats，不返回原始 DB/Redis 错误、DSN、密码或堆栈。

## 下一阶段建议

1. Bugfix/体验补齐：页面返回按钮、商家更新后用户端可见性、入口与状态刷新一致性。
2. `merchant-admin` / 运营增强：商家实时看板、成交趋势、出价分布、用户活跃度。
3. 可观测性后续增强：结构化日志、竞拍引擎指标、WebSocket/锁竞争指标。
4. 演示打磨：移动端动画、提示文案、完整演示路径 E2E。
