# DynamoDB Database Design

This is the final Phase 3 design proposal. It has been validated locally against the Phase 2 data service and mock records. No DynamoDB table, index, AWS SDK client, or AWS resource has been created.

## 1. Current application schema

The browser currently uses these fields:

| Field | Required locally | Type | Current use |
|---|---:|---|---|
| `id` | Yes | String | Stable sample ID or generated `local-<timestamp>` ID. Duplicate IDs are rejected. |
| `reportType` | Yes | String | `LOST` or `FOUND`. |
| `title` | Yes | String | Search/display text. |
| `description` | Yes | String | Search/matching/display text. |
| `category` | Yes | String | Controlled form value and matching input. |
| `location` | Yes | String | Display, filtering, and matching input. |
| `date` | Yes | String | `YYYY-MM-DD` event date. |
| `time` | No | String | Optional `HH:MM` event time. |
| `status` | Yes | String | `ACTIVE`, `MATCHED`, `RESOLVED`, or `CLOSED`. Legacy sample labels are normalized: `CLAIMED → RESOLVED`, `UNDER REVIEW → ACTIVE`. |
| `image` | No | String | Local visual/icon identifier such as `headphones` or `other`; not binary data. |
| `imageMetadata` | No | Object | Local preview metadata such as file name, MIME type, and byte size. |
| `contact` | No | String | Local demo contact note; not a secure user identity or authorization mechanism. |
| `userId` | No | String | Not currently collected by the frontend; reserved for authenticated integration. |
| `imageKey` | No | String | Not currently populated; reserved for a future private S3 object key. |
| `createdAt` | No | ISO timestamp | Not currently populated on creation; supported by validation for future integration. |
| `updatedAt` | No | ISO timestamp | Added by local status updates; supported for future integration. |

The Phase 2 data service is the single local persistence boundary. Page scripts do not write directly to `localStorage`. It validates required fields, optional DynamoDB-compatible fields, IDs, dates, timestamps, statuses, and image metadata.

## 2. Final table choice

Use one table named `FoundlyReports` for the MVP. A separate `Users` table is deferred because authentication has not been selected and the current application only needs a `userId` reference for ownership queries. Adding a user profile table now would create an entity and lifecycle that the MVP does not yet require.

This is a deliberately understandable design rather than a maximal single-table model. Each report is one item with a direct key, while three GSIs serve the actual browse, owner, and category access patterns. The trade-off is additional index write/storage overhead in exchange for simpler queries and easier explanation in an AWS Academy project.

## 3. Primary key and attributes

| Attribute | Type | Required | Proposed meaning |
|---|---|---:|---|
| `pk` | String | Yes | `REPORT#<reportId>` |
| `sk` | String | Yes | `REPORT` (reserved for future related records) |
| `reportId` | String | Yes | Stable application ID; unique through a conditional create. |
| `userId` | String | Future | Authenticated owner reference. Anonymous/local demo records may omit it. |
| `reportType` | String | Yes | `LOST` or `FOUND`. |
| `title` | String | Yes | Bounded display/search input. |
| `description` | String | Yes | Bounded display/matching input. |
| `category` | String | Yes | Controlled category value. |
| `location` | String | Yes | User-facing campus location text. |
| `locationNorm` | String | Future | Normalized location token used for bounded matching/index decisions. |
| `eventAt` | String | Yes | ISO-8601 timestamp composed from `date` and optional `time`. |
| `imageKey` | String | Optional | Private S3 object key, never a public URL. |
| `status` | String | Yes | `ACTIVE`, `MATCHED`, `RESOLVED`, or `CLOSED`. |
| `createdAt` | String | Yes in AWS | ISO-8601 creation timestamp. |
| `updatedAt` | String | Yes in AWS | ISO-8601 update timestamp. |
| `version` | Number | Yes in AWS | Optimistic concurrency counter. |
| `gsi1pk`, `gsi1sk` | String | Derived | Browse/status/type index keys. |
| `gsi2pk`, `gsi2sk` | String | Derived | Category/status index keys. |
| `gsi3pk`, `gsi3sk` | String | Derived | Owner/recent history index keys. |

### Example report item

```json
{
  "pk": "REPORT#lf-1001",
  "sk": "REPORT",
  "reportId": "lf-1001",
  "userId": "user-demo-001",
  "reportType": "LOST",
  "title": "Silver wireless headphones",
  "description": "Over-ear headphones with a navy fabric case.",
  "category": "Electronics",
  "location": "Central Library",
  "locationNorm": "central library",
  "eventAt": "2026-10-08T16:30:00Z",
  "status": "ACTIVE",
  "imageKey": "reports/user-demo-001/lf-1001/original.jpg",
  "createdAt": "2026-10-08T17:00:00Z",
  "updatedAt": "2026-10-08T17:00:00Z",
  "version": 1,
  "gsi1pk": "BROWSE#ACTIVE#LOST",
  "gsi1sk": "2026-10-08T16:30:00Z#2026-10-08T17:00:00Z#lf-1001",
  "gsi2pk": "CATEGORY#ELECTRONICS#ACTIVE",
  "gsi2sk": "2026-10-08T16:30:00Z#lf-1001",
  "gsi3pk": "USER#user-demo-001",
  "gsi3sk": "2026-10-08T17:00:00Z#lf-1001"
}
```

## 4. Index design

Only three GSIs are proposed:

| Index | Partition key | Sort key | Purpose | Why it is justified |
|---|---|---|---|---|
| `GSI1Browse` | `gsi1pk = BROWSE#<status>#<reportType>` | `gsi1sk = <eventAt>#<updatedAt>#<reportId>` | Active LOST/FOUND lists, status-specific lists, and recent reports by type. | Directly supports the main browse page without a table scan. |
| `GSI2Category` | `gsi2pk = CATEGORY#<category>#<status>` | `gsi2sk = <eventAt>#<reportId>` | Reports for a category and status. | Supports category-focused candidate retrieval and category browsing. |
| `GSI3Owner` | `gsi3pk = USER#<userId>` | `gsi3sk = <updatedAt>#<reportId>` | A user's report history, newest first. | Required for ownership/status tracking once authentication exists. |

Every GSI adds storage and write amplification. No separate location, keyword, or full-text index is proposed. Those fields are used in bounded application-level matching after a category/type candidate query. If measured usage does not require owner history or category browsing, those indexes should be deferred rather than provisioned automatically.

## 5. Access-pattern matrix

| # | Access pattern | Query | Key condition | Scan? | Notes/limitations |
|---:|---|---|---|---|---|
| 1 | Get report by ID | Base table `GetItem` | `pk = REPORT#<id> AND sk = REPORT` | No | One direct read. |
| 2 | Reports for a user | Query `GSI3Owner` | `gsi3pk = USER#<userId>` | No | Paginate; authorization still occurs in the backend. |
| 3 | Active LOST reports | Query `GSI1Browse` | `gsi1pk = BROWSE#ACTIVE#LOST` | No | Sort newest by descending `gsi1sk`. |
| 4 | Active FOUND reports | Query `GSI1Browse` | `gsi1pk = BROWSE#ACTIVE#FOUND` | No | Same bounded/paginated pattern. |
| 5 | Reports by category | Query `GSI2Category` | `gsi2pk = CATEGORY#<category>#<status>` | No | Query one or more status partitions if all statuses are required. |
| 6 | Recent reports | Query GSI1 partitions | Query `BROWSE#<status>#LOST` and `BROWSE#<status>#FOUND` with a `gsi1sk` time range | No | Merge two bounded result sets in application logic; define which statuses are included. |
| 7 | Reports by status | Query GSI1 | Query each needed `BROWSE#<status>#<type>` partition | No | A status-only view across both types requires two queries, not a scan. |
| 8 | Update status | Base table `UpdateItem` | `pk/sk` plus conditional expression | No | Check owner/admin authorization and expected version. |
| 9 | Matching candidates | GSI1/GSI2 queries | Opposite type plus active status; optionally category | No | Retrieve a bounded candidate set, then run the Phase 2 rule-based engine locally in application logic. |

DynamoDB does not provide arbitrary full-text search over title/description. Search text remains a future concern: for this MVP, the local engine can search a bounded result set; a larger product would need a deliberately selected search service or a maintained token/index strategy.

## 6. Query examples

These are illustrative SDK request shapes, not executable deployment code:

```text
GetItem: pk = REPORT#lf-1001, sk = REPORT
Query GSI1Browse: gsi1pk = BROWSE#ACTIVE#LOST, ScanIndexForward = false, Limit = 20
Query GSI2Category: gsi2pk = CATEGORY#ELECTRONICS#ACTIVE, ScanIndexForward = false, Limit = 20
Query GSI3Owner: gsi3pk = USER#user-demo-001, ScanIndexForward = false, Limit = 20
```

Use `LastEvaluatedKey` for pagination. Do not use `FilterExpression` as a substitute for a missing partition-key design when a query can be shaped more precisely.

## 7. Status updates and consistency

The allowed local status model is:

```text
ACTIVE → MATCHED | CLOSED
MATCHED → ACTIVE | RESOLVED | CLOSED
RESOLVED → RESOLVED | CLOSED
CLOSED → CLOSED
```

The local data service already enforces this lifecycle. A future DynamoDB update should use a conditional expression such as “update only where `version = expectedVersion` and `status = expectedStatus`”, increment `version`, and set `updatedAt`. This prevents a stale browser from overwriting a newer moderation decision. Report creation should use `attribute_not_exists(pk)` to reject duplicate IDs.

These are future backend controls; no DynamoDB conditional write is implemented in Phase 3. Client-side status controls remain a demonstration and do not provide authorization.

## 8. Image storage boundary

Do not store image bytes in DynamoDB. In a later AWS phase:

1. The backend validates MIME type, extension, size, ownership, and a safe generated object key.
2. The browser receives a short-lived presigned S3 upload URL.
3. S3 stores the object privately, for example under `reports/<userId>/<reportId>/<generated-name>`.
4. DynamoDB stores `imageKey`, not a public URL and never credentials.
5. Authorized reads receive a short-lived presigned download URL when needed.

The current frontend only stores local preview metadata and an icon identifier. No S3 bucket or upload path exists.

## 9. Matching integration

The shared engine accepts a report and a list of reports, excludes same-type/self/resolved/closed candidates, and scores category, keywords, location, date proximity, and description overlap. The backend queries active opposite-type candidates through GSI1, caps the result count, and passes them to the same deterministic engine. A high-confidence result with category plus non-title evidence is cleaned up by conditionally deleting both existing report items in one transaction. Lower-confidence results remain suggestions.

## 10. Cost and operational trade-offs

- One table avoids cross-table joins and keeps the student project understandable.
- Three GSIs are the minimum proposed set for owner history, category retrieval, and browse/status/type lists; each increases item storage and write cost.
- On-demand versus provisioned billing mode must be checked against current Learner Lab availability and usage; this design does not promise a particular cost or free-tier result.
- Bounded `Query` operations, pagination, small attributes, and S3 image storage reduce unnecessary reads and item size.
- Avoid scans during normal operation. A one-off local/admin diagnostic scan may be acceptable only with explicit limits and authorization.
- Monitor read/write usage, storage, logs, and index utilization after any approved deployment, and delete test resources and image objects afterward.

## 11. Limitations and future improvements

- Authentication and the source of `userId` are not selected.
- The design does not solve arbitrary full-text search, typo tolerance, or multilingual matching.
- Category and location values require normalization rules.
- Cross-type recent queries require merging bounded partitions.
- Moderation-specific states such as hidden or duplicate may need a separate moderation attribute or an expanded status policy later.
- Retention, deletion, audit history, and campus tenancy need decisions before real personal data is used.

