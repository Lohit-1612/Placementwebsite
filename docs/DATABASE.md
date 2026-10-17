# Database

No schema, database connection, migrations, or production data exists in the audited source. No database operations were performed.

Proposed initial Flyway migrations, subject to architecture review:

1. Tenant, identity membership, and role tables with UUID keys and tenant-aware constraints.
2. Coding problems, immutable published versions, topics, languages, visible examples, and separately protected judge cases.
3. Per-user/per-problem/per-language drafts with optimistic locking.
4. Submissions, outbox events, judge jobs/results, idempotency records, and audit events.
5. Unique solved-problem records and append-only points ledger.

Use tenant-scoped foreign keys and indexes; enforce tenant membership in every API operation. Test isolation with independent tenants. Add RLS where supported by a documented transaction/connection-pooling design. Never enable destructive automatic schema updates. No migration files are included in this audit-only change.
