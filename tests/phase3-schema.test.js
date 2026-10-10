/* Phase 3 schema compatibility tests. Uses only Node's built-in modules. */
"use strict";
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

var storage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
var context = vm.createContext({ window: { localStorage: storage, LOST_FOUND_SAMPLE_ITEMS: [] }, Date: Date, JSON: JSON, Object: Object, Number: Number, String: String, RegExp: RegExp, Array: Array, Set: Set, Error: Error, console: console });
context.globalThis = context;
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "frontend/assets/js/data-service.js"), "utf8"), context);
var data = context.window.LFData;

function valid(overrides) {
  return Object.assign({ id: "schema-1", reportType: "FOUND", title: "Blue notebook", description: "Found beside the library desk", category: "Books", location: "Central Library", date: "2026-10-10", time: "12:30", status: "ACTIVE" }, overrides || {});
}

assert.equal(data.validateReport(valid()).ok, true, "core report schema is valid");
assert.equal(data.validateReport(valid({ userId: "user-demo", imageKey: "reports/schema-1/image.jpg", createdAt: "2026-10-10T10:00:00.000Z", updatedAt: "2026-10-10T10:05:00.000Z" })).ok, true, "future DynamoDB fields are compatible");
assert.equal(data.validateReport(valid({ reportType: "MAYBE" })).ok, false, "invalid report type is rejected");
assert.equal(data.validateReport(valid({ status: "ARCHIVED" })).ok, false, "invalid status is rejected");
assert.equal(data.validateReport(valid({ date: "10/10/2026" })).ok, false, "invalid date shape is rejected");
assert.equal(data.validateReport(valid({ createdAt: "not-a-timestamp" })).ok, false, "invalid timestamp is rejected");
assert.equal(data.validateReport(valid({ imageKey: "" })).ok, false, "empty image reference is rejected");
assert.equal(data.validateReport(valid({ userId: "" })).ok, false, "empty user ID is rejected");
assert.deepEqual(data.VALID_STATUSES, ["ACTIVE", "MATCHED", "RESOLVED", "CLOSED"], "status model is stable");

console.log("PASS Phase 3 local DynamoDB schema compatibility tests");
