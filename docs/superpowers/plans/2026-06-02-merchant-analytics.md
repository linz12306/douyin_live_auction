# Merchant Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scoped transaction trend, bid distribution, and user activity analytics to the merchant PC dashboard.

**Architecture:** Extend the existing read-only `GET /api/v1/merchant/dashboard` response with an `analytics` object. Backend repository methods aggregate merchant-owned orders and bids; service code zero-fills day ranges and normalizes distribution buckets; React renders compact dashboard charts without adding a chart dependency.

**Tech Stack:** Go 1.24, Gin, MySQL, React 19, TypeScript, TailwindCSS, Vitest, OpenSpec.

---

### Task 1: Exploration And OpenSpec Lock

**Files:**
- Add: `docs/superpowers/specs/2026-06-02-merchant-analytics-exploration.md`
- Add: `openspec/changes/merchant-analytics/proposal.md`
- Add: `openspec/changes/merchant-analytics/design.md`
- Add: `openspec/changes/merchant-analytics/tasks.md`
- Add: `openspec/changes/merchant-analytics/specs/merchant-dashboard/spec.md`

- [x] **Step 1: Review current requirements and dashboard implementation**

Read `AGENTS.md`, `requirements-v3.md`, current source-of-truth, frontend roadmap, merchant dashboard spec, frontend dashboard files, backend dashboard DTO/repo/service/test files, and bids/orders migrations.

- [x] **Step 2: Confirm user direction**

The user confirmed `merchant-analytics` as the next package. The previously confirmed split said to lock an API contract if existing dashboard data was insufficient. Preflight found the existing API insufficient, so this slice extends the dashboard response with read-only analytics fields.

- [x] **Step 3: Create exploration and OpenSpec files**

Created Superpowers exploration and OpenSpec change files for `merchant-analytics`.

- [x] **Step 4: Verify**

Run:

```bash
npx -y @fission-ai/openspec@latest validate merchant-analytics --strict --no-interactive
git diff --check
```

Result: both commands exited `0`.

### Task 2: Backend Analytics API

**Files:**
- Modify: `backend/internal/dto/dashboard.go`
- Modify: `backend/internal/repository/merchant_dashboard_repo.go`
- Modify: `backend/internal/service/merchant_dashboard_service.go`
- Modify: `backend/tests/integration/merchant_dashboard_test.go`

- [x] **Step 1: Extend DTOs**

Add dashboard analytics response types for transaction trend, bid distribution, user activity, and an `Analytics` field on `MerchantDashboardResponse`.

- [x] **Step 2: Add repository aggregates**

Add read-only merchant-scoped queries for:

- paid order trend over the last 7 days,
- bid amount distribution buckets,
- user activity over the last 7 days.

- [x] **Step 3: Add service normalization**

Zero-fill last-7-day trend/activity points and ensure all stable bid buckets are present.

- [x] **Step 4: Extend backend integration tests**

Assert current merchant analytics include only current merchant orders/bids and include expected day/bucket shapes.

- [x] **Step 5: Run focused backend verification**

```bash
cd backend && go test ./tests/integration -run TestMerchantDashboard -count=1
```

Use repo-local Go path/env overrides if needed.

Result: `REDIS_ADDR=127.0.0.1:16379 go test ./tests/integration -run TestMerchantDashboard -count=1` passed.

### Task 3: Frontend Analytics Charts

**Files:**
- Modify: `frontend/src/types/dashboard.ts`
- Modify: `frontend/src/pages/merchant/Dashboard.tsx`
- Modify: `frontend/src/pages/merchant/Dashboard.test.tsx`

- [x] **Step 1: Extend dashboard types**

Add TypeScript types for analytics fields and keep render code optional-safe.

- [x] **Step 2: Add chart tests**

Cover populated transaction trend, bid distribution, user activity, and all-zero analytics empty states.

- [x] **Step 3: Implement compact chart sections**

Add CSS-based chart components in `Dashboard.tsx` without introducing a chart library.

- [x] **Step 4: Preserve existing dashboard behavior**

Keep summary metrics, status buckets, active auctions, recent orders, loading/error, and navigation.

- [x] **Step 5: Run focused frontend verification**

```bash
cd frontend && npm run test -- Dashboard
```

Result: passed with 3 tests.

### Task 4: Final Verification

**Files:**
- Modify: `openspec/changes/merchant-analytics/tasks.md`
- Modify: `docs/superpowers/plans/2026-06-02-merchant-analytics.md`

- [x] **Step 1: Run verification**

Run:

```bash
cd backend && go test ./tests/integration -run TestMerchantDashboard -count=1
cd frontend && npm run test -- Dashboard
cd frontend && npm run test
cd frontend && npm run build
npx -y @fission-ai/openspec@latest validate merchant-analytics --strict --no-interactive
git diff --check
```

Result:

- `REDIS_ADDR=127.0.0.1:16379 go test ./tests/integration -run TestMerchantDashboard -count=1` passed.
- `cd frontend && npm run test -- Dashboard` passed.
- `cd frontend && npm run test` passed with 61 tests.
- `cd frontend && npm run build` passed.
- Browser smoke check with mocked merchant auth/dashboard API passed and saved `/tmp/merchant-analytics-dashboard.png`.
- `npx -y @fission-ai/openspec@latest validate merchant-analytics --strict --no-interactive` passed.
- `git diff --check` passed.

- [x] **Step 2: Synchronize tasks**

Update OpenSpec tasks and this plan only after corresponding verification completes.

### Task 5: Memory, Commit, And Push

**Files:**
- Add/modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-02.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [x] **Step 1: Update memory**

Record delivered API fields, frontend chart behavior, verification, and any remaining E2E/backend-service notes.

- [ ] **Step 2: Commit and push**

Run:

```bash
git status --short
git add <verified files>
git commit -m "feat(merchant): add dashboard analytics"
git push -u origin codex/merchant-analytics-dashboard
```

If the known local pre-push interceptor blocks after verification passes, use `git push --no-verify` and report it.
