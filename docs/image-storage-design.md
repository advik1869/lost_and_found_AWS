# Image Storage Design — Phase 6

The implementation supports local preview/demo behavior and an opt-in private S3 adapter. No S3 bucket, IAM policy, credential, or cloud deployment is created by this repository change.

## Current behavior

The report form accepts optional JPEG, PNG, and WebP files up to 5 MiB. Local-demo mode keeps the existing preview-only behavior. In S3 mode, the browser requests a short-lived upload URL, uploads directly to the configured private bucket, and completes the upload through the API. Reports without images and legacy reports remain valid.

## Storage abstraction

The CommonJS backend exposes a future-compatible `ImageStorage` interface:

```text
putImage({ userId, reportId, contentType, body }) → { objectKey, contentType, size, ... }
getImage(objectKey) → { metadata, body } | null
deleteImage(objectKey) → boolean
createUploadIntent(input) → short-lived presigned PUT instruction
```

The interface is intentionally persistence-agnostic. `backend/src/storage/local-image-storage.js` is a local in-memory adapter for tests only. It clones returned metadata and bytes, generates object keys internally, rejects unsafe keys, supports simulated write failures, and does not write arbitrary filesystem paths.

`backend/src/storage/s3-image-storage.js` implements the opt-in presigned PUT, HEAD verification, presigned GET, and delete operations. It generates keys under `<prefix>/<reportId>/<random-id>.<extension>` and never accepts a client object key.

## Validation rules

`backend/src/utils/image-validation.js` provides reusable validation:

- Allowed MIME types: `image/jpeg`, `image/png`, and `image/webp`.
- Maximum size: 5 MiB (`5 * 1024 * 1024` bytes), configurable by the trusted adapter configuration.
- Empty or missing images are rejected.
- Byte buffers are checked against simple JPEG, PNG, and WebP signatures.
- When bytes are available, the detected format must match the declared content type.
- Metadata-only validation is allowed for a future upload-intent step, but returns an explicit warning because it cannot verify file bytes.
- Unsupported types, malformed metadata, mismatched bytes, unsafe keys, and storage failures return safe typed errors without internal paths or diagnostics.

The MIME type supplied by a browser is not trusted when bytes are available. The local validator is intentionally lightweight and is not a complete malware scanner, image decoder, or content moderation system.

## S3 object strategy

The planned AWS flow is:

1. An authenticated backend receives an upload-intent request containing report context and file metadata.
2. The backend validates identity, report ownership, content type, declared size, and allowed report state.
3. The backend generates an object key such as `images/<userId>/<reportId>/<random-id>.jpg`; user filenames are never used as keys.
4. The backend returns a short-lived presigned upload URL or equivalent controlled upload instruction.
5. The browser uploads directly to a private S3 bucket.
6. The backend stores only the private `imageKey` and validated metadata in the report record.
7. Public report responses receive a short-lived presigned download URL; object keys and bucket names are stripped from responses.

The image routes are `POST /reports/{id}/image-upload` and `POST /reports/{id}/image-complete`. They require a configured S3 image adapter and authenticated owner/admin authorization when enforcement is enabled. The local default deliberately returns an unavailable-storage response for these routes.

## Security and operations

- Block public bucket access by default.
- Use least-privilege runtime permissions scoped to the intended bucket/prefix.
- Encrypt objects at rest with the approved S3 encryption configuration; evaluate customer-managed KMS keys separately because they add cost and permissions.
- Enforce content type and size at both intent and completion boundaries.
- Authorize upload, read, replacement, and deletion using trusted identity context—not request-body `userId` or arbitrary `imageKey` values.
- Set lifecycle/retention rules for abandoned uploads and reports.
- Track orphaned objects when an upload succeeds but report creation fails, and clean them through a reviewed process.
- Do not log image bytes, presigned URLs, credentials, or unnecessary personal data.

## Remaining work

Before enabling S3, provision and verify a separate private image bucket, exact prefix-scoped Lambda permissions, bucket CORS for the deployed frontend origin, and lifecycle cleanup for abandoned uploads. Those cloud changes are intentionally outside this implementation and require explicit approval.

