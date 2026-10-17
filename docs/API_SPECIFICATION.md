# Implemented API

Base: `/api/v1`. All application endpoints require a signed bearer token with the expected issuer and `placeprep-api` audience, onboarded `tenant_id`, and authorized role/ownership. Interactive OpenAPI is available at `/swagger-ui/index.html`; the JSON schema is `/v3/api-docs`. Public schemas do not reveal database test-case contents.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/me`, `/me/profile` | Current college profile |
| PUT | `/me/profile` | Update own non-verified profile fields |
| GET | `/me/dashboard` | Database-derived metrics, activity, and basic learning tasks |
| GET | `/me/notifications` | College announcements |
| POST | `/notifications` | Faculty/admin publishes an announcement |
| GET | `/coding/problems` | Published tenant bank; `q`, `difficulty`, `topic`, `page`, `size` (1–100) |
| GET | `/coding/problems/{slug}` | Public statement, examples, formats, constraints; no hidden cases |
| POST | `/coding/problems` | Staff creates unpublished problem |
| POST | `/coding/problems/{id}/publish` | Staff supplies protected cases and publishes once |
| GET | `/coding/languages` | Four configured language options and execution availability |
| GET, PUT | `/coding/drafts/{problemId}` | Owner's language draft; PUT includes version |
| POST | `/coding/runs`, `/coding/submissions` | Complete program, language, problem UUID; required `Idempotency-Key`; returns queued ID |
| GET | `/coding/submissions/{id}` | Owner's public verdict/output |
| GET | `/coding/me/submissions`, `/coding/me/progress` | Owner history and verified progress |
| GET | `/assessments` | Published college practice assessments |
| POST | `/assessments` | Staff publishes immutable questions and answer keys |
| POST | `/assessments/{id}/attempts` | Start or resume own active attempt |
| GET | `/attempts/{id}` | Questions, saved responses, deadline, server time; no answer key |
| PUT | `/attempts/{id}/answers/{questionId}` | Idempotent choice/mark save; rejects expired/final attempts |
| POST | `/attempts/{id}/submit` | Idempotent server evaluation |
| GET | `/attempts/{id}/result` | Owner's finalized score/explanations; expires/finalizes overdue attempts on access |
| GET, POST | `/materials` | College resources; staff-only creation |
| PUT | `/materials/{id}/progress` | Own completion flag |
| GET | `/leaderboard` | College first-name rankings from verified ledger |
| GET, POST | `/placement-drives` | College drives; admin-only creation |
| GET | `/placement-drives/{id}/eligibility` | Eligible / Not Eligible / Verification Required, with reason |
| POST | `/placement-drives/{id}/applications` | Verified eligible student registration |
| GET | `/admin/students`, `/admin/applications` | College-admin review |
| PUT | `/admin/students/{id}/academic` | Admin verification of CGPA |
| PATCH | `/admin/applications/{id}` | Admin recruitment stage update |
| POST | `/ai/resume/analyze`, `/ai/interviews/evaluate` | Consented text analysis; requires configured provider |
| GET | `/ai/reports` | Owner's saved reports |
| DELETE | `/ai/reports/{id}` | Delete own report |

Validation/business errors use an `error` message. Standard resource-server 401/403 responses follow Spring Security behavior. Broad lists use conservative result caps; full pagination beyond the coding bank is future work. Missing judge/provider returns 503 instead of a fake result. The local judge has its own authenticated private protocol and must not be exposed to the browser.
