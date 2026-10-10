#!/bin/sh
set -eu

# Data-driven, opt-in cleanup for a pair that is already confirmed as matched.
# This is deliberately dry-run unless the caller supplies --execute.
if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  printf '%s\n' "Usage: $0 <lost-report-id> <found-report-id> [--execute]" >&2
  exit 2
fi

LOST_ID=$1
FOUND_ID=$2
EXECUTE=${3:-}
TABLE=${FOUNDLY_REPORTS_TABLE:-FoundlyReports}
REGION=${AWS_REGION:-us-east-1}

read_item() {
  aws dynamodb get-item --region "$REGION" --table-name "$TABLE" --consistent-read \
    --key "{\"pk\":{\"S\":\"REPORT#$1\"},\"sk\":{\"S\":\"REPORT\"}}" \
    --projection-expression 'pk,sk,reportType,status,#version,matchedReportId' \
    --expression-attribute-names '{"#version":"version"}' --output json
}

LOST_ITEM=$(read_item "$LOST_ID")
FOUND_ITEM=$(read_item "$FOUND_ID")

if [ "$(printf '%s' "$LOST_ITEM" | jq -r '.Item // empty' | wc -c | tr -d ' ')" -eq 0 ] || [ "$(printf '%s' "$FOUND_ITEM" | jq -r '.Item // empty' | wc -c | tr -d ' ')" -eq 0 ]; then
  printf '%s\n' "Refusing cleanup: both report records must exist." >&2
  exit 1
fi

LOST_TYPE=$(printf '%s' "$LOST_ITEM" | jq -r '.Item.reportType.S // empty')
FOUND_TYPE=$(printf '%s' "$FOUND_ITEM" | jq -r '.Item.reportType.S // empty')
LOST_STATUS=$(printf '%s' "$LOST_ITEM" | jq -r '.Item.status.S // empty')
FOUND_STATUS=$(printf '%s' "$FOUND_ITEM" | jq -r '.Item.status.S // empty')
LOST_VERSION=$(printf '%s' "$LOST_ITEM" | jq -r '.Item.version.N // empty')
FOUND_VERSION=$(printf '%s' "$FOUND_ITEM" | jq -r '.Item.version.N // empty')
LOST_MATCH=$(printf '%s' "$LOST_ITEM" | jq -r '.Item.matchedReportId.S // empty')
FOUND_MATCH=$(printf '%s' "$FOUND_ITEM" | jq -r '.Item.matchedReportId.S // empty')

if [ "$LOST_TYPE" != "LOST" ] || [ "$FOUND_TYPE" != "FOUND" ] || [ "$LOST_MATCH" != "$FOUND_ID" ] || [ "$FOUND_MATCH" != "$LOST_ID" ]; then
  printf '%s\n' "Refusing cleanup: stored types and reciprocal match links do not confirm this pair." >&2
  exit 1
fi
case "$LOST_STATUS:$FOUND_STATUS" in
  MATCHED:MATCHED|MATCHED:RESOLVED|RESOLVED:MATCHED|RESOLVED:RESOLVED) : ;;
  *) printf '%s\n' "Refusing cleanup: both records must be matched or resolved matched records." >&2; exit 1 ;;
esac

TRANSACT_ITEMS=$(jq -n \
  --arg lost "$LOST_ID" --arg found "$FOUND_ID" \
  --arg lostType "$LOST_TYPE" --arg foundType "$FOUND_TYPE" \
  --arg lostStatus "$LOST_STATUS" --arg foundStatus "$FOUND_STATUS" \
  --arg lostVersion "$LOST_VERSION" --arg foundVersion "$FOUND_VERSION" \
  --arg table "$TABLE" '
  [
    {Delete:{TableName:$table,Key:{pk:{S:("REPORT#"+$lost)},sk:{S:"REPORT"}},ConditionExpression:"attribute_exists(#pk) AND #status = :status AND #version = :version AND #reportType = :reportType AND #matchedReportId = :matchedReportId",ExpressionAttributeNames:{"#pk":"pk","#status":"status","#version":"version","#reportType":"reportType","#matchedReportId":"matchedReportId"},ExpressionAttributeValues:{":status":{S:$lostStatus},":version":{N:$lostVersion},":reportType":{S:$lostType},":matchedReportId":{S:$found}}}},
    {Delete:{TableName:$table,Key:{pk:{S:("REPORT#"+$found)},sk:{S:"REPORT"}},ConditionExpression:"attribute_exists(#pk) AND #status = :status AND #version = :version AND #reportType = :reportType AND #matchedReportId = :matchedReportId",ExpressionAttributeNames:{"#pk":"pk","#status":"status","#version":"version","#reportType":"reportType","#matchedReportId":"matchedReportId"},ExpressionAttributeValues:{":status":{S:$foundStatus},":version":{N:$foundVersion},":reportType":{S:$foundType},":matchedReportId":{S:$lost}}}}
  ]')

if [ "$EXECUTE" != "--execute" ]; then
  printf '%s\n' "Dry run: reciprocal matched pair is eligible for deletion." \
    "Run again with --execute only after reviewing the records above."
  exit 0
fi

aws dynamodb transact-write-items --region "$REGION" --transact-items "$TRANSACT_ITEMS"
printf '%s\n' "Deleted only the verified reciprocal matched pair."
