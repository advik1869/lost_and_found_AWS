"use strict";

var assert = require("node:assert/strict");
var InMemoryReportRepository = require("../src/repositories/in-memory-report-repository");
var ReportService = require("../src/services/report-service");
var createHandler = require("../src/handlers/create-report").createHandler;
var getHandler = require("../src/handlers/get-report").createHandler;
var listHandler = require("../src/handlers/list-reports").createHandler;
var updateHandler = require("../src/handlers/update-report-status").createHandler;
var matchesHandler = require("../src/handlers/get-matches").createHandler;

function event(method, path, overrides) {
  return Object.assign({ version: "2.0", routeKey: method + " " + path, rawPath: path, requestContext: { http: { method: method, path: path } }, httpMethod: method, pathParameters: {}, queryStringParameters: {} }, overrides || {});
}
function json(result) { assert.equal(result.headers["Content-Type"], "application/json"); return JSON.parse(result.body); }
function fixture(overrides) { return Object.assign({ id: "api-seed", reportType: "LOST", title: "Black laptop", description: "Black laptop with a silver sticker", category: "Electronics", location: "Central Library", date: "2026-10-08", time: "10:00", eventAt: "2026-10-08T10:00:00Z", status: "ACTIVE", createdAt: "2026-10-08T11:00:00.000Z", updatedAt: "2026-10-08T11:00:00.000Z", version: 1 }, overrides || {}); }

var repository = new InMemoryReportRepository([fixture(), fixture({ id: "api-found", reportType: "FOUND", title: "Black laptop found", description: "Black laptop with a silver sticker near library", location: "Library entrance", date: "2026-10-09", eventAt: "2026-10-09T10:00:00Z" })]);
var service = new ReportService(repository);
var handlers = { create: createHandler({ service: service }), get: getHandler({ service: service }), list: listHandler({ service: service }), update: updateHandler({ service: service }), matches: matchesHandler({ service: service }) };

var create = handlers.create(event("POST", "/reports", { body: JSON.stringify({ reportType: "FOUND", title: "Green bottle", description: "Found near union", category: "Other", location: "Student Union", date: "2026-10-10" }) }));
assert.equal(create.statusCode, 201, "POST /reports works with HTTP API-style event");
assert.ok(json(create).data.id, "POST returns generated ID");

var encodedBody = Buffer.from(JSON.stringify({ reportType: "LOST", title: "Blue book", description: "Blue book near the quad", category: "Books", location: "Main Quad", date: "2026-10-10" })).toString("base64");
assert.equal(handlers.create(event("POST", "/reports", { body: encodedBody, isBase64Encoded: true })).statusCode, 201, "base64 body is parsed");
assert.equal(handlers.create(event("POST", "/reports", { body: "{" })).statusCode, 400, "malformed JSON is rejected");

var listed = handlers.list(event("GET", "/reports", { queryStringParameters: { reportType: "LOST", limit: "1" } }));
assert.equal(listed.statusCode, 200, "GET /reports works");
assert.ok(Array.isArray(json(listed).data.items), "list returns items");
assert.equal(handlers.list(event("GET", "/reports", { queryStringParameters: { limit: "invalid" } })).statusCode, 400, "invalid pagination is rejected");

assert.equal(handlers.get(event("GET", "/reports/{id}", { pathParameters: { id: "api-seed" } })).statusCode, 200, "GET /reports/{id} works");
assert.equal(handlers.get(event("GET", "/reports/{id}", { pathParameters: {} })).statusCode, 400, "missing path parameter is rejected");
assert.equal(handlers.get(event("GET", "/reports/{id}", { pathParameters: { id: "does-not-exist" } })).statusCode, 404, "missing report is 404");

var updated = handlers.update(event("PATCH", "/reports/{id}/status", { pathParameters: { id: "api-seed" }, body: JSON.stringify({ status: "MATCHED", expectedVersion: 1 }) }));
assert.equal(updated.statusCode, 200, "PATCH /reports/{id}/status works");
assert.equal(handlers.update(event("PATCH", "/reports/{id}/status", { pathParameters: { id: "api-seed" }, body: JSON.stringify({ status: "NOT_VALID" }) })).statusCode, 400, "invalid status is rejected");

var matches = handlers.matches(event("GET", "/reports/{id}/matches", { pathParameters: { id: "api-seed" } }));
assert.equal(matches.statusCode, 200, "GET /reports/{id}/matches works");
assert.ok(json(matches).data.matches.length >= 1, "matches return candidates");

var preflight = handlers.list(event("OPTIONS", "/reports"));
assert.equal(preflight.statusCode, 204, "OPTIONS is handled");
assert.equal(preflight.headers["Access-Control-Allow-Origin"], "http://localhost:8000", "local origin is explicit");
assert.match(preflight.headers["Access-Control-Allow-Methods"], /GET/);
assert.equal(handlers.list(event("POST", "/reports" )).statusCode, 405, "unsupported method is rejected");

console.log("PASS Phase 5 local API Gateway integration tests");
