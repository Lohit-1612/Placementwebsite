# Security

No application security controls have been implemented or tested. Repository Git read access is the only verified remote access operation in the audit.

Foundation requirements: supported OIDC integration, secure cookie/token lifecycle, explicit role permissions, backend membership checks, tenant-scoped queries, cross-tenant tests, validation, rate limits, audit events, and production TLS.

Judge requirements: separate non-root sandbox, disabled unneeded network access, CPU/memory/process/filesystem/output limits, protected test-case storage, authenticated internal traffic, idempotent jobs, and safe handling of internal errors. No code execution is allowed in the core API process.

Before production: dependency/security scanning, upload validation and retention, authorization review, backup/recovery testing, monitoring, and verified deployment configuration. These are requirements, not completed checks. Report vulnerabilities privately to the repository owner; do not include live secrets in issues or commits.
