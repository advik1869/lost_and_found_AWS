"use strict";

var assert = require("node:assert/strict");
var InMemoryReportRepository = require("../src/repositories/in-memory-report-repository");
var ReportService = require("../src/services/report-service");
var createHandler = require("../src/handlers/create-report").createHandler;
var getHandler = require("../src/handlers/get-report").createHandler;
var listHandler = require("../src/handlers/list-reports").createHandler;
var updateHandler = require("../src/handlers/update-report-status").createHandler;
var matchesHandler = require("../src/handlers/get-matches").createHandler;

function stored(overrides) {
  return Object.assign({ id: "seed-1", reportType: "LOST", title: "Black laptop", description: "Black laptop with a silver sticker", category: "Electronics", location: "Central Library", date: "2026-10-08", time: "10:00", eventAt: "2026-10-08T10:00:00Z", status: "ACTIVE", createdAt: "2026-10-08T11:00:00.000Z", updatedAt: "2026-10-08T11:00:00.000Z", version: 1, userId: "user-1" }, overrides || {});
}
function setup(seed) { var repository = new InMemoryReportRepository(seed); var service = new ReportService(repository); return { repository: repository, service: service }; }
function body(result) { return JSON.parse(result.body); }
function event(overrides) { return Object.assign({ httpMethod: "GET", queryStringParameters: {}, pathParameters: {} }, overrides || {}); }

var env = setup([stored(), stored({ id: "seed-2", reportType: "FOUND", title: "Black laptop found", description: "Black laptop with a silver sticker near the library", location: "Library entrance", date: "2026-10-09", eventAt: "2026-10-09T10:00:00Z", createdAt: "2026-10-09T11:00:00.000Z", updatedAt: "2026-10-09T11:00:00.000Z" }), stored({ id: "seed-3", category: "Books", title: "Blue book", description: "Blue notebook", userId: "user-2" })]);
var create = createHandler({ service: env.service });
var get = getHandler({ service: env.service });
var list = listHandler({ service: env.service });
var update = updateHandler({ service: env.service });
var matches = matchesHandler({ service: env.service });

var created = create(event({ httpMethod: "POST", body: JSON.stringify({ reportType: "FOUND", title: "Green bottle", description: "Found near the union", category: "Other", location: "Student Union", date: "2026-10-10" }) }));
assert.equal(created.statusCode, 201, "valid creation returns 201");
assert.equal(body(created).data.status, "ACTIVE", "creation applies server status");
assert.ok(body(created).data.createdAt && body(created).data.version === 1, "creation applies server fields");
assert.equal(create(event({ httpMethod: "POST", body: "not-json" })).statusCode, 400, "malformed JSON returns 400");
assert.equal(create(event({ httpMethod: "POST", body: JSON.stringify({ title: "Incomplete" }) })).statusCode, 400, "invalid create returns 400");

assert.equal(get(event({ pathParameters: { id: "seed-1" } })).statusCode, 200, "existing report returns 200");
assert.equal(get(event({ pathParameters: { id: "missing-1" } })).statusCode, 404, "missing report returns 404");
assert.equal(get(event({ pathParameters: { id: "bad id" } })).statusCode, 400, "invalid ID returns 400");

var firstPage = list(event({ queryStringParameters: { reportType: "LOST", limit: "1" } }));
assert.equal(firstPage.statusCode, 200, "list returns 200");
assert.equal(body(firstPage).data.items.length, 1, "list respects page size");
assert.ok(body(firstPage).data.nextToken, "list returns a next token");
assert.equal(list(event({ queryStringParameters: { category: "Books", limit: "10" } })).body.includes("seed-3"), true, "category filter works");
assert.equal(list(event({ queryStringParameters: { limit: "51" } })).statusCode, 400, "page limit is bounded");
assert.equal(list(event({ queryStringParameters: { userId: "user-1" } })).statusCode, 401, "untrusted user query is rejected");
assert.equal(list(event({ queryStringParameters: { userId: "ignored" }, requestContext: { authorizer: { userId: "user-1" } } })).statusCode, 200, "trusted authorizer context supports user reports");

var updated = update(event({ httpMethod: "PATCH", pathParameters: { id: "seed-1" }, body: JSON.stringify({ status: "MATCHED", expectedVersion: 1 }) }));
assert.equal(updated.statusCode, 200, "valid status update returns 200");
assert.equal(body(updated).data.report.status, "MATCHED", "status is updated");
assert.equal(update(event({ httpMethod: "PATCH", pathParameters: { id: "seed-1" }, body: JSON.stringify({ status: "ACTIVE" }) })).statusCode, 200, "matched report can return active");
assert.equal(update(event({ httpMethod: "PATCH", pathParameters: { id: "seed-1" }, body: JSON.stringify({ status: "NOT_VALID" }) })).statusCode, 400, "invalid status returns 400");
assert.equal(update(event({ httpMethod: "PATCH", pathParameters: { id: "seed-1" }, body: JSON.stringify({ status: "ACTIVE", title: "not allowed" }) })).statusCode, 400, "arbitrary update fields are rejected");
assert.equal(update(event({ httpMethod: "PATCH", pathParameters: { id: "missing-1" }, body: JSON.stringify({ status: "ACTIVE" }) })).statusCode, 404, "missing update returns 404");
assert.equal(update(event({ httpMethod: "PATCH", pathParameters: { id: "seed-1" }, body: JSON.stringify({ status: "MATCHED", expectedVersion: 1 }) })).statusCode, 409, "stale version returns 409");

var matchResponse = matches(event({ pathParameters: { id: "seed-1" } }));
assert.equal(matchResponse.statusCode, 200, "match endpoint returns 200");
assert.ok(body(matchResponse).data.matches.some(function (item) { return item.matchId === "seed-2" && item.reasons.length > 0; }), "match response includes score and reasons");
assert.equal(matches(event({ pathParameters: { id: "missing-1" } })).statusCode, 404, "missing match target returns 404");

var duplicateRepo = new InMemoryReportRepository([stored({ id: "duplicate-1" })]);
assert.throws(function () { duplicateRepo.createReport(stored({ id: "duplicate-1" })); }, function (error) { return error.code === "DUPLICATE_REPORT"; }, "repository rejects duplicate IDs");
assert.equal(create(event({ httpMethod: "GET" })).statusCode, 405, "unsupported method returns 405");

var broken = getHandler({ service: { getReport: function () { throw new Error("private diagnostic"); } } });
var brokenResponse = broken(event({ pathParameters: { id: "seed-1" } }));
assert.equal(brokenResponse.statusCode, 500, "unexpected errors return 500");
assert.equal(brokenResponse.body.includes("private diagnostic"), false, "internal details are not exposed");

console.log("PASS Phase 4 Lambda-compatible backend tests");
