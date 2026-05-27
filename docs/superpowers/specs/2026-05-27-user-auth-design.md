# User Auth Module — Design Spec

> 实时竞拍大师 · 模块一 · 2026-05-27

## Overview

用户认证系统，提供双角色（商家/用户）注册登录、JWT 双 Token 认证、个人资料管理、虚拟余额初始化。

---

## Approach

选择**方案 B：标准方案**，在极简和过度设计之间取平衡点。

| 对比维度 | 方案 A 极简 | **方案 B 标准 ✅** | 方案 C 企业级 |
|---------|------------|-------------------|--------------|
| Token 策略 | 单 Access | **Access+Refresh** | 双 Token+黑名单 |
| 速率限制 | 无 | **5次/min/IP** | 验证码+设备指纹 |
| 头像存储 | 默认头像 | **本地文件系统** | OSS+CDN |
| 注册验证 | 无 | **无** | 邮箱/手机验证 |
| 代码量 | ~300行Go | **~800行Go** | ~1500行Go |

**选 B 的理由：**
- 双 Token 是 WebSocket 认证基础（ws-realtime 模块需要 Access Token 鉴权 + Refresh Token 续期）
- 速率限制展示安全意识，但不过度
- 本地头像避免依赖外部服务，MVP 够用
- 注册无需邮箱降低摩擦，比赛演示流畅

---

## API Design

```
POST   /api/v1/auth/register       # 注册
POST   /api/v1/auth/login          # 登录
POST   /api/v1/auth/refresh        # 刷新 Access Token
POST   /api/v1/auth/logout         # 注销
GET    /api/v1/users/me            # 当前用户信息
PUT    /api/v1/users/me            # 更新资料（昵称）
POST   /api/v1/users/me/avatar     # 上传头像
PUT    /api/v1/users/me/password   # 修改密码
GET    /api/v1/users/:id           # 用户公开信息（排行榜用）
```

### 请求/响应约定

**Register**
```
POST /api/v1/auth/register
Body: { "username": "string", "password": "string", "role": "merchant|user", "display_name": "string" }
Response 201: { "access_token": "...", "refresh_token": "...", "user": { ... } }
```

**Login**
```
POST /api/v1/auth/login
Body: { "username": "string", "password": "string" }
Response 200: { "access_token": "...", "refresh_token": "...", "user": { ... } }
Errors: 401 "用户名或密码错误"
```

**Refresh**
```
POST /api/v1/auth/refresh
Body: { "refresh_token": "..." }
Response 200: { "access_token": "...", "refresh_token": "..." }  (refresh token 轮换)
Errors: 401 "token 已失效，请重新登录"
```

**统一错误格式**
```json
{ "code": 401, "message": "用户名或密码错误", "data": null }
```

---

## Database

```sql
CREATE TABLE users (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('merchant', 'user') NOT NULL,
    display_name  VARCHAR(50) NOT NULL,
    avatar_url    VARCHAR(255) DEFAULT '',
    balance       DECIMAL(15,2) DEFAULT 1000000.00,
    frozen_amount DECIMAL(15,2) DEFAULT 0.00,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username)
);
```

**字段说明：**
- `balance` + `frozen_amount` 在 user-auth 模块建表时创建，业务逻辑归 auction-engine 模块
- 注册时 `balance = 1000000.00`（100 万虚拟币）
- `role` 注册时选定，后续不可修改（API 不暴露修改 role 的入口）

---

## JWT Token 策略

```
Access Token:
  - 有效期：30 分钟
  - Payload: { user_id, username, role }
  - 签名算法：HS256
  - 存储：前端 Zustand（内存），不存 localStorage

Refresh Token:
  - 有效期：7 天
  - Payload: { user_id, jti (唯一ID) }
  - 存储：localStorage + Redis(key: "refresh:<user_id>:<jti>")
  - 轮换：每次 refresh 时旧 token 失效，发放新 token
```

**刷新流程：**
```
请求 API → 401 Unauthorized
  → 前端拦截器自动调 /auth/refresh
    → 成功：替换 access_token，重放原请求
    → 失败：清空状态，跳转登录页
```

**注销流程：**
```
POST /auth/logout
  → 从 Redis 删除 refresh token
  → 前端清空 store + localStorage
```

---

## 安全措施

### 密码
- bcrypt cost=12 加密存储
- 最少 6 字符

### 速率限制（Redis）
- 登录：同 IP 5次/分钟 → 429 + "请15分钟后再试"
- 注册：同 IP 10次/小时
- Key 格式：`rate_limit:login:<ip>`，滑动窗口

### 输入校验
- username：4-20 字符，字母数字下划线，正则 `^[a-zA-Z0-9_]{4,20}$`
- password：最少 6 字符
- display_name：1-50 字符
- 头像：jpg/png/webp，最大 2MB

---

## Backend Structure

```
backend/
  cmd/server/main.go
  internal/
    config/config.go           # Env/Config 加载
    model/user.go              # User struct + DB 标签
    dto/auth.go                # RegisterRequest, LoginRequest, AuthResponse
    dto/user.go                # UpdateProfileRequest, UserResponse
    repository/user_repo.go    # CRUD 操作
    service/auth_service.go    # 注册/登录/刷新/注销 逻辑
    service/user_service.go    # 资料/密码/头像 逻辑
    handler/auth_handler.go    # HTTP handler -> service
    handler/user_handler.go
    middleware/jwt_auth.go     # Bearer token 提取+验证
    middleware/rate_limit.go   # Redis 限流
    middleware/role_guard.go   # 角色白名单校验
    pkg/jwt/jwt.go             # Token 生成/验证
    pkg/hash/bcrypt.go         # 密码哈希
    pkg/response/response.go   # 统一 JSON 响应
  migrations/
    001_create_users.sql
  static/avatars/              # 头像上传目录（gitignore）
```

---

## Frontend Structure

```
frontend/src/
  pages/
    Login.tsx                  # 登录表单
    Register.tsx               # 注册表单（含角色选择卡片）
    Profile.tsx                # 个人中心：资料+余额+改密码
  components/
    AvatarUpload.tsx           # 头像上传（裁剪预览）
  store/
    authStore.ts               # Zustand: user, accessToken, isAuth
  api/
    client.ts                  # Axios 实例 + 拦截器（自动 refresh）
    auth.ts                    # login(), register(), refresh(), logout()
    user.ts                    # getMe(), updateMe(), uploadAvatar()
  types/
    user.ts                    # User, Role, AuthResponse 类型
```

---

## Key Decisions

| # | 决策 | 理由 |
|---|------|------|
| 1 | 双 Token | 为 WebSocket 续期打基础，展示技术深度 |
| 2 | Refresh Token 存 Redis | 支持注销和主动踢人 |
| 3 | 本地文件存头像 | MVP 够用，避免云服务依赖 |
| 4 | 注册无需邮箱/手机 | 降低摩擦，比赛演示流畅 |
| 5 | 速率限制 5次/min | 轻量防暴破，展示安全意识 |
| 6 | balance 放 users 表 | 需求注册时即获得余额，无需独立 wallet 表 |
| 7 | role 注册时锁定 | 需求要求不可切换，API 不暴露修改入口 |

---

## Out of Scope (后续模块处理)

- 邮箱/手机绑定 — 需要短信/邮件服务，MVP 不做
- OAuth 第三方登录 — 需求未提及
- 账户注销/封禁 — auction-engine 和 order-system 完成后需要
- 余额变动记录（transactions 表） — 归 auction-engine 模块
- 支付密码/二次验证 — 超出比赛范围
