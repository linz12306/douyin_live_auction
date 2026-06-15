# 演示准备 Runbook

## 目的

本文档用于在本地重复演示抖音直播竞拍 MVP。演示路径覆盖商家准备与监控、买家直播出价、私有被超越通知、竞拍结算、订单确认和模拟支付。

## 依赖服务

- MySQL：`127.0.0.1:3307`
- Redis：`127.0.0.1:16380`
- 后端：`http://127.0.0.1:8080`
- 前端：`http://127.0.0.1:3000`

## 启动服务

以下命令默认在当前仓库 `/Users/vivix/Documents/Codex/douyin_live_auction` 中执行。

启动项目本地数据库服务：

```bash
docker compose up -d mysql redis
```

启动后端：

```bash
cd backend
REDIS_ADDR=127.0.0.1:16380 go run ./cmd/server
```

另开一个终端启动前端：

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

## 准备演示数据

在仓库根目录运行：

```bash
DEMO_API_BASE_URL=http://127.0.0.1:8080 npm run demo:seed
```

该命令会打印本次演示的 active auction id 和主要访问路由。每次运行都会创建一个新的、名称唯一的进行中竞拍。

## 演示账号

- 商家：`demo_merchant` / `test123`
- 买家 A：`demo_buyer_a` / `test123`
- 买家 B：`demo_buyer_b` / `test123`

## 演示路径

1. 商家打开 `/merchant/dashboard`。
2. 商家进入商品管理，并打开 seed 竞拍的实时监控页。
3. 买家 A 打开 `/app/auctions`，进入 seed 竞拍房间。
4. 买家 A 提交下一口出价。
5. 买家 B 进入同一竞拍房间，并提交更高出价。
6. 买家 A 看到私有被超越提醒。
7. 商家监控页看到价格、排行榜和出价事件同步更新。
8. 买家 A 提交封顶价，看到已成交终态。
9. 买家 A 打开 `/app/orders`，确认中标订单并点击模拟支付。

## 自动化检查

重复跑自动化检查时，建议使用禁用限流的后端和指向该后端的前端：

```bash
cd backend
SERVER_PORT=18080 DISABLE_RATE_LIMIT=1 REDIS_ADDR=127.0.0.1:16380 go run ./cmd/server
```

另开一个终端：

```bash
cd frontend
VITE_BACKEND_TARGET=http://127.0.0.1:18080 npx vite --host 127.0.0.1 --port 13000
```

在仓库根目录运行演示 E2E：

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:13000 npm run test:e2e:demo
```

如果按 README 的默认本地前端端口 `3000` 启动，则使用：

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:demo
```

## 排障

- 后端健康检查：打开 `http://127.0.0.1:8080/healthz`。
- 前端不可访问：确认 Vite 正在预期端口运行。
- WebSocket 状态滞后：检查后端日志后刷新竞拍房间。
- 重复 E2E 注册失败：使用 `DISABLE_RATE_LIMIT=1` 启动备用后端端口。
- 演示数据过旧：重新运行 `npm run demo:seed`；脚本每次会创建新的竞拍标题。
- Redis 配置错误：确认后端使用 `REDIS_ADDR=127.0.0.1:16380`。
