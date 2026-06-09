# Design: ai-merchant-assistant

## Architecture

Add a focused AI subsystem beside existing merchant dashboard, auction, and realtime modules:

```text
Merchant UI -> REST AI routes -> AIService -> LLMClient
                         |        |
                         |        -> ai_generation_records
Auction events -> AI commentary service -> realtime event bus -> buyer room + merchant monitor
```

AI content is presentation-only. The auction engine remains authoritative for price, rankings, countdown, winner, and order state.

## Configuration

Add backend config fields:

- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL`
- `AI_TIMEOUT_MS`
- `AI_MAX_TOKENS`

If `AI_BASE_URL`, `AI_API_KEY`, or `AI_MODEL` is missing, direct AI APIs return a clear configuration error. Realtime commentary skips generation.

## Persistence

Add `ai_generation_records`:

- `id`
- `merchant_id`
- `target_type`: `product_copy` or `auction_report`
- nullable `product_id`
- nullable `auction_id`
- `input_snapshot` JSON
- `output_content` JSON/text
- `model`
- `status`: `succeeded` or `failed`
- nullable `error_message`
- `created_at`
- `updated_at`

Product copy and auction reports are saved. Realtime commentary is not saved.

## API Contracts

### Product Copy

`POST /api/v1/merchant/ai/product-copy`

Request:

```json
{
  "title": "和田玉手镯",
  "description": "已有描述",
  "start_price": 1000,
  "bid_increment_type": "fixed",
  "bid_increment_value": 100,
  "ceiling_price": 8000,
  "duration_seconds": 300
}
```

Response:

```json
{
  "record_id": 1,
  "model": "gpt-compatible",
  "draft": {
    "title": "温润和田玉手镯",
    "description": "适合直播间展示的商品介绍",
    "selling_points": ["玉质温润", "适合收藏"],
    "live_script": "各位看这里..."
  }
}
```

The API does not create or update products.

### Auction Report

`POST /api/v1/merchant/ai/auctions/:id/report` generates or regenerates a report.

`GET /api/v1/merchant/ai/auctions/:id/report` returns the latest saved successful report when present.

Only the owning merchant may access a report. Generation requires a terminal auction: `ended_sold`, `ended_no_bid`, or `cancelled`.

Report metrics include product title, start price, final/current price, participant count, bid count, duration seconds, and last-30-second bid share.

## Realtime Commentary

Add WebSocket type `ai_commentary`:

```json
{
  "type": "ai_commentary",
  "auction_id": 7,
  "version": 12,
  "server_time": "2026-06-09T12:00:00Z",
  "payload": {
    "event": "auction_end",
    "commentary": "恭喜 3 号用户竞得本场拍品！"
  }
}
```

Triggers:

- first accepted bid,
- soft-close extension,
- notable price jump,
- final 30 seconds,
- final 10 seconds,
- auction terminal event.

Model calls happen after auction state commits and outside bid locks. Failures do not broadcast local substitute commentary.

## Frontend

- Product form shows an AI assistant panel near product identity fields.
- Generated copy displays as a draft preview; merchant must click apply before fields change.
- Buyer live room displays recent AI commentary in the message feed.
- Merchant monitor displays the same commentary in its event feed.
- Merchant monitor or merchant order detail displays the saved report panel for terminal auctions.

## Verification

- Mock LLM backend tests for success, configuration errors, malformed output, scoping, and report metrics.
- Frontend tests for draft application, commentary rendering, saved report states, and error states.
- OpenSpec strict validation, backend tests, frontend tests, frontend build, and `git diff --check`.
