"use strict";

var assert = require("node:assert/strict");
var InMemoryReportRepository = require("../src/repositories/in-memory-report-repository");
var ReportService = require("../src/services/report-service");
var routes = require("../src/http-routes");

function fixture() { return { id: "image-report", reportType: "LOST", title: "Blue bag", description: "Blue bag with a patch", category: "Bags", location: "Library", date: "2026-10-09", time: "10:00", status: "ACTIVE", createdAt: "2026-10-09T11:00:00.000Z", updatedAt: "2026-10-09T11:00:00.000Z", version: 1 }; }
function event(method, path, body) { return { httpMethod: method, rawPath: path, requestContext: { http: { method: method, path: path } }, pathParameters: { id: "image-report" }, body: body === undefined ? undefined : JSON.stringify(body) }; }
function json(result) { return JSON.parse(result.body); }

async function run() {
  var storage = { createUploadIntent: function () { return { uploadUrl: "https://upload.example", headers: { "Content-Type": "image/png" }, expiresIn: 300, objectKey: "report-images/image-report/file.png", contentType: "image/png", size: 123 }; }, completeUpload: function (input) { return { objectKey: input.objectKey, contentType: input.contentType, size: input.size }; }, createReadUrl: function () { return "https://read.example/image.png"; } };
  var service = new ReportService(new InMemoryReportRepository([fixture()]), storage);
  var handlers = routes.createHandlers({ service: service, enforceAuth: false });
  var intent = handlers.imageUpload(event("POST", "/reports/image-report/image-upload", { contentType: "image/png", size: 123, expectedVersion: 1 }));
  assert.equal(intent.statusCode, 200);
  assert.equal(json(intent).data.image.version, 2);
  assert.equal(json(intent).data.image.objectKey, undefined, "private object key is not returned");
  var complete = await handlers.imageComplete(event("POST", "/reports/image-report/image-complete", { expectedVersion: 2 }));
  assert.equal(complete.statusCode, 200);
  assert.equal(json(complete).data.report.imageUrl, "https://read.example/image.png");
  assert.equal(json(complete).data.report.imageKey, undefined, "private object key is not returned");
  var invalid = await handlers.imageUpload(event("POST", "/reports/image-report/image-upload", { contentType: "image/gif", size: 123, expectedVersion: 3 }));
  assert.equal(invalid.statusCode, 400);
  assert.equal(json(invalid).error.code, "IMAGE_VALIDATION_ERROR");
  console.log("PASS image upload API integration tests");
}

Promise.resolve(run()).catch(function (error) { console.error(error); process.exitCode = 1; });
