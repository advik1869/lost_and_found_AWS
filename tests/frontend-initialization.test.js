"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var vm = require("node:vm");

var configSource = fs.readFileSync("frontend/assets/js/config.js", "utf8");
var dataSource = fs.readFileSync("frontend/assets/js/data-service.js", "utf8");

var writes = [];
var configContext = { window: {}, document: { currentScript: {}, write: function (value) { writes.push(value); } } };
vm.runInNewContext(configSource, configContext);
assert.deepEqual(writes, ['<script src="/assets/js/api.js"></script>'], "config injects a valid API script element");
assert.equal(configContext.window.LFConfig.mode, "api", "deployed configuration stays in API mode");

var created;
var storage = { getItem: function () { return null; }, setItem: function () {} };
var api = {
  isEnabled: function () { return true; },
  createReport: function (report) {
    created = report;
    return Promise.resolve({ data: Object.assign({}, report, { id: "api-created" }) });
  }
};
var page = { LFConfig: { mode: "api", apiBaseUrl: "https://api.example.test" }, LFAPI: api, localStorage: storage, LOST_FOUND_SAMPLE_ITEMS: [] };
var context = { window: page, Set: Set, Promise: Promise, JSON: JSON, Date: Date, Number: Number, Object: Object, Array: Array, RegExp: RegExp, console: console };
vm.runInNewContext(dataSource, context);
var firstDataService = page.LFData;
vm.runInNewContext(dataSource, context);
assert.strictEqual(page.LFData, firstDataService, "data service initializes exactly once");

firstDataService.createReportAsync({ reportType: "LOST", title: "Blue keys", description: "Blue keys", category: "Other", location: "Library", date: "2026-10-10", status: "ACTIVE" }).then(function (result) {
  assert.equal(result.ok, true, "API-mode report submission succeeds");
  assert.equal(result.report.id, "api-created", "API response report is returned");
  assert.equal(created.title, "Blue keys", "API adapter receives the submitted report");
  console.log("PASS frontend initialization and API-mode report submission tests");
}).catch(function (error) { console.error(error); process.exitCode = 1; });
