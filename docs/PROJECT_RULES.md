# Project rules

The user-supplied PlacePrep AI version 2.0 specification is the target. The original Stage 1 audit was followed by user-authorized implementation; current status is in `PHASE_PROGRESS.md`.

- Work incrementally on feature branches. Do not push directly to `main`.
- Review the Coding Lab audit before large architectural changes.
- Preserve recovered working interfaces, college branding, and production data.
- Use Next.js/React/TypeScript, Java 21/Spring Boot, PostgreSQL/Flyway, and the specified service boundaries after compatibility verification.
- Enforce permissions, ownership, tenancy, evaluation, and scoring on the backend.
- Never fabricate student scores, compiler verdicts, AI output, or test results.
- Never execute untrusted code in the core application process.
- Never commit credentials or expose hidden test cases.
- Test each stage, document exact outcomes, and identify unverified acceptance criteria.
- Treat 10,000 students per college and 2,000 concurrent exam users as unverified design targets.

## Post-review authorization

The user approved creating the full-stack project after the audit. Foundation and application implementation now proceeds on `feat/placeprep-fullstack`; the audit-stage pause has been satisfied. Current completion/limitations belong in `PHASE_PROGRESS.md`. Keep production capacity, operational deployment, and optional-provider validation separate from local feature evidence.
