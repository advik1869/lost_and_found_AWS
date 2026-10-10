"use strict";

var assert = require("node:assert/strict");
var ReportService = require("../src/services/report-service");
var updateHandler = require("../src/handlers/update-report-status").createHandler;

var report = { id: "report-a764caf3-2550-40c4-9e79-df0b3dccfce6", reportType: "LOST", title: "Black bagpack", description: "Black bagpack", category: "Bags", location: "Library", date: "2026-10-10", time: "", eventAt: "2026-10-10T00:00:00Z", status: "ACTIVE", createdAt: "2026-10-10T10:00:00.000Z", updatedAt: "2026-10-10T10:00:00.000Z", version: 1 };

function asyncRepository(current, update) {
  return {
    getReportById: function () { return Promise.resolve(current); },
    updateReportStatus: function (id, status, expectedVersion) {
      assert.equal(id, report.id);
      assert.equal(status, update.status);
      assert.equal(expectedVersion, 1);
      return Promise.resolve(Object.assign({}, current, update, { version: 2 }));
    }
  };
}

async function run() {
  var service = new ReportService(asyncRepository(report, { status: "MATCHED", updatedAt: "2026-10-10T11:00:00.000Z" }));
  var updated = await service.updateReportStatus(report.id, "MATCHED", 1);
  assert.equal(updated.status, "MATCHED", "ACTIVE to MATCHED succeeds with an async repository");
  assert.equal(updated.version, 2, "successful update advances the version");

  var handler = updateHandler({ service: service, enforceAuth: false });
  var response = await handler({ httpMethod: "PATCH", pathParameters: { id: report.id }, body: JSON.stringify({ status: "RESOLVED", expectedVersion: 1 }), headers: {} });
  assert.equal(response.statusCode, 400, "active reports cannot be resolved as a substitute for matching");

  var closed = Object.assign({}, report, { status: "CLOSED" });
  var invalidService = new ReportService({ getReportById: function () { return Promise.resolve(closed); }, updateReportStatus: function () { throw new Error("must not update an invalid transition"); } });
  await assert.rejects(invalidService.updateReportStatus(report.id, "RESOLVED", 1), function (error) { return error.code === "INVALID_TRANSITION"; }, "invalid transitions remain rejected");

  var conflictService = new ReportService({ getReportById: function () { return Promise.resolve(Object.assign({}, report, { status: "MATCHED" })); }, updateReportStatus: function () { var error = new Error("Report changed since it was read."); error.code = "VERSION_CONFLICT"; return Promise.reject(error); } });
  await assert.rejects(conflictService.updateReportStatus(report.id, "RESOLVED", 1), function (error) { return error.code === "VERSION_CONFLICT"; }, "version conflicts remain preserved");
  console.log("PASS async status transition regression tests");
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
