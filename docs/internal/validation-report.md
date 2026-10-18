# Documentation validation

Validation date: 18 October 2026.

The Markdown source covers requirements, timestamped video design, customer/admin workflows, architecture, logical database design, API inventory, JSON configuration, operations, delivery acceptance, decisions, GitHub workflow and verified Neon setup. The editable specification is built from these twelve maintained sections and contains no embedded images.

Local checks verify Markdown file links, both JSON profiles against their schema, local OpenAPI schema references, operation IDs and path parameters. Configuration tests also check cross-field relationships and the public allowlist. Application build, Prisma validation, six configuration tests, live read-only PostgreSQL queries and one browser E2E test passed. See the setup report for sanitized command output and resolved setup errors.

The OpenAPI artifact is a critical-flow design contract rather than the full API implementation. The full logical Prisma commerce schema is not yet implemented; the current client supports connectivity checks without creating tables. No claim of release readiness or complete video-screen implementation is made.

The source video, extracted/cropped images, rendered page images, browser screenshots, generated client and local credentials are excluded from Git. GitHub CI validates the source without production database credentials. Remote workflow status is checked independently after pushing the feature branch.
