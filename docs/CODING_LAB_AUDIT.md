# PlacePrep AI — Coding Lab audit

Date: 2026-10-17
Repository: `Lohit-1612/Placementwebsite`
Audited source commit: `f847de43209d6355d093942a5d9df213f9297ee6`
Status: **Stage 1 audit complete; architecture review pending. No application implemented.**

## Evidence and scope

The selected checkout's HEAD matches remote `refs/heads/main`. `git ls-tree -r HEAD` contains exactly one tracked file, `README.md`, whose complete content is `# Placementwebsite`. `git log --all --oneline` shows the initial commit. `git ls-remote --heads origin` reported only `main` during this audit.

The supplied version 2.0 specification describes an existing student portal. That implementation is not present in this repository's audited commit. This is a source-availability gap, not evidence that an application elsewhere does not exist. No existing pages were replaced. No database was reset. A preliminary, uncommitted portal scaffold created before receipt of the specification was moved outside the checkout and is not part of this branch or the proposed implementation.

## Coding Lab inventory

| Area | Observed repository state | Consequence |
| --- | --- | --- |
| `/coding` route and components | Absent | Cannot audit or preserve an existing UI without its source |
| Dashboard and other portal pages | Absent | Existing blue-and-white design cannot be inspected |
| Question bank and starter programs | Absent | No existing problems or correctness fixtures to validate |
| Database and migrations | Absent | PostgreSQL integration is not established |
| Compiler / judge | Absent | No execution integration or sandbox to test |
| Authentication and roles | Absent | No secure student workflow or tenant membership established |
| Scoring / leaderboard | Absent | No implemented rewards or verified progress |
| Hardcoded scores and API responses | No application source | No implementation to classify or replace |
| Tests and CI | Absent | No application checks available to execute |
| Manifests and version pins | Absent | Framework compatibility remains to be selected and verified |

## Cloud machine observations

- Node.js `v24.19.0`, npm `11.9.0`.
- Java `21.0.12.1`.
- Docker client and responding daemon `28.4.0`.
- `mvn` and `psql` not found on PATH; no installation attempted during this review-only stage.
- Native Git remote read succeeded. This does not prove API or deployment access.
- No application server was started; there is no runnable source.
- No database, identity provider, broker, judge, or AI connection was verified.

## Proposed incremental implementation

1. **Review this audit.** Confirm whether the existing portal should be supplied from another repository/archive, or approve a new foundation in this repository. Do not overwrite an existing implementation supplied later.
2. **Foundation and identity prerequisite.** Pin compatible Next.js/React/TypeScript and Spring Boot/Java 21 versions after compatibility checks. Establish Maven wrapper, PostgreSQL/Flyway, local Compose services, OIDC login, tenant membership authorization, and CI. Validate migrations, authenticated API connectivity, and cross-tenant denials before building student-owned features.
3. **Stage 2: question bank.** Persist tenant-scoped published problem versions, topics, difficulty, languages, and visible examples. Add server-side search, filters, bounded pagination, and authorized publishing. Build question-bank UI using existing components if recovered.
4. **Stage 3: solving workspace.** Add problem detail, Monaco, language templates, stdin/stdout instructions, and user-owned persistent drafts. Provide responsive panels and honest execution-unavailable states until a real judge is integrated.
5. **Stages 4–5: execution and submissions.** Integrate a hardened, separate Judge0-compatible service. Verify Java 21 support rather than assuming language IDs. Add bounded run requests, durable submissions, idempotency, transactional outbox, RabbitMQ workers, protected tests, retries, and authentic verdicts. Never run student programs inside the API process.
6. **Stage 6: verified progress.** Award first-accepted-solve points transactionally with uniqueness constraints and an auditable ledger. Derive metrics and rankings from verified results.
7. **Stage 7: hardening.** Exercise tenant isolation, ownership, hidden-case secrecy, judge failures, resource limits, and load workloads. Record measured results before making capacity claims.

## Review decisions

- Is the existing portal source available elsewhere, or should this README-only repository receive the foundation?
- Approve the foundation prerequisite and Stage 2–3 plan before architectural implementation.
- Before execution integration, select the isolated judge hosting model and confirm its supported language versions.

Identity-provider, judge, storage, and AI configuration will be assessed at their respective stages. Do not submit credential values in chat or commit them to Git.

## Validation outcome

Repository, commit, remote branch, and toolchain inspection completed. Documentation consistency checks are recorded in `TESTING.md`. No frontend/backend builds, unit/integration/end-to-end tests, compiler tests, or load tests ran because their implementation does not exist. None of the Coding Lab completion criteria is currently satisfied by this repository.

## Local commands

At this stage only inspection is available:

```sh
cd /workspace/Placementwebsite
git ls-tree -r --name-only f847de43209d6355d093942a5d9df213f9297ee6
git log --all --oneline
git ls-remote --heads origin
```

There is no supported application startup command yet. Next action: review this audit and supply the existing source or approve the proposed foundation.
