# Tasks: merchant-auction-monitor

- [x] 1. Preflight and baseline stabilization
  - Read required requirements, progress, auction-engine, realtime-live-room, bids/orders, and relevant frontend/backend files.
  - Confirm worktree status and OpenSpec availability.
  - Apply local DB migrations when test DB lacks tracked tables.
  - Fix service-owned timestamp persistence for bids/orders and matching test helpers.
  - Verification: focused Go tests for recent-bid cancellation and order confirmation.

- [x] 2. OpenSpec lock and execution plan
  - Create Superpowers exploration, proposal, design, tasks, capability spec, and implementation plan.
  - Validate `merchant-auction-monitor` with OpenSpec strict mode.

- [x] 3. Merchant list auction id
  - Add a failing Go integration test proving merchant product list rows include `auction_id` for published products.
  - Add optional `auction_id` to merchant product list response.
  - Keep user lobby response behavior unchanged.

- [x] 4. Frontend navigation entries
  - Add failing Vitest coverage for monitor links in merchant product list and product detail.
  - Add links to `/merchant/auctions/:id/monitor` when an auction id is known.

- [x] 5. Realtime monitor page
  - Add failing Vitest coverage for monitor rendering, event feed, cancellation restrictions, and cancellation command.
  - Implement `/merchant/auctions/:id/monitor` route and page using existing live room store and WebSocket connection.
  - Do not add bid controls to the merchant page.

- [x] 6. Store bid-event feed
  - Add failing store test for a `price_update` bid-event notification.
  - Extend existing store `price_update` handling to append a bid event without changing current price/ranking semantics.

- [x] 7. Verification, docs, and memory
  - Run `openspec validate merchant-auction-monitor --strict --no-interactive`.
  - Run `cd backend && go test ./...` with `REDIS_ADDR=127.0.0.1:16380`.
  - Run `cd frontend && npm run test`.
  - Run `cd frontend && npm run build`.
  - Run `git diff --check`.
  - Update task checkboxes, Superpowers plan, project memory, and report commit/push state.
