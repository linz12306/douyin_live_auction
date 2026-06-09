# Proposal: ai-merchant-assistant

## Why

The live auction MVP already demonstrates real-time bidding, merchant monitoring, dashboard analytics, and post-win orders. A merchant AI assistant adds a clear competition highlight by helping merchants prepare product copy, energize live auction moments, and summarize auction results.

The feature must be grounded in existing auction data and must not change auction correctness. AI output is assistive presentation content only; auction state, bids, wallets, orders, and WebSocket truth semantics remain unchanged.

## What Changes

- Add OpenAI-compatible backend configuration for LLM calls.
- Add an AI service and LLM client abstraction using configurable chat-completions-compatible requests.
- Add persistent AI generation records for product-copy drafts and post-auction reports.
- Add merchant-only AI APIs:
  - `POST /api/v1/merchant/ai/product-copy`
  - `POST /api/v1/merchant/ai/auctions/:id/report`
  - `GET /api/v1/merchant/ai/auctions/:id/report`
- Add `ai_commentary` realtime WebSocket messages for key auction events.
- Add frontend AI surfaces to the product form, buyer live room, merchant monitor, and auction report surface.

## Compatibility Decisions

- Backward-compatible API addition; existing routes continue unchanged.
- WebSocket adds a new message type without changing existing message payloads.
- No auction, wallet, order, payment, settlement, cancellation, or ranking semantic changes.
- Realtime commentary is not persisted.
- Product copy and reports are saved as AI generation records.
- Missing AI config produces explicit errors for direct AI APIs and no fake realtime commentary.

## Impact

- Backend:
  - New config fields, migration, DTOs, repository, service, handler, and realtime commentary broadcaster.
  - Integration/unit tests with mocked LLM responses.
- Frontend:
  - New AI API/types.
  - Product form assistant panel.
  - `ai_commentary` rendering in live room and monitor.
  - Saved report panel in merchant monitor or order detail.
- Documentation:
  - Superpowers exploration and execution plan.
  - OpenSpec change files.

## Out Of Scope

- Buyer bid strategy recommendations.
- Streaming AI responses.
- Persisted realtime commentary history.
- AI-generated auction rules being auto-applied.
- Any change to bid acceptance, wallet, order, settlement, or cancellation behavior.
