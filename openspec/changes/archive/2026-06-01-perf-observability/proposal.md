# Proposal: perf-observability

## Why

The system already has core auction, realtime, order, and health-check capabilities. Judges still need concrete proof that the high-concurrency path is observable during a local demo: bid request volume, success rate, average latency, lock contention, and WebSocket connection count should be visible without adding a complex monitoring stack.

## What Changes

- Extend the existing `/healthz` auction-engine component with lightweight process-local bid and WebSocket metrics.
- Instrument bid placement with concurrency-safe counters for total requests, successes, failures, average latency, and lock-busy outcomes.
- Keep WebSocket connection count sourced from the existing realtime hub.
- Add a local Node load script for concurrent bid and optional WebSocket smoke testing.
- Add a performance report template with commands, metric definitions, and demo narrative.

## Non-Goals

- Prometheus, OpenTelemetry, tracing, external dashboards, or log shipping.
- Redis Pub/Sub, multi-instance aggregation, or distributed metrics.
- Changes to auction bid rules, wallet behavior, settlement, orders, or realtime message contracts.
- New database tables or migrations.
- A new public metrics endpoint.

## Impact

- `/healthz` JSON grows with additional `components.auction_engine` fields.
- Backend keeps process-local counters that reset on restart.
- Local demos gain a repeatable script and report format for performance evidence.
