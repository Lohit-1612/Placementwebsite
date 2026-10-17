# Architecture

Status: proposed; review pending. The audited repository contains no application architecture.

The requested target is a Next.js App Router frontend and a Java 21 Spring Boot modular monolith using PostgreSQL/Flyway, OIDC, Redis, and RabbitMQ. AI processing and untrusted program execution belong in separately isolated services. The API owns authorization, tenancy, scoring, and deadlines. Students must never access internal judge services or hidden test cases.

## Decision record 001 — Audit before foundation

On 2026-10-17, repository inspection found only the README, rather than the existing portal described in the specification. Preserve the README and add reviewable documentation on a feature branch. Defer framework selection, infrastructure, and application generation until the audit is reviewed. This avoids replacing source that may be provided separately. See `CODING_LAB_AUDIT.md` for evidence and the staged plan.

## Decision record 002 — Required stack and compatibility

The supplied specification is the target stack, not evidence of implemented services. No alternate Node/SQLite portal is part of this branch. Exact supported dependency versions must be selected, pinned, built, and tested together during the approved foundation stage; no versions are claimed verified here.
