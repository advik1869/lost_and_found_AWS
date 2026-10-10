# Requirements

Priority labels: **MUST HAVE** is required for the MVP; **SHOULD HAVE** is valuable but can be deferred; **OPTIONAL** is a future enhancement.

## Functional requirements

| Priority | Requirement |
|---|---|
| MUST HAVE | A user can register/sign in through the selected authentication approach. |
| MUST HAVE | A user can create a lost or found report with title, description, category, location, date/time, and status. |
| MUST HAVE | A user can optionally associate an image with a report. |
| MUST HAVE | Users can browse, search, and filter active reports. |
| MUST HAVE | Users can view report details without exposing unnecessary private information. |
| MUST HAVE | A report owner can view their reports and track status. |
| MUST HAVE | An administrator can review, hide, flag, or update reports. |
| SHOULD HAVE | The system can show rule-based candidate matches between lost and found reports. |
| SHOULD HAVE | The system can prevent obvious duplicate submissions or mark them for review. |
| SHOULD HAVE | Administrators can view basic counts by report type and status. |
| OPTIONAL | Email or mobile notifications for status changes or candidate matches. |
| OPTIONAL | Campus SSO, saved searches, chat, map views, audit exports, and advanced matching. |

## Non-functional requirements

- **MUST HAVE — security:** enforce authentication for ownership and administrative actions; validate inputs server-side; use least privilege; use HTTPS and private-by-default image storage.
- **MUST HAVE — cost:** support local development first and avoid always-running or high-cost infrastructure.
- **MUST HAVE — reliability:** return clear errors and avoid losing a submitted report after successful validation.
- **MUST HAVE — privacy:** minimize personal data and avoid exposing user contact information in public listings.
- **SHOULD HAVE — performance:** common list/detail operations should use DynamoDB key access or bounded queries rather than scans.
- **SHOULD HAVE — maintainability:** keep the API, data model, and matching rules documented and testable independently.
- **OPTIONAL — scalability:** support asynchronous processing and CDN delivery if actual usage justifies the added complexity.

## Roles and permissions

| Role | Allowed actions |
|---|---|
| Anonymous visitor | View only public, approved reports; search/filter if the product chooses public browsing. |
| Authenticated user | Create reports; view and edit their own reports; upload images for their own reports; view candidate suggestions. |
| Administrator | All moderation, status, duplicate handling, and statistics actions; must not receive unrestricted infrastructure access. |

## Assumptions and acceptance boundaries

- The initial campus is a single logical tenant.
- Report status is controlled by the owner and administrator rules defined during implementation.
- Images have a small enforced size/type limit and are not trusted content.
- No feature is considered deployed or AWS-tested during Phase 0.

