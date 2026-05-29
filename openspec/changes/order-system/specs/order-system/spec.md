## ADDED Requirements

### Requirement: Auction order handoff
The system SHALL use `pending_confirm` orders created by the existing auction engine as the source of truth for post-win order workflows.

#### Scenario: Settled auction creates confirmable order
- **GIVEN** an auction has reached `ended_sold`
- **AND** the auction engine created one order for the winning buyer with status `pending_confirm`
- **WHEN** the buyer views their orders
- **THEN** the order is visible to the buyer
- **AND** the order includes the auction id, product summary, amount, status, and confirm deadline

#### Scenario: Existing auction settlement is not duplicated
- **GIVEN** an order already exists for an auction
- **WHEN** order-system operations run for that order
- **THEN** no additional order is created for the same auction
- **AND** the existing order id remains the workflow target

### Requirement: Buyer order confirmation
The system SHALL allow the winning buyer to confirm a `pending_confirm` order before its confirmation deadline.

#### Scenario: Buyer confirms pending order
- **GIVEN** a user is the buyer on an order with status `pending_confirm`
- **WHEN** the user confirms the order
- **THEN** the order status becomes `pending_payment`
- **AND** `confirmed_at` is set
- **AND** the buyer wallet balance and frozen amount remain unchanged

#### Scenario: Non-buyer cannot confirm order
- **GIVEN** a user is not the buyer on an order
- **WHEN** the user attempts to confirm the order
- **THEN** the request is rejected
- **AND** the order status remains unchanged

#### Scenario: Confirming wrong status is rejected
- **GIVEN** an order status is `pending_payment`, `paid`, or `cancelled`
- **WHEN** the buyer attempts to confirm the order
- **THEN** the request is rejected
- **AND** the order status remains unchanged

### Requirement: Simulated payment
The system SHALL allow the buyer to simulate payment for a `pending_payment` order and mark it paid without charging the wallet again.

#### Scenario: Buyer pays pending-payment order
- **GIVEN** a user is the buyer on an order with status `pending_payment`
- **WHEN** the user pays the order
- **THEN** the order status becomes `paid`
- **AND** `paid_at` is set
- **AND** the buyer wallet balance and frozen amount remain unchanged by the payment action

#### Scenario: Payment before confirmation is rejected
- **GIVEN** a user is the buyer on an order with status `pending_confirm`
- **WHEN** the user attempts to pay the order
- **THEN** the request is rejected
- **AND** the order remains `pending_confirm`

### Requirement: Confirmation cancellation and timeout
The system SHALL cancel unconfirmed orders and refund the buyer exactly once when a `pending_confirm` order is cancelled before confirmation or reaches its confirmation timeout.

#### Scenario: Buyer cancels before confirmation
- **GIVEN** a user is the buyer on an order with status `pending_confirm`
- **WHEN** the user cancels the order
- **THEN** the order status becomes `cancelled`
- **AND** `cancel_reason` records buyer cancellation
- **AND** `cancelled_at` is set
- **AND** the order amount is refunded to the buyer balance exactly once

#### Scenario: Pending confirmation times out
- **GIVEN** an order has status `pending_confirm`
- **AND** the order confirmation deadline has passed
- **WHEN** the timeout worker processes expired orders
- **THEN** the order status becomes `cancelled`
- **AND** `cancel_reason` is `confirm_timeout`
- **AND** `cancelled_at` is set
- **AND** the order amount is refunded to the buyer balance exactly once

#### Scenario: Cancellation does not rewrite auction result
- **GIVEN** an order is cancelled because of buyer cancellation or confirmation timeout
- **WHEN** the cancellation commits
- **THEN** the related auction and product terminal statuses remain unchanged
- **AND** the order status and cancel reason represent the failed transaction

#### Scenario: Repeated cancellation cannot double refund
- **GIVEN** an order was already changed from `pending_confirm` to `cancelled`
- **WHEN** buyer cancellation or timeout processing runs again for the same order
- **THEN** the buyer balance is not incremented again
- **AND** the order remains `cancelled`

### Requirement: User order list and detail
The system SHALL provide authenticated user order list and detail APIs scoped to the current buyer.

#### Scenario: Buyer lists own orders
- **GIVEN** an authenticated user account
- **WHEN** the user requests `GET /api/v1/orders`
- **THEN** the response includes only orders where `buyer_id` is the current user
- **AND** each order includes product summary, amount, status, timestamps, and confirm deadline when applicable

#### Scenario: Buyer views own order detail
- **GIVEN** an authenticated user account
- **AND** the user is the buyer on an order
- **WHEN** the user requests `GET /api/v1/orders/:id`
- **THEN** the response includes order detail, product summary, merchant id, amount, status, cancel reason, timestamps, and actions available to the buyer

#### Scenario: Buyer cannot view another user's order
- **GIVEN** an authenticated user account
- **AND** the user is not the buyer on an order
- **WHEN** the user requests that order detail
- **THEN** the request is rejected

### Requirement: Merchant order view
The system SHALL provide authenticated merchant order list and detail APIs scoped to the current merchant.

#### Scenario: Merchant lists own orders
- **GIVEN** an authenticated merchant account
- **WHEN** the merchant requests `GET /api/v1/orders`
- **THEN** the response includes only orders where `merchant_id` is the current merchant
- **AND** each order includes product summary, buyer display information, amount, status, and timestamps

#### Scenario: Merchant views own order detail
- **GIVEN** an authenticated merchant account
- **AND** the merchant owns the product associated with an order
- **WHEN** the merchant requests `GET /api/v1/orders/:id`
- **THEN** the response includes order detail, buyer display information, product summary, amount, status, cancel reason, and timestamps

#### Scenario: Merchant cannot view another merchant's order
- **GIVEN** an authenticated merchant account
- **AND** the merchant does not own the order
- **WHEN** the merchant requests that order detail
- **THEN** the request is rejected

### Requirement: Frontend order experience
The frontend SHALL provide necessary user and merchant entries, status displays, and actions for the order workflow.

#### Scenario: User sees and acts on order states
- **GIVEN** an authenticated user account
- **WHEN** the user opens `/app/orders` or `/app/orders/:id`
- **THEN** the user can see their order statuses
- **AND** a `pending_confirm` order offers confirm and cancel actions
- **AND** a `pending_payment` order offers a simulated payment action
- **AND** `paid` and `cancelled` orders show terminal status without mutation actions

#### Scenario: Merchant inspects orders
- **GIVEN** an authenticated merchant account
- **WHEN** the merchant opens `/merchant/orders` or `/merchant/orders/:id`
- **THEN** the merchant can see their order statuses, buyer information, product summary, and amount
- **AND** the merchant view does not show buyer-only confirm, cancel, or pay actions

#### Scenario: Order entry points are discoverable
- **GIVEN** an authenticated user or merchant account
- **WHEN** the account is using the existing auction or merchant pages
- **THEN** there is a visible navigation path to the account's order list
