# Local API Contract

These contracts describe the Lambda-compatible handlers prepared for Phase 5. They are locally tested interfaces for a future API Gateway HTTP API integration; they are not deployed endpoints. Phase 11C also exposes the same handlers through the local-only `backend/server.js` Node HTTP adapter, using isolated in-memory storage.

## Verified route table

| Method | Path | Handler | Local status |
|---|---|---|---|
| POST | `/reports` | `create-report` | Locally tested with JSON and base64-encoded API Gateway-style bodies. |
| GET | `/reports` | `list-reports` | Locally tested with filters, pagination, and errors. |
| GET | `/reports/{id}` | `get-report` | Locally tested with existing, missing, and invalid IDs. |
| PATCH | `/reports/{id}/status` | `update-report-status` | Locally tested with valid/invalid transitions and version conflicts. |
| GET | `/reports/{id}/matches` | `get-matches` | Locally tested with score/explanation results. |

The route table is a local contract verification result, not evidence of an API Gateway deployment.

## Route security policy

`GET /reports` is public for approved listing data. In a future secured deployment, `POST /reports` requires an authenticated principal; `GET /reports/{id}` and `GET /reports/{id}/matches` allow public access only for active public reports; and `PATCH /reports/{id}/status` requires the report owner or an administrator. The current default local handlers retain demo compatibility, while secure-mode tests enforce these policies. Client body/query/header identities are not trusted.

## API Gateway HTTP API event compatibility

The handlers accept representative HTTP API payload fields: `version`, `routeKey`, `rawPath`, `requestContext.http.method`, `httpMethod`, `pathParameters`, `queryStringParameters`, `headers`, `body`, and `isBase64Encoded`. The local harness invokes the actual handlers using this shape. `requestContext.authorizer.userId` is recognized only as a future trusted identity source; query-string or body `userId` values are not trusted.

The local tests simulate handler invocation directly. They do not open a network port, call API Gateway, invoke Lambda remotely, or prove that a deployed route has been configured.

## Common response shape

Success responses use:

```json
{
  "data": {}
}
```

Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A safe client-facing message.",
    "details": ["Optional validation detail."]
  }
}
```

Responses include JSON content type and CORS headers selected from the configured allowlist. A request with an unapproved `Origin` receives `Access-Control-Allow-Origin: null`; CORS is not authentication. Internal stack traces and diagnostics are never included.

## CORS strategy

For local testing, responses allow only `http://localhost:8000`, the documented static frontend origin. The allowed methods are `GET,POST,PATCH,OPTIONS`, and the allowed request headers are `Content-Type,Authorization`. `OPTIONS` returns a 204 response from each handler. A future deployed API must replace the local origin with an explicit approved frontend origin, keep the method/header list narrow, and review credential behavior. CORS is not authentication or authorization.

## Create report

`POST /reports`

Request body:

```json
{
  "reportType": "LOST",
  "title": "Black laptop",
  "description": "Black laptop with a silver sticker",
  "category": "Electronics",
  "location": "Central Library",
  "date": "2026-10-10",
  "time": "12:30",
  "contact": "Reply through the campus help desk"
}
```

`id`, `status`, `createdAt`, `updatedAt`, `eventAt`, `version`, authenticated `userId`, and `imageKey` are server-controlled. The local service rejects client-supplied storage keys and user IDs. In S3 mode, `POST /reports/{id}/image-upload` accepts only `contentType`, `size`, and `expectedVersion`, and returns a short-lived presigned PUT URL; `POST /reports/{id}/image-complete` accepts only `expectedVersion` and verifies the object before persisting its controlled reference. Image bytes never pass through DynamoDB.

After persistence, the service checks a bounded set of active opposite-type reports using the shared matching engine. A high-confidence result with category plus non-title evidence is atomically deleted with the newly created report in a conditional two-item transaction. The response reports that the pair was matched and removed; it does not return a persistent report copy. A title-only or otherwise uncertain result remains available for review.

## Get report

`GET /reports/{id}`

Returns 200 with one report, 400 for an invalid ID, or 404 when absent.

## List reports

`GET /reports?reportType=LOST&category=Electronics&location=Central%20Library&status=ACTIVE&limit=20&nextToken=...`

Supported filters are `reportType`, `category`, `location`, `status`, `limit`, and `nextToken`. The frontend's default browse request supplies `status=ACTIVE`; deleted matched reports are absent from every browse query and cannot be retrieved by ID. `limit` is 1–50. The local repository returns:

```json
{
  "data": {
    "items": [],
    "nextToken": null,
    "localRepositoryCount": 0
  }
}
```

The `localRepositoryCount` field is a local diagnostic and should not be exposed by a production API unless intentionally designed. A future DynamoDB implementation should use Query operations and `LastEvaluatedKey`, not offset tokens.

## List authenticated user's reports

`GET /reports?userId=ignored`

The local handler rejects this with 401 unless a future trusted authorizer context supplies `requestContext.authorizer.userId`. The query-string value is never treated as proof of ownership.

## Update report status

`PATCH /reports/{id}/status`

Request body:

```json
{
  "status": "MATCHED",
  "expectedVersion": 1
}
```

Only `status` and optional `expectedVersion` are accepted. Supported statuses are `ACTIVE`, `MATCHED`, `RESOLVED`, and `CLOSED`; an active report must transition through `MATCHED` before it can be resolved. A stale expected version returns 409 in the local repository. A future DynamoDB repository should enforce the same rule with a conditional expression.

The 200 response includes a local-mode authorization note. In secure mode, the handler checks the trusted principal and owner/admin policy before updating the report. A deployed identity provider and verified authorizer are still required; the note is not evidence of deployed authentication.

## Potential matches

`GET /reports/{id}/matches?threshold=42`

The handler retrieves up to 50 active, opposite-type candidates and returns the existing deterministic engine's scores and explanations:

```json
{
  "data": {
    "reportId": "report-example",
    "threshold": 42,
    "matches": [
      {
        "score": 83,
        "reasons": ["same category", "shared keywords: black, laptop", "related location: library", "within 1 day"],
        "sourceId": "report-example",
        "matchId": "report-found-example"
      }
    ]
  }
}
```

The engine excludes same-type, self, resolved, and closed comparisons. A confirmed match deletes both records; it does not leave a `MATCHED` copy available through the report API.

## Error status mapping

| Status | Codes | Meaning |
|---:|---|---|
| 200 | — | Successful read, list, match, or status update. |
| 201 | — | Report created. |
| 400 | `VALIDATION_ERROR`, `INVALID_TRANSITION`, `INVALID_NEXT_TOKEN` | Malformed or invalid request. |
| 401 | `AUTHENTICATION_REQUIRED` | Trusted identity is required but not implemented/present. |
| 404 | `NOT_FOUND` | Report does not exist. |
| 405 | `METHOD_NOT_ALLOWED` | Handler does not support the requested method. |
| 409 | `DUPLICATE_REPORT`, `VERSION_CONFLICT` | Duplicate ID or stale update. |
| 500 | `INTERNAL_ERROR` | Unexpected failure without implementation details. |

## Local integration test

From the repository root:

```bash
node --test backend/tests/api-gateway.integration.test.js
```

This test uses isolated in-memory data and exercises all five routes, malformed JSON, base64 request bodies, missing path parameters, pagination errors, unsupported methods, response headers, and CORS preflight handling.

