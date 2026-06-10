# 抖音直播拍卖 MVP

这是一个本地可运行的直播拍卖 MVP，覆盖商家发布商品、开启并监控拍卖、买家实时出价、私密超价提醒、拍卖结算、订单确认和模拟支付等核心流程。

## 项目结构

- `backend/`：Go HTTP API，包含 JWT 登录、MySQL 持久化、Redis 出价锁、WebSocket 拍卖房间和健康检查。
- `frontend/`：React + Vite + TypeScript 前端，使用 React Router、Zustand 和 Vitest。
- `backend/migrations/`：MySQL 初始化脚本。
- `docs/`、`openspec/`、`projects/`：演示材料、OpenSpec 规格和 Superpowers 工作流记录。
- `tests/e2e/`：Playwright 本地演示链路测试。

## 本地启动

以下命令默认在仓库根目录执行。

启动 MySQL 和 Redis：

```bash
docker compose up -d mysql redis
```

在宿主机启动后端。

PowerShell：

```powershell
cd backend
$env:REDIS_ADDR = "127.0.0.1:16380"
go run ./cmd/server
```

Bash：

```bash
cd backend
REDIS_ADDR=127.0.0.1:16380 go run ./cmd/server
```

后端默认读取以下本地配置；也可以复制 `backend/.env.example` 后按需调整：

```env
DB_DSN=root:auction123@tcp(127.0.0.1:3307)/auction_db?parseTime=true&loc=UTC&charset=utf8mb4
REDIS_ADDR=127.0.0.1:16380
SERVER_PORT=8080
```

在另一个终端启动前端：

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

打开 `http://127.0.0.1:3000` 访问应用。Vite 默认把 `/api`、`/ws` 和 `/static` 代理到 `http://localhost:8080`；如需修改后端地址，设置 `VITE_BACKEND_TARGET`。

也可以通过 Docker 启动后端服务：

```bash
docker compose --profile app up -d
```

## 演示账号

准备可重复的演示数据：

```bash
npm run demo:seed
```

如果后端地址不是默认值，可以显式指定。

PowerShell：

```powershell
$env:DEMO_API_BASE_URL = "http://127.0.0.1:8080"
npm run demo:seed
```

Bash：

```bash
DEMO_API_BASE_URL=http://127.0.0.1:8080 npm run demo:seed
```

默认演示账号：

- 商家：`demo_merchant` / `test123`
- 买家 A：`demo_buyer_a` / `test123`
- 买家 B：`demo_buyer_b` / `test123`

种子脚本会创建一个新的有效拍卖，并打印主要演示路由。完整演示步骤见 [docs/demo-readiness.md](docs/demo-readiness.md)。

## 核心功能

- 商家商品管理，支持图片上传和拍卖规则发布。
- 拍卖引擎，支持开启拍卖、出价校验、余额冻结/解冻、排名、软关闭、取消规则和结算。
- 买家直播拍卖房间，支持 WebSocket 快照、实时价格/排名、倒计时和私密超价提醒。
- 商家工作台，展示范围化指标、活跃拍卖、状态计数和近期订单。
- 商家拍卖监控页，与拍卖 WebSocket 流保持一致。
- 订单流程，支持胜出者确认、模拟支付、超时/取消处理、买家订单页和商家订单页。
- 健康检查：`GET /healthz` 返回数据库、Redis 和拍卖引擎组件状态。

## 常用验证

文档或规格类改动可运行：

```bash
npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive
git diff --check
```

后端代码改动常用检查。

PowerShell：

```powershell
cd backend
$env:REDIS_ADDR = "127.0.0.1:16380"
go test ./...
```

Bash：

```bash
cd backend
REDIS_ADDR=127.0.0.1:16380 go test ./...
```

前端代码改动常用检查：

```bash
cd frontend
npm run test
npm run build
```

演示 E2E 可在本地服务启动后运行：

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:demo
```
