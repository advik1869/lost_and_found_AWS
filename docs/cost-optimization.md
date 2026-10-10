# Cost Optimization and Learner Lab Constraints

The $50 figure is a project limit, not a guarantee of free usage or available credit. Actual cost depends on region, usage, quotas, account rules, and Learner Lab policies. No AWS resources have been created in Phase 0.

## Cost strategy

1. Build and test locally with mock data and local adapters.
2. Deploy only the smallest approved slice for a short demonstration.
3. Prefer serverless, on-demand services and small payloads.
4. Set bounded image sizes, API result pages, log retention, and test data volume.
5. Keep optional CloudFront, SQS, SNS, and customer-managed KMS keys out of the initial deployment unless justified.
6. Record every deployed resource and its cleanup owner/date.

## Potential cost or quota sources

- S3 storage, requests, and data transfer; image objects can accumulate.
- CloudFront requests and data transfer; distributions may continue to exist after a lab session.
- API Gateway request volume and data transfer.
- Lambda invocations, duration, and logs.
- DynamoDB read/write usage, storage, and indexes.
- SQS requests and message retention.
- SNS delivery and subscription behavior.
- CloudWatch log ingestion, storage, metrics, and alarms.
- KMS key usage and especially persistent customer-managed keys, if enabled.

Pricing and free-tier assumptions must be checked against the current AWS pricing pages and Learner Lab terms before deployment. Do not assume that a short lab session makes every resource free.

## Cleanup checklist

After an approved experiment, identify and remove or disable unused API stages, Lambda functions, S3 objects and buckets, CloudFront distributions, DynamoDB tables/indexes, SQS queues, SNS topics/subscriptions, CloudWatch alarms/log groups, and any KMS keys or aliases that are no longer needed. Some services can continue incurring charges or retain data even when the browser is closed. Follow the lab's deletion and key-retention rules; never delete shared or unknown resources.

## Monitoring and budget checks

Before deployment, record the intended region, resources, limits, and expected test volume. During deployment, inspect the AWS billing/cost views available to the lab account, CloudWatch metrics/log volume, and service quotas. Confirm what Learner Lab exposes; billing dashboards, alarms, or budgets may be restricted. Stop testing if usage or permissions are unclear.

## Learner Lab uncertainty

The lab may restrict IAM, CloudFront, custom domains, KMS, email/SNS delivery, regions, quotas, or CloudFormation. The design therefore keeps local development independent of AWS and treats each AWS service as subject to an explicit availability and permission check. No AWS CLI create/update/delete commands are permitted in Phase 0.

