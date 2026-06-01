# Demo Readiness Runbook

## Purpose

Run a repeatable local demonstration of the Douyin live auction MVP. The path shows merchant preparation and monitoring, buyer live bidding, private outbid notification, auction settlement, order confirmation, and simulated payment.

## Required Services

- MySQL: `127.0.0.1:3307`
- Redis: `127.0.0.1:16380`
- Backend: `http://127.0.0.1:8080`
- Frontend: `http://127.0.0.1:3000`

## Start Services

Start project-local database services:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials
docker compose up -d mysql redis
```

Start the backend:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials/backend
REDIS_ADDR=127.0.0.1:16380 go run ./cmd/server
```

Start the frontend in another terminal:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials/frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

## Prepare Demo Data

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials
DEMO_API_BASE_URL=http://127.0.0.1:8080 npm run demo:seed
```

The command prints the active auction id and the main routes for the run. It creates a new uniquely named active auction each time.

## Demo Accounts

- Merchant: `demo_merchant` / `test123`
- Buyer A: `demo_buyer_a` / `test123`
- Buyer B: `demo_buyer_b` / `test123`

## Presenter Path

1. Merchant opens `/merchant/dashboard`.
2. Merchant opens product management and enters the active auction monitor for the seeded auction.
3. Buyer A opens `/app/auctions` and enters the seeded auction room.
4. Buyer A bids the next amount.
5. Buyer B opens the same auction room and bids higher.
6. Buyer A sees the private outbid notice.
7. Merchant monitor shows the updated price, ranking, and bid event.
8. Buyer A bids the ceiling amount and sees the terminal sold state.
9. Buyer A opens `/app/orders`, confirms the order, and clicks simulated payment.

## Automated Check

For repeated automated checks, run a backend with rate limiting disabled and a frontend pointed at that backend:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials/backend
SERVER_PORT=18080 DISABLE_RATE_LIMIT=1 REDIS_ADDR=127.0.0.1:16380 go run ./cmd/server
```

In another terminal:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials/frontend
VITE_BACKEND_TARGET=http://127.0.0.1:18080 npx vite --host 127.0.0.1 --port 13000
```

Run the demo readiness E2E:

```bash
cd /Users/vivix/Documents/Codex/douyin_live_auction_worktrees/demo-materials
PLAYWRIGHT_BASE_URL=http://127.0.0.1:13000 npm run test:e2e:demo
```

## Troubleshooting

- Backend health: open `http://127.0.0.1:8080/healthz`.
- Frontend unavailable: confirm Vite is running on the expected port.
- WebSocket stale: refresh the auction room after checking backend logs.
- Repeated E2E registration failures: use `DISABLE_RATE_LIMIT=1` on an alternate backend port.
- Old demo data: rerun `npm run demo:seed`; it creates a new auction title for each run.
- Wrong Redis: confirm the backend uses `REDIS_ADDR=127.0.0.1:16380`.
