# Superpowers Exploration: auction-engine-mvp

## Goal

Build the backend auction engine MVP so the system can accept bids, maintain wallet freezes, rank bidders, settle auctions, and create orders without WebSocket/UI dependencies.

## Non-goals

- WebSocket realtime broadcast
- H5 auction room UI
- dashboard charts
- real payment integration

## Users

- User account: places bids and sees rankings.
- Merchant account: owns products/auctions and can cancel eligible auctions.
- System timer/engine: activates and settles auctions.

## Acceptance Criteria

- Valid bids freeze balance and update auction price.
- Outbid users are unfrozen.
- Invalid bids leave state unchanged.
- Rankings are queryable.
- Soft Close and ceiling settlement work.
- Ended auctions create pending-confirm orders when sold.
- Cancellation rules protect recent active bids.
- Audit logs are written for important transitions.

## Risks

- Concurrency can corrupt balances if bid flow is not transactional.
- Existing partial bids/orders files need reconciliation.
- Time-based tests can be flaky unless time calculations are isolated.

## Recommended Direction

Use the existing Go/Gin handler-service-repository structure. Keep wallet state in the existing users table for this MVP. Make WebSocket the next OpenSpec change after the engine is stable.
