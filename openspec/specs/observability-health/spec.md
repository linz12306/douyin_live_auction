# observability-health Specification

## Purpose
Defines the backend observability health surface for the live auction system: an unauthenticated `/healthz` endpoint, DB and Redis dependency checks, auction-engine runtime status, lightweight realtime stats, degraded HTTP mapping, and safe bounded failure responses.
## Requirements
### Requirement: Health endpoint
The system SHALL expose an unauthenticated `GET /healthz` endpoint outside `/api/v1` that reports backend operational health.

#### Scenario: Health endpoint is available without authentication
- **GIVEN** no JWT or session credentials
- **WHEN** a client requests `GET /healthz`
- **THEN** the server responds with a health JSON body
- **AND** the request is not rejected by authentication middleware

### Requirement: Component health response
The health endpoint SHALL return top-level status, check timestamp, and component entries for DB, Redis, and auction engine.

#### Scenario: All components healthy
- **GIVEN** MySQL ping succeeds
- **AND** Redis ping succeeds
- **AND** the auction engine runtime is constructed
- **WHEN** a client requests `GET /healthz`
- **THEN** the response status code is 200
- **AND** the body top-level status is `ok`
- **AND** the body includes `checked_at`
- **AND** `components.db.status` is `ok`
- **AND** `components.redis.status` is `ok`
- **AND** `components.auction_engine.status` is `ok`

#### Scenario: Component stats included
- **GIVEN** the realtime runtime has active room, connected client, or dropped event counters
- **WHEN** a client requests `GET /healthz`
- **THEN** `components.auction_engine` includes active room count
- **AND** `components.auction_engine` includes connected client count
- **AND** `components.auction_engine` includes dropped event count

### Requirement: Dependency degradation handling
The health endpoint SHALL return HTTP 503 when DB or Redis health checks fail and SHALL still report every component status.

#### Scenario: DB ping fails
- **GIVEN** MySQL ping fails or times out
- **AND** Redis ping succeeds
- **WHEN** a client requests `GET /healthz`
- **THEN** the response status code is 503
- **AND** the body top-level status is `degraded`
- **AND** `components.db.status` is `down`
- **AND** `components.db.message` is sanitized
- **AND** `components.redis.status` is `ok`
- **AND** `components.auction_engine.status` is present

#### Scenario: Redis ping fails
- **GIVEN** Redis ping fails or times out
- **AND** MySQL ping succeeds
- **WHEN** a client requests `GET /healthz`
- **THEN** the response status code is 503
- **AND** the body top-level status is `degraded`
- **AND** `components.redis.status` is `down`
- **AND** `components.redis.message` is sanitized
- **AND** `components.db.status` is `ok`
- **AND** `components.auction_engine.status` is present

### Requirement: Health check safety
The health endpoint SHALL use bounded checks and SHALL NOT expose secrets or raw infrastructure errors.

#### Scenario: Checks are bounded
- **GIVEN** a dependency is slow or unavailable
- **WHEN** `/healthz` checks the dependency
- **THEN** the component check uses a short timeout
- **AND** the endpoint returns a bounded degraded response instead of hanging indefinitely

#### Scenario: Sensitive details are hidden
- **GIVEN** a DB or Redis check fails with a raw infrastructure error
- **WHEN** `/healthz` returns the component failure
- **THEN** the response does not include DSNs
- **AND** the response does not include Redis passwords
- **AND** the response does not include raw stack traces
