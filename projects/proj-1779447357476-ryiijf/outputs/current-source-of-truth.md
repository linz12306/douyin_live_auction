# 当前权威文档与状态说明

> 更新时间：2026-05-29

## 权威需求版本

当前最新、最高优先级需求文档是：

- `projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`

旧版 `requirements-v1.md` / `requirements-v2.md` 已在仓库整理中移除。如旧文档、旧记忆或历史聊天中出现“requirements-v2 是当前版本”等表述，一律视为过期。后续规划、OpenSpec 变更和实现验收都必须以 `requirements-v3.md` 为准。

## 当前状态报告

当前业务代码真实状态以以下文件为准：

- `projects/proj-1779447357476-ryiijf/outputs/progress-report-v3.md`

该报告已按当前 `order-system`、`AGENTS.md`、`requirements-v3.md`、`project.md`、已归档的 `auction-engine-mvp`、已归档的 `ws-realtime-live-room` 和已归档的 `order-system` 重新盘点。

旧版 `progress-report-v1.md` / `progress-report-v2.md` 已移除。如需追溯历史，请查看 Git 历史。

## 当前执行规范

后续 agent 必须先读：

- `AGENTS.md`
- `projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`
- `projects/proj-1779447357476-ryiijf/outputs/current-source-of-truth.md`
- `openspec/specs/auction-engine/spec.md`
- `openspec/specs/realtime-live-room/spec.md`
- `openspec/specs/order-system/spec.md`
- `openspec/changes/archive/2026-05-28-auction-engine-mvp/`
- `openspec/changes/archive/2026-05-28-ws-realtime-live-room/`
- `openspec/changes/archive/2026-05-29-order-system/`
- `docs/superpowers/plans/2026-05-27-auction-engine-mvp.md`
- `docs/superpowers/plans/2026-05-28-ws-realtime-live-room.md`
- `docs/superpowers/plans/2026-05-29-order-system.md`

## 下一步

当前下一步不是重新读 v2，也不是继续在已归档 change 上直接写业务代码，而是开启新的 OpenSpec change：

1. 已完成并归档：`auction-engine-mvp`。
2. 已完成并归档：`ws-realtime-live-room`，打通 WebSocket 实时竞价和前端用户体验。
3. 已完成并归档：`order-system`，做中标确认、模拟支付、超时处理、用户/商家订单展示。
4. 建议下一步：`merchant-admin` / 运营增强，规划商家实时看板、订单运营增强或数据看板。
5. 仍需保持 Superpowers + OpenSpec 五段式流程，并在每个可验证切片提交。
