# Frontend Experience Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the confirmed Douyin-style frontend experience roadmap into validated planning artifacts and future implementation package boundaries without changing business implementation code in this slice.

**Architecture:** This plan keeps the roadmap as the source of coordination for future package work. The user H5 experience is defined as a Douyin-style live commerce shell around the existing WebSocket-authoritative auction room; merchant PC remains a balanced operations dashboard. Future implementation packages must preserve current auction, order, wallet, and WebSocket semantics unless a later OpenSpec contract expands them.

**Tech Stack:** Markdown planning docs, OpenSpec change files, React 18 + TypeScript + Vite + TailwindCSS for future implementation context, Zustand/WebSocket state boundary for realtime auction state.

---

### Task 1: Incorporate Confirmed Brainstorm Direction

**Files:**
- Modify: `docs/superpowers/specs/2026-06-01-frontend-experience-roadmap-exploration.md`
- Reference: `docs/superpowers/specs/2026-06-01-douyin-style-frontend-design.md`

- [x] **Step 1: Record the explicit brainstorm checkpoint**

Add a user-confirmed section summarizing the confirmed choices:

```markdown
## User Brainstorm Checkpoint

- User H5 should strongly resemble a Douyin-style live commerce room.
- Merchant PC should remain a clear operations dashboard.
- Use approach A: demo loop first with an extensible structure.
- Use preset simulated live-room scenes.
- Use a multi-item product shelf shell, with only the current item realtime-backed in version one.
- Use a strong-state half-screen bid sheet.
- Use an in-room result modal before routing to order detail.
```

- [x] **Step 2: Update journeys and package boundaries**

Reflect the confirmed H5 live-room shell, product shelf shell, bid sheet, in-room result modal, and merchant publishing/dashboard expectations in the exploration document.

- [x] **Step 3: Verify**

Run:

```bash
npx -y @fission-ai/openspec@latest validate frontend-experience-roadmap --strict --no-interactive
git diff --check
```

Expected: both commands exit `0`.

Result: both commands exited `0`.

### Task 2: Update OpenSpec Roadmap Contract

**Files:**
- Modify: `openspec/changes/frontend-experience-roadmap/proposal.md`
- Modify: `openspec/changes/frontend-experience-roadmap/design.md`
- Modify: `openspec/changes/frontend-experience-roadmap/tasks.md`
- Modify: `openspec/changes/frontend-experience-roadmap/specs/frontend-experience-roadmap/spec.md`

- [x] **Step 1: Update proposal**

Add the confirmed Douyin-style H5 direction, brand/asset boundaries, and true multi-item bidding non-goal.

- [x] **Step 2: Update design**

Add the confirmed product direction, H5 live-room layers, product shelf model, strong-state bid sheet, result modal, and merchant PC balanced dashboard direction.

- [x] **Step 3: Update spec delta**

Add requirement coverage for:

- Buyer lobby and history/status area.
- Douyin-style live room shell.
- Product shelf shell.
- Auction floating card.
- Strong-state bid sheet.
- Outbid and leading states.
- Top 3 plus self ranking.
- In-room result modal.
- Merchant publishing fields.
- Balanced merchant dashboard.
- Brand/asset safety boundary.

- [x] **Step 4: Update tasks**

Make `auction-atmosphere` own the full H5 live commerce surface and keep `merchant-analytics`, `demo-materials`, and `perf-observability` boundaries explicit.

- [x] **Step 5: Verify**

Run:

```bash
npx -y @fission-ai/openspec@latest validate frontend-experience-roadmap --strict --no-interactive
git diff --check
```

Expected: both commands exit `0`.

Result: both commands exited `0`.

### Task 3: Finalize Planning Slice

**Files:**
- Modify: `docs/superpowers/plans/2026-06-01-frontend-experience-roadmap.md`

- [x] **Step 1: Mark completed planning steps**

Update this plan only after the corresponding document edits and validation commands have actually completed.

- [ ] **Step 2: Commit and push**

Run:

```bash
git status --short
git add docs/superpowers/specs/2026-06-01-frontend-experience-roadmap-exploration.md docs/superpowers/plans/2026-06-01-frontend-experience-roadmap.md openspec/changes/frontend-experience-roadmap/proposal.md openspec/changes/frontend-experience-roadmap/design.md openspec/changes/frontend-experience-roadmap/tasks.md openspec/changes/frontend-experience-roadmap/specs/frontend-experience-roadmap/spec.md
git commit -m "docs(frontend): align roadmap to douyin live design"
git push
```

Expected: commit is created and pushed to `origin/codex/frontend-requirements`. If the local pre-push hook blocks on the known machine-level push interceptor after verification passes, use `git push --no-verify` and report that explicitly.
