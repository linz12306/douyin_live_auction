# AI Merchant Assistant Exploration

## Goal

Add a merchant-facing AI assistant as a competition highlight for the live auction product.

V1 includes three AI capabilities:

- Before auction: generate product title, description, selling points, and live selling script drafts for merchant review.
- During auction: generate real-time AI commentary for key auction events and show it to both buyers and merchants.
- After auction: generate and save an AI auction analysis report for ended merchant-owned auctions.

All generated AI content must come from a real OpenAI-compatible model call. The system must not present local template output as AI output.

## Workflow Choice

This is full workflow work rather than fast lane. It adds public merchant APIs, a new persistence table, WebSocket message contract changes, new frontend behavior, and an external LLM integration. Per `AGENTS.md`, it requires Superpowers exploration, OpenSpec lock, a Superpowers execution plan, implementation, verification, and memory.

The user explicitly requested implementation of the plan in this turn, so this exploration records that as approval to continue from planning into implementation. Commit and push are still not assumed.

## Preflight Findings

- Current branch: `codex/ai-auction-assistant`.
- Worktree was clean at preflight.
- OpenSpec CLI is available through `npx -y @fission-ai/openspec@latest`.
- Current specs validate with `npx -y @fission-ai/openspec@latest validate --specs --strict --no-interactive`.
- No existing AI/LLM config, SDK, service, route, or environment variables exist.
- Existing merchant dashboard analytics already expose bid distribution and user activity aggregates.
- Existing `bids` table stores `auction_id`, `user_id`, `amount`, `status`, and `created_at`, enough to compute bid count, participant count, price uplift, and last-30-second bid share.
- Existing auction/product/order models provide title, description, start price, current/final price, duration, status, start/end timestamps, and merchant ownership.
- Existing realtime WebSocket envelope already carries typed messages and is the source of truth for room/monitor state.
- Existing product form, buyer live room, and merchant auction monitor are the relevant frontend entry points.

## User-Confirmed Decisions

- Build all three V1 capabilities: product copy, real-time commentary, and post-auction report.
- Generated content must come from a real model; no local generated fallback content.
- Use OpenAI-compatible configuration rather than locking to a single vendor.
- V1 uses a configurable `/v1/chat/completions` style client because it is broadly supported by OpenAI-compatible providers.
- Save product copy drafts and post-auction reports.
- Do not persist realtime commentary in DB.
- Product copy fills draft fields only after merchant confirmation.
- Realtime commentary appears in both the buyer live room and merchant monitor.
- Commentary calls are limited to key events, not every bid.

## Non-Goals

- Do not change auction bid acceptance, wallet freeze/unfreeze, settlement, order, payment, cancellation, or ranking semantics.
- Do not make AI content authoritative for price, winner, countdown, or order status.
- Do not auto-save AI product copy into product records without merchant action.
- Do not show local template output as AI output.
- Do not add buyer strategy advice or fairness-affecting bid recommendations.
- Do not require streaming responses in V1.
- Do not persist realtime commentary history.

## Scenarios

### Merchant Generates Product Copy

1. Merchant opens the product form.
2. Merchant provides partial product and auction-rule context.
3. Merchant clicks AI generation.
4. Backend calls the configured OpenAI-compatible model.
5. The generated draft is saved as an AI generation record.
6. Frontend shows the generated title, description, selling points, and live script.
7. Merchant clicks apply before fields change.
8. Product is saved only through the existing create/update flow.

### Key Auction Event Triggers Commentary

1. A buyer and merchant monitor are connected to the same auction room.
2. A key event occurs: first bid, soft-close extension, notable price jump, final 30 seconds, final 10 seconds, or auction end.
3. Backend builds a compact event context and calls the configured model outside the bid lock.
4. On success, backend broadcasts an `ai_commentary` WebSocket message to the auction room.
5. Buyer room and merchant monitor display the commentary as atmosphere text.
6. On model failure, no fake commentary is broadcast.

### Merchant Generates Post-Auction Report

1. Merchant opens a terminal auction surface or related order detail.
2. Merchant requests an AI report for an ended auction they own.
3. Backend aggregates product title, start price, final/current price, participant count, bid count, duration, and last-30-second bid share.
4. Backend calls the configured model and saves the report.
5. Frontend displays the report and can fetch it again later.

## Acceptance Criteria

- OpenAI-compatible AI configuration is explicit and missing configuration returns a clear direct API error.
- Product-copy API is merchant-only and saves generated drafts without creating or updating products.
- Auction report API is merchant-only, owner-scoped, terminal-auction-only, and saves generated reports.
- Report input metrics include product, start price, final price, participant count, bid count, duration, and last-30-second bid share.
- Realtime `ai_commentary` messages use the existing WebSocket envelope and never replace canonical auction state.
- Commentary is key-event gated and called outside bid locks.
- Product form, live room, merchant monitor, and report surface render AI states and model errors safely.
- OpenSpec validation, backend tests, frontend tests, frontend build, and whitespace checks pass.

## Technical Direction

- Add a backend `LLMClient` abstraction and `AIService`.
- Use Go `net/http` for the OpenAI-compatible chat completion request to avoid adding an SDK dependency.
- Add `ai_generation_records` migration and repository for saved product copy and reports.
- Add merchant AI routes under `/api/v1/merchant/ai`.
- Extend realtime message types with `ai_commentary`; generate commentary asynchronously from domain events.
- Keep AI prompts compact and JSON-oriented for product copy; report and commentary can be returned as plain text.
- Frontend adds thin API wrappers and typed AI models.
- Product form applies AI drafts only via an explicit button.

## Risks

- External model calls can fail or time out. Direct AI panels show an error and retry path; realtime commentary silently skips failed events.
- Model output may be malformed. Backend validates required JSON fields for product copy and returns an error instead of guessing.
- Commentary can overwhelm the room. V1 limits triggers to key events and avoids every-bid calls.
- AI text can imply official pricing advice. Prompts should frame outputs as merchant-facing suggestions or atmosphere commentary, never as authoritative financial advice.
