# Tasks: h5-visual-design-pipeline

- [x] 1. Exploration and OpenSpec lock
  - Read `AGENTS.md`, `requirements-v3.md`, `current-source-of-truth.md`, `project.md`, existing frontend roadmap, and `auction-atmosphere`.
  - Confirm this is full OpenSpec work because it changes visual design acceptance and future implementation boundaries.
  - Create `docs/superpowers/specs/2026-06-02-h5-visual-design-pipeline-exploration.md`.
  - Create OpenSpec change files under `openspec/changes/h5-visual-design-pipeline/`.
  - Record confirmed decisions: user-provided source material, new Figma file, high-fidelity output, live-room full-state first round, profile/search deferred.

- [x] 2. Superpowers execution plan
  - Create `docs/superpowers/plans/2026-06-02-h5-visual-design-pipeline.md`.
  - Break work into OpenSpec lock, Figma handoff template, mobile acceptance, verification, commit, and push.

- [x] 3. Repo-local Figma handoff template
  - Create `docs/design/h5-visual-design-pipeline/figma-file-template.md`.
  - Define pages `00 References`, `01 Teardown`, `02 Components`, `03 Hi-Fi Screens`, and `04 Motion Notes`.
  - Define first-round components and state screens.
  - Record that the actual Figma file cannot be created in this session because Figma MCP tools are unavailable.

- [x] 4. Mobile screenshot acceptance template
  - Create `docs/design/h5-visual-design-pipeline/mobile-screenshot-acceptance.md`.
  - Define 390x844 screenshot coverage.
  - Define real-device comparison requirements once user source material is available.
  - Define no-overlap, action-state, realtime-truth, and reduced-motion checks.

- [x] 4.1 Source Batch 01 teardown
  - Record the first user-provided reference batch in `docs/design/h5-visual-design-pipeline/source-material-teardown.md`.
  - Create `docs/design/h5-visual-design-pipeline/react-h5-refinement-brief.md`.
  - Update the Figma template and mobile acceptance checklist to reference Source Batch 01.
  - Keep reference images out of the repo and treat them as structure/state/motion guidance only.

- [x] 4.2 React H5 visual refinement
  - Refine `frontend/src/pages/app/LiveAuctionRoom.tsx` against Source Batch 01.
  - Reshape the auction floating card toward the R2 auction reference with a white control card, bid-count chip, lot id, separated price/countdown zones, and red CTA.
  - Reshape the bid sheet toward R3/R5/R6 with a light half-screen surface, timer headline, current/my bid split, state chip, large amount input, edge steppers, and pink primary CTA.
  - Reshape the product shelf toward R4 with dense white auction rows, state-specific price labels, and state-specific CTAs while keeping demo rows clearly labeled.
  - Reshape the result modal toward R7 with distinct winner/sold hierarchy and existing order route entry.
  - Preserve REST/WS truth rules and existing buyer order routes.

- [x] 4.3 Mobile screenshot QA
  - Create `docs/design/h5-visual-design-pipeline/mobile-screenshot-qa-2026-06-02.md`.
  - Record the local 390x844 main-room, bid-sheet, shelf, and 1200x900 desktop smoke screenshots.
  - Record passed visual checks, remaining visual review items, and the recommended second-stage profile/search change.
  - Keep screenshot files as local validation artifacts instead of committing generated images.

- [x] 5. Verification
  - Run `npx -y @fission-ai/openspec@latest validate h5-visual-design-pipeline --strict --no-interactive`.
  - Run `git diff --check`.
  - Record verification results in this task file and the Superpowers plan.
  - Verification:
    - `npx -y @fission-ai/openspec@latest validate h5-visual-design-pipeline --strict --no-interactive` passed.
    - `git diff --check` passed.
    - `cd frontend && npm run test -- LiveAuctionRoom` passed with 11 tests after React H5 visual refinement.
    - `cd frontend && npm run build` passed after React H5 visual refinement.
    - Playwright visual smoke passed with mocked auth/live-room store and captured `/tmp/h5-live-room-refined-mobile-fixed.png`, `/tmp/h5-live-room-refined-bid-sheet.png`, `/tmp/h5-live-room-refined-shelf.png`, and `/tmp/h5-live-room-refined-desktop.png`.

- [ ] 6. Finalize, commit, and push
  - Update project memory.
  - Confirm no unrelated dirty files are included.
  - Commit verified slices:
    - `198fd0b docs(frontend): add h5 visual design pipeline`
    - `67a9041 docs(frontend): add h5 source material teardown`
    - `ee4a370 feat(frontend): refine h5 live auction design`
  - Push the current branch and report commit/push state.
  - Current push status: blocked by local global pre-push policy hook `/Users/vivix/.git-hooks/pre-push`; do not bypass the hook.
