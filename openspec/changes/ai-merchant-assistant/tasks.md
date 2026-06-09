# Tasks: ai-merchant-assistant

- [x] 1. Exploration and OpenSpec lock
  - Create Superpowers exploration document.
  - Create OpenSpec proposal, design, tasks, and spec delta.
  - Run `npx -y @fission-ai/openspec@latest validate ai-merchant-assistant --strict --no-interactive`.
  - Verification: passed.

- [x] 2. Superpowers execution plan
  - Create `docs/superpowers/plans/2026-06-09-ai-merchant-assistant.md`.
  - Include backend, realtime, frontend, verification, and memory tasks.

- [x] 3. Backend AI service and persistence
  - Add config fields.
  - Add `ai_generation_records` migration.
  - Add AI DTOs, repository, LLM client, service, and handler.
  - Wire merchant AI routes.
  - Add backend tests with mocked LLM.
  - Verification: `cd backend && go test ./...` passed.

- [x] 4. Realtime AI commentary
  - Add `ai_commentary` type and payload.
  - Trigger key-event commentary outside auction bid locks.
  - Broadcast only successful model output.
  - Add focused realtime/commentary tests.
  - Verification: `cd backend && go test ./...` passed.

- [x] 5. Frontend AI surfaces
  - Add AI API and types.
  - Add product form AI draft panel.
  - Render `ai_commentary` in buyer live room and merchant monitor.
  - Add saved report panel and regenerate flow.
  - Add frontend tests.
  - Verification: `cd frontend && npm run test` and `cd frontend && npm run build` passed.

- [x] 6. Verification and memory
  - Run OpenSpec validation.
  - Run backend tests.
  - Run frontend tests and build.
  - Run `git diff --check`.
  - Update project memory with implementation state and residual risks.
  - Verification:
    - `npx -y @fission-ai/openspec@latest validate ai-merchant-assistant --strict --no-interactive` passed.
    - `cd backend && go test ./...` passed.
    - `cd frontend && npm run test` passed.
    - `cd frontend && npm run build` passed.
    - `git diff --check` passed.
