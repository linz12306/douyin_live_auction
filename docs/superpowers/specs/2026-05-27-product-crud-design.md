# Product CRUD Module — Design Spec

> 实时竞拍大师 · 模块二 · 2026-05-27

## Overview

商家端商品管理与竞拍规则配置。商家创建商品（含多图）、配置竞拍规则、发布到待开拍状态。支持草稿/待开拍/进行中/已结束/已取消五种状态筛选，未开始可修改，进行中可取消。

基于 requirements-v3.md 设计，products + auctions 双表分离。

---

## Approach

选择**方案 B：标准方案**。products 表存商品信息 + product_images 存图片 + auctions 表存竞拍规则，三表事务包裹创建。

| 对比维度 | 方案 A 极简 | **方案 B 标准** | 方案 C 全分离 |
|---------|------------|----------------|--------------|
| 数据表 | 单表 auctions | **products+images+auctions** | products+images+auctions+variants |
| 图片存储 | JSON 字段 | **独立表** | 独立表+OSS |
| 创建流程 | 直接 pending | **draft→publish→pending** | multi-step wizard |
| 适合 | 快速原型 | **MVP 产品** | 复杂电商 |

---

## Database

### products
```
id, merchant_id, title, description, 
status ENUM('draft','pending','active','ended_sold','ended_no_bid','cancelled')
created_at, updated_at
```

### product_images
```
id, product_id, image_url, sort_order, created_at
```
- 每个商品 1-9 张图
- ON DELETE CASCADE，删除商品时自动删图片记录

### auctions
```
id, product_id(UNIQUE), merchant_id,
start_price, bid_increment_type(fixed/percent), bid_increment_value,
ceiling_price(NULL=不封顶), duration_seconds,
auto_extend_seconds, max_extend_count, current_extend_count,
status, current_price, highest_bidder_id, cancel_reason, version,
started_at, ended_at, cancelled_at, created_at, updated_at
```
- product_id UNIQUE：一个商品仅对应一个拍卖实例
- version：乐观锁字段，auction-engine 使用
- product-crud 仅设置 status='pending'，后续状态流转归 auction-engine

### auction_logs
```
id, auction_id, action, user_id, detail(JSON), created_at
```
- product-crud 在创建 auction 时写入首条 action='created'

---

## API Design

```
POST   /api/v1/products                     # 创建商品（草案）→ 返回 product
POST   /api/v1/products/:id/publish         # 发布（创建 auction + 写日志）→ status: draft→pending
GET    /api/v1/products                     # 列表（?status=&page=&size=）→ 仅本商家
GET    /api/v1/products/:id                 # 详情（含 images + auction 规则）
PUT    /api/v1/products/:id                 # 修改商品信息（仅 draft/pending）
DELETE /api/v1/products/:id                 # 删除（仅 draft），级联删 images
POST   /api/v1/products/:id/images          # 追加图片（≤9张）
DELETE /api/v1/products/:id/images/:image_id # 删除图片（保留至少1张）
POST   /api/v1/products/:id/cancel          # 取消（pending→cancelled，active需确认+原因）
```

### 创建流程（两步）

**Step 1: POST /products** — 创建草稿
```json
Request:
{
  "title": "商品名称",
  "description": "介绍",
  "image_urls": ["/static/images/xxx.jpg", ...],
  "auction": {
    "start_price": 0,
    "bid_increment_type": "fixed",
    "bid_increment_value": 10,
    "ceiling_price": null,
    "duration_seconds": 300,
    "auto_extend_seconds": 15,
    "max_extend_count": 5
  }
}
Response 201: { "product": {...}, "images": [...], "auction": null }
```
注：创建时仅存 product + images，auction 在 publish 时创建。

**Step 2: POST /products/:id/publish** — 发布
```
Response 200: { "product": {...}, "auction": {...} }
```
事务内：products.status='pending' → INSERT auction → INSERT auction_logs('created')

### 校验规则

| 字段 | 规则 |
|------|------|
| title | 1-200 字符 |
| description | 可选，≤5000 |
| images | 1-9 张，jpg/png/webp，≤2MB |
| start_price | DECIMAL ≥0 |
| bid_increment_type | 'fixed' 或 'percent' |
| bid_increment_value | fixed≥1元 / percent∈[1,20] |
| ceiling_price | NULL 或 > start_price |
| duration_seconds | 60/300/1800 |
| auto_extend_seconds | 10-30 |
| max_extend_count | 1-10 |

### 业务规则

| 操作 | 允许条件 |
|------|---------|
| 创建 | role=merchant |
| 修改 | status IN (draft, pending) 且 作者本人 |
| 删除 | status=draft 且 作者本人 |
| 发布 | status=draft 且 images≥1 |
| 取消-pending | 作者本人，直接取消 |
| 取消-active | 最后出价30s内不可取消，需填原因（auction-engine 实现） |
| 追加图片 | status IN (draft, pending) 且 当前<9张 |
| 删除图片 | status IN (draft, pending) 且 保留≥1张 |

---

## Backend Files

```
backend/internal/
  model/product.go
  model/product_image.go
  model/auction.go
  dto/product.go
  repository/product_repo.go
  repository/auction_repo.go
  service/product_service.go
  handler/product_handler.go
  migrations/
    002_create_products.sql
    003_create_product_images.sql
    004_create_auctions.sql
    005_create_auction_logs.sql
```

---

## Frontend Files

```
frontend/src/
  pages/merchant/
    ProductList.tsx       # 状态 Tab 切换 + 列表
    ProductForm.tsx       # 创建/编辑表单（含图片上传+规则配置）
    ProductDetail.tsx     # 详情（信息+图片+规则+操作按钮）
  components/
    ImageUploader.tsx     # 多图上传（拖拽+排序+删除+预览）
    AuctionRuleForm.tsx   # 竞拍规则子表单
  api/product.ts          # CRUD API
  types/product.ts        # Product, Auction 类型
```

---

## Key Decisions

| # | 决策 | 理由 |
|---|------|------|
| 1 | products + auctions 分离 | v3 要求，职责清晰 |
| 2 | product_images 独立表 | v3 要求，支持排序和级联删除 |
| 3 | draft → publish → pending | 草稿机制，发前可反复修改 |
| 4 | publish 事务写三表 | 保证 product+auction+log 一致性 |
| 5 | 创建时不建 auction | 允许存草稿不发布 |
| 6 | version 乐观锁字段 | auction-engine 用，product-crud 不管 |
| 7 | 图片先上传到本地 | 复用 user-auth 的 static/images/ 目录 |

---

## Out of Scope

- 竞拍状态流转（auction-engine）
- 出价逻辑、分布式锁（auction-engine）
- WebSocket 实时广播（ws-realtime）
- 订单生成（order-system）
- wallets 表迁移（后续改造 user-auth）
- /healthz 健康检查（归入拍卖引擎或独立 infra 模块）
- zerolog 结构化日志（归入拍卖引擎）
- 数据看板（merchant-admin）
