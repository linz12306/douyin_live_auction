# Superpowers Execution Plan: auction-engine-mvp

Source of truth: `openspec/changes/auction-engine-mvp/tasks.md`.

Current execution mode: remote GitHub connector edits only. Local clone and `go test ./...` are blocked by missing GitHub SSH/GH authentication on this machine.

- [x] Reconcile partial bids/orders work.
- [ ] Finalize schema and models.
  - Status: existing bids/orders migrations and models are incorporated; fresh DB verification pending.
- [ ] Add wallet transaction operations.
  - Status: first-pass freeze/unfreeze/deduct helpers added; tests pending.
- [ ] Add auction repository operations.
  - Status: first-pass bid/ranking/order/state helpers added; nullable auction scans fixed; tests pending.
- [ ] Implement bid service flow with lock + transaction.
  - Status: first-pass service added for validation, Redis bid lock, DB transaction, outbid unfreeze, soft close, ceiling settlement, and audit logs; TDD coverage pending.
- [ ] Implement state transitions and cancellation.
- [ ] Add HTTP handlers and routes.
  - Status: bid and rankings routes added; cancellation route pending.
- [ ] Run backend integration tests and `go test ./...`.
- [ ] Update OpenSpec tasks and project memory.

Next implementation slice:
1. Restore local repository access or provide a local checkout so tests can be written and run.
2. Add focused auction service/repository tests before expanding behavior further.
3. Implement activation/state transition and merchant cancellation through the same OpenSpec tasks.
