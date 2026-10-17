# Validation evidence

These results were obtained on the current cloud machine, not inferred from generated code. GitHub-hosted CI execution and fresh-task restoration are separate and have not been observed.

## Completed checks

| Check | Actual outcome |
| --- | --- |
| Spring Boot Maven verify | 15 tests passed, 0 failures/errors/skips; executable JAR built |
| API/PostgreSQL integration suite | 12 tests; actual PostgreSQL 17 and Flyway; mock signed-user principals isolate API authorization tests from the IdP |
| Judge protocol integration suite | 3 tests; explicitly simulated provider response tests ledger uniqueness, no run rewards, and internal-error classification; not compiler validation |
| Real isolated execution suite | 9 tests passed against actual Docker containers |
| AI adapter suite | 3 tests passed: missing-provider behavior, payload limits, unsupported operation |
| Next.js production build | Successful compilation, TypeScript, and production output |
| TypeScript standalone check | Passed |
| Browser workflows | 5 scenarios passed with actual Keycloak, API, PostgreSQL, RabbitMQ, Monaco, and local judge |
| Frontend production dependency audit | `npm audit --omit=dev --audit-level=low`: zero vulnerabilities at check time |
| Python syntax | All scripts, AI, and judge source compiled |

## Real execution coverage

The nine tests compile/execute Java 21, C++17, Python 3, and JavaScript. They check real acceptance/output, wrong answer, compilation error, runtime error, timeout, output limit, and sandbox UID/network/host-mount boundaries. These are program executions, not generated sample verdicts. Runtime images are pinned in `judge-service/main.py`. Memory-limit mapping exists, but a deterministic OOM test has not been run.

## Backend coverage

Authenticated requests are required. Tests check tenant isolation, missing membership claims, unpublished bank access boundaries, search/pagination validation, hidden-case serialization, draft persistence/owner isolation/conflicts, disabled-judge behavior, student staff-access denial, resource publication/completion, attempt ownership/durable answers/answer secrecy/idempotent submission/deadline enforcement, unverified versus verified drive eligibility, duplicate registrations, and AI consent/unavailability.

The real browser login separately verifies the Keycloak-to-JWT-to-API path; mock JWT authorization tests alone do not establish OIDC functionality.

## Browser coverage

- Desktop/mobile landing and navigation with no horizontal overflow at 390 px.
- Real PKCE login, question search, Monaco loading, Java draft save/restore, queued sample run and protected-case submission with accepted verdict, and profile persistence.
- Answer persistence after reload and final server-side scoring/explanations.
- Faculty publishes a persistent resource and marks completion.
- Admin academic verification, drive publishing, student eligibility/registration, and recruitment stage update: passed.

Screenshots were inspected locally. They are not proof of deployment or a full accessibility audit. A first browser run exposed a selector ambiguity with Monaco live regions and asynchronous controlled-radio timing; tests were refined and UI selection feedback was made optimistic with rollback on save failure. A repeat run handled already persisted answers rather than requiring fresh state.

## Environment corrections

The initial Java runtime lacked `ct.sym`; a complete pinned JDK was extracted from its official Docker image. The cloud TLS trust store was retained for Maven HTTPS verification. Keycloak's new H2 volume needed ownership initialization; Compose now contains an explicit one-shot initializer. The judge's original file-size limit was too small for C++ output and its overflow cleanup needed pipe draining; both were corrected before all nine real tests passed.

## Unrun / external prerequisites

- Successful real AI-provider analysis needs `AI_PROVIDER_KEY` and `AI_MODEL`. Missing-provider behavior is tested; live AI quality/success is not.
- No production security review, kernel escape testing, load/capacity tests, backup restoration, production container image rollout, or cloud release has run.
- No claim of supporting 2,000 simultaneous examinations is made.
- CI is defined in `.github/workflows/ci.yml`; hosted results are not claimed.

Run commands are in the root README. Integration mutation tests refuse databases whose name does not end in `_test`. Never use production data for validation.

## Reusable command validation

`python3 scripts/setup.py` completed successfully with existing credentials and volumes preserved. `python3 scripts/dev.py` passed API/web readiness checks, stopped its own children cleanly, and restarted successfully. The five-scenario browser suite passed after this supervisor restart and the runtime API-proxy implementation. No new-task snapshot restoration is claimed.

## Final framework patch check

Spring Boot was upgraded to the latest available 3.5 patch, `3.5.16`. All 15 backend tests and the executable JAR build passed again. The frontend production build also passed after the runtime proxy and formatting changes.

The final five-scenario browser rerun passed on Spring Boot 3.5.16 and the current Next.js production build. The documented Maven command also passed all 15 tests without a manual `JAVA_HOME` override after the launcher learned to activate the installed task-owned JDK. Distinct automated tests total 32: 15 backend, 9 real sandbox execution, 3 AI-adapter, and 5 browser scenarios. This total does not imply a live AI-provider success or production load validation.
