# AI Coding Usage

## Scope

This project used AI coding assistance for implementation planning, code navigation, patch drafting, test design, documentation, and verification bookkeeping. Human review remained responsible for requirements interpretation, final product choices, credential handling, and accepting changes.

No real API keys, production tokens, private credentials, or customer data are recorded in this document.

## Workflow

1. Requirements were grounded in `requirements-v3.md`, `AGENTS.md`, and OpenSpec/Superpowers artifacts before non-trivial implementation.
2. For behavior changes, AI drafted exploration notes, OpenSpec proposal/design/tasks/spec deltas, and an execution plan before business code changed.
3. Implementation proceeded in small verified slices, usually starting with focused tests for backend services, integration behavior, frontend state, or browser flows.
4. Verification results were copied back into task plans and memory so later agents could distinguish accepted state from stale work.
5. Documentation-only or narrow material cleanup used the repo fast-lane: read only relevant docs, make a small patch, run focused verification, then commit/push the verified slice.

## Human Decision Points

- Chose the latest requirements authority: `requirements-v3.md`.
- Approved the five-stage project workflow and when a task may use fast-lane.
- Decided auction semantics such as balance freeze/unfreeze, soft close, cancellation restrictions, settlement, and simulated payment behavior.
- Accepted merchant dashboard, merchant monitor, and demo readiness as archived OpenSpec changes.
- Kept demo credentials intentionally local and non-sensitive: `demo_merchant`, `demo_buyer_a`, and `demo_buyer_b` use the shared demo password `test123`.
- Required Redis to be documented as the project-local port `127.0.0.1:16380`.

## AI Contribution Estimate

- Requirements/spec drafting: high AI contribution, with human acceptance of scope and tradeoffs.
- Backend and frontend implementation: high AI contribution, constrained by repo patterns, tests, and human-selected semantics.
- Test authoring and verification loops: high AI contribution, with human-provided acceptance criteria.
- Product decisions and risk acceptance: human-led.
- Final repository state: human-owned, with AI assistance recorded through specs, plans, memory, commits, and verification output.

Overall AI contribution is estimated at 70-80% of drafting and mechanical implementation effort, and 30-40% of product judgment. The split is approximate because design, coding, and verification were iterative rather than cleanly separable.

## Risk Control

- Never write real secrets to docs, `.env`, code, or test fixtures.
- Keep generated/runtime output out of commits, including `node_modules`, `dist`, local DB files, and runtime uploads under `backend/static/avatars/*` or `backend/static/images/*`.
- Prefer OpenSpec lock for behavior, API, schema, realtime, auction engine, payment/order, and wallet changes.
- Use focused tests for narrow patches and broader backend/frontend/E2E checks when behavior changes.
- Run OpenSpec validation before claiming specs are current.
- Run `git diff --check` before commit to catch whitespace and line-ending issues.
- Report when frontend/backend tests are intentionally skipped for documentation-only work.
