# 项目长期记忆

> 更新时间：2026-06-09

## 用户偏好

- 使用中文沟通。
- 优先快速推进核心业务闭环，标准登录/资料等通用能力不做过度优化。
- 非轻量功能遵守 `AGENTS.md`：Superpowers exploration -> OpenSpec lock -> Superpowers execution -> OpenSpec verification/archive -> Superpowers memory。
- 小型 UI 接线、文档整理、分支/worktree 收口可走 fast-lane，但必须说明范围、做最小改动并验证。

## 当前仓库状态

- 当前材料收口工作区：`/Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials`
- 当前材料收口分支：`codex/demo-materials`
- 主仓库：`/Users/vivix/Documents/Codex/douyin_live_auction`
- 当前权威需求：`projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`
- 当前进度报告：`projects/proj-1779447357476-ryiijf/outputs/progress-report-v3.md`
- 旧版 `requirements-v1/v2` 和 `progress-report-v1/v2` 已清理；如需追溯历史，使用 Git 历史。

## 本地开发环境

- Go：`/Users/vivix/.local/go/bin/go`
- MySQL：`127.0.0.1:3307`，数据库 `auction_db`
- Redis：`127.0.0.1:16380`
- 常用测试端口：后端 `18080`，前端 `13000`
- 前端代理可用 `VITE_BACKEND_TARGET=http://localhost:18080`
- 后端本地验证可用 `SERVER_PORT=18080 DISABLE_RATE_LIMIT=1`

## 已完成并归档

- `merchant-dashboard`
  - 归档：`openspec/changes/archive/2026-05-31-merchant-dashboard/`
  - 持久规范：`openspec/specs/merchant-dashboard/spec.md`
  - Added merchant operations dashboard API `GET /api/v1/merchant/dashboard`.
  - Added frontend route `/merchant/dashboard` and entry links from product management, order management, and profile.
  - Dashboard paid metrics count only `paid` orders; pending/cancelled orders are reported in status counts and recent orders only.
  - Local verification used Redis `127.0.0.1:16380` and isolated DB `auction_db_merchant_dashboard` because default `auction_db` was being touched by an existing local backend process/historical test state.

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

- `observability-health`
  - 归档：`openspec/changes/archive/2026-05-29-observability-health/`
  - 持久规范：`openspec/specs/observability-health/spec.md`
  - 覆盖：`GET /healthz`，DB/Redis/竞拍引擎健康状态，realtime runtime 轻量 stats，HTTP 200/503 健康映射，敏感错误脱敏。

- `merchant-auction-monitor`
  - 归档：`openspec/changes/archive/2026-05-31-merchant-auction-monitor/`
  - 持久规范：`openspec/specs/merchant-auction-monitor/spec.md`
  - 覆盖：商家监控入口、WebSocket 实时监控、出价事件、终态展示和受限取消命令。

- `demo-readiness`
  - 归档：`openspec/changes/archive/2026-05-31-demo-readiness/`
  - 持久规范：`openspec/specs/demo-readiness/spec.md`
  - 覆盖：本地 demo seed、演示 runbook、demo 账号、商家/买家完整演示 E2E。

- `perf-observability`
  - 归档：`openspec/changes/archive/2026-06-01-perf-observability/`
  - 持久规范：`openspec/specs/observability-health/spec.md`
  - 覆盖：`/healthz` auction_engine bid metrics、当前 WebSocket 连接数、本地压测脚本 `scripts/load-auction.mjs`、性能报告模板 `docs/performance-report.md`。
  - Scope is intentionally single-process; no Redis Pub/Sub, Prometheus, or multi-instance aggregation.

## 当前进行中

- `h5-live-animations`
  - 分支：`codex/frontend-live-animations`
  - OpenSpec change：`openspec/changes/h5-live-animations/`
  - 已为用户端 H5 `/app/auctions/:id` 增加 Motion for React 动效：价格更新、WebSocket 确认出价成功金币、领先暖色强调、私有 outbid 警告、最后十秒心跳倒计时。
  - 仍保持 WebSocket/Zustand 为实时真理源；REST 出价成功不触发成交/领先庆祝，也不直接改价格、排行、倒计时或终态。
  - 已通过 TDD red/green、focused live-room tests、全量 frontend tests、frontend build、OpenSpec strict、diff 检查和 390x844 Playwright smoke。
  - 当前未提交/未推送；等待用户明确要求。

- `h5-live-ui-polish`
  - 分支：`codex/user-live-ui-optimization`
  - OpenSpec change：`openspec/changes/h5-live-ui-polish/`
  - 已完成用户端 H5 精修：直播间移动端防遮挡、按钮视觉升级、点击反馈、WebSocket 驱动价格更新提示、领先/被超越提示，以及大厅/订单页的窄范围按钮一致性。
  - 保持 WebSocket/Zustand 为实时真理源；REST 出价成功不直接改价格、排行、倒计时、延时、领先/被超越或终态。
  - 已通过 focused buyer tests、全量 frontend tests、frontend build、OpenSpec strict、diff 检查和 390x844 Playwright smoke。

- `merchant-ui-optimization`
  - 分支：`codex/merchant-ui-optimization`
  - OpenSpec change：`openspec/changes/merchant-ui-optimization/`
  - 已锁定并实现商家 PC 端深色横向直播商品控盘台方向：墨黑/石墨底色，青绿/琥珀/玫红/蓝色对应进行中成交/待处理/风险取消/支付信息态。
  - 已覆盖商家运营总览、直播商品横向控盘行、商品详情/编辑/新建、成交订单列表/详情、实时竞拍监控等页面。
  - 新增 `MerchantConsole`、`MerchantPrimitives`、`merchantStatus` 作为商家端共享展示组件；不改变后端 API、数据库、竞拍状态机、WebSocket、订单或钱包规则。
  - 已通过前端完整测试、构建、OpenSpec strict、diff 检查；浏览器烟测受登录保护限制，只确认商家路由正确重定向登录且无 console error。

- `frontend-experience-integration`
  - 分支：`codex/frontend-experience-integration`
  - 已合入 `codex/auction-atmosphere-h5` 和 `codex/merchant-analytics-dashboard`，用于统一验证前端体验路线图的两个已完成包。

- `auction-atmosphere`
  - 分支：`codex/auction-atmosphere-h5`
  - OpenSpec change：`openspec/changes/auction-atmosphere/`
  - 已完成用户端 H5 `/app/auctions/:id` 直播间氛围改造：全屏直播间壳、主播栏、状态徽标、消息层、右侧氛围按钮、底部操作、竞拍浮卡、半屏出价面板、半屏商品橱窗和房间内结果弹层。
  - 仍保持 WebSocket 为实时真理源；REST 出价成功不直接改当前价、排行、倒计时、延时、领先/被超越或终态。
  - 已通过前端测试、构建、OpenSpec 校验、截图布局检查和 diff 检查；完整双买家 E2E 需在后端/MySQL/Redis 启动后再跑。

- `merchant-analytics`
  - 分支：`codex/merchant-analytics-dashboard`
  - OpenSpec change：`openspec/changes/merchant-analytics/`
  - 已扩展 `GET /api/v1/merchant/dashboard` 的只读 `analytics` 字段，包含成交趋势、出价分布和用户活跃度。
  - 商家 analytics 仅统计当前商家的订单和拍品出价，不改变竞拍、钱包、订单、结算、支付、取消或 WebSocket 语义。
  - 前端 `/merchant/dashboard` 已增加 PC 运营风格图表，保留原有汇总指标、状态桶、进行中竞拍、最近订单和导航。

- `h5-visual-design-pipeline`
  - 分支：`codex/frontend-experience-integration`
  - OpenSpec change：`openspec/changes/h5-visual-design-pipeline/`
  - 已锁定用户端 H5 抖音式视觉设计管线：真机截图/录屏 -> Figma 高保真拆解 -> 组件清单 -> React H5 实现 -> 动效还原 -> 移动端截图验收。
  - 首轮只覆盖直播间全状态；个人主页、搜索页、发现/大厅扩展放到第二阶段。
  - 用户已在聊天中提供 Source Batch 01 真机/参考素材；已创建 `source-material-teardown.md` 和 `react-h5-refinement-brief.md`，用于指导后续 React H5 精修。
  - 已创建 `visual-reference-board.html` 作为本地可视化参考板。
  - 已按 Source Batch 01 对 `LiveAuctionRoom` 做一轮 frontend-design 精修：竞拍浮卡、出价半屏、商品橱窗、结果弹窗更贴近抖音式竞拍直播间参考，同时保持 WebSocket 为实时真理源。
  - 已补充 `mobile-screenshot-qa-2026-06-02.md`，记录 390x844 主屏、出价半屏、商品橱窗和桌面烟测截图验收结果；下一步建议在直播间确认后单独开启 `h5-profile-search-expansion`。
  - 当前会话没有可调用的 Figma MCP 工具；已创建 repo-local Figma 文件结构模板和移动端截图验收模板，后续不能声称 Figma 高保真视觉完成，直到 Figma 文件实际落地。

- `h5-discovery-live-feed`
  - 分支：`codex/frontend-experience-integration`
  - OpenSpec change：`openspec/changes/h5-discovery-live-feed/`
  - 二期用户已选择搜索/发现优先，并确认 `直播流入口` 方案。
  - 已锁定 `/app/auctions` 从普通竞拍大厅升级为 H5 `发现竞拍` 入口：搜索视觉、频道 chips、大直播卡、双列拍品卡、订单/我的入口。
  - 首版只使用现有 `listAuctionLobby()` / `AuctionLobbyItem[]`；搜索和频道是本地筛选/展示能力，不新增后端搜索、热榜、WebSocket 或竞拍语义。
  - 已创建 `docs/superpowers/plans/2026-06-02-h5-discovery-live-feed.md`，实现计划覆盖本地筛选测试、发现页视觉壳、频道 chips、hero 优先级、状态验收和移动端截图。
  - 已实现 `/app/auctions` H5 `发现竞拍` 直播流入口：本地搜索/筛选、频道 chips、大直播卡、双列拍品卡、订单/我的入口、加载/错误/空态/本地筛选空态，以及可访问性状态。
  - 已通过 `AuctionLobby` 测试、前端 build、OpenSpec strict、diff 检查、移动端截图 smoke、subagent spec review 和 code-quality review。
  - 个人主页改版、真实后端搜索和真实热榜排序继续后置。

- `merchant-live-media`
  - 分支：`codex/frontend-experience-integration`
  - OpenSpec change：`openspec/changes/merchant-live-media/`
  - 已实现商家为每个商品配置一个直播间素材：后端 `product_live_media` 表、`/api/v1/products/:id/live-media` 上传/替换/删除、`/static/live-media` 静态服务、商品详情和 WebSocket snapshot 的可选 `live_media` 字段。
  - 商家 `ProductForm` 已新增 `直播间素材` 区块，支持新建暂存上传、草稿编辑直接替换/删除、预览、错误提示和非草稿只读。
  - 用户端 `LiveAuctionRoom` 已优先渲染商家上传的图片/视频作为直播间舞台背景；没有 live media 时继续使用当前 fallback staged scene。
  - 大厅和订单摘要图仍以 `product_images` 为来源；已有 lobby/order 回归测试保护不被 live media 覆盖。
  - Demo seed 现在通过真实上传接口注入 live media；本地预览种子 `mpxxsy9z` 创建 auction `1802`，可用 `/app/auctions/1802` 查看。
  - 自动验证和浏览器预览已通过；commit/push 暂停等待用户确认。

## 关键业务决策

- 竞拍成交生成 `pending_confirm` 订单时，auction engine 已经扣减中标冻结金额。
- 模拟支付只改变订单状态，不再次扣款。
- 买家确认前取消或确认超时只退款一次，由订单服务在锁定 `pending_confirm` 订单后处理。
- 订单取消/超时不改写 `auctions` 和 `products` 的 `ended_sold` 历史状态。
- 用户端实时竞拍页以 WebSocket 为实时真理源，REST 只做初始化或动作提交。
- 商家实时监控页同样复用 `/ws/auctions/:id` 作为实时真理源，只展示状态/排行/出价事件，不提供出价控件；取消竞拍仍走现有 REST 命令路径。
- 商家商品列表可返回可选 `auction_id`，用于跳转到对应竞拍监控页；用户大厅行为保持不变。
- `/healthz` 只暴露短消息和轻量 runtime stats，不返回原始 DB/Redis 错误、DSN、密码或堆栈。
- `/healthz` auction_engine metrics now include process-local bid request totals, success/failure totals, success rate, average latency, lock-busy count, and current WebSocket connections.

## 下一阶段建议

1. Bugfix/体验补齐：页面返回按钮、商家更新后用户端可见性、入口与状态刷新一致性。
2. `merchant-admin` / 运营增强：商家实时看板、成交趋势、出价分布、用户活跃度。
3. 可观测性后续增强：结构化日志、持久化或多实例聚合指标、真实监控面板。
4. 演示打磨：移动端动画、提示文案、完整演示路径 E2E。
## 2026-05-30 Fix Notes

- Active bugfix branch: `codex/fix-self-outbid-notification`.
- Current active OpenSpec change: `fix-self-outbid-notification`; do not archive until user accepts the live-room retest.
- Decision: self-rebids must still broadcast accepted bid updates, but must not emit private `outbid` events because the previous active bid was not replaced by a different user.
- Verification passed for focused integration, related backend packages, OpenSpec strict validation, and diff whitespace check.

## Demo Readiness

- Local demo runbook: `docs/demo-readiness.md`.
- Seed command: `DEMO_API_BASE_URL=http://127.0.0.1:8080 npm run demo:seed`.
- E2E command: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:demo`.
- Isolated E2E verification can use frontend `127.0.0.1:13000` and backend `127.0.0.1:18080`.
- Demo accounts: `demo_merchant`, `demo_buyer_a`, `demo_buyer_b`; password `test123`.
