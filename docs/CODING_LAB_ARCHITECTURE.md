# Coding Lab architecture

Status: design proposal for review; not implemented.

## Question bank and workspace first

The Next.js frontend retrieves authorized published problem versions from the Spring Boot API. PostgreSQL stores problem/topic/language metadata and student drafts. Monaco edits complete stdin/stdout programs. Draft APIs scope all reads/writes to both authenticated student and authorized tenant. Public serializers include visible examples but exclude judge test data and unpublished content.

## Real execution in later stages

A run request executes visible cases through an isolated execution service and cannot award points. A submission transaction persists source/version/language/idempotency metadata and an outbox event. An outbox publisher sends durable RabbitMQ work; a separate worker communicates with the hardened judge, validates results, and records verdicts. Use bounded retries/dead-letter handling, explicit internal-failure states, and idempotent consumption.

A first accepted solve creates one unique student/problem solve record and an auditable ledger entry in a transaction. Repeated acceptance or duplicate worker delivery must not duplicate points. Never count internal judge errors as student failures. Leaderboards are derived projections with explicit tie-breaking and privacy rules.

Do not invent provider language IDs or claim Java 21 support until the configured judge confirms it. No service calls, UI components, queues, or scoring logic are implemented by these documents.
