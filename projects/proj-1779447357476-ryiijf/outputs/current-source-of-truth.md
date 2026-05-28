# 当前权威文档与状态说明

> 更新时间：2026-05-27

## 权威需求版本

当前最新、最高优先级需求文档是：

- `projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`

历史版本仅作参考：

- `projects/proj-1779447357476-ryiijf/outputs/requirements-v1.md`：历史初版
- `projects/proj-1779447357476-ryiijf/outputs/requirements-v2.md`：历史中间版

如旧文档或记忆中出现“requirements-v2 是当前版本”等表述，一律视为过期。后续规划、OpenSpec 变更和实现验收都必须以 `requirements-v3.md` 为准。

## 当前状态报告

当前业务代码真实状态以以下文件为准：

- `projects/proj-1779447357476-ryiijf/outputs/progress-report-v3.md`

该报告已按当前本地分支、`AGENTS.md`、`requirements-v3.md`、`project.md` 和 `openspec/changes/auction-engine-mvp/` 重新盘点。

## 当前执行规范

后续 agent 必须先读：

- `AGENTS.md`
- `projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`
- `projects/proj-1779447357476-ryiijf/outputs/current-source-of-truth.md`
- `openspec/changes/auction-engine-mvp/`
- `docs/superpowers/plans/2026-05-27-auction-engine-mvp.md`

## 下一步

当前下一步不是重新读 v2，也不是直接写业务代码，而是执行 `auction-engine-mvp` 的 OpenSpec tasks：

1. 审查并纳入/修正提前加入的 `bids/orders` 相关文件。
2. 实现 auction-engine 后端最小闭环。
3. 运行 Go 测试、迁移验证和出价流程集成测试。
