# Security boundary and current limits

## Implemented and exercised

- OIDC PKCE, token signature/issuer/audience/time validation, in-memory browser tokens, stateless bearer API.
- Trusted tenant claim resolved against PostgreSQL; tenant/owner predicates and composite foreign keys.
- Backend staff/admin checks, student-only submission paths, immutable published assessments, and no client-modifiable verified CGPA.
- Parameterized SQL and validated bounded request fields.
- Per-student database-backed execution request limit (six/minute).
- Protected judge cases absent from student APIs; hidden-case output never returned by submission APIs.
- Idempotency, row locks, transactional outbox, publisher confirmations, and unique solve/ledger constraints.
- Consent for external AI processing; no original resume/interview text stored by the application; reports can be deleted.
- Random local credentials, ignored secret files, and no public default users/passwords.

## Local execution sandbox

The trusted private judge launches one disposable container per test case. Student containers have:

- UID/GID 65534, no extra capabilities, `no-new-privileges`, default Docker seccomp.
- No network, no host mounts, no Docker socket, read-only root filesystem.
- 512 MB memory/swap ceiling, one CPU share, 64-process limit, file-descriptor/file-size limits.
- Bounded 64 MB executable sandbox tmpfs and 32 MB non-executable temporary tmpfs.
- Two-second program wall deadline and 23-second infrastructure/compilation deadline.
- 32 KB combined captured output limit; returned sample diagnostics capped at 16 KB.
- Authenticated internal calls and two concurrent executions per local judge process.

Real tests verify non-root identity, blocked outbound connection, absent host checkout, supported compilation, and selected limits. They are **not** a penetration test or proof against kernel/container escapes. The judge control plane can access Docker and is therefore highly privileged even though student containers cannot. Run production judges on dedicated isolated hosts with reviewed kernel/runtime/seccomp controls; never mount a host Docker socket into an internet-facing web service. The local service binds only to loopback and is for development.

## Before production

Use TLS and production OIDC with approved origins, email verification/account recovery, trusted per-college membership provisioning, password/session policies, brute-force protections, and invitation/onboarding controls. The included realm binds registrations to a single local college for development. Do not allow users to edit security-sensitive tenant/role claims.

Additional work: end-to-end audit coverage, staff department scoping, recruiter permissions, comprehensive abuse limits/request-body ceilings, object-storage upload validation, retention/account deletion, AI prompt/provider review, operational secret management, dependency/container scanning, RLS if required, and security assessment. HOD/recruiter roles are recognized but have no dedicated management endpoints in this release. Broad platform administration is not implemented.

The AI service and infrastructure must remain private. Local Compose credentials and H2-backed Keycloak development mode are unsuitable for public hosting. Node and Java container images must be patched and revalidated before production. No compliance, security certification, or production-readiness claim is made.
