"use strict";

var assert = require("node:assert/strict");
var InMemoryReportRepository = require("../src/repositories/in-memory-report-repository");
var ReportService = require("../src/services/report-service");
var createHandler = require("../src/handlers/create-report").createHandler;
var listHandler = require("../src/handlers/list-reports").createHandler;
var getHandler = require("../src/handlers/get-report").createHandler;
var matchesHandler = require("../src/handlers/get-matches").createHandler;
var updateHandler = require("../src/handlers/update-report-status").createHandler;
var imageValidation = require("../src/utils/image-validation");
var LocalImageStorage = require("../src/storage/local-image-storage");

function event(method, pathParameters, queryStringParameters, body, headers) {
  return { version: "2.0", requestContext: { http: { method: method } }, httpMethod: method, pathParameters: pathParameters || {}, queryStringParameters: queryStringParameters || {}, body: body, headers: headers || {} };
}
function json(result) { return JSON.parse(result.body); }
function fixture(overrides) { return Object.assign({ id: "found-seed", reportType: "FOUND", title: "Green bottle", description: "Green bottle with a black lid", category: "Other", location: "Student Union", date: "2026-10-09", time: "10:00", eventAt: "2026-10-09T10:00:00Z", status: "ACTIVE", createdAt: "2026-10-09T11:00:00.000Z", updatedAt: "2026-10-09T11:00:00.000Z", version: 1 }, overrides || {}); }

var repository = new InMemoryReportRepository([fixture(), fixture({ id: "lost-seed", reportType: "LOST", title: "Black keys", description: "Black keys near the library", location: "Central Library", date: "2026-10-08", eventAt: "2026-10-08T10:00:00Z", createdAt: "2026-10-08T11:00:00.000Z", updatedAt: "2026-10-08T11:00:00.000Z" })]);
var service = new ReportService(repository);
var handlers = {
  create: createHandler({ service: service }),
  list: listHandler({ service: service }),
  get: getHandler({ service: service }),
  matches: matchesHandler({ service: service }),
  update: updateHandler({ service: service })
};
var originEvent = { Origin: "http://localhost:8000" };

var created = handlers.create(event("POST", {}, {}, JSON.stringify({ reportType: "LOST", title: "Blue umbrella", description: "Blue umbrella near the quad", category: "Other", location: "Main Quad", date: "2026-10-10" }), originEvent));
assert.equal(created.statusCode, 201, "workflow creates a report");
assert.equal(created.headers["Access-Control-Allow-Origin"], "http://localhost:8000", "approved origin is returned");
var createdReport = json(created).data;
assert.ok(createdReport.id, "created report has a server ID");

var listed = handlers.list(event("GET", {}, { reportType: "LOST", category: "Other", limit: "1" }, undefined, originEvent));
assert.equal(listed.statusCode, 200, "workflow lists reports");
assert.ok(json(listed).data.items.some(function (report) { return report.id === createdReport.id; }), "created report appears in filtered list");
assert.ok(json(listed).data.nextToken, "pagination returns a continuation token");
var nextPage = handlers.list(event("GET", {}, { reportType: "LOST", category: "Other", limit: "1", nextToken: json(listed).data.nextToken }, undefined, originEvent));
assert.equal(nextPage.statusCode, 200, "pagination continuation is accepted");

var retrieved = handlers.get(event("GET", { id: createdReport.id }, {}, undefined, originEvent));
assert.equal(retrieved.statusCode, 200, "workflow retrieves the created report");
assert.equal(json(retrieved).data.id, createdReport.id, "retrieved ID matches created ID");

var matches = handlers.matches(event("GET", { id: createdReport.id }, { threshold: "0" }, undefined, originEvent));
assert.equal(matches.statusCode, 200, "workflow requests matches");
assert.equal(json(matches).data.reportId, createdReport.id, "match response identifies source report");
assert.ok(Array.isArray(json(matches).data.matches), "match response has a matches array");
assert.ok(json(matches).data.matches.some(function (match) { return match.matchId === "found-seed"; }), "expected opposite-type candidate is returned");

var updated = handlers.update(event("PATCH", { id: createdReport.id }, {}, JSON.stringify({ status: "MATCHED", expectedVersion: 1 }), originEvent));
assert.equal(updated.statusCode, 200, "workflow updates status");
assert.equal(json(updated).data.report.status, "MATCHED", "status update is persisted");
var closed = handlers.update(event("PATCH", { id: createdReport.id }, {}, JSON.stringify({ status: "CLOSED", expectedVersion: 2 }), originEvent));
assert.equal(closed.statusCode, 200, "workflow closes report");
var invalidTransition = handlers.update(event("PATCH", { id: createdReport.id }, {}, JSON.stringify({ status: "MATCHED", expectedVersion: 3 }), originEvent));
assert.equal(invalidTransition.statusCode, 400, "closed report cannot transition back to matched");
assert.equal(json(invalidTransition).error.code, "INVALID_TRANSITION", "invalid transition uses the shared error contract");

assert.equal(handlers.get(event("GET", { id: "missing-report" }, {}, undefined, originEvent)).statusCode, 404, "missing report is handled consistently");
assert.equal(handlers.create(event("POST", {}, {}, "{", originEvent)).statusCode, 400, "malformed create payload is handled consistently");
assert.equal(handlers.list(event("GET", {}, { nextToken: "not-valid" }, undefined, originEvent)).statusCode, 400, "malformed pagination token is rejected");
assert.equal(handlers.get(event("GET", { id: "bad id" }, {}, undefined, originEvent)).statusCode, 400, "malformed report ID is rejected");

var disallowedOrigin = handlers.list(event("GET", {}, {}, undefined, { Origin: "https://unapproved.example" }));
assert.equal(disallowedOrigin.headers["Access-Control-Allow-Origin"], "null", "disallowed origin is not granted CORS access");

var png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
assert.equal(imageValidation.validateImage({ contentType: "image/png", body: png }).ok, true, "workflow image validation accepts matching bytes");
var storage = new LocalImageStorage();
var savedImage = storage.putImage({ userId: "student-1", reportId: createdReport.id, contentType: "image/png", body: png });
assert.deepEqual(Array.from(storage.getImage(savedImage.objectKey).body), Array.from(png), "workflow local image storage round-trips bytes");
assert.throws(function () { storage.getImage("../outside.png"); }, function (error) { return error.code === "IMAGE_KEY_INVALID"; }, "unsafe image keys are rejected");

console.log("PASS Phase 9 local end-to-end integration tests");
