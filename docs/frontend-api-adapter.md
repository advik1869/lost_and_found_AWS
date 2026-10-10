# Frontend API adapter — Phase 11B

`frontend/assets/js/api.js` is an opt-in browser adapter for the routes already defined in [the API contract](api-contract.md). It is loaded by the existing static pages through the shared configuration script, but it makes no request while `LFConfig.mode` is `local-demo` (the default).

## Implemented adapter methods

| Method | Request | Successful response consumed |
| --- | --- | --- |
| `LFAPI.listReports(filters)` | `GET /reports` with `reportType`, `category`, `location`, `status`, `limit`, and `nextToken` query values | `{ data: { items, nextToken } }` |
| `LFAPI.getReport(id)` | `GET /reports/{id}` | `{ data: report }` |
| `LFAPI.createReport(report)` | `POST /reports` with JSON report fields | `{ data: { report } }` |
| `LFAPI.updateReportStatus(id, status, expectedVersion)` | `PATCH /reports/{id}/status` with `{ status, expectedVersion }` | `{ data: { report } }` |
| `LFAPI.getMatches(id, threshold)` | `GET /reports/{id}/matches?threshold=...` | `{ data: { matches } }` |

The adapter constructs URLs from the configured public HTTPS base URL, sends JSON bodies with `Content-Type: application/json`, parses JSON responses, and exposes safe errors for HTTP failures, invalid JSON, unavailable APIs, and unconfigured API mode. It does not embed credentials or add an Authorization token. Authentication and token acquisition remain pending until an approved authorizer flow exists.

## Local behavior and integration boundary

The existing local data service remains the default. Its asynchronous facade selects the adapter only when API mode is valid and configured; otherwise it resolves to the existing in-memory/localStorage behavior. Browse, report creation, item retrieval, and status updates use that facade without changing the local-demo path. Existing local matching remains available; the remote matches method is prepared for the documented endpoint.

The adapter does not invent claim, upload, authentication, image, or administration endpoints. Those operations remain pending because no corresponding backend contract is implemented in the current application. The API contract itself is locally tested and does not prove that an API Gateway endpoint exists.
