"use strict";

process.env.APP_ENV = "test";
process.env.AUTH_MODE = "demo";
process.env.CORS_ALLOWED_ORIGINS = "http://localhost:8000,http://foundly-frontend-380030254399.s3-website-us-east-1.amazonaws.com";
process.env.REPORT_REPOSITORY = "in-memory";
process.env.IMAGE_STORAGE = "local";

var assert = require("node:assert/strict");
var InMemoryReportRepository = require("../src/repositories/in-memory-report-repository");
var ReportService = require("../src/services/report-service");
var createLambdaHandler = require("../lambda").createHandler;

var localOrigin = "http://localhost:8000";
var deployedOrigin = "http://foundly-frontend-380030254399.s3-website-us-east-1.amazonaws.com";
var repository = new InMemoryReportRepository([]);
var handler = createLambdaHandler({ service: new ReportService(repository), enforceAuth: false });

function event(method, path, origin) {
  return { version: "2.0", rawPath: path, requestContext: { http: { method: method, path: path } }, headers: { Origin: origin, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": "Content-Type,Authorization" }, queryStringParameters: {}, pathParameters: {} };
}

async function run() {
  for (var origin of [localOrigin, deployedOrigin]) {
    var response = await handler(event("GET", "/reports", origin));
    assert.equal(response.headers["Access-Control-Allow-Origin"], origin, "allowlisted origin is returned: " + origin);
  }

  var unknown = await handler(event("GET", "/reports", "https://unknown.example"));
  assert.equal(unknown.headers["Access-Control-Allow-Origin"], "null", "unknown origin is rejected");

  for (var preflight of [
    ["POST", "/reports"],
    ["PATCH", "/reports/report-1/status"]
  ]) {
    var options = await handler(event("OPTIONS", preflight[1], deployedOrigin));
    assert.equal(options.statusCode, 204, "OPTIONS succeeds for " + preflight[0]);
    assert.equal(options.headers["Access-Control-Allow-Origin"], deployedOrigin, "preflight allows deployed origin");
    assert.equal(options.headers["Access-Control-Allow-Headers"], "Content-Type,Authorization", "preflight preserves request headers");
    assert.equal(options.headers["Access-Control-Allow-Methods"], "GET,POST,PATCH,OPTIONS", "preflight preserves methods");
  }

  console.log("PASS focused CORS allowlist and preflight tests");
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
