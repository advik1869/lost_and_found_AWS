# Security Plan

Controls in this document are planned controls, not implemented controls. The project must re-check them during each implementation and deployment phase.

## Identity and authorization

- Select an approved authentication approach before implementing protected endpoints. Do not treat a client-side user ID as proof of identity.
- Require authentication for create, edit, image upload, status ownership, and administrative operations.
- Authorize every report read/update against the caller's role and the report's visibility.
- Represent administrator access as a small, explicit role or group. Do not give the frontend AWS credentials or broad IAM permissions.
- Keep deployment permissions separate from runtime Lambda permissions.

## IAM and service permissions

Planned runtime permissions are narrow: API Lambdas can read/write only the required DynamoDB table and create limited presigned S3 operations for validated object-key prefixes. A worker, if added, can consume only its SQS queue, write matcher results, and publish only to the intended notification topic. CloudWatch permissions should be limited to log streams. Human lab permissions remain governed by Learner Lab and must not be bypassed.

## Input and API controls

- Validate request size, required fields, enum values, timestamps, image type, and image size server-side.
- Use parameterized SDK operations and avoid constructing unsafe expressions from user input.
- Apply pagination and bounded limits to list endpoints.
- Return generic authentication/authorization errors where detailed responses could reveal private data.
- Add throttling and abuse controls appropriate to the selected API/authentication service.

## S3 and images

- Keep image buckets private; block public access.
- Use short-lived presigned URLs and user-scoped object keys.
- Allow only approved content types and size limits; do not trust a filename or browser MIME type alone.
- Store object keys, not permanent public URLs, in DynamoDB.
- Consider content review and deletion/retention rules before production use.

## Data protection

- Use HTTPS/TLS for browser-to-service traffic.
- Use S3 and DynamoDB encryption at rest. Customer-managed KMS keys are optional and should be introduced only if required, because they add permissions and cost complexity.
- Minimize names, contact information, and precise personal details. Prefer in-app workflows over exposing email/phone data.
- Do not log passwords, tokens, presigned URLs, full descriptions containing sensitive data, or raw image content.
- Define deletion and retention behavior for reports and images.

## Credentials and configuration

Never commit AWS credentials, session tokens, `.env` secrets, or hard-coded keys. Use the lab's approved identity mechanism for later AWS work and local mock configuration for local development. Configuration should identify environment and resource names without embedding secrets.

## Verification plan

Later phases should test unauthorized reads/writes, owner isolation, admin-only endpoints, invalid uploads, oversized requests, public S3 access, log redaction, and dependency vulnerabilities. Until those checks pass, security remains planned rather than implemented.

