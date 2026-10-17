# PlacePrep AI architecture

## Implemented development architecture

```text
Next.js 16 / React 19 / TypeScript / Tailwind
              | same-origin /api proxy; OIDC PKCE
              v
Java 21 / Spring Boot 3.5.16 modular API <---- Keycloak signed JWTs
              |
     +--------+-----------+-------------------+
     |                    |                   |
PostgreSQL 17        RabbitMQ 4           FastAPI AI adapter
Flyway migrations    durable queue         (provider key required)
     |                    |
transactional outbox ---> judge consumer ---> private local judge
                                               |
                                      disposable Docker sandbox
```

PostgreSQL is the authority for identity membership projections, tenant data, draft conflicts, assessment deadlines, verdicts, unique solves, ledger entries, and eligibility. Redis is provisioned for future caching/rate-limiting work but is not currently used. Prometheus/Grafana deployment and object storage are not implemented.

## Source audit and implementation decision

The audited original commit contained only a README; no portal was replaced. After audit review the user authorized creating the full-stack project. The original audit remains a historical record; `PHASE_PROGRESS.md` describes the current implementation.

## Decisions

1. **Next.js App Router and Spring Boot modular monolith.** One catch-all App Router entry dispatches client workspace pages without duplicate route trees. Portal, identity, coding, assessment, AI, and judge modules share a core API initially.
2. **Explicit tenant-scoped SQL.** Spring Data JPA is available, but current projections and transactional operations use `JdbcTemplate` to keep tenant predicates and concurrency controls explicit. This is a conscious first-release implementation choice. ORM-generated schema updates are disabled; Flyway owns schema.
3. **OIDC resource server.** The API verifies issuer, audience, signature, and token times. College membership comes from a trusted token claim and must resolve to an onboarded tenant. Roles come from trusted realm roles. The frontend keeps tokens in memory and uses PKCE; it never accesses the database or judge.
4. **Local judge rather than fabricated compiler results.** The trusted Python control plane launches containerized programs. It is authenticated and loopback-bound. No student code runs inside the API or worker JVM. A production deployment must move the execution service and Docker daemon to dedicated hosts and review sandbox hardening.
5. **Outbox and transactional scoring.** Publisher confirmations precede marking outbox events delivered. Redelivery is safe through verdict locks and unique solve/ledger constraints. Executions run synchronously per test case within the worker's submission transaction; this is simple and tested locally, but long transactions must be redesigned before high-volume deployment.
6. **Honest AI boundaries.** A real provider adapter handles text feedback. Missing credentials return 503. PDF/object-storage processing and multi-turn interviews are not presented as implemented.
7. **Educational metrics.** No fictional student records, hiring probability, or unsupported readiness score is shown. Readiness weights require a future reviewed configuration.

Dependency versions are pinned in manifests/lockfiles and runtime image tags. Tested versions and limits are in `TESTING.md` and `SECURITY.md`.
