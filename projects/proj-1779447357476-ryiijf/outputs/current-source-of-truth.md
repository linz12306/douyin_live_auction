# 当前权威文档与状态说明

> 更新时间：2026-06-01

## 权威需求版本

当前最新、最高优先级需求文档是：

- `projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`

旧版 `requirements-v1.md` / `requirements-v2.md` 已在仓库整理中移除。如旧文档、旧记忆或历史聊天中出现“requirements-v2 是当前版本”等表述，一律视为过期。后续规划、OpenSpec 变更和实现验收都必须以 `requirements-v3.md` 为准。

## 当前状态报告

当前业务代码真实状态以以下文件为准：

- `projects/proj-1779447357476-ryiijf/outputs/progress-report-v3.md`

该报告已按当前 `AGENTS.md`、`requirements-v3.md`、`project.md`、已归档的 `auction-engine-mvp`、`ws-realtime-live-room`、`order-system`、`observability-health`、`merchant-dashboard`、`merchant-auction-monitor` 和 `demo-readiness` 重新盘点。

旧版 `progress-report-v1.md` / `progress-report-v2.md` 已移除。如需追溯历史，请查看 Git 历史。

## 当前执行规范

后续 agent 必须先读：

- `AGENTS.md`
- `projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`
- `projects/proj-1779447357476-ryiijf/outputs/current-source-of-truth.md`
- `openspec/specs/auction-engine/spec.md`
- `openspec/specs/realtime-live-room/spec.md`
- `openspec/specs/order-system/spec.md`
- `openspec/specs/observability-health/spec.md`
- `openspec/specs/merchant-dashboard/spec.md`
- `openspec/specs/merchant-auction-monitor/spec.md`
- `openspec/specs/demo-readiness/spec.md`
- `openspec/changes/archive/2026-05-28-auction-engine-mvp/`
- `openspec/changes/archive/2026-05-28-ws-realtime-live-room/`
- `openspec/changes/archive/2026-05-29-order-system/`
- `openspec/changes/archive/2026-05-29-observability-health/`
- `openspec/changes/archive/2026-05-31-merchant-dashboard/`
- `openspec/changes/archive/2026-05-31-merchant-auction-monitor/`
- `openspec/changes/archive/2026-05-31-demo-readiness/`
- `docs/superpowers/plans/2026-05-27-auction-engine-mvp.md`
- `docs/superpowers/plans/2026-05-28-ws-realtime-live-room.md`
- `docs/superpowers/plans/2026-05-29-order-system.md`
- `docs/superpowers/plans/2026-05-29-observability-health.md`
- `docs/superpowers/plans/2026-05-30-merchant-dashboard.md`
- `docs/superpowers/plans/2026-05-30-merchant-auction-monitor.md`
- `docs/superpowers/plans/2026-05-31-demo-readiness.md`

## 下一步

当前下一步不是重新读 v2，也不是继续在已归档 change 上直接写业务代码，而是开启新的 OpenSpec change：

1. 已完成并归档：`auction-engine-mvp`。
2. 已完成并归档：`ws-realtime-live-room`，打通 WebSocket 实时竞价和前端用户体验。
3. 已完成并归档：`order-system`，做中标确认、模拟支付、超时处理、用户/商家订单展示。
4. 已完成并归档：`observability-health`，提供 `/healthz` 和 DB/Redis/auction_engine 健康状态。
5. 已完成并归档：`merchant-dashboard`，提供商家运营看板。
6. 已完成并归档：`merchant-auction-monitor`，提供商家实时竞拍监控。
7. 已完成并归档：`demo-readiness`，提供本地演示数据、演示 runbook 和 E2E readiness check。
8. 建议下一步：按新的 OpenSpec change 规划商家运营增强、指标或日志能力。
9. 仍需保持 Superpowers + OpenSpec 五段式流程，并在每个可验证切片提交。
