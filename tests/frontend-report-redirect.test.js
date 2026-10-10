"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var vm = require("node:vm");

var source = fs.readFileSync("frontend/assets/js/report.js", "utf8");
var context = {
  window: {},
  document: { addEventListener: function () {} },
  LFUI: {},
  URLSearchParams: URLSearchParams,
  Array: Array,
  Boolean: Boolean,
  Object: Object,
  String: String
};
vm.runInNewContext(source, context);

assert.equal(context.window.LFReport.createdReportForRedirect({ ok: true, report: { id: "report-api-created" } }).id, "report-api-created", "API response ID is used for the redirect");
assert.equal(context.window.LFReport.createdReportForRedirect({ ok: true, report: { title: "missing id" } }), null, "missing API ID blocks navigation");
console.log("PASS frontend report redirect regression tests");
