# Proposal: auction-engine-mvp

## Why

The project plan identifies `auction-engine` as the next P0 module after user-auth and product-crud. The current code can publish products into pending auctions, but it does not yet support bidding, rankings, wallet freeze/unfreeze, state transitions, settlement, or cancellation. There are also partial `bids` and `orders` files already committed; they must be reviewed and either adopted or corrected under a formal OpenSpec change before further implementation.

## What

Implement the backend auction engine MVP:

- validate and persist bids
- freeze bidder balance and unfreeze outbid bidders
- expose bid and ranking APIs
- manage auction state transitions from pending to active to ended/cancelled
- support Soft Close extension and ceiling-price auto settlement
- create orders on successful settlement
- record audit logs for bid, extension, settlement, cancellation, freeze, unfreeze, and deduction events

## Non-goals

- WebSocket realtime delivery
- H5 auction room UI
- merchant dashboard charts
- payment provider integration
- multi-room livestream UI

## Impact

- Adds or revises auction-engine database schema, models, repositories, services, handlers, and tests.
- Existing partial `bids` and `orders` files must be reviewed as part of this change.
- Later `ws-realtime` work will consume events/state produced by this engine.
