## ADDED Requirements

### Requirement: Buyer order action polish
The frontend SHALL present buyer order actions as clear mobile-first controls while preserving existing order workflow semantics.

#### Scenario: Buyer order list actions are clear
- **GIVEN** an authenticated buyer opens `/app/orders`
- **WHEN** one or more orders render
- **THEN** each order card shows status, product summary, amount, and a clear detail action
- **AND** the detail action is visibly tappable on mobile
- **AND** the action copy reads like final product UI rather than rough draft text

#### Scenario: Buyer order detail actions are clear
- **GIVEN** an authenticated buyer opens `/app/orders/:id`
- **WHEN** an order has available confirm, pay, or cancel actions
- **THEN** those actions render as clear mobile-first buttons with stable tap targets
- **AND** primary actions such as confirm or simulated pay have stronger visual hierarchy than secondary cancel or refresh actions
- **AND** disabled or submitting states prevent duplicate operation attempts while keeping status text readable

#### Scenario: Buyer order polish preserves workflow semantics
- **GIVEN** the buyer order pages render polished controls
- **WHEN** the buyer confirms, pays, cancels, refreshes, or views a terminal order
- **THEN** the frontend uses the existing order APIs and action availability fields
- **AND** paid and cancelled orders continue to show terminal status without mutation actions
- **AND** no new order, wallet, payment, settlement, or auction semantics are introduced
