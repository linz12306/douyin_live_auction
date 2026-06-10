# 前端说明

本目录是直播拍卖 MVP 的前端应用，使用 React、Vite、TypeScript、React Router、Zustand、Tailwind CSS 和 Vitest。

## 主要目录

- `src/pages/app/`：买家侧页面，包括拍卖大厅、直播拍卖房间和订单相关页面。
- `src/pages/merchant/`：商家侧页面，包括商品管理、拍卖监控、工作台和订单管理。
- `src/api/`：前端请求封装。
- `src/stores/`：直播房间等客户端状态。
- `src/components/`：可复用 UI 组件。

## 本地开发

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev -- --host 127.0.0.1 --port 3000
```

应用默认通过 Vite 代理访问 `http://localhost:8080`，代理范围包括 `/api`、`/ws` 和 `/static`。如果后端地址不同，可设置 `VITE_BACKEND_TARGET`；启动前端前，请先在仓库根目录启动 MySQL、Redis 和后端服务。

## 常用命令

```bash
npm run dev
npm run test
npm run build
npm run lint
```

- `npm run dev`：启动 Vite 开发服务。
- `npm run test`：运行 Vitest 测试。
- `npm run build`：执行 TypeScript 构建和 Vite 打包。
- `npm run lint`：运行 ESLint。

## 开发提示

- 新页面优先复用现有路由、API 客户端和状态管理模式。
- 涉及直播房间、拍卖排名或出价状态时，同时检查 WebSocket 数据流和相关测试。
- 前端变更提交前至少运行与改动范围匹配的测试；影响构建或路由时运行 `npm run build`。
