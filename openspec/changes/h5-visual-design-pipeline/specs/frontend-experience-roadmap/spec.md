## ADDED Requirements

### Requirement: H5 visual design pipeline
The frontend roadmap SHALL define a source-material-driven visual design pipeline before further high-fidelity React H5 live-room refinement.

#### Scenario: User-provided captures are the visual authority
- **GIVEN** the user provides real-device screenshots or recordings
- **WHEN** H5 visual refinement work begins
- **THEN** the captures are recorded as the primary visual reference
- **AND** each reference includes screen/state, device or viewport when known, and keyframe timestamp when sourced from a recording
- **AND** workers distinguish structural interaction patterns from brand-specific assets that must not be copied

#### Scenario: Source material is not available yet
- **GIVEN** real-device screenshots or recordings have not been provided
- **WHEN** design pipeline work proceeds
- **THEN** workers may create Figma structure, repo-local templates, and acceptance checklists
- **AND** workers do not claim exact high-fidelity visual completion
- **AND** workers do not invent source-specific colors, spacing, media, or animation details

### Requirement: Figma high-fidelity live-room file
The design pipeline SHALL produce a high-fidelity Figma structure for the first-round buyer H5 live-room state set.

#### Scenario: Figma tools are available
- **GIVEN** Figma tools are available or the user provides a target Figma file
- **WHEN** the visual design pipeline is executed
- **THEN** a design file named `H5 Douyin-style Live Auction Pipeline` is created or updated
- **AND** it includes pages for `00 References`, `01 Teardown`, `02 Components`, `03 Hi-Fi Screens`, and `04 Motion Notes`
- **AND** high-fidelity screen work is limited to the first-round live-room state set unless a later OpenSpec change expands scope

#### Scenario: Figma tools are unavailable
- **GIVEN** Figma MCP tools are unavailable in the current session
- **WHEN** the visual design pipeline is executed
- **THEN** a repo-local Figma handoff template is created
- **AND** the missing tool limitation is recorded
- **AND** later Figma creation can proceed from the same page, component, state, and motion structure

#### Scenario: First-round live-room states are covered
- **GIVEN** the first-round high-fidelity design scope is active
- **WHEN** the Figma file or handoff template is reviewed
- **THEN** it covers default room, leading, outbid, last-10-second urgency, Soft Close extension, product shelf, bid sheet, winner result, non-winner sold result, and no-bid or cancelled terminal result
- **AND** profile, search, discovery, and lobby redesign are marked as second-stage work

### Requirement: Component and motion handoff
The design pipeline SHALL map Figma output to React H5 implementation components and motion behavior.

#### Scenario: Component inventory is reviewed
- **GIVEN** the high-fidelity live-room design exists
- **WHEN** the component inventory is reviewed
- **THEN** it maps host bar, right-side action rail, comment/system message layer, auction floating card, product shelf, bid sheet, and result modal to the existing React H5 live-room surface
- **AND** each component includes relevant visible states
- **AND** the inventory preserves WebSocket/store as the realtime truth source

#### Scenario: Motion notes are reviewed
- **GIVEN** the visual design includes live-room animations
- **WHEN** motion notes are reviewed
- **THEN** price pulse, countdown urgency, half-screen overlay transitions, outbid recovery, result modal entrance, and bid feedback have trigger, duration, easing, affected element, and accessible fallback notes
- **AND** motion notes do not require backend or WebSocket contract changes

### Requirement: React H5 implementation boundary
The design pipeline SHALL constrain future React implementation to visual refinement of the existing buyer live room unless another OpenSpec change expands scope.

#### Scenario: React refinement begins
- **GIVEN** the high-fidelity Figma live-room state set is ready
- **WHEN** React H5 implementation starts
- **THEN** workers refine the existing `/app/auctions/:id` live-room surface
- **AND** REST bid command state remains local to submitting and error feedback
- **AND** price, ranking, countdown, extension count, leading/outbid state, and terminal result remain WebSocket/store-driven
- **AND** no backend API, WebSocket message type, auction, order, wallet, or payment semantic changes are introduced by this pipeline

### Requirement: Mobile screenshot acceptance
The design pipeline SHALL define mobile screenshot acceptance for the live-room full-state set.

#### Scenario: Mobile acceptance is run
- **GIVEN** React H5 refinement has been implemented
- **WHEN** mobile screenshot acceptance is performed
- **THEN** the live room is captured at 390x844 for default, leading, outbid, urgency, extension, shelf, bid sheet, and result states
- **AND** at least one real-device screenshot comparison is performed after user source material is available
- **AND** top host bar, badges, messages, right action rail, auction floating card, overlays, and bottom controls have no incoherent overlap
- **AND** disabled or visual-only controls do not imply unavailable auction mutations are possible
