# API specification

No HTTP endpoints are implemented. The following is the proposed first Coding Lab contract, not a running API.

| Method | Path | Intended authorization / behavior |
| --- | --- | --- |
| GET | `/api/v1/me` | Authenticated identity and authorized college membership |
| GET | `/api/v1/coding/problems` | Published tenant-visible problems; bounded pagination, search, filters |
| GET | `/api/v1/coding/problems/{slug}` | Authorized published version; no protected test data |
| GET | `/api/v1/coding/languages` | Enabled, verified runtime versions and starter templates |
| GET | `/api/v1/coding/drafts/{problemId}` | Current student's own tenant-scoped draft |
| PUT | `/api/v1/coding/drafts/{problemId}` | Validated draft, source limit, optimistic conflict handling |
| POST | `/api/v1/coding/runs` | Rate-limited isolated execution of visible samples; no points |
| POST | `/api/v1/coding/submissions` | Idempotent durable submission and outbox event |
| GET | `/api/v1/coding/submissions/{id}` | Owner or explicitly authorized staff; public verdict only |
| GET | `/api/v1/coding/me/submissions` | Paginated current-student history |
| GET | `/api/v1/coding/me/progress` | Verified solved count, points, topics, and activity |

Derive active tenant from authenticated and authorized membership, never trust a caller-supplied tenant ID alone. Use standardized validation/errors and publish generated OpenAPI documentation during implementation. Staff publishing endpoints require a reviewed permission contract before introduction.
