# 抖音电商 AI 全栈挑战赛提交材料

## 1. 课题名称

抖音电商 AI 全栈挑战赛 - 直播竞拍全栈系统。

项目对外名称：实时竞拍大师。

## 2. 团队名称与成员名单

团队：林志 - 个人开发。

成员：林志。

## 3. 分工说明

当前按单人独立开发整理：

- 产品与需求：竞拍规则、用户流程、演示路径和验收标准。
- 后端：Go API、竞拍引擎、钱包冻结、订单、WebSocket、健康检查和 AI 能力接入。
- 前端：React H5 买家端、商家后台、实时竞拍房间、商家监控页和订单页面。
- 数据与运维：MySQL/Redis 本地环境、迁移脚本、演示 seed、压测脚本和验证文档。
- 文档与流程：OpenSpec、Superpowers 计划、README、演示 runbook、AI 使用记录和提交材料。

## 4. 核心功能清单

1. 商家商品与竞拍发布：商家可创建商品、上传图片和直播间素材，配置起拍价、加价规则、封顶价、竞拍时长和自动延时规则。
2. 实时直播竞拍：买家进入 H5 竞拍房间，通过 WebSocket 获取当前价格、倒计时、排行榜、竞拍终态和私有被超越通知。
3. 竞拍引擎与资金冻结：后端支持余额预冻结、被超越自动解冻、成交扣款、Redis `SETNX` 短锁、数据库事务和行锁一致性保护。
4. 成交订单闭环：竞拍结束后生成订单，买家可确认中标、模拟支付，超时或取消会触发余额返还。
5. 商家运营后台：商家可查看商品列表、竞拍状态、订单列表、运营看板和单场实时竞拍监控。
6. AI 商家助手：提供商品文案草稿、实时竞拍解说、终局竞拍分析报告。AI 输出只辅助展示，不改变竞拍、钱包和订单状态。

## 5. 端到端使用流程

1. 商家登录系统后进入商家后台，创建商品并填写商品介绍、图片和竞拍规则。
2. 商家发布竞拍后，可在商品列表或运营看板中进入实时竞拍监控页。
3. 买家登录 H5 端，进入竞拍大厅并选择当前进行中的商品。
4. 买家在直播竞拍房间中查看当前价格、倒计时、排行榜和竞拍规则，并提交符合加价规则的出价。
5. 后端竞拍引擎冻结当前出价者余额，解冻被超越者余额，并通过 WebSocket 向房间广播价格、排名和倒计时变化。
6. 若触发 Soft Close，系统自动延长倒计时；若达到封顶价或时间结束，竞拍进入成交或流拍状态。
7. 成交后系统生成订单，中标买家进入订单页完成确认和模拟支付。
8. 商家可在订单页和竞拍监控页查看成交结果，也可生成 AI 赛后分析报告用于复盘。

## 6. 在线 Demo 链接

暂未提供公开在线 Demo。当前项目支持本地一键启动和本地演示数据初始化。

## 7. 演示视频链接

暂未提供公开演示视频链接。

## 8. 源代码仓库链接

- 主仓库：https://github.com/linz12306/douyin_live_auction.git

## 9. README / 运行说明

项目根目录已有 `README.md`，包含项目简介、架构、启动方式、演示账号、核心功能和验证命令。以下是可直接用于提交页的精简版。

### 项目简介

实时竞拍大师是一个面向直播电商场景的本地 MVP，覆盖商家商品发布、竞拍激活与监控、买家实时出价、私有被超越通知、竞拍结算、订单确认和模拟支付。

### 依赖环境

- Go：`backend/go.mod` 当前声明 `go 1.26.3`
- Node.js / npm：用于前端 Vite、脚本和 Playwright
- MySQL 8：本地 Docker，默认 `127.0.0.1:3307`，数据库 `auction_db`
- Redis 7：本地 Docker，默认 `127.0.0.1:16380`
- 前端：React 19 + Vite + TypeScript + TailwindCSS
- 后端：Go + Gin + gorilla/websocket

### 启动步骤

在仓库根目录启动 MySQL 和 Redis：

```bash
docker compose up -d mysql redis
```

启动后端：

```bash
cd backend
REDIS_ADDR=127.0.0.1:16380 go run ./cmd/server
```

另开终端启动前端：

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

准备演示数据时，在仓库根目录运行：

```bash
DEMO_API_BASE_URL=http://127.0.0.1:8080 npm run demo:seed
```

打开 `http://127.0.0.1:3000` 体验应用。

### 目录结构

```text
backend/
  cmd/server/                 后端入口与路由注册
  internal/config/            配置、MySQL、Redis 初始化
  internal/handler/           HTTP 与 WebSocket handler
  internal/service/           业务服务、竞拍引擎、订单、AI、健康检查
  internal/repository/        MySQL 持久化访问
  internal/realtime/          WebSocket Hub、事件总线、Redis Streams backplane
  internal/model/             数据模型
  migrations/                 MySQL 表结构迁移
  tests/integration/          后端集成测试

frontend/
  src/api/                    前端 API client
  src/pages/app/              买家 H5 页面
  src/pages/merchant/         商家后台页面
  src/store/                  登录与实时房间状态
  src/components/             通用组件与商家组件

scripts/
  demo-seed.mjs               本地演示数据初始化
  load-auction.mjs            并发出价 / WebSocket 压测脚本

docs/
  demo-readiness.md           演示 runbook
  performance-report.md       性能与压测证据
  ai-usage.md                 AI 协作使用记录

openspec/
  specs/                      已归档能力规范
  changes/                    当前和历史 OpenSpec 变更
```

### 配置说明

后端关键环境变量：

- `DB_DSN`：MySQL 连接串，默认连接 `127.0.0.1:3307/auction_db`
- `REDIS_ADDR`：Redis 地址，默认 `127.0.0.1:16380`
- `REDIS_PASSWORD`：Redis 密码，本地默认空
- `JWT_SECRET`：JWT 签名密钥
- `SERVER_PORT`：后端端口，默认 `8080`
- `AVATAR_DIR`、`IMAGE_DIR`、`LIVE_MEDIA_DIR`：头像、商品图片和直播素材存储目录
- `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`、`AI_TIMEOUT_MS`、`AI_MAX_TOKENS`：OpenAI-compatible 模型配置

## 10. 需求文档

需求确认文档 v3.0（终极版）：`projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`。

当前权威状态说明：`projects/proj-1779447357476-ryiijf/outputs/current-source-of-truth.md`。

## 11. 大模型 / AI 能力使用说明

### 系统内 AI 能力

1. 商品文案助手：商家在商品表单中输入标题、描述和竞拍规则后，请求 `POST /api/v1/merchant/ai/product-copy`，后端调用 OpenAI-compatible Chat Completions API 生成标题、描述、卖点和直播话术草稿。草稿只预览，需商家手动点击应用，不会自动保存或覆盖商品。
2. 实时竞拍解说：后端订阅已提交的竞拍事件，在首口出价、价格里程碑、Soft Close 延时、竞拍结束或取消等关键事件后异步生成一句短解说，并通过 WebSocket `ai_commentary` 消息展示。模型失败时跳过，不伪造兜底内容。
3. 赛后竞拍报告：终态竞拍可调用 `POST /api/v1/merchant/ai/auctions/:id/report` 生成分析报告，数据来自商品、出价数、参与人数、成交价、持续时间、最后 30 秒出价占比等快照，并持久化到 `ai_generation_records`。

### 模型接入方式

- 使用 OpenAI-compatible `/v1/chat/completions` 接口。
- 通过 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`、`AI_TIMEOUT_MS`、`AI_MAX_TOKENS` 配置。
- 未配置模型时，直接 AI API 返回清晰配置错误，实时解说跳过生成，不使用伪造内容兜底。

### AI 辅助开发记录

- `docs/ai-usage.md` 记录本项目使用 AI 进行需求拆解、OpenSpec/Superpowers 文档、代码导航、补丁草拟、测试设计和验证记录。
- AI 参与了约 70-80% 的文档草拟与机械实现工作，产品判断、语义选择和风险接受由人类主导。

## 12. 关键工程难点与解决方案

### 难点 1：高并发出价下的钱包一致性

直播间同一商品会出现短时间大量出价。如果多个请求同时修改余额、冻结金额和最高价，容易出现重复成交、余额为负或多个 active bid。

项目使用 Redis `SETNX` 做竞拍级短锁，并用数据库事务和 `FOR UPDATE` 行锁保护关键状态。出价成功后冻结新出价、解冻被超越者，并保证同一竞拍只有一个 active bid。`version` 字段用于实时事件排序和前端防倒退，不夸大为数据库乐观锁。

### 难点 2：实时 UI 与后端真理源同步

REST 返回和 WebSocket 广播可能存在先后顺序差异。项目约定 WebSocket 是实时竞拍的真理源：REST 只做页面初始化和动作提交，价格、排名、倒计时、出价结果和终态都以 WebSocket snapshot/update 覆盖前端 Zustand store，降低 UI 闪烁和状态倒退风险。

### 难点 3：竞拍倒计时与 Soft Close

最后时刻出价需要自动延时，同时不能无限延长。后端维护竞拍状态机和延时次数，临近结束时触发 Soft Close，把倒计时重置到指定窗口并广播 extended 消息；达到最大延时次数后不再延长，时间到或封顶价达到时进入终态。

### 难点 4：热点竞拍的请求峰值削峰

同步出价在高争用下会出现大量 Redis lock busy，能保护一致性但用户侧会收到较多 429。项目新增异步排队出价路径 `POST /api/v1/auctions/:id/bid/async`，先持久化 bid command，再由 Redis Streams worker 按竞拍顺序处理。同一竞拍串行消化，不同竞拍可并行处理，兼顾削峰和状态一致性。

### 难点 5：AI 输出不能污染核心交易状态

AI 生成内容可能失败、为空或格式不稳定。项目把 AI 能力限制为展示辅助：商品文案只生成草稿，实时解说不参与状态判定，赛后报告只读取终态快照；所有竞拍、钱包、订单、排名仍由后端业务逻辑和数据库记录决定。

## 13. 项目亮点 / 创新点

1. 直播电商竞拍闭环完整：覆盖商家发布、买家实时出价、排行榜、Soft Close、成交确认、模拟支付、商家监控与订单管理。
2. 高并发一致性方案可演示：Redis 锁、数据库事务/行锁、异步 bid command 队列、健康指标和压测脚本组成可验证的工程证据链。
3. AI 与业务边界清晰：AI 提供文案、直播解说和赛后复盘，增强演示表现力，但不改变交易正确性和状态真理源。

## 14. 其余材料

### 14.1 性能指标 / 压测结果

仓库已有 `docs/performance-report.md`。本地压测证据摘要如下：

- 同步出价模式使用 Redis `SETNX` fail-fast 保护一致性，高争用下会返回较多 429。
- 最高一轮本地样例为 5000 请求、500 并发、150 个 WebSocket 连接，无 5xx 或超时。
- 异步排队模式通过 `auction_bid_commands` 和 Redis Streams worker 吸收 HTTP 峰值，再按竞拍维度顺序处理。

一致性验证要点：

- 同一非终态竞拍 `active_bid_count = 1`。
- 成交订单不重复。
- 用户钱包 `balance` 与 `frozen_amount` 非负。
- `/healthz` 可展示 bid 请求量、成功率、平均延迟、lock busy、lock degraded、WebSocket 连接数、dropped events 和 bid command 处理指标。

### 14.2 Prompt 策略 / Agent 流程

Prompt 策略：

- 商品文案要求严格 JSON 输出，字段包括 `title`、`description`、`selling_points`、`live_script`。
- 实时解说要求一句中文短句，不超过 32 字，不编造用户姓名，不参与竞拍状态判断。
- 赛后报告只基于后端终态快照，不编造输入中没有的数据。

AI 工作流：

```text
商品信息 / 竞拍事件 / 终态竞拍快照
  -> 后端校验权限与状态
  -> 构造受约束 Prompt
  -> OpenAI-compatible Chat Completions
  -> 解析与格式校验
  -> 前端草稿预览，商家手动应用
  -> WebSocket ai_commentary 展示
  -> 保存 ai_generation_records
  -> 返回错误或跳过解说，不伪造兜底内容
```

### 14.3 评测方案与样例结果

功能评测：

1. 使用 `npm run demo:seed` 创建演示账号和活跃竞拍。
2. 使用商家账号进入 `/merchant/dashboard` 和竞拍监控页。
3. 使用两个买家账号进入同一竞拍房间，依次出价，验证价格、排行榜、私有 outbid、Soft Close 和终态。
4. 使用订单页验证中标确认、模拟支付、取消/超时退款。
5. 使用 `/healthz` 和 `scripts/load-auction.mjs` 验证健康状态、并发指标和一致性证据。

自动化评测：

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:demo
```

后端与前端常用验证：

```bash
cd backend
REDIS_ADDR=127.0.0.1:16380 go test ./...
```

```bash
cd frontend
npm run test
npm run build
```

样例结果可从 `docs/performance-report.md` 和 `projects/proj-1779447357476-ryiijf/outputs/progress-report-v3.md` 中摘取。

## 15. AI 协作说明

本项目采用 AI 辅助的开发方式。开发者先用自然语言描述业务目标、竞拍规则和演示需求，再由 AI 协助完成需求拆解、技术方案、OpenSpec 规范、执行计划、代码实现、测试补齐和文档整理。

对于竞拍引擎、WebSocket 实时通信、订单、钱包、并发一致性、AI 商家助手等复杂模块，项目先经过 Superpowers exploration -> OpenSpec lock -> Superpowers execution -> OpenSpec verification/archive -> Superpowers memory 的流程，确保每次行为变更都有目标、边界、验收标准、实现任务和验证记录。

对于小型 UI 调整和文档整理，则使用 fast-lane 快速完成，但仍要求阅读相关上下文、最小改动、聚焦验证和提交记录。
