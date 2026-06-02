# H5 Visual Design Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the specification and handoff structure for a real-device-material-driven, high-fidelity Figma-to-React H5 live-room design pipeline.

**Architecture:** This is a planning and handoff slice. It creates an OpenSpec change, Superpowers exploration, and repo-local Figma delivery template while preserving the existing `LiveAuctionRoom` implementation and realtime data contracts.

**Tech Stack:** OpenSpec, Superpowers docs, React H5/Vite context, Figma design handoff, mobile screenshot acceptance.

---

### Task 1: OpenSpec and Exploration Lock

**Files:**
- Create: `docs/superpowers/specs/2026-06-02-h5-visual-design-pipeline-exploration.md`
- Create: `openspec/changes/h5-visual-design-pipeline/proposal.md`
- Create: `openspec/changes/h5-visual-design-pipeline/design.md`
- Create: `openspec/changes/h5-visual-design-pipeline/tasks.md`
- Create: `openspec/changes/h5-visual-design-pipeline/specs/frontend-experience-roadmap/spec.md`

- [x] **Step 1: Record confirmed decisions**

Capture source material, Figma workflow, high-fidelity output, first-round live-room scope, and deferred profile/search expansion in the exploration document.

- [x] **Step 2: Lock proposal and design**

Create the OpenSpec change with no backend API, WebSocket, auction, order, wallet, or payment semantic changes.

- [x] **Step 3: Lock spec scenarios**

Add requirements for source-material intake, Figma teardown/high-fidelity structure, component inventory, motion notes, React handoff, and mobile screenshot acceptance.

### Task 2: Figma Handoff Template

**Files:**
- Create: `docs/design/h5-visual-design-pipeline/figma-file-template.md`
- Create: `docs/design/h5-visual-design-pipeline/mobile-screenshot-acceptance.md`

- [x] **Step 1: Create Figma file template**

Document the intended Figma file name, pages, frames, component sets, state coverage, and source-material placeholders.

- [x] **Step 2: Create mobile acceptance checklist**

Document 390x844 screenshot requirements, real-device comparison expectations, no-overlap checks, and state-by-state acceptance.

- [x] **Step 3: Record current tool limitation**

State that the actual Figma file cannot be created until Figma MCP tools are available or the user provides a Figma file/link.

### Task 3: Verification and Finalization

**Files:**
- Modify: `openspec/changes/h5-visual-design-pipeline/tasks.md`
- Modify: `docs/superpowers/plans/2026-06-02-h5-visual-design-pipeline.md`
- Optional modify: `projects/proj-1779447357476-ryiijf/memory/2026-06-02.md`
- Optional modify: `projects/proj-1779447357476-ryiijf/memory/long-term.md`

- [x] **Step 1: Validate OpenSpec**

Run:

```bash
npx -y @fission-ai/openspec@latest validate h5-visual-design-pipeline --strict --no-interactive
```

Result: passed for `h5-visual-design-pipeline`.

- [x] **Step 2: Run diff hygiene check**

Run:

```bash
git diff --check
```

Result: passed with no whitespace errors.

- [ ] **Step 3: Commit and push**

Run:

```bash
git status --short
git add docs/superpowers/specs/2026-06-02-h5-visual-design-pipeline-exploration.md docs/superpowers/plans/2026-06-02-h5-visual-design-pipeline.md docs/design/h5-visual-design-pipeline openspec/changes/h5-visual-design-pipeline projects/proj-1779447357476-ryiijf/memory
git commit -m "docs(frontend): add h5 visual design pipeline"
git push
```

Expected: commit is created and pushed from the current branch.
