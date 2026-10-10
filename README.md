# Foundly: Lost and Found Campus Platform

Foundly is a modern, lightweight campus lost-and-found platform. It gives your campus one clear place to report, browse, and bring everyday items back to the people who miss them.

## Main Features
- **Browse and Search:** Quickly filter and find lost or found items by category, status, and keywords.
- **Report Items:** Create detailed reports for lost or found items, complete with optional image uploads.
- **Smart Matching:** Automatic deterministic heuristic matching suggests potential matches between lost and found reports.
- **Status Lifecycle:** Track the lifecycle of an item from `ACTIVE` to `MATCHED`, `RESOLVED`, or `CLOSED`.
- **Local-Demo & API Modes:** Run entirely in the browser using `localStorage` for demonstrations, or switch to API mode for full cloud persistence.

## AWS Architecture
Foundly uses a fully serverless architecture deployed on AWS:
- **Amazon S3 (Frontend Hosting):** Hosts the static HTML, CSS, and vanilla JavaScript single-page application.
- **Amazon API Gateway (HTTP API):** Provides a secure, low-latency RESTful entry point for the backend.
- **AWS Lambda:** Runs the Node.js backend handlers, business logic, matching engine, and storage adapters.
- **Amazon DynamoDB:** Serves as the primary NoSQL repository for reports and lifecycle status.
- **Amazon S3 (Private Image Bucket):** Securely stores uploaded images. The backend generates presigned URLs for client-side uploads and downloads.
- **AWS IAM:** Enforces least-privilege execution roles for Lambda and precise bucket policies.
- **Amazon CloudWatch:** Collects structured, redacted application logs.

## Repository Structure
- `frontend/`: Static HTML, CSS, JavaScript, and local sample data.
- `backend/`: Node.js API handlers, domain logic, and AWS storage adapters.
- `docs/`: Academic deliverables, design decisions, and architecture plans.
- `scripts/`: Deployment and cleanup utility scripts.
- `tests/`: Automated frontend regression tests.
- `backend/tests/`: Automated backend integration and unit tests.
- `dist/`: Compiled deployment artifacts (`foundly-lambda.zip`).

## Prerequisites and Local Setup
To run and test the project locally, you need:
- Node.js (v18 or higher)
- A local HTTP server for the frontend (e.g., `python3 -m http.server 8000`)

1. **Clone the repository.**
2. **Install dependencies:** Navigate to the project root and run `npm install`.
3. **Run the local backend:** Run `node backend/server.js` (starts on port 3000).
4. **Run the local frontend:** Serve the `frontend/` directory and open it in a browser.

## How to use Local-Demo Mode versus API Mode
- **Local-Demo Mode:** Set `mode: "local-demo"` in `frontend/assets/js/config.js`. The application will use `localStorage` and `frontend/data/items.js` to simulate the platform entirely in the browser without making external network requests.
- **API Mode:** Set `mode: "api"` and `apiBaseUrl: "<YOUR_API_GATEWAY_URL>"` in `frontend/assets/js/config.js`. The application will communicate with the deployed AWS backend.

## Private S3 Image Uploads
Image uploads are opt-in and use a secure, direct-to-S3 pattern:
1. The frontend requests an upload intent from the backend API.
2. The Lambda function validates the request and generates an S3 presigned PUT URL.
3. The browser uploads the image directly to the private S3 bucket using the presigned URL.
4. The frontend confirms the upload with the backend, which verifies the object metadata via `HeadObject` before committing the reference to DynamoDB.
Images are served via short-lived presigned GET URLs for secure display.

## AWS Environment Variables and Permissions
The Lambda function relies on the following environment variables (required variables must be set; others have defaults):
- `APP_ENV`: e.g., `production` (default: `development`)
- `REPORT_REPOSITORY`: `dynamodb` (default: `in-memory`)
- `AWS_REGION`: e.g., `us-east-1` (required if using DynamoDB or S3)
- `FOUNDLY_REPORTS_TABLE`: The name of your DynamoDB table. (required if using DynamoDB)
- `IMAGE_STORAGE`: `s3` (default: `local`)
- `FOUNDLY_IMAGE_BUCKET`: The name of the private S3 image bucket. (required if using S3)
- `FOUNDLY_IMAGE_PREFIX`: The object key prefix for images. (default: `report-images`)
- `IMAGE_URL_TTL_SECONDS`: Presigned URL expiry time in seconds. (default: `300`)
- `CORS_ALLOWED_ORIGINS`: The deployed frontend URL. (default: local and deployed frontend origins)

**IAM Permissions Required for Lambda Execution Role:**
- `dynamodb:PutItem`, `dynamodb:GetItem`, `dynamodb:UpdateItem`, `dynamodb:Scan` on the reports table.
- `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on the image bucket.

## Packaging and Deploying the Lambda
Use the provided script to bundle only production runtime dependencies:
```bash
sh scripts/package-lambda.sh
```
This creates or updates `dist/foundly-lambda.zip`. You can then deploy this artifact to your AWS Lambda function using the AWS Console or CLI:
```bash
aws lambda update-function-code --function-name foundly-api --zip-file fileb://dist/foundly-lambda.zip
```

## Deploying the Frontend
Configure `frontend/assets/js/config.js` for API mode, then sync the directory to your S3 static website bucket:
```bash
export FOUNDLY_BUCKET="<your-bucket-name>"
aws s3 sync frontend "s3://${FOUNDLY_BUCKET}" --delete
```

## Running Tests
Foundly includes a comprehensive local test suite with zero AWS dependencies.

**Backend tests:**
```bash
for f in backend/tests/*.test.js; do node "$f"; done
```

**Frontend tests:**
```bash
for f in tests/frontend-*.test.js; do node "$f"; done
```
