"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var vm = require("node:vm");

var source = fs.readFileSync("frontend/assets/js/data-service.js", "utf8");
var requestedId = "report-a764caf3-2550-40c4-9e79-df0b3dccfce6";
var calls = [];
var page = {
  LFConfig: { mode: "api", apiBaseUrl: "https://api.example.test" },
  LFAPI: {
    isEnabled: function () { return true; },
    getReport: function (id) { calls.push(id); return Promise.resolve({ data: { id: id, title: "black bagpack" } }); }
  },
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  LOST_FOUND_SAMPLE_ITEMS: []
};
var context = { window: page, Set: Set, Promise: Promise, JSON: JSON, Date: Date, Number: Number, Object: Object, Array: Array, RegExp: RegExp, console: console };
vm.runInNewContext(source, context);

page.LFData.getReportAsync(requestedId).then(function (report) {
  assert.equal(report.id, requestedId, "API-mode item details return the requested report");
  assert.deepEqual(calls, [requestedId], "item details request the exact card-link ID");
  console.log("PASS frontend API-mode item-detail regression test");
}).catch(function (error) { console.error(error); process.exitCode = 1; });
