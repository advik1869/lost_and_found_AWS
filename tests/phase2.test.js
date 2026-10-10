/* Phase 2 tests use only Node's built-in assert/vm modules. No package install is required. */
"use strict";
var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

function makeStorage() {
  var values = {};
  return {
    getItem: function (key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
    setItem: function (key, value) { values[key] = String(value); },
    removeItem: function (key) { delete values[key]; },
    seed: function (key, value) { values[key] = value; }
  };
}

var storage = makeStorage();
var context = vm.createContext({
  window: { localStorage: storage, LOST_FOUND_SAMPLE_ITEMS: [] },
  console: console,
  Date: Date,
  JSON: JSON,
  Set: Set,
  Object: Object,
  Number: Number,
  String: String,
  Math: Math,
  RegExp: RegExp,
  Array: Array,
  Error: Error
});
context.globalThis = context;
function load(relativePath) { vm.runInContext(fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8"), context, { filename: relativePath }); }
load("frontend/data/items.js");
load("frontend/assets/js/data-service.js");
load("frontend/assets/js/matching-engine.js");
var data = context.window.LFData;
var matching = context.window.LFMatching;

function report(overrides) {
  return Object.assign({ reportType: "LOST", title: "Black HP laptop", description: "Black HP laptop with a silver sticker", category: "Electronics", location: "Central Library", date: "2026-10-08", time: "10:00", status: "ACTIVE" }, overrides || {});
}

assert.equal(data.getAllReports().length, 12, "sample records load");
var created = data.createReport(report({ title: "Test notebook" }));
assert.equal(created.ok, true, "valid report is created");
assert.match(created.report.id, /^local-/, "created report receives a local ID");
assert.equal(data.getReportById(created.report.id).title, "Test notebook", "created report is retrievable");
assert.equal(data.createReport(report({ id: "lf-1001" })).ok, false, "duplicate ID is rejected");
assert.equal(data.createReport(report({ title: "" })).ok, false, "invalid report is rejected");
assert.equal(data.createReport(report({ time: "99:99" })).ok, false, "invalid time is rejected");
assert.equal(data.createReport(report({ imageMetadata: { type: 4 } })).ok, false, "invalid image metadata is rejected");

var update = data.updateReport(created.report.id, { status: "MATCHED" });
assert.equal(update.ok, true, "valid status update succeeds");
assert.equal(data.getReportById(created.report.id).status, "MATCHED", "updated status is retrievable");
assert.equal(data.updateReport(created.report.id, { status: "ACTIVE" }).ok, true, "matched reports can return to active");
assert.equal(data.updateReport(created.report.id, { status: "CLOSED" }).ok, true, "active reports can close");
assert.equal(data.updateReport(created.report.id, { status: "ACTIVE" }).ok, false, "closed reports cannot reopen");
assert.equal(data.updateReport(created.report.id, { status: "NOT_A_STATUS" }).ok, false, "invalid status is rejected");
assert.equal(data.canTransition("ACTIVE", "MATCHED"), true, "valid transition recognized");
assert.equal(data.canTransition("RESOLVED", "ACTIVE"), false, "invalid transition recognized");

storage.seed(data.STORAGE_KEY, JSON.stringify([report({ id: "local-valid" }), { bad: true }]));
assert.equal(data.getReportById("local-valid").id, "local-valid", "valid data survives malformed neighbors");
assert.equal(data.getStorageStatus().invalidCount, 1, "malformed storage is reported");
storage.seed(data.STORAGE_KEY, "not-json");
assert.equal(data.getStorageStatus().ok, false, "malformed JSON is handled safely");

var lost = report({ id: "lost-1" });
var found = report({ id: "found-1", reportType: "FOUND", title: "Black HP laptop found near library", description: "Black HP laptop with a silver sticker", location: "Library entrance", date: "2026-10-09" });
var result = matching.scorePair(lost, found);
assert.ok(result && result.score >= 42, "compatible lost/found reports produce a match");
assert.ok(result.reasons.length >= 3, "match includes explanations");
assert.equal(matching.scorePair(lost, report({ id: "lost-2" })), null, "same-type reports do not match");
assert.equal(matching.scorePair(lost, lost), null, "a report cannot match itself");
assert.equal(matching.scorePair(lost, Object.assign({}, found, { status: "CLOSED" })), null, "closed reports are excluded");
assert.doesNotThrow(function () { matching.scorePair(lost, { id: "found-minimal", reportType: "FOUND", category: "Other", status: "ACTIVE" }); }, "missing optional fields are safe");
var first = matching.findMatches(lost, [found, Object.assign({}, found, { id: "found-2" })]);
var second = matching.findMatches(lost, [found, Object.assign({}, found, { id: "found-2" })]);
assert.deepEqual(first, second, "matching is deterministic");

console.log("PASS Phase 2 data service, status lifecycle, and matching tests");
