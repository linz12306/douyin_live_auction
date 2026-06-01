# Douyin Live Auction

Douyin Live Auction is a local MVP for a livestream-style auction flow. It covers merchant product publishing, auction activation and monitoring, buyer realtime bidding, private outbid notifications, auction settlement, order confirmation, and simulated payment.

## Architecture

- Backend: Go HTTP API with JWT auth, MySQL persistence, Redis bid locks, and WebSocket auction rooms.
- Frontend: React + Vite + TypeScript, React Router, Zustand live-room state, and Vitest coverage.
- Database: MySQL 8 on `127.0.0.1:3307`, database `auction_db`, initialized from `backend/migrations`.
- Realtime/locks: Redis 7 on `127.0.0.1:16380`, container `douyin-live-redis`.
- E2E: Playwright for the local demo journey.
- Specs/process: OpenSpec persistent specs under `openspec/specs` and Superpowers notes under `docs/superpowers`.

Use this worktree as the local project path:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials
```

## Start Locally

Start MySQL and Redis:

```bash
docker compose up -d mysql redis
```

Run the backend on the host:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials/backend
REDIS_ADDR=127.0.0.1:16380 go run ./cmd/server
```

Run the frontend in another terminal:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials/frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`.

You can also run the backend through Docker:

```bash
docker compose --profile app up -d
```

Use `REDIS_ADDR=127.0.0.1:16380` for this worktree when running the backend on the host.

## Demo Accounts

Prepare repeatable demo data:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials
DEMO_API_BASE_URL=http://127.0.0.1:8080 npm run demo:seed
```

- Merchant: `demo_merchant` / `test123`
- Buyer A: `demo_buyer_a` / `test123`
- Buyer B: `demo_buyer_b` / `test123`

The seed command creates a fresh active auction and prints the main demo routes. Full presenter steps are in [docs/demo-readiness.md](docs/demo-readiness.md).

## Core Features

- Merchant product management with image upload and auction rule publishing.
- Auction engine with activation, bid validation, balance freeze/unfreeze, ranking, soft close, cancellation rules, and settlement.
- Buyer live auction room with WebSocket snapshot, realtime price/ranking updates, countdown, and private outbid notices.
- Merchant dashboard with scoped metrics, active auctions, status counts, and recent orders.
- Merchant auction monitor backed by the same auction WebSocket stream.
- Order flow with winner confirmation, simulated payment, timeout/cancel handling, buyer pages, and merchant order pages.
- Health endpoint at `GET /healthz` with DB, Redis, and auction-engine component status.

## Verification

Documentation/spec-only checks used for this slice:

```bash
npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive
git diff --check
```

Common full checks for code changes:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials/backend
REDIS_ADDR=127.0.0.1:16380 go test ./...

cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials/frontend
npm run test
npm run build
```

Demo E2E can run against isolated ports:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials
PLAYWRIGHT_BASE_URL=http://127.0.0.1:13000 npm run test:e2e:demo
```
