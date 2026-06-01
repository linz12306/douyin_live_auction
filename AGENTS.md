# AGENTS.md

This repo uses one project-local workflow:

`Superpowers exploration -> OpenSpec lock -> Superpowers execution -> OpenSpec verification/archive -> Superpowers memory`

Use the smallest workflow that protects correctness. Do not run the full process for every small UI affordance or narrow bugfix.

## Context

Before non-trivial work, read the relevant subset of:

- `AGENTS.md`
- `projects/proj-1779447357476-ryiijf/outputs/current-source-of-truth.md`
- `projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`
- `projects/proj-1779447357476-ryiijf/project.md`
- `docs/superpowers/specs/`
- `docs/superpowers/plans/`
- `openspec/`

`requirements-v3.md` is the latest requirements authority. Ignore older claims that `requirements-v2.md` is current.

If Superpowers skills, OpenSpec files, or the OpenSpec CLI are missing, say so and use the fallback rules below. Do not silently skip the discipline.

## Workflow Choice

Use the full integrated workflow for:

- product behavior or acceptance-criteria changes
- public API changes
- database/schema/migration changes
- architecture changes
- concurrency, WebSocket, auction engine, payment/order, or wallet changes
- unclear work whose scope may expand

Use the routine fast lane for small, low-risk changes:

- wiring one existing backend action into the UI, such as a missing button for an existing endpoint
- narrow frontend display/state fixes that do not change backend contracts or core auction semantics
- small route, navigation, validation-message, or error-display fixes
- test-only changes for existing behavior
- process/documentation updates

Fast-lane requirements:

1. Read `AGENTS.md` and only directly relevant code/docs.
2. State why the work is fast-lane instead of full OpenSpec.
3. Make the smallest coherent patch.
4. Run focused verification.
5. Commit and push the verified slice unless the user asks not to.
6. If scope expands into full-workflow territory, stop and promote it.

Documentation-only typo/format/comment fixes may be lighter, but still state verification.

## Full Workflow

### Phase 0: Preflight

- Read relevant requirements, plans, specs, code, and tests.
- Check branch/worktree status and report unrelated dirty files.
- Check OpenSpec/Superpowers availability.
- Do not write business code during preflight.
- Before the next feature change, review the existing `bids` / `orders` related files and migrations. Either include them in a formal OpenSpec change or intentionally rework/remove them during that change.

### Phase 1: Superpowers Exploration

Define goal, non-goals, users, scenarios, acceptance criteria, risks, and technical direction.

For product requirements, UX planning, workflow design, OpenSpec lock work, or any change whose main output is a new direction for later implementation, exploration must include an explicit user-facing brainstorm checkpoint before writing or finalizing the spec documents:

- Summarize the current understanding in plain language.
- Present the intended split, tradeoffs, and recommended direction.
- Ask the user to confirm, correct, or narrow the direction unless the user explicitly asked for unattended execution.
- Record any user-confirmed assumptions or corrections in the exploration document.

Do not treat a written exploration file as a substitute for this checkpoint. If the user already provided detailed requirements, still mirror back the planned interpretation briefly before locking OpenSpec.

Write or update:

- `docs/superpowers/specs/YYYY-MM-DD-<change-id>-exploration.md`

### Phase 2: OpenSpec Lock

Create or update:

- `openspec/changes/<change-id>/proposal.md`
- `openspec/changes/<change-id>/design.md`
- `openspec/changes/<change-id>/tasks.md`
- `openspec/changes/<change-id>/specs/<capability>/spec.md`

Rules:

- `tasks.md` must be implementation-ready and include verification.
- Run `openspec validate <change-id> --strict` when available.
- Do not implement until this phase passes.
- If implementation shows the spec is wrong, pause coding and return here.

### Phase 3: Superpowers Execution

- Generate/update `docs/superpowers/plans/YYYY-MM-DD-<change-id>.md` from OpenSpec tasks.
- Implement in small verified slices.
- Prefer TDD for service logic, state machines, bidding, wallet, and orders.
- Use systematic debugging for failures.
- Keep OpenSpec tasks and the Superpowers plan synchronized.
- Commit each verified slice.

#### Subagent Scheduling

Before dispatching subagents, map:

- task goal
- write scope
- upstream dependencies
- owned verification

Default to parallel subagents when tasks are independent:

- no task depends on another task's unmerged output
- write scopes are disjoint or clearly non-conflicting
- verification can run independently
- one task's failure does not invalidate another task's assumptions

Keep work sequential when tasks share files/state, define contracts needed by others, depend on ordering, or review feedback may change another task's assumptions.

For parallel work, give each subagent explicit ownership. Subagents must not revert unrelated edits. Integrate results in dependency order, then run spec review, code-quality review, verification, and commit.

### Phase 4: Verification, Archive, Memory

Completion requires alignment across code, tests/build/checks, OpenSpec, Superpowers plan, and memory.

Required:

- Run relevant verification and record commands/results.
- Confirm code matches OpenSpec requirements and scenarios.
- Confirm task/plan checkboxes match reality.
- Exclude generated/runtime files.
- Push branch or open PR when appropriate.
- Archive accepted OpenSpec changes when appropriate.
- Update memory with current state, decisions, risks, and next step.

Memory locations:

- `projects/proj-1779447357476-ryiijf/memory/YYYY-MM-DD.md`
- `projects/proj-1779447357476-ryiijf/memory/long-term.md`

## Git Rules

- Do not implement non-lightweight work directly on `master` or `main`.
- Use a topic branch that maps to the OpenSpec change when applicable.
- Inspect dirty worktrees before editing; do not mix unrelated changes.
- Commit coherent verified slices.
- Do not commit broken code unless the user asks for a checkpoint.
- Use concise conventional messages, for example `feat(auction): add bid placement`.
- Never commit secrets, `.env`, `node_modules`, build output, local DB files, or runtime uploads such as `backend/static/avatars/*` and `backend/static/images/*` unless intentionally tracked as fixtures.
- Push meaningful verified checkpoints unless the user asks to keep work local.
- Do not merge to `master`/`main`, rewrite published history, or open PRs unless the user asks.
- Always report commit/push state.

## Fallback

If Superpowers skills are unavailable, still create/update the repo-local exploration and plan docs and follow the same engineering discipline manually.

If OpenSpec CLI is unavailable, still create the OpenSpec change structure and manually validate proposal/design/tasks/spec deltas. Record that CLI validation was unavailable.

Missing tools are not permission to skip the workflow.

## Agent Rules

- Never skip OpenSpec for complex work.
- Never write only OpenSpec without a Superpowers execution plan.
- Never treat old chat context as more authoritative than repo state.
- Never silently build on accidental or partial work.
- Prefer repo-local patterns over new abstractions.
- Protect user work; do not revert unrelated changes unless explicitly requested.
- Do not claim completion when verification, specs, plans, or memory are stale.
