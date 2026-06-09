## ADDED Requirements

### Requirement: Local performance realtime scope disclosure
The system SHALL document that local performance metrics are process-local while multi-backend realtime fanout is covered by the Redis Streams backplane change.

#### Scenario: Performance report states realtime scope
- **GIVEN** a presenter reads the local performance report
- **WHEN** the report describes WebSocket load evidence
- **THEN** it states that the recorded WebSocket connection and broadcast metrics are from one backend process
- **AND** it identifies `distributed-realtime-backplane` as the Redis Streams implementation for multi-backend fanout
