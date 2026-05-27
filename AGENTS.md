# AGENTS.md

This repository uses a combined Superpowers + OpenSpec workflow. Agents must treat this file as the first source of execution rules for all future work in this repo.

The workflow is not "use Superpowers sometimes and OpenSpec sometimes". It is a single pipeline:

`Superpowers exploration -> OpenSpec lock -> Superpowers execution -> OpenSpec verification/archive -> Superpowers memory`

## Required Context

Before planning or implementing any non-trivial change, read these files when present:

- `AGENTS.md`
- `projects/proj-1779447357476-ryiijf/outputs/requirements-v3.md`
- `projects/proj-1779447357476-ryiijf/project.md`
- `docs/superpowers/specs/`
- `docs/superpowers/plans/`
- `openspec/`

If `openspec/` or the OpenSpec CLI is missing, say so explicitly and follow the fallback rules in this file. Do not silently skip the spec discipline.

## Change Classes

Full integrated workflow is required for:

- behavior changes
- public API changes
- database/schema changes
- architecture changes
- concurrency, WebSocket, auction engine, payment/order, or wallet changes
- any feature that affects acceptance criteria in `requirements-v3.md`

Lightweight workflow is allowed only for:

- typo fixes
- formatting-only documentation edits
- comments that do not change behavior
- small README clarifications

Even lightweight work must state its verification method.

## Phase 0: Preflight

Goal: establish repo truth before producing any plan or code.

Required actions:

1. Read the relevant requirements, project plan, existing Superpowers docs, and OpenSpec changes/specs.
2. Inspect the current implementation and tests related to the requested change.
3. Check whether OpenSpec tooling and Superpowers skills are available.
4. Identify unplanned or partial prior work before building on it.

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
2. Implement in small, verifiable steps.
3. Prefer TDD for service logic, state machines, bidding, wallet, and order behavior.
4. Use systematic debugging when a failure appears; do not guess-and-patch.
5. Keep OpenSpec `tasks.md` and the Superpowers execution plan synchronized.

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
4. Archive the OpenSpec change after the change is accepted/merged, when appropriate.
5. Update project memory with current state, key decisions, known risks, and suggested next step.

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

## Source Notes

This project-local workflow is informed by:

- OpenSpec's model of repo-local specs and changes with proposal, design, tasks, and spec deltas.
- OpenSpec issue #780, which tracks interest in packaging OpenSpec as a Superpowers skill pack.
- `Te9ui1a/openspec-superpowers-skill`, which frames OpenSpec as the product-change record and Superpowers as engineering discipline.
- `SYZ-Coder/superpowers-openspec-team-skills`, which combines Superpowers exploration, OpenSpec specification, Superpowers execution, and final archive.

The repository does not require those external projects to be installed. This file is the local contract.
