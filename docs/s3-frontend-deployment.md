# Foundly S3 frontend deployment preparation — Phase 11A

## Prepared local artifact

- Frontend directory: `frontend/`
- Entry HTML file: `frontend/index.html`
- Additional pages: `browse.html`, `item.html`, and `report.html`
- Static sample data: `frontend/data/items.js`
- Shared browser configuration: `frontend/assets/js/config.js`
- Current behavior: local demo data and browser `localStorage`; no cloud API calls

All page navigation and local asset references use relative paths. The pages do not depend on a repository-root URL or a localhost URL to load their static assets. Bootstrap, Bootstrap Icons, and fonts remain external CDN dependencies; an S3-hosted page therefore needs browser access to those CDNs unless those assets are vendored later.

## Public API configuration

`frontend/assets/js/config.js` is the public configuration boundary. It defaults to:

```js
{ mode: "local-demo", apiBaseUrl: "" }
```

For a future API-backed deployment, the approved API Gateway HTTPS base URL may be supplied as a public value before upload, for example:

```js
window.FOUNDLY_CONFIG = {
  mode: "api",
  apiBaseUrl: "https://api.example.invalid"
};
```

The example is illustrative only and is not a live endpoint. Do not put credentials, tokens, private keys, account identifiers, or other secrets in this file. The current frontend data service remains local-first and does not yet implement the API adapter, so setting `mode: "api"` is not a claim that cloud API integration is complete. Keep `mode: "local-demo"` for the current local behavior.

There are no hardcoded localhost URLs in the production-facing public configuration. Localhost appears only in local-development documentation/default backend CORS settings, not as a deployed API endpoint.

## S3 hosting preparation checklist

- [x] Use `frontend/` as the upload root and `index.html` as the entry document.
- [x] Keep page, stylesheet, script, and sample-data references relative.
- [x] Keep local demo mode as the safe default.
- [x] Keep the public API setting free of secrets.
- [ ] Confirm the approved Learner Lab region, S3 availability, bucket naming rules, and current permissions immediately before any upload.
- [ ] Obtain explicit approval for the bucket and public static website trade-off.
- [ ] Choose a unique bucket name only after region and ownership constraints are confirmed.
- [ ] Review the complete frontend artifact for secrets and unintended files.
- [ ] If using an S3 website endpoint, configure `index.html` as the index document and select an error-document behavior appropriate to these multi-page HTML routes.
- [ ] Configure the eventual API Gateway CORS allowlist for the exact frontend origin before enabling API-backed behavior.
- [ ] Upload only the reviewed `frontend/` contents; do not upload the repository, `.env` files, credentials, or backend source.
- [ ] Open every page and verify static assets, query-string navigation, local report creation, and sample data after upload.
- [ ] Record the exact bucket and object scope for later cleanup; do not delete shared or unknown resources.

## Deferred upload command sequence

The following is a documented command sequence only. It was not executed in Phase 11A. Replace placeholders only after the preflight gate and explicit approval are complete; do not paste credentials into commands.

```bash
# Review the upload root locally first.
find frontend -type f -print

# Set these only in the shell used for an approved deployment.
export FOUNDLY_BUCKET="<approved-unique-bucket-name>"

# Configure the S3 static website after the bucket has been approved/created.
aws s3 website "s3://${FOUNDLY_BUCKET}" \
  --index-document index.html \
  --error-document error.html \
  --region us-east-1

# Upload only reviewed static frontend files.
aws s3 sync frontend "s3://${FOUNDLY_BUCKET}" \
  --delete \
  --region us-east-1

# Verify the exact static objects and website configuration using approved
# read-only checks before sharing an endpoint.
aws s3 ls "s3://${FOUNDLY_BUCKET}/" --recursive --region us-east-1
aws s3api get-bucket-website --bucket "${FOUNDLY_BUCKET}" --region us-east-1
```

`error.html` is not currently part of the frontend. Before using the website command, either add and review an appropriate error document or omit the error-document option and use the provider's approved default. This report does not authorize the command sequence or any S3 mutation.

## S3 static website limitations

S3 static website hosting serves static files and does not provide API execution, authentication, authorization, server-side routing, secrets, or database access. The current multi-page links are compatible with direct object paths, but a website endpoint's error behavior must be tested for invalid paths. S3 website endpoints also have hosting/security trade-offs, including the need for an approved public-read approach and the absence of HTTPS at the website endpoint itself; CloudFront is intentionally out of scope for this phase.

The frontend remains a local demonstration until the API adapter, API Gateway CORS configuration, Lambda backend, DynamoDB repository, and authentication boundary are separately implemented and approved. No S3 bucket has been created and no frontend files have been uploaded.
