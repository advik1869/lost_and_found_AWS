"use strict";

var response = require("../utils/response");
var helpers = require("./_helpers");
var runtime = require("../runtime");
var authorization = require("../auth/authorization");

function createHandler(dependencies) {
  return function (event) {
    if (helpers.method(event) === "OPTIONS") return response.response(204, {}, null, event);
    if (!["PATCH", "PUT"].includes(helpers.method(event))) return helpers.methodNotAllowed(["PATCH", "PUT", "OPTIONS"], event);
    return helpers.run(function () { var body = helpers.requireJson(event); if (!body || typeof body.status !== "string" || Object.keys(body).some(function (key) { return !["status", "expectedVersion"].includes(key); })) { var invalid = new Error("Only status and optional expectedVersion may be supplied."); invalid.code = "VALIDATION_ERROR"; invalid.details = [invalid.message]; throw invalid; } return helpers.resolve(dependencies.service.getReport(helpers.pathId(event)), function (current) { if (!current) return response.error(404, "NOT_FOUND", "Report was not found.", undefined, event); var principal = helpers.requireAuthorization(dependencies, authorization.ACTIONS.UPDATE_STATUS, event, current); return helpers.resolve(dependencies.service.updateReportStatus(helpers.pathId(event), body.status, body.expectedVersion), function (result) { return helpers.ok(200, { report: result, authorization: principal ? "policy checked; verified authentication still required at deployment" : "not implemented; local demo mode only" }, event); }); }); }, event);
  };
}

module.exports = { handler: createHandler({ service: runtime.service, enforceAuth: runtime.config.enforceAuth }), createHandler: createHandler };
