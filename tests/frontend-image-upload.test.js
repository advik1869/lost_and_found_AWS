"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var vm = require("node:vm");

var source = fs.readFileSync("frontend/assets/js/data-service.js", "utf8");
var calls = [];
var page = {
  LFConfig: { mode: "api", apiBaseUrl: "https://api.example.test" },
  LFAPI: {
    isEnabled: function () { return true; },
    createImageUploadIntent: function (id, metadata, version) { calls.push(["intent", id, metadata, version]); return Promise.resolve({ data: { image: { uploadUrl: "https://signed.example/image", headers: { "Content-Type": metadata.contentType }, version: 2 } } }); },
    completeImageUpload: function (id, version) { calls.push(["complete", id, version]); return Promise.resolve({ data: { report: { id: id, version: 3, imageUrl: "https://signed.example/read" } } }); }
  },
  fetch: function (url, options) { calls.push(["put", url, options.method, options.body]); return Promise.resolve({ ok: true }); },
  localStorage: { getItem: function () { return null; }, setItem: function () {} },
  LOST_FOUND_SAMPLE_ITEMS: []
};
var context = { window: page, Set: Set, Promise: Promise, JSON: JSON, Date: Date, Number: Number, Object: Object, Array: Array, RegExp: RegExp, console: console };
vm.runInNewContext(source, context);

page.LFData.uploadImageAsync("report-1", { type: "image/png", size: 123 }, 1).then(function (result) {
  assert.equal(result.ok, true, "API image upload completes");
  assert.equal(result.report.imageUrl, "https://signed.example/read");
  assert.equal(calls[0][0], "intent");
  assert.equal(calls[1][0], "put");
  assert.equal(calls[2][0], "complete");
  console.log("PASS frontend image upload flow tests");
}).catch(function (error) { console.error(error); process.exitCode = 1; });
