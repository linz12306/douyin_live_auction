## ADDED Requirements

### Requirement: AI provider configuration
The backend SHALL support OpenAI-compatible model configuration for merchant AI assistant features.

#### Scenario: AI configuration is missing
- **GIVEN** required AI provider configuration is missing
- **WHEN** a merchant calls a direct AI generation API
- **THEN** the request is rejected with a clear configuration error
- **AND** no local template content is returned as AI content

#### Scenario: AI request uses configured provider
- **GIVEN** AI provider configuration is present
- **WHEN** the backend generates AI content
- **THEN** it sends a chat-completions-compatible request to the configured base URL
- **AND** it uses the configured model
- **AND** it bounds the request by configured timeout and token limits

### Requirement: Product copy generation
The system SHALL allow authenticated merchants to generate saved AI product copy drafts without automatically changing product records.

#### Scenario: Merchant generates product copy draft
- **GIVEN** an authenticated merchant provides product and auction-rule context
- **WHEN** the merchant requests product copy generation
- **THEN** the backend calls the configured model
- **AND** the response includes a generated title, description, selling points, and live script
- **AND** an AI generation record is saved
- **AND** no product is created or updated by the AI generation request

#### Scenario: User cannot generate merchant product copy
- **GIVEN** an authenticated user account
- **WHEN** the account requests product copy generation
- **THEN** the request is rejected

#### Scenario: Merchant applies copy explicitly
- **GIVEN** the product form shows an AI copy draft
- **WHEN** the merchant accepts the draft
- **THEN** the frontend fills the editable product fields
- **AND** the product is still saved only through the existing product save action

### Requirement: Auction AI report
The system SHALL allow merchants to generate and retrieve saved AI analysis reports for their own terminal auctions.

#### Scenario: Merchant generates terminal auction report
- **GIVEN** an authenticated merchant owns an auction with status `ended_sold`, `ended_no_bid`, or `cancelled`
- **WHEN** the merchant requests an AI auction report
- **THEN** the backend aggregates product title, start price, final or current price, participant count, bid count, duration seconds, and last-30-second bid share
- **AND** the backend calls the configured model with that snapshot
- **AND** the generated report is saved as an AI generation record
- **AND** the response includes the saved report content

#### Scenario: Merchant retrieves saved report
- **GIVEN** a merchant has generated an AI report for an auction they own
- **WHEN** the merchant requests the latest report for that auction
- **THEN** the latest saved successful report is returned

#### Scenario: Non-owner cannot access report
- **GIVEN** a merchant does not own an auction
- **WHEN** the merchant requests or generates the auction AI report
- **THEN** the request is rejected

#### Scenario: Active auction report is rejected
- **GIVEN** an auction is not in a terminal status
- **WHEN** the owning merchant requests an AI report
- **THEN** the request is rejected
- **AND** no report is saved

### Requirement: Realtime AI commentary
The system SHALL broadcast AI-generated commentary for key auction events without changing canonical realtime auction state.

#### Scenario: Key event produces commentary
- **GIVEN** AI provider configuration is present
- **AND** clients are connected to an auction WebSocket room
- **WHEN** a key auction event occurs
- **THEN** the backend may call the configured model outside auction bid locks
- **AND** successful output is broadcast as an `ai_commentary` WebSocket message
- **AND** existing price, ranking, countdown, and terminal messages remain the source of truth

#### Scenario: AI commentary failure is not faked
- **GIVEN** a key auction event occurs
- **AND** the model call fails
- **WHEN** realtime handling continues
- **THEN** no local substitute `ai_commentary` content is broadcast
- **AND** auction state and existing realtime messages continue unaffected

#### Scenario: Buyer and merchant see commentary
- **GIVEN** a buyer live room and merchant monitor are connected to the same auction room
- **WHEN** an `ai_commentary` message is received
- **THEN** both surfaces display the commentary text

### Requirement: AI assistant persistence
The system SHALL persist product-copy and auction-report AI outputs and SHALL NOT persist realtime commentary.

#### Scenario: Saved AI generation record
- **GIVEN** product-copy or auction-report generation succeeds
- **WHEN** the generation completes
- **THEN** an AI generation record stores merchant id, target type, optional product id, optional auction id, input snapshot, output content, model, status, and timestamps

#### Scenario: Realtime commentary is not persisted
- **GIVEN** realtime commentary is generated
- **WHEN** the commentary is broadcast
- **THEN** no AI generation record is created for that commentary
