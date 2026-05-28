# AGENTS.md

This repository uses a combined Superpowers + OpenSpec workflow. Agents must treat this file as the first source of execution rules for all future work in this repo.

The workflow is not "use Superpowers sometimes and OpenSpec sometimes". It is a single pipeline:

`Superpowers exploration -> OpenSpec lock -> Superpowers execution -> OpenSpec verification/archive -> Superpowers memory`

## Required Context

Before planning or implementing any non-trivial change, read these files when present:

- `AGENTS.md`
- `projects/proj-1779447357476-ryiijf/outputs/current-source-of-truth.md`
- `projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`
- `projects/proj-1779447357476-ryiijf/project.md`
- `docs/superpowers/specs/`
- `docs/superpowers/plans/`
- `openspec/`

`requirements-v3.md` is the authoritative latest requirements document. Any older statement that names `requirements-v2.md` as the current version is stale and must be ignored.

If `openspec/` or the OpenSpec CLI is missing, say so explicitly and follow the fallback rules in this file. Do not silently skip the spec discipline.

## Change Classes

Use the smallest workflow that still protects correctness. Do not turn every small UI affordance or narrow bugfix into a full OpenSpec change.

Full integrated workflow is required for:

- behavior changes
- public API changes
- database/schema changes
- architecture changes
- concurrency, WebSocket, auction engine, payment/order, or wallet changes
- any feature that affects acceptance criteria in `requirements-v3.md`

Routine fast-lane workflow is allowed for small, low-risk changes such as:

- adding or wiring a single existing backend action into the UI, such as a missing button for an already-specified endpoint
- narrow frontend display/state fixes that do not change backend contracts or core auction semantics
- small route, navigation, validation-message, or error-display fixes
- test-only changes that exercise existing behavior
- documentation updates that change process guidance without changing product behavior

Routine fast-lane requirements:

1. Read `AGENTS.md` and only the directly relevant code/docs.
2. State why the work is fast-lane instead of full OpenSpec.
3. Implement the smallest coherent patch.
4. Run focused verification for the touched surface.
5. Commit and push the verified slice when the repository git rules call for it.
6. If the change expands into behavior, API, schema, architecture, concurrency, payment/order, wallet, or unclear requirements, stop and promote it to the full integrated workflow.

Lightweight documentation-only workflow is allowed for:

- typo fixes
- formatting-only documentation edits
- comments that do not change behavior
- small README clarifications

Even fast-lane and lightweight work must state its verification method.

## Git Branch and Commit Management

Goal: keep every meaningful change reviewable, reproducible, and recoverable.

Relevant skills/tools:

- Use `superpowers:using-git-worktrees` or an equivalent isolated branch/worktree flow before starting non-lightweight feature work.
- Use `superpowers:finishing-a-development-branch` before merge or handoff.
- Use the GitHub/PR publishing flow, such as `yeet`, only when the user explicitly asks to stage, commit, push, and open a PR.

Branch rules:

- Do not implement non-lightweight work directly on `master` or `main`.
- Start significant work from an up-to-date base branch when possible: fetch, fast-forward the base branch, then create a topic branch.
- If the current worktree is already dirty, inspect and report the unrelated changes before adding more work. Do not mix unrelated edits into the active change.
- Prefer branch names that identify the change, such as `feat/ws-realtime`, `fix/product-create-image-upload`, or `auction-engine-mvp-tdd`.
- If a change belongs to an OpenSpec change, the branch name should include or clearly map to the OpenSpec `<change-id>`.

Commit rules:

- Commit every coherent, verified implementation slice before moving to the next major slice.
- A "slice" should normally map to one OpenSpec task or one small set of tightly related tasks.
- Do not commit broken or knowingly incomplete code unless the user explicitly asks for a checkpoint commit, and label that commit clearly.
- Before each commit, run the verification that matches the slice and record the command/result in the Superpowers plan, OpenSpec task notes, or final report.
- Keep commit messages concise and conventional when possible, for example `feat(auction): add bid placement`, `fix(product): upload images after draft create`, `docs(workflow): add git branch rules`, or `test(auction): cover settlement worker`.
- Never include secrets, `.env`, `node_modules`, build output, local database files, or runtime uploads such as `backend/static/avatars/*` and `backend/static/images/*` unless the file is an intentional tracked fixture.

Remote/PR rules:

- Push the feature branch after meaningful verified checkpoints or before ending a significant work session, unless the user asks to keep changes local.
- Do not merge to `master`/`main` without explicit user approval.
- Prefer PR review before merging non-lightweight changes.
- If the user says not to commit or not to push, obey that instruction and report the uncommitted diff plus recommended next git action.

## Phase 0: Preflight

Goal: establish repo truth before producing any plan or code.

Required actions:

1. Read the relevant requirements, project plan, existing Superpowers docs, and OpenSpec changes/specs.
2. Inspect the current implementation and tests related to the requested change.
3. Check whether OpenSpec tooling and Superpowers skills are available.
4. Identify unplanned or partial prior work before building on it.
5. Confirm the active branch/worktree is appropriate for the change and note any dirty or unrelated files.

Rules:

- Do not write business code in preflight.
- Do not assume older conversation context is authoritative when repo state differs.
- If tool support is missing, record the fallback path before continuing.

Important current note:

- Before the next feature development, review the recently added `bids` / `orders` related files and migrations. Either include them in a formal OpenSpec change or intentionally remove/rework them during that change. Do not continue building on them without this review.

## Phase 1: Superpowers Exploration

Goal: turn the request into an engineering-ready problem statement.

Use Superpowers-style exploration to define:

- goal and non-goals
- users and workflows
- user stories or scenarios
- acceptance criteria
- constraints and risks
- technical options and recommended direction

Output:

- Write or update `docs/superpowers/specs/YYYY-MM-DD-<change-id>-exploration.md`.
- This exploration document is the input to OpenSpec. It is not the final authority for implementation.

Rules:

- Prefer concrete scenarios over vague feature descriptions.
- Record rejected options when the tradeoff matters.
- Stop here if product intent is unclear and cannot be resolved from repo context.

## Phase 2: OpenSpec Lock

Goal: convert exploration into durable repo specification.

Create or update:

- `openspec/changes/<change-id>/proposal.md`
- `openspec/changes/<change-id>/design.md`
- `openspec/changes/<change-id>/tasks.md`
- `openspec/changes/<change-id>/specs/<capability>/spec.md`

Requirements:

- `proposal.md` states why the change exists.
- `design.md` states the chosen implementation approach and key tradeoffs.
- `tasks.md` is an implementation checklist, not a vague roadmap.
- Every task in `tasks.md` includes or points to a verification method.
- Spec deltas use OpenSpec-style requirements and scenarios.

Gate:

- Run `openspec validate <change-id> --strict` when the CLI is available.
- If the CLI is unavailable, manually review the same structure and state that validation was manual.
- Do not start implementation until this phase passes.

## Phase 3: Superpowers Execution

Goal: execute the locked OpenSpec change with disciplined implementation.

Required actions:

1. Generate or update `docs/superpowers/plans/YYYY-MM-DD-<change-id>.md` from OpenSpec `tasks.md`.
2. Before dispatching implementation subagents, classify task dependencies and write scopes.
3. Implement in small, verifiable steps.
4. Prefer TDD for service logic, state machines, bidding, wallet, and order behavior.
5. Use systematic debugging when a failure appears; do not guess-and-patch.
6. Keep OpenSpec `tasks.md` and the Superpowers execution plan synchronized.
7. Commit each verified slice according to the Git Branch and Commit Management rules.

### Subagent Scheduling

Default to parallel subagent execution when tasks are independent.

Before dispatching subagents, create a brief dependency map:

- task goal
- files or modules each task may write
- upstream inputs each task needs
- verification each task owns

Parallelize tasks when all of these are true:

- no task depends on another task's unmerged output
- write scopes are disjoint or clearly non-conflicting
- verification can run independently
- failures in one task do not invalidate the assumptions of the other task

Keep tasks sequential when any of these are true:

- two tasks edit the same file or shared state-heavy module
- one task defines contracts, types, migrations, routes, or schemas needed by another
- order matters for correctness, such as backend contract before frontend integration
- review findings from one task are likely to change another task's assumptions

For parallel work, each subagent must receive an explicit ownership boundary and must not revert unrelated edits. After parallel subagents finish, integrate and review in dependency order: spec compliance first, code quality second, then verification and commit.

Rules:

- OpenSpec is the product-change authority.
- Superpowers is the engineering execution discipline.
- If implementation reveals that the locked spec is wrong or incomplete, pause coding and return to Phase 2.
- Do not mark a task complete without evidence.

## Phase 4: Verification, Archive, Memory

Goal: prove completion and preserve knowledge.

Completion requires alignment across:

- code
- tests/build/checks
- OpenSpec change and spec deltas
- Superpowers execution plan
- project memory

Required actions:

1. Run the relevant tests/build/checks and record the exact commands and results.
2. Confirm implementation matches OpenSpec requirements and scenarios.
3. Confirm OpenSpec `tasks.md` and Superpowers plan checkboxes match reality.
4. Confirm the git branch contains only intended changes, with generated/runtime files excluded.
5. Push the branch and/or open a PR when requested or appropriate for handoff.
6. Archive the OpenSpec change after the change is accepted/merged, when appropriate.
7. Update project memory with current state, key decisions, known risks, and suggested next step.

Suggested memory locations:

- `projects/proj-1779447357476-ryiijf/memory/YYYY-MM-DD.md`
- `projects/proj-1779447357476-ryiijf/memory/long-term.md`

Rules:

- Green tests alone are not enough if specs, plans, or memory are stale.
- Do not claim completion when verification is partial or indirect.
- Final reports must mention skipped validation and why it was skipped.

## Fallback When Tools Are Missing

If Superpowers skills are unavailable:

- Still create the exploration and execution-plan documents under `docs/superpowers/`.
- Follow the same discipline manually: exploration, small steps, TDD where useful, systematic debugging, verification-before-completion.

If OpenSpec CLI is unavailable:

- Still create the `openspec/changes/<change-id>/` structure.
- Perform manual validation against this file's OpenSpec requirements.
- Record that CLI validation was unavailable.

If both are unavailable:

- Continue with the repository-local document structure and gates in this file.
- Do not use missing tools as permission to skip the integrated workflow.

## Agent Rules

- Never skip OpenSpec and directly implement a complex feature.
- Never write only OpenSpec without creating a Superpowers execution plan.
- Never treat old chat context as more authoritative than current repo state.
- Never silently build on partial or accidental work; identify it and decide how it belongs in the active change.
- Prefer repo-local patterns over new abstractions unless the OpenSpec design explicitly chooses otherwise.
- Keep edits scoped to the active OpenSpec change.
- Protect user work: do not revert unrelated changes unless explicitly requested.
- Do not leave significant verified implementation only in the local worktree without telling the user the commit/push state and recommended next git action.
- Do not commit unrelated runtime artifacts, generated uploads, secrets, or dependency folders.
- Do not merge or rewrite published history unless the user explicitly asks for that exact git operation.

## Source Notes

This project-local workflow is informed by:

- OpenSpec's model of repo-local specs and changes with proposal, design, tasks, and spec deltas.
- OpenSpec issue #780, which tracks interest in packaging OpenSpec as a Superpowers skill pack.
- `Te9ui1a/openspec-superpowers-skill`, which frames OpenSpec as the product-change record and Superpowers as engineering discipline.
- `SYZ-Coder/superpowers-openspec-team-skills`, which combines Superpowers exploration, OpenSpec specification, Superpowers execution, and final archive.

The repository does not require those external projects to be installed. This file is the local contract.
