# Testing

## Audit-stage checks, 2026-10-17

- `git ls-tree -r HEAD`: one tracked file in the audited source commit, `README.md`.
- `git log --all --oneline`: initial commit at audit time.
- `git ls-remote --heads origin`: only remote `main`, matching audited commit `f847de43209d6355d093942a5d9df213f9297ee6`.
- Node/npm/Java version checks completed; Docker daemon answered its version query.
- Documentation review: all 11 requested Markdown documents present, no empty documents, local Markdown filename references resolve.
- `git diff --check` and staged diff whitespace check: passed.

These checks validate source inventory and documentation only. Application builds, automated application tests, UI checks, database migrations, OIDC, judge execution, tenant isolation, AI services, and load tests are **unrun**, because no implementation exists. No test counts, performance results, or application readiness claims are made.

## Required future validation

Foundation: frontend production build/typecheck; Maven build/tests; PostgreSQL Flyway migration integration; OIDC success/failure; tenant and role access denials.

Question bank/workspace: filters and pagination, unpublished access, problem detail secrecy, Monaco load, ownership and draft persistence/conflicts, mobile/keyboard navigation.

Judge: real Java sample outputs, hidden-case evaluation, correct verdicts, duplicate request handling, recoverable worker failure, isolation/resource limits, and one-time point awards under concurrent acceptance.

Run load tests at 500, 1,000, and 2,000 users against an explicitly documented environment and workload before reporting capacity. Record latency, errors, throughput, queue depth, and database utilization. Do not substitute a health check for these tests.
