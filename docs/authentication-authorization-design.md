# Authentication and Authorization Design — Phase 7

This phase prepares a local security boundary. No Cognito user pool, JWT verifier, IAM role, token, password, AWS credential, or deployed authentication service exists.

## Authentication versus authorization

Authentication answers “who is the caller?” Authorization answers “may that caller perform this action?” They are separate in the backend:

- `backend/src/auth/principal.js` extracts a principal only from a trusted API Gateway authorizer context and validates its shape.
- `backend/src/auth/authorization.js` evaluates action policies against the principal and report ownership.
- Request bodies, query parameters, arbitrary headers, and client-supplied `userId`/roles are never authentication sources.

The current default handlers remain in local demo mode so the existing frontend and regression tests continue to work. Secure-mode tests inject `enforceAuth: true` into handlers. Demo mode is not production-secure and must not be used as a deployed bypass.

## Principal representation

The local normalized principal is:

```json
{
  "userId": "student-1",
  "roles": ["STUDENT"],
  "claims": {}
}
```

Supported roles are intentionally limited to `STUDENT` and `ADMIN`. A missing authorizer context means anonymous access. Malformed trusted authorizer claims result in an authentication error. The local adapter recognizes an HTTP API JWT-authorizer shape at `requestContext.authorizer.jwt.claims.sub` and maps `cognito:groups` values to the supported roles, but it does not verify JWT signatures.

In a production Cognito integration, API Gateway or a backend verifier must cryptographically validate issuer, audience/client ID, signature, expiry, and token use before claims reach this boundary. The application must never decode an unsigned token and treat it as verified.

## Route access policy

| Route/action | Local demo mode | Secured-mode policy |
|---|---|---|
| `GET /reports` browse | Public | Public for approved listing data. |
| `POST /reports` create | Allowed for compatibility | Authenticated principal required; owner comes from principal, not body. |
| `GET /reports/{id}` read | Allowed for compatibility | Active reports may be public; restricted reports require owner or admin. |
| `PATCH /reports/{id}/status` | Allowed for compatibility with an authorization note | Owner or admin only, with valid transition and optional expected version. |
| `GET /reports/{id}/matches` | Allowed for compatibility | Active report suggestions may be public; restricted targets require owner or admin. |
| Future image upload/delete | Not exposed | Owner or admin only; server-generated object keys and validated storage requests. |
| Future admin actions | Not exposed | `ADMIN` role required. |

Denied requests receive generic errors. The implementation does not include owner IDs in denial messages. A production API may choose 404 for especially sensitive resources to reduce existence leakage; the current local contract uses 403 for a known unauthorized report and 401 when authentication is missing/invalid.

## Ownership rules

- Creation derives `userId` from the trusted principal in secure mode.
- A `userId` in a request body is rejected by backend validation.
- A query-string `userId` is not treated as proof of identity; authenticated user listing uses the authorizer principal instead.
- A student may update or manage images only for a report whose stored `userId` matches the principal.
- An administrator may perform authorized moderation actions across reports.
- Reports without an owner remain compatible with local demo mode but cannot satisfy owner-only production policies until ownership is established.

## Test identities

The test suite uses isolated fixture principals such as `student-1`, `student-2`, and `admin-1`. They are plain test data, not credentials, tokens, or production users. No passwords or tokens are stored in the repository.

## Future Cognito and IAM work

Later approved work must select the Cognito pool/client configuration, configure a verified API Gateway JWT authorizer or equivalent backend verification, map only approved claims, and define least-privilege Lambda/IAM permissions. IAM controls AWS resources; application authorization still needs explicit owner/admin policy checks. Neither is supplied by CORS.

## Remaining production security work

Authentication verification, refresh/session behavior, account recovery, role administration, rate limiting, audit logging, contact privacy, report visibility rules, and authorization tests against the real persistence layer remain unfinished. Local secure-mode tests demonstrate policy boundaries only; they do not prove a deployed identity system is secure.

