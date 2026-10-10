# DynamoDB Implementation Plan

This document records the local Phase 11D DynamoDB repository preparation. It contains no credentials, does not execute AWS operations, and does not authorize table creation or deployment. The repository remains opt-in; in-memory storage is still the default.

## Prerequisites to verify

- Confirm the Learner Lab region, DynamoDB availability, quotas, and allowed IAM actions.
- Confirm whether the lab permits the intended billing mode and GSI configuration.
- Select an authentication approach that supplies a trustworthy `userId`.
- Define report retention, image retention, moderation, and privacy rules.
- Keep the Phase 4 backend runtime as plain Node.js/CommonJS without putting credentials in the frontend; the local adapter uses the AWS SDK for JavaScript v3 only when DynamoDB mode is explicitly selected.

## Proposed table creation shape

The future backend would create `FoundlyReports` with:

- Partition key: `pk` (String)
- Sort key: `sk` (String)
- GSIs: `GSI1Browse`, `GSI2Category`, and `GSI3Owner`, each with String partition and sort keys as documented in [database-design.md](database-design.md).
- Billing mode: choose only after checking Learner Lab constraints and expected usage; do not assume on-demand or provisioned capacity is free.
- Encryption and point-in-time recovery: evaluate against lab permissions, cost, and the course demonstration need.

The implementation must use an idempotent, reviewable provisioning method in a later phase. This plan intentionally does not include a CloudFormation/CDK/Terraform template or a command that creates the table.

## Local-to-DynamoDB field mapping

| Local field | DynamoDB field | Mapping note |
|---|---|---|
| `id` | `reportId`, `pk`, `gsi*` components | Build `pk = REPORT#<id>` and derived index keys. |
| `reportType` | `reportType` | Preserve `LOST`/`FOUND`. |
| `title`, `description` | Same | Keep bounded and validate server-side. |
| `category` | `category`, `gsi2pk` | Normalize only for keys; retain display value. |
| `location` | `location`, optional `locationNorm` | Do not pretend this is full-text search. |
| `date`, `time` | `eventAt` | Compose an ISO-8601 event timestamp. |
| `status` | `status`, `gsi1pk/gsi2pk` | Update derived keys whenever status changes. |
| `userId` | `userId`, `gsi3pk` | Comes from authenticated backend context, not browser input. |
| `imageKey` | `imageKey` | Private S3 key only; image bytes stay in S3. |
| `createdAt`, `updatedAt` | Same | Backend-generated ISO timestamps. |
| — | `version` | Backend-managed optimistic concurrency counter. |
| — | `pk`, `sk`, `gsi1*`, `gsi2*`, `gsi3*` | Derived storage keys, never trusted from a client request. |

## Configuration names

Future backend configuration may use names such as:

```text
FOUNDDLY_REPORTS_TABLE=FoundlyReports
FOUNDDLY_AWS_REGION=<approved-region>
FOUNDDLY_IMAGES_BUCKET=<approved-private-bucket>
FOUNDDLY_IMAGE_PREFIX=reports/
FOUNDDLY_MATCH_THRESHOLD=42
```

These are names/placeholders only. Do not commit credentials, access keys, secret keys, session tokens, or a real bucket name to the repository.

## Local implementation status

- [x] The repository interface is shared by in-memory and DynamoDB implementations.
- [x] Conditional create, direct read, bounded GSI queries, status updates, optimistic version checks, and derived index-key mapping are implemented locally.
- [x] DynamoDB mode is selected only with `REPORT_REPOSITORY=dynamodb`, `AWS_REGION`, and `FOUNDLY_REPORTS_TABLE`.
- [x] Unit tests inject a fake DynamoDB client and require no credentials.
- [ ] Create or verify the actual table and GSIs in AWS; this remains outside Phase 11D.
- [ ] Verify live IAM, region, quota, budget, and Learner Lab permissions.

## Suggested implementation order

1. Keep the Phase 4 repository interface and in-memory contract tests passing.
2. Add request/response mapping and server-side validation tests using the local schema fixtures.
3. Prepare the reviewed table/index definition without applying it.
4. Verify Learner Lab permissions and cost controls with explicit approval.
5. Create the smallest approved table in a later phase.
6. Implement conditional create, read, query, update, and pagination operations behind the existing repository interface.
7. Connect API handlers only after repository tests pass against the approved repository.
8. Add image integration separately; do not mix binary upload work into report persistence.

## Local testing strategy

Before AWS integration, run:

```bash
node tests/phase2.test.js
node tests/phase3-schema.test.js
```

Use fake repositories or a local emulator only if it is already available and does not require AWS access. Contract tests should cover the access-pattern matrix, pagination, duplicate creation, optimistic concurrency conflicts, status transitions, malformed records, and index-key derivation. No local test should require credentials.

## Future AWS verification steps

Only after explicit approval:

1. Verify the account/region and allowed services.
2. Review the planned table name, keys, GSIs, billing mode, and retention with the course budget in mind.
3. Create the table through the approved reviewed mechanism.
4. Confirm table/index status and write a small fictional fixture set.
5. Exercise direct reads and each query access pattern with bounded limits.
6. Verify conditional duplicate/status writes and pagination.
7. Inspect usage, logs, quotas, and any available billing view.
8. Remove all test data and resources after the lab exercise if they are not explicitly needed.

## Cleanup and cost-control checklist

- Keep test data fictional and small.
- Avoid scans, unbounded queries, and oversized descriptions.
- Do not add indexes without a demonstrated access pattern.
- Review index write amplification before adding a GSI.
- Delete test tables and image objects only after resolving ownership and confirming the exact targets.
- Remove unused log groups, API stages, buckets, and other later-phase resources.
- Record what was created, when it was created, and how it will be removed.
- Never assume closing the lab session stops charges or deletes resources.

