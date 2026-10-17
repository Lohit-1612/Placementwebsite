# Development setup and deployment

## Verified local path

Run `python3 scripts/setup.py`, then `python3 scripts/dev.py` from the checkout. Setup preserves `.env`, installs frozen npm dependencies, prepares a task-owned verified Maven/JDK, installs pinned Python dependencies, builds frontend/backend, and starts persistent PostgreSQL/Keycloak/RabbitMQ/Redis. The supervisor starts the API, frontend, AI adapter, and local judge and checks API/web readiness. Ctrl+C stops only its child process groups; persistent infrastructure remains running.

Each cloud task already has an isolated checkout. Reuse it; do not create a worktree unless explicitly requested. Future tasks must restart processes; installed dependencies/volumes do not imply live readiness. Use the saved environment startup instructions.

## Configuration

See `.env.example`. `init-dev.py` generates secrets instead of committing default passwords. `enable-local-judge.py` configures the local service and IDs 1–4, preserving an existing key. It refuses to overwrite a configured external judge. Local credentials stay in `.env`; provider credentials belong in secure environment settings.

For AI, configure `AI_PROVIDER_KEY` and a JSON-response-compatible `AI_MODEL` and restart the AI adapter. No AI provider request has succeeded without those prerequisites. The API calls the private adapter; the browser never receives the key.

The local OIDC realm allows registration into the development college. Additional colleges require a new PostgreSQL tenant and identity-provider-controlled tenant binding; database `tenant_id` alone is insufficient. No public tenant onboarding UI exists yet.

## Containers

`compose.yml` runs infrastructure by default and has an optional `app` profile for the containerized frontend/backend/AI adapter. The default verified supervisor runs application processes on the host so the private local judge can launch disposable containers without mounting Docker into a web container. The optional all-container profile requires an external judge reachable from its backend, or `JUDGE_ENABLED=false`; never point a backend container at host loopback and expect the host judge to be reachable. Dockerfiles are supplied; full app-image build/run is separate from the tested host-process workflow.

The Next.js server proxies `/api` to `API_INTERNAL_URL`. The internal URL is read at runtime in the tested standalone server. `NEXT_PUBLIC_OIDC_URL` is a build-time browser setting. Rebuild when changing public identity configuration. Update Keycloak's exact redirect/web-origin settings for a different browser hostname.

## CI

GitHub Actions runs migrations/tests against a separate database, frontend build/audit, AI tests, real local execution tests, and browser tests using disposable accounts. The workflow is committed but a hosted GitHub Actions run has not been observed during local implementation.

## Production prerequisites

A production deployment is not performed by pushing source. Provision TLS reverse proxy, production identity provider and SMTP, managed PostgreSQL/backups, private broker/cache, dedicated isolated judge hosts, object storage if adding uploads, centralized monitoring/alerts, resource limits, disaster recovery, and staged security/load validation. Keycloak `start-dev`, the local tenant claim mapper, and loopback development defaults must be replaced.

Redis is provisioned but unused by current business logic. Prometheus/Grafana, WAF, object storage, automated cloud release, and backup restoration are pending. No 2,000-user capacity or public-hosting readiness claim is made.
