# Lambda Backend Foundation

This Phase 4/5 backend is a local, Lambda-compatible foundation. Phase 11C adds a small Node `http` server that adapts local HTTP requests to the same handlers; it has not been deployed, connected to AWS, connected to DynamoDB, or connected to a cloud API Gateway.

## Structure

```text
backend/
  src/
    handlers/
      _helpers.js
      create-report.js
      get-report.js
      list-reports.js
      update-report-status.js
      get-matches.js
    repositories/
      report-repository.js
      in-memory-report-repository.js
    services/
      report-service.js
      matching-service.js
    utils/
      response.js
      validation.js
    storage/
      image-storage.js
      local-image-storage.js
    auth/
      principal.js
      authorization.js
    config.js
    health.js
    logger.js
    runtime.js
  server.js
  tests/backend.test.js
```

## Separation of concerns

- **Handlers** translate API Gateway-style events into service calls and return `{ statusCode, headers, body }` responses.
- **Report service** owns report creation, server-controlled IDs/timestamps/status/version fields, status transitions, filtering rules, and match orchestration.
- **Repository interface** defines the future persistence boundary without AWS assumptions.
- **In-memory repository** is a temporary isolated test implementation. It clones data on read/write, rejects duplicate IDs, supports filters/pagination, and does not represent production persistence or DynamoDB performance.
- **Validation/response utilities** centralize request checks and HTTP-style response shapes.
- **Matching service** reuses the exact browser matching engine through a CommonJS-compatible export; there is no second scoring algorithm. On creation it queries a bounded active opposite-type set, applies a non-title evidence gate, and asks the repository to atomically link high-confidence matches.
- **Image storage** is an isolated interface plus an in-memory adapter. It validates bytes and metadata locally but has no AWS implementation.
- **Authentication/authorization** normalizes trusted authorizer claims and evaluates owner/admin policies separately. Secure mode is available for local tests; demo mode remains for frontend compatibility.

## Handlers

| Handler | Method | Responsibility |
|---|---|---|
| `create-report` | POST | Parse JSON, validate allowed input, assign ID/timestamps/status/version, and create through the repository. |
| `get-report` | GET | Validate an ID and return one report or 404. |
| `list-reports` | GET | Apply documented filters, bounded pagination, and optional authenticated user listing. |
| `update-report-status` | PATCH/PUT | Accept only `status` and optional `expectedVersion`; enforce the status lifecycle. |
| `get-matches` | GET | Retrieve the target, get bounded opposite-type active candidates, and reuse the deterministic matcher. |

All handlers include local CORS headers, but CORS is not an authentication or authorization control.

## API Gateway preparation

The handlers accept both the REST-style `httpMethod` field and the HTTP API v2 `requestContext.http.method` field. JSON and base64-encoded bodies are supported. A local integration suite simulates route events for all five documented routes and verifies CORS preflight behavior. This simulation does not create a network server or prove deployed API Gateway configuration.

## Local HTTP server

Run the local API from the repository root with:

```bash
node backend/server.js
```

It listens on `http://127.0.0.1:3000` by default. Set `PORT` or `HOST` only for local development. The server routes the five documented paths to the existing handlers, keeps records in an isolated in-memory repository for the process lifetime, and returns safe JSON errors for unknown routes, invalid input, unsupported methods, and oversized request bodies. Restarting the process clears local API records; it does not modify frontend sample data or browser `localStorage`.

This server is a local adapter for development and integration tests. It is not a production server, does not provide TLS, authentication, durable persistence, or AWS connectivity, and does not replace API Gateway or Lambda.

## Security boundary

The local backend contains a prepared authentication/authorization boundary. Secure-mode handlers require a principal from a trusted authorizer context, reject client-supplied ownership, and enforce owner/admin policies. Default demo-mode handlers remain available for local frontend compatibility and are not production-secure. JWT signature and issuer/audience verification must be supplied by a deployed API Gateway authorizer or approved verifier before claims reach this boundary.

The local runtime also validates configuration at startup, applies an explicit CORS allowlist, emits redacted structured diagnostics, and returns safe JSON errors without stack traces. These local controls do not prove a deployed API Gateway, identity provider, or persistence layer is correctly configured.

## DynamoDB repository (opt-in, not deployed)

`dynamodb-report-repository.js` implements the same repository methods as the in-memory repository using the AWS SDK for JavaScript v3. It maps reports to `FoundlyReports` items with `pk`/`sk` and the planned `GSI1Browse`, `GSI2Category`, and `GSI3Owner` derived keys. Create uses a conditional put; status updates use optimistic version conditions and refresh derived index keys. Automatic matching uses a conditional two-item delete transaction with expected versions, so no matched copy or additional index is retained.

DynamoDB mode is explicit and never the local default:

```text
REPORT_REPOSITORY=dynamodb
AWS_REGION=<approved-region>
FOUNDLY_REPORTS_TABLE=<approved-table-name>
```

The AWS SDK is loaded only when DynamoDB mode is selected. Credentials are not read from project files or embedded in code; the SDK uses the approved runtime credential chain. Tests inject a fake client and do not require credentials. A missing table, unavailable SDK, or service error becomes a safe repository failure for the existing 500 response path.

The repository uses bounded GSI queries rather than scans. Broad list requests query the relevant status/type partitions and merge the bounded results locally; category and location filters are applied after the query. Automatic matching uses a conditional two-item delete transaction; successful deletion removes both records from all indexes automatically. This is suitable for the local integration boundary but should be reviewed against expected data volume before production use. DynamoDB pagination uses an opaque local offset token over the merged result set and is not a substitute for a production LastEvaluatedKey design.

