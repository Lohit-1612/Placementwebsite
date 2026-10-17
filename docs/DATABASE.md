# Database

PostgreSQL 17 is the application database. Flyway runs migrations at API startup. Hibernate schema modification is disabled. No production data was reset.

## Migrations

- `V1__foundation.sql`: tenants, members, problems, protected judge cases, drafts, submissions, outbox, unique solved records, point ledger, assessments/questions/attempts/answers, resources/completion, drives/applications, announcements, AI reports, and audit events.
- `V2__learning_content.sql`: one local development college, four educational coding problems with public samples and protected cases, and three small practice assessments. No student performance, faculty content, or employer vacancy is seeded.

Primary identities use UUIDs. Tenant/member/problem relations use composite foreign keys where applicable. Student-owned queries always include tenant and owner. There is no RLS policy in this release; isolation is enforced in application authorization and scoped SQL with integration tests. Deployments requiring RLS must establish transaction-local tenant context and test pooled connections before enabling it.

## Concurrency and immutability

- Draft version comparison implements optimistic writes; conflicting tabs receive 409.
- Submissions have unique per-student idempotency keys.
- A database-backed per-student execution limit is checked under a member row lock.
- Outbox publishers lock pending events with `SKIP LOCKED`; consumers lock submissions.
- Unique tenant/student/problem solves and ledger entries prevent duplicate points.
- Assessments are immutable through the public API after publication. Attempts reference their assessment, save a server deadline, and lock before answering/finalizing. There is no faculty edit endpoint; future version editing requires immutable snapshots.
- An active-attempt partial unique index prevents parallel active attempts for the same student/assessment.

AI source text is forwarded transiently and is not stored by this application. Generated reports are stored and can be deleted by their owner; provider-side retention remains separate. Coding source/drafts and submissions persist until an operator-defined retention policy is implemented.

## Test and backup separation

Integration tests use the separate `placeprep_test` database and refuse mutation tests unless the database name ends in `_test`. Never reuse a production database for tests. Compose uses persistent volumes. No script invokes `down -v` or resets data. Production backup encryption, retention, point-in-time recovery, and restoration drills remain operator responsibilities and have not been validated.
