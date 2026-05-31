## ADDED Requirements

### Requirement: Repeatable local demo setup
The system SHALL provide a documented local-only way to create or reset demo data needed for a complete auction demonstration.

#### Scenario: Presenter prepares demo data
- **GIVEN** local MySQL, Redis, backend, and frontend services are available
- **WHEN** the presenter runs the demo setup flow
- **THEN** demo merchant and user accounts are available
- **AND** at least one demo auction is available for live bidding
- **AND** repeated setup runs do not fail because of stale demo data

### Requirement: End-to-end demo readiness check
The system SHALL provide an automated browser check for the main demo journey.

#### Scenario: Demo journey passes
- **GIVEN** demo data has been prepared
- **WHEN** the demo-readiness E2E is run
- **THEN** it verifies merchant entry points
- **AND** verifies buyer live-room bidding
- **AND** verifies competing bidder outbid behavior
- **AND** verifies merchant realtime monitoring
- **AND** verifies settlement into an order
- **AND** verifies buyer confirmation and simulated payment

### Requirement: Presenter runbook
The system SHALL document the exact steps required to run the local demo.

#### Scenario: Presenter follows runbook
- **GIVEN** a developer has the repository on a local machine
- **WHEN** they follow the runbook commands and checkpoints
- **THEN** they can start dependencies, start backend/frontend services, prepare demo data, log in with demo accounts, and walk through the core demo path
- **AND** they have troubleshooting checks for health, WebSocket updates, stale data, and rate limits

### Requirement: Demo blocker polish
The system SHALL fix narrow UI or flow blockers that prevent the documented demo journey from completing.

#### Scenario: Demo path page has valid data
- **GIVEN** the demo setup created valid data for a page in the runbook
- **WHEN** the presenter opens that page
- **THEN** the page does not appear broken due to missing entry links, hidden errors, misleading empty states, or stale loading states
