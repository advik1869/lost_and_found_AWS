"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var vm = require("node:vm");

var source = fs.readFileSync("frontend/assets/js/data-service.js", "utf8");
var requested = { id: "report-status-1", reportType: "LOST", title: "Black bagpack", description: "Black bagpack", category: "Bags", location: "Library", date: "2026-10-10", status: "ACTIVE", version: 1, createdAt: "2026-10-10T10:00:00.000Z", updatedAt: "2026-10-10T10:00:00.000Z" };
var calls = [];
var page = {
  LFConfig: { mode: "api", apiBaseUrl: "https://api.example.test" },
  LFAPI: {
    isEnabled: function () { return true; },
    updateReportStatus: function (id, status, expectedVersion) {
      calls.push({ id: id, status: status, expectedVersion: expectedVersion });
      return Promise.resolve({ data: { report: Object.assign({}, requested, { status: status, version: expectedVersion + 1 }) } });
    }
  },
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  LOST_FOUND_SAMPLE_ITEMS: []
};
var context = { window: page, Set: Set, Promise: Promise, JSON: JSON, Date: Date, Number: Number, Object: Object, Array: Array, RegExp: RegExp, console: console };
vm.runInNewContext(source, context);

assert.deepEqual(page.LFData.allowedStatuses(requested), ["ACTIVE", "MATCHED", "CLOSED"], "ACTIVE reports expose only contract-valid transitions");
assert.deepEqual(page.LFData.allowedStatuses(Object.assign({}, requested, { status: "CLOSED" })), ["CLOSED"], "closed reports cannot transition back to active states");
assert.equal(page.LFData.canTransition("ACTIVE", "RESOLVED"), false, "ACTIVE to RESOLVED is not a valid contract transition");
assert.equal(page.LFData.canTransition("CLOSED", "RESOLVED"), false, "closed to resolved remains invalid");

page.LFData.updateReportAsync(requested.id, { status: "RESOLVED", expectedVersion: requested.version }).then(function (result) {
  assert.equal(result.ok, true, "API-mode status update succeeds");
  assert.equal(result.report.status, "RESOLVED", "API response status is returned");
  assert.deepEqual(calls, [{ id: requested.id, status: "RESOLVED", expectedVersion: 1 }], "API receives the report ID and optimistic version");
  console.log("PASS frontend status transition and API update tests");
}).catch(function (error) { console.error(error); process.exitCode = 1; });
