# Deployment

There is no deployable application in this audit-only branch. No public website, infrastructure, containers, or cloud release has been deployed.

After review, establish a development Compose stack with PostgreSQL, Redis, RabbitMQ, and an OIDC provider, then the Spring Boot API and Next.js frontend. Add separate judge infrastructure only after validating its sandbox and supported runtimes. Keep data, broker, identity administration, and judge interfaces off the public network. Configure secrets outside version control.

The current cloud task is already isolated. Reuse its existing checkout; do not create a Git worktree unless explicitly requested. Live services must be restarted in future tasks. There is no application install/start script to save during the audit stage.

Future CI must build frontend and backend, exercise migrations and isolation, and gate releases on tests. Publishing source to GitHub is separate from deploying a live website. Production capacity requires measured load tests and operational review.
