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

- [x] 5. Verification
  - Run `npx -y @fission-ai/openspec@latest validate h5-visual-design-pipeline --strict --no-interactive`.
  - Run `git diff --check`.
  - Record verification results in this task file and the Superpowers plan.
  - Verification:
    - `npx -y @fission-ai/openspec@latest validate h5-visual-design-pipeline --strict --no-interactive` passed.
    - `git diff --check` passed.

- [ ] 6. Finalize, commit, and push
  - Update project memory.
  - Confirm no unrelated dirty files are included.
  - Commit the verified slice with `docs(frontend): add h5 visual design pipeline`.
  - Push the current branch and report commit/push state.
