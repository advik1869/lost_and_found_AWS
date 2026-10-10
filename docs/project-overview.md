# Project Overview

## Problem statement

Students who lose or find belongings on campus often rely on disconnected messages, posters, or informal group chats. These channels make reports difficult to search, easy to miss, and hard to track. They also provide limited moderation and little support for identifying a lost report that may correspond to a found report.

## Objectives

1. Provide a simple, searchable place for campus lost-and-found reports.
2. Support both lost-item and found-item workflows.
3. Allow a report owner to track status changes.
4. Give administrators moderation and basic operational visibility.
5. Explore an appropriately small, serverless AWS architecture.
6. Keep the design suitable for local-first development and a $50 Learner Lab budget.

## Target users

- **Student/user:** registers, signs in, creates and manages their own reports, searches listings, and reviews possible matches.
- **Administrator:** moderates reports, handles duplicates or inappropriate content, changes statuses, and views basic statistics.

## Proposed solution

The planned platform consists of a static browser frontend, a small HTTP API, serverless business logic, and a single DynamoDB-backed report store. Images would be stored separately in S3 and referenced by object key. A transparent rule-based matcher may produce candidate suggestions. Notifications and asynchronous processing are optional and should be added only if they provide clear value without exceeding the lab's constraints.

## MVP scope

The MVP includes account access, lost/found report creation, optional image upload, browsing/search/filtering, item details, report ownership, status tracking, and basic administrator moderation. It does not attempt to replace campus security procedures, verify ownership automatically, or guarantee that a suggested match is correct.

## Limitations and assumptions

- Campus identity-provider integration is not assumed; authentication may initially use a simple local/mock approach and must be selected before implementation.
- Learner Lab permissions and service availability are unknown until explicitly checked later.
- The platform stores only the minimum personal information needed for account and report ownership.
- Rule-based suggestions are hints for human review, not proof of identity or ownership.
- Deployment, AWS testing, and production readiness are out of scope for Phase 0.

## Expected outcomes

Phase 0 produces a consistent design baseline, an implementation dependency order, and a cost/safety checklist. Later phases should produce a locally testable MVP before any approved AWS deployment.

