# Tasks: h5-discovery-live-feed

- [x] 1. Brainstorm and design approval
  - Use visual companion to compare second-stage scope options.
  - Record user choice: search/discovery first.
  - Compare discovery layout options.
  - Record user choice: `直播流入口`.
  - Present final direction and receive user approval.

- [x] 2. OpenSpec lock
  - Create `docs/superpowers/specs/2026-06-02-h5-discovery-live-feed-design.md`.
  - Create OpenSpec proposal, design, tasks, and frontend roadmap spec delta under `openspec/changes/h5-discovery-live-feed/`.
  - Preserve existing backend/API/WebSocket contracts.
  - Defer personal homepage, real backend search, real ranking, and profile/search expansion beyond `/app/auctions`.

- [x] 3. Superpowers implementation plan
  - After user review, create `docs/superpowers/plans/2026-06-02-h5-discovery-live-feed.md`.
  - Break implementation into local filter helpers, H5 visual shell, focused tests, build, screenshot smoke, commit, and push.

- [ ] 4. React H5 implementation
  - Refine `frontend/src/pages/app/AuctionLobby.tsx`.
  - Keep `listAuctionLobby()` as the only data source.
  - Add local search/filter affordance.
  - Add hero live card and secondary auction feed.
  - Preserve `/app/auctions/:id`, `/app/orders`, and `/profile` navigation.

- [ ] 5. Verification
  - Run `cd frontend && npm run test -- AuctionLobby`.
  - Run `cd frontend && npm run build`.
  - Run `npx -y @fission-ai/openspec@latest validate h5-discovery-live-feed --strict --no-interactive`.
  - Run `git diff --check`.
  - Capture mobile screenshot smoke at 390x844 after implementation.

- [ ] 6. Finalize
  - Update memory.
  - Commit verified slices.
  - Attempt push and report push state.
