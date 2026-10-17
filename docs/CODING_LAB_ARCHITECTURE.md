# Coding Lab implementation

`frontend/components/Portal.tsx` supplies the searchable, paginated question bank and history. `Workspace.tsx` provides problem/example panels, self-hosted Monaco, four language templates, draft save/restore with conflict detection, run/submit actions, polling, and history. `Coding.java` owns access and input validation. `Judge.java` owns outbox publishing, queue consumption, verdict mapping, and score updates.

## Execution lifecycle

1. Authenticated student submits a bounded complete stdin/stdout program and idempotency key.
2. API validates active tenant/problem/language and locks the student row to enforce execution rate limits.
3. Submission and outbox event persist in the same transaction.
4. Publisher locks pending events, sends to the durable RabbitMQ queue, waits for confirmation, then marks delivered. A crash can redeliver; consumption is idempotent.
5. Consumer locks the submission and calls the private judge for the visible sample, then protected cases for full submissions.
6. The judge starts a constrained non-root container, compiles if necessary, executes, compares trimmed output, and removes its container.
7. The API stores the authentic verdict. Runs expose visible sample diagnostics and award no points. Submissions expose no protected output.
8. An accepted full submission inserts a unique solve; only a newly inserted solve creates the auditable 10/20/30-point ledger reward.

Accepted, Wrong Answer, Time Limit Exceeded, Memory Limit Exceeded, Runtime Error, Compilation Error, Output Limit Exceeded, and Internal Judge Error are mapped. Internal errors award no points and are excluded from student-attempt activity projections. The UI polls queued/running submissions.

## Reliability limits

The local worker holds a database transaction while judging, and cases run serially. It is designed for local correctness testing, not the 2,000-exam-user target. Outbox and queue persistence plus transactional locks cover redelivery; internal provider failures are saved explicitly and can be resubmitted. Automated delayed retries and fleet orchestration are future work. Runtime displayed by the local judge includes compile/container overhead; per-submission runtime aggregation is not currently persisted by the consumer.

Problem versions are stored with submissions; published problems have no edit endpoint. Future problem edits must create immutable snapshots rather than changing the case set for an existing version. SQL problems and function-based harnesses are not implemented. The problem collection is small educational seed content, not a comprehensive company question bank.
