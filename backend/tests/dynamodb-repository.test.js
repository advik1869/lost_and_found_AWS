var assert = require("node:assert/strict");
var DynamoDBReportRepository = require("../src/repositories/dynamodb-report-repository");

function Command(input) { this.input = input; }
var commands = { PutItemCommand: Command, GetItemCommand: Command, QueryCommand: Command, UpdateItemCommand: Command, TransactWriteItemsCommand: Command };
function fixture(overrides) {
  return Object.assign({ id: "dynamo-1", reportType: "LOST", title: "Black laptop", description: "Black laptop with a silver sticker", category: "Electronics", location: "Central Library", date: "2026-10-08", time: "10:00", eventAt: "2026-10-08T10:00:00Z", status: "ACTIVE", createdAt: "2026-10-08T11:00:00.000Z", updatedAt: "2026-10-08T11:00:00.000Z", version: 1, userId: "student-1" }, overrides || {});
}
function clientFor(responses) {
  var calls = [];
  return { calls: calls, send: function (command) { calls.push(command.input); return Promise.resolve(responses.shift() || {}); } };
}
function repo(client) {
  return new DynamoDBReportRepository({ tableName: "FoundlyReports", region: "us-east-1", client: client, commands: commands, marshall: function (value) { return value; }, unmarshall: function (value) { return value; } });
}

async function run() {
  var report = fixture();
  var createClient = clientFor([{}]);
  var created = await repo(createClient).createReport(report);
  assert.deepEqual(created, report, "create returns the validated report");
  assert.equal(createClient.calls[0].ConditionExpression, "attribute_not_exists(#pk)");
  assert.equal(createClient.calls[0].Item.pk, "REPORT#dynamo-1");
  assert.equal(createClient.calls[0].Item.gsi1pk, "BROWSE#ACTIVE#LOST");
  assert.equal(createClient.calls[0].Item.gsi3pk, "USER#student-1");

  var getClient = clientFor([{ Item: DynamoDBReportRepository.toItem(report) }]);
  assert.deepEqual(await repo(getClient).getReportById("dynamo-1"), report, "get maps a DynamoDB item back to a report");
  assert.deepEqual(getClient.calls[0].Key, { pk: "REPORT#dynamo-1", sk: "REPORT" });

  var listClient = clientFor([{ Items: [DynamoDBReportRepository.toItem(report)] }, {}, {}, {}]);
  var listed = await repo(listClient).listReports({ reportType: "LOST", status: "ACTIVE" }, { limit: 10 });
  assert.equal(listed.items.length, 1, "list queries the matching type/status partition");
  assert.equal(listClient.calls[0].IndexName, "GSI1Browse");
  assert.equal(listClient.calls[0].ExpressionAttributeValues[":partition"], "BROWSE#ACTIVE#LOST");

  var updateClient = clientFor([{ Item: DynamoDBReportRepository.toItem(report) }, { Attributes: DynamoDBReportRepository.toItem(Object.assign({}, report, { status: "MATCHED", version: 2, updatedAt: "2026-10-08T12:00:00.000Z" })) }]);
  var updated = await repo(updateClient).updateReportStatus("dynamo-1", "MATCHED", 1);
  assert.equal(updated.status, "MATCHED");
  assert.equal(updateClient.calls[1].ConditionExpression, "attribute_exists(#pk) AND #version = :expectedVersion");
  assert.equal(updateClient.calls[1].ExpressionAttributeValues[":gsi1pk"], "BROWSE#MATCHED#LOST");

  var second = fixture({ id: "dynamo-2", reportType: "FOUND" });
  var matchClient = clientFor([{ Item: DynamoDBReportRepository.toItem(report) }, { Item: DynamoDBReportRepository.toItem(second) }, {}]);
  var matched = await repo(matchClient).deleteMatchedPair(report.id, second.id, { first: 1, second: 1 });
  assert.equal(matched.deleted, true, "DynamoDB matched-pair deletion succeeds through a transaction");
  assert.equal(matchClient.calls[2].TransactItems.length, 2);
  assert.match(matchClient.calls[2].TransactItems[0].Delete.ConditionExpression, /attribute_exists/);
  assert.equal(matchClient.calls[2].TransactItems[0].Delete.ExpressionAttributeValues[":expectedVersion"], 1);

  var failedTransactionClient = clientFor([{ Item: DynamoDBReportRepository.toItem(report) }, { Item: DynamoDBReportRepository.toItem(second) }, Promise.reject({ name: "TransactionCanceledException" })]);
  var failedTransaction = await repo(failedTransactionClient).deleteMatchedPair(report.id, second.id, { first: 1, second: 1 });
  assert.equal(failedTransaction.deleted, false, "a canceled transaction does not report deletion success");

  var pending = fixture({ version: 1 });
  var imageClient = clientFor([{ Attributes: DynamoDBReportRepository.toItem(Object.assign({}, pending, { version: 2, pendingImageKey: "report-images/dynamo-1/file.png", pendingImageMetadata: { contentType: "image/png", size: 123 } })) }, { Attributes: DynamoDBReportRepository.toItem(Object.assign({}, pending, { version: 3, imageKey: "report-images/dynamo-1/file.png", imageMetadata: { contentType: "image/png", size: 123 } })) }]);
  var imageRepo = repo(imageClient);
  assert.equal((await imageRepo.setPendingImage("dynamo-1", { pendingImageKey: "report-images/dynamo-1/file.png", pendingImageMetadata: { contentType: "image/png", size: 123 } }, 1)).version, 2);
  assert.match(imageClient.calls[0].UpdateExpression, /pendingImageKey/);
  assert.equal((await imageRepo.completeImageUpload("dynamo-1", { imageKey: "report-images/dynamo-1/file.png", imageMetadata: { contentType: "image/png", size: 123 } }, 2)).version, 3);
  assert.match(imageClient.calls[1].UpdateExpression, /REMOVE/);

  var missingClient = clientFor([{ Item: DynamoDBReportRepository.toItem(report) }, {}]);
  var missingPair = await repo(missingClient).deleteMatchedPair(report.id, second.id, { first: 1, second: 1 });
  assert.equal(missingPair.deleted, false, "missing pair members are not deleted");

  var duplicateClient = { send: function () { return Promise.reject({ name: "ConditionalCheckFailedException" }); } };
  await assert.rejects(repo(duplicateClient).createReport(report), function (error) { return error.code === "DUPLICATE_REPORT"; });
  var unavailableClient = { send: function () { return Promise.reject(new Error("table unavailable")); } };
  await assert.rejects(repo(unavailableClient).getReportById("dynamo-1"), function (error) { return error.code === "DYNAMODB_UNAVAILABLE"; });
  console.log("PASS DynamoDB repository mapping and mock tests");
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
