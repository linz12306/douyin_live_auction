# AI Merchant Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a merchant AI assistant that generates product-copy drafts, realtime auction commentary, and saved post-auction reports using a real OpenAI-compatible model.

**Architecture:** Add a focused backend AI subsystem with config, `LLMClient`, `AIService`, persistence, and merchant-only handlers. Realtime commentary subscribes to committed auction events and broadcasts `ai_commentary` messages without mutating auction truth. Frontend adds AI panels to product form, buyer live room, merchant monitor, and terminal report surfaces.

**Tech Stack:** Go + Gin + MySQL + gorilla/websocket, React + TypeScript + Vite, OpenAI-compatible `/v1/chat/completions`, OpenSpec, Vitest, Go tests.

---

### Task 1: Backend AI Foundation

**Files:**
- Create: `backend/migrations/009_create_ai_generation_records.sql`
- Create: `backend/internal/dto/ai.go`
- Create: `backend/internal/repository/ai_repo.go`
- Create: `backend/internal/service/llm_client.go`
- Create: `backend/internal/service/ai_service.go`
- Create: `backend/internal/handler/ai_handler.go`
- Modify: `backend/internal/config/config.go`
- Modify: `backend/cmd/server/main.go`
- Test: `backend/internal/service/ai_service_test.go`

- [x] Add failing service tests for missing AI config, valid product copy JSON parsing, and terminal auction report metrics.
- [x] Implement config, migration, DTOs, repository, LLM client, AI service, and merchant handler.
- [x] Wire merchant AI routes.

### Task 2: Realtime Commentary

**Files:**
- Modify: `backend/internal/realtime/message.go`
- Modify: `backend/internal/realtime/hub.go`
- Modify: `backend/internal/service/auction_service.go`
- Modify: `backend/cmd/server/main.go`
- Test: `backend/internal/service/ai_commentary_test.go`

- [x] Add failing tests for commentary generation on accepted bid and no fake output on model failure.
- [x] Add `ai_commentary` message type and payload.
- [x] Subscribe to committed auction events and asynchronously generate key-event commentary.
- [x] Ensure commentary generation never happens inside the bid transaction/lock.

### Task 3: Frontend AI Product Copy

**Files:**
- Create: `frontend/src/api/ai.ts`
- Create: `frontend/src/types/ai.ts`
- Modify: `frontend/src/pages/merchant/ProductForm.tsx`
- Test: `frontend/src/pages/merchant/ProductForm.test.tsx`

- [x] Add failing test that generated AI copy is previewed and only fills fields after merchant accepts.
- [x] Add AI API wrapper and types.
- [x] Add product form AI assistant panel with loading/error/preview/apply states.

### Task 4: Frontend Commentary And Reports

**Files:**
- Modify: `frontend/src/types/auction.ts`
- Modify: `frontend/src/store/liveRoomStore.ts`
- Modify: `frontend/src/pages/app/LiveAuctionRoom.tsx`
- Modify: `frontend/src/pages/merchant/AuctionMonitor.tsx`
- Test: `frontend/src/store/liveRoomStore.test.ts`
- Test: `frontend/src/pages/app/LiveAuctionRoom.test.tsx`
- Test: `frontend/src/pages/merchant/AuctionMonitor.test.tsx`

- [x] Add failing tests for applying `ai_commentary` and rendering it in live room/monitor.
- [x] Add report panel tests for generating a terminal monitor report and rendering model output.
- [x] Implement frontend commentary state and terminal monitor report UI.

### Task 5: Verification And Memory

**Files:**
- Modify: `openspec/changes/ai-merchant-assistant/tasks.md`
- Create or modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-09.md`
- Modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [x] Run `npx -y @fission-ai/openspec@latest validate ai-merchant-assistant --strict --no-interactive`.
- [x] Run `cd backend && go test ./...`.
- [x] Run `cd frontend && npm run test`.
- [x] Run `cd frontend && npm run build`.
- [x] Run `git diff --check`.
- [x] Update tasks and memory with final verification results.

## Verification Results

- `npx -y @fission-ai/openspec@latest validate ai-merchant-assistant --strict --no-interactive` passed.
- `cd backend && go test ./...` passed.
- `cd frontend && npm run test` passed: 16 files, 91 tests.
- `cd frontend && npm run build` passed.
- `git diff --check` passed.

## Execution Notes

- The user explicitly requested implementation of this plan in the current turn.
- Do not commit or push unless the user explicitly requests it.
- Real AI content must come from the configured LLM. Direct AI APIs should fail clearly if config is missing; realtime commentary should skip failed calls.
