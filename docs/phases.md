# Development Roadmap

The original phase sequence is retained, with dependency notes to keep local validation ahead of AWS deployment. Each phase must be explicitly approved as work begins.

## Phase 0 — Project foundation and architecture

Complete requirements, architecture, data design, matching approach, security plan, cost plan, and roadmap. **Status: complete; documentation only.**

## Phase 1 — Frontend foundation

Create the static HTML/CSS/JavaScript/Bootstrap shell and accessible navigation using local placeholder content. No AWS deployment. **Status: complete; verified locally with static checks and a local HTTP server.**

## Phase 2 — Local application logic and mock data

Add local mock reports, client-side browsing/search/filtering, detail views, forms, validation, matching, and status displays. Keep data adapters replaceable. **Status: complete; verified locally with the built-in Node test suite and static frontend checks.**

## Phase 3 — DynamoDB design and local testing

Finalize access patterns and request/response contracts. Test the repository layer with mocks or a local emulator if available; do not assume the lab permits a particular emulator. **Status: complete; design and local schema validation only. No DynamoDB resources or AWS operations were used.**

## Phase 4 — Lambda backend

Implement and unit-test small backend handlers locally, including validation, ownership boundaries, status transitions, and repository behavior. **Status: complete; Lambda-compatible local foundation only. No AWS SDK calls, deployment, production repository integration, or image upload flow.**

## Phase 5 — API Gateway integration

Only after explicit approval and a Learner Lab availability check, expose the smallest approved API surface and test authentication, authorization, pagination, and error handling. **Status: complete; local API Gateway-style simulation only. No API Gateway, Lambda deployment, AWS credentials, or AWS resources were used.**

## Phase 6 — S3 image storage

Add a private image bucket/prefix, presigned upload/download flow, size/type limits, lifecycle rules, and cleanup procedures. Verify no public access. **Status: local implementation complete; S3 adapter and API routes are opt-in, but no bucket, IAM policy, or deployment was created.**

## Phase 7 — Authentication and authorization

Prepare a Cognito-compatible authentication boundary, owner/admin authorization policies, and local security tests. **Status: complete; local principal/policy preparation only. No Cognito, IAM, tokens, or AWS resources were used.**

## Phase 8 — Cloud deployment readiness and configuration preparation

Centralize local configuration, separate frontend environments, add safe operational logging, provide a local health check, and document deployment requirements without provisioning cloud services. **Status: complete; local readiness only.**

## Phase 9 — Full integration, regression, and security audit

Audit local contracts and end-to-end workflows, verify security boundaries and frontend/API compatibility, fix confirmed local defects, and document remaining deployment limitations. **Status: complete; local audit only.**

## Phase 10A — AWS infrastructure plan and preflight preparation

Map the local application to a minimal AWS architecture, document resource dependencies, prepare read-only session/region/permission checks, define deployment gates, and document budget/cleanup controls. **Status: complete; planning only. No AWS resources or credentials were used.**

## Phase 10B — Final AWS preflight verification and controlled deployment

Record actual read-only AWS verification results, confirm cleanup and the approved region/session/permissions/budget, then create only the explicitly approved minimum resources with independent verification and rollback. CloudFront remains optional; a local or simpler S3-hosting demonstration may be preferable if it is permitted and the public-access trade-off is accepted. **Status: supplied cleanup, policy-simulation, IAM restriction, regional opt-in, and session screenshot evidence reconciled; Learner Lab eligibility, live permissions, current budget, and Foundly preflight checks remain pending. No Foundly resources created.**

## Phase 11A — S3 frontend deployment preparation

Prepare the existing static frontend for a future S3 upload, document the public API configuration boundary, and record the reviewed upload sequence and S3 website limitations. **Status: local preparation complete; no S3 bucket was created, no files were uploaded, and cloud API integration is not implemented.**

## Phase 11B — Security hardening

Review IAM policies, authentication configuration, public access blocks, input validation, log redaction, retention, and secret handling. Run negative/authorization tests.

## Phase 11C — Local backend API

Expose the existing Lambda-compatible handlers through a local HTTP adapter, keep storage behind the repository interface, and verify the documented routes and safe error behavior. **Status: complete locally; the server uses isolated in-memory data and has no AWS, API Gateway, DynamoDB, authentication, or durable cloud integration.**

## Phase 11D — DynamoDB repository integration

Add an opt-in AWS SDK v3 repository behind the existing interface, map the planned report table/indexes, and test it with injected mocks. **Status: local implementation complete; in-memory storage remains the default, no table was created, and live AWS permissions/schema compatibility remain unverified.**

## Phase 11F — Lambda deployment package

Adapt API Gateway HTTP API v2 events to the existing backend handlers and prepare a dependency-inclusive Lambda ZIP command. **Status: local package preparation complete; no ZIP upload, Lambda function, API Gateway integration, or cloud deployment was performed.**

## Phase 12 — Monitoring, testing, and cost verification

Add bounded CloudWatch logging/metrics, run functional and failure tests, inspect usage and quotas, verify cleanup, and document any unavailable service or deviation.

## Phase 13 — Final documentation and demonstration

Update the architecture diagram to reflect what was actually implemented, distinguish planned/deferred/deployed components, document test evidence and cost observations, and prepare the course demonstration.

## Dependency changes recommended

The sequence is acceptable, but local mock behavior should remain ahead of every AWS integration. Authentication and API contracts should be decided before backend integration, and a Learner Lab service/permission check should occur immediately before Phases 5–9. SQS/SNS should remain a measured optional branch rather than a mandatory milestone.

