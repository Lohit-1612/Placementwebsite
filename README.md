# PlacePrep AI

A working full-stack campus placement preparation application with a Next.js student portal, Java 21 / Spring Boot API, PostgreSQL persistence, Keycloak login, RabbitMQ submission processing, and a separate Docker-based local code judge.

This is a development release. The original repository contained only a README; the existing portal described in the supplied specification was not present. Implementation was authorized after the source audit. Production capacity and the entire version 2 roadmap are **not** claimed complete. See [phase progress](docs/PHASE_PROGRESS.md) for the precise boundary.

## Included workflows

- OIDC authorization-code login with PKCE, self-service local student registration, signed tenant claims, and backend role checks.
- Student profile and dashboard metrics derived from PostgreSQL records.
- Published coding problem search, difficulty/topic filters, pagination, split problem workspace, self-hosted Monaco, four language templates, persistent versioned drafts, and submission history.
- Real Java 21, Python 3, C++17, and JavaScript execution in disposable non-root containers with no host mounts or networking, plus resource limits.
- Durable submissions, transactional outbox, RabbitMQ processing, protected tests, unique accepted solves, points ledger, and college leaderboard.
- Timed aptitude/subject tests, answer saving, marked questions, reconnection recovery, server deadlines, idempotent finalization, and released explanations.
- Faculty resource links, completion tracking, announcements, coding-problem publishing, and assessment creation.
- College-admin drive creation, academic verification, eligibility checks, student registration, and recruitment stage updates.
- Consent-based resume-text and interview-answer analysis through a real AI provider adapter; saved reports can be viewed and deleted. A provider key/model is required; no reports are invented when unconfigured.

## Quick start

Requirements: Linux/macOS with Python 3.12+, Node.js 24, Java 21, and a working Docker Engine/Compose. The supervisor uses POSIX process groups. On Windows use WSL2. Allow several GB for language runtime images.

```sh
python3 scripts/setup.py
python3 scripts/dev.py
```

Setup generates `.env` with random local credentials, retains existing settings, prepares language images and an isolated judge key, installs dependencies, builds both applications, and starts supporting services. It never deletes volumes or resets a database. A task-owned JDK and Maven are cached under ignored `.tools/`; Maven's pinned SHA-512 is verified. Cloud proxy trust uses the host's existing Java trust store without disabling TLS verification.

The web service uses port 3000, API 8080, Keycloak 8081, AI adapter 8000, and private local judge 2358. Open the web service through your development environment's supported port forwarding. Click **Sign in → Register** to create a local student account. Local identity credentials are managed by Keycloak. Do not reuse the development realm in production.

The Keycloak administrator username and random password are in your ignored `.env`; use them locally at Keycloak to grant `FACULTY` or `ADMIN` realm roles to authorized accounts. Sign out and back in after role changes. There is no committed default account or password. `scripts/dev-account.py` creates disposable browser-test accounts only; it stores their generated credentials in ignored `.tools/local-accounts.json` and does not print them.

## Manual development

```sh
python3 scripts/init-dev.py
python3 scripts/enable-local-judge.py
docker compose up -d postgres keycloak rabbitmq redis
python3 scripts/with-env.py python3 scripts/mvn.py -B -f backend/pom.xml package -DskipTests
npm ci --prefix frontend
npm run build --prefix frontend
python3 -m venv .tools/ai-venv
.tools/ai-venv/bin/pip install -r ai-service/requirements.lock
python3 scripts/dev.py
```

The manual route assumes a complete Java 21 JDK and the four images listed in `judge-service/main.py` are installed. `scripts/setup.py` handles those steps automatically. For frontend hot reload run `npm run dev --prefix frontend` instead of the production frontend process; for API changes rebuild/restart the API. Do not run two servers on the same port.

## Tests

Create a dedicated test database once, without touching the application database:

```sh
docker compose exec -T postgres createdb -U placeprep placeprep_test
python3 scripts/with-env.py python3 scripts/mvn.py -B -f backend/pom.xml verify
.tools/ai-venv/bin/python -m unittest discover -s ai-service -v
# With scripts/dev.py running:
python3 -m unittest discover -s judge-service -v
python3 scripts/dev-account.py
cd frontend
npx playwright install chromium
npm run test:e2e
```

If Chromium is already installed, set `CHROMIUM_PATH` to its executable rather than downloading another browser. PostgreSQL tests use `placeprep_test`; never point `TEST_DATABASE_URL` at production. See [test evidence and limitations](docs/TESTING.md).

## AI configuration

Set `AI_PROVIDER_KEY` and a supported `AI_MODEL` securely in your local environment, then restart the AI service. The adapter currently calls the OpenAI Chat Completions API with JSON responses. The key never reaches the browser or repository. Resume input is text; PDF parsing/object-storage uploads and multi-turn AI interviews are future work. Do not include sensitive personal details. Provider retention policies apply separately from deletion of locally saved reports.

## Deployment and boundaries

[Deployment](docs/DEPLOYMENT.md), [security](docs/SECURITY.md), [API](docs/API_SPECIFICATION.md), [architecture](docs/ARCHITECTURE.md), [database](docs/DATABASE.md), and [Coding Lab design](docs/CODING_LAB_ARCHITECTURE.md) describe configuration and remaining work. Compose is for local development, not an internet-facing production deployment. Redis is provisioned but is not a source of correctness or currently used by application logic. A PostgreSQL tenant schema plus trusted identity-provider provisioning is required for additional colleges; a platform onboarding UI is not implemented.

No 2,000-user capacity claim is made. No live hosting deployment is included in a GitHub source upload.
