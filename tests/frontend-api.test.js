var assert = require("node:assert/strict");
var fs = require("node:fs");
var vm = require("node:vm");

var source = fs.readFileSync("frontend/assets/js/api.js", "utf8");

function load(config, fetch) {
  var context = {
    window: { LFConfig: config, fetch: fetch, location: { href: "http://localhost:8000/frontend/" } },
    URL: URL,
    encodeURIComponent: encodeURIComponent,
    Promise: Promise,
    Object: Object,
    String: String,
    Boolean: Boolean,
    Error: Error
  };
  vm.runInNewContext(source, context);
  return context.window.LFAPI;
}

function response(status, body) {
  return { ok: status >= 200 && status < 300, status: status, text: function () { return Promise.resolve(body === undefined ? "" : JSON.stringify(body)); } };
}

async function run() {
  var local = load({ mode: "local-demo", apiBaseUrl: "" }, function () { throw new Error("fetch should not run in local mode"); });
  assert.equal(local.isEnabled(), false, "local mode does not enable network calls");
  await assert.rejects(local.listReports(), function (error) { return error.code === "API_NOT_CONFIGURED"; });

  var calls = [];
  var api = load({ mode: "api", apiBaseUrl: "https://api.example.test/root/" }, function (url, options) {
    calls.push({ url: url, options: options });
    return Promise.resolve(response(200, { data: { items: [] } }));
  });
  assert.equal(api.buildUrl("/reports", { category: "Books", limit: 20 }), "https://api.example.test/root/reports?category=Books&limit=20", "URL and query construction are stable");
  await api.createReport({ title: "Test item" });
  assert.equal(calls[0].url, "https://api.example.test/root/reports", "create uses the configured base URL");
  assert.equal(calls[0].options.method, "POST", "create uses POST");
  assert.equal(calls[0].options.cache, "no-store", "API requests do not reuse stale report responses");
  assert.equal(calls[0].options.headers["Content-Type"], "application/json", "JSON content type is sent");
  assert.equal(calls[0].options.body, JSON.stringify({ title: "Test item" }), "request body is JSON encoded");
  await api.createImageUploadIntent("report-1", { contentType: "image/png", size: 12 }, 1);
  assert.equal(calls[1].url, "https://api.example.test/root/reports/report-1/image-upload", "image intent uses the report-scoped route");
  assert.equal(calls[1].options.method, "POST");
  assert.equal(calls[1].options.body, JSON.stringify({ contentType: "image/png", size: 12, expectedVersion: 1 }));
  await api.completeImageUpload("report-1", 2);
  assert.equal(calls[2].url, "https://api.example.test/root/reports/report-1/image-complete", "image completion uses the report-scoped route");

  var failed = load({ mode: "api", apiBaseUrl: "https://api.example.test" }, function () {
    return Promise.resolve(response(404, { error: { code: "NOT_FOUND", message: "Report was not found." } }));
  });
  await assert.rejects(failed.getReport("missing id"), function (error) {
    return error.code === "NOT_FOUND" && error.status === 404 && error.message === "Report was not found.";
  }, "HTTP API errors preserve safe code/status/message");

  var unavailable = load({ mode: "api", apiBaseUrl: "https://api.example.test" }, function () { return Promise.reject(new Error("network down")); });
  await assert.rejects(unavailable.listReports(), function (error) { return error.code === "API_UNAVAILABLE"; });
  console.log("PASS frontend API adapter tests");
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
