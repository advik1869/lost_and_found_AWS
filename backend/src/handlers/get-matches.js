"use strict";

var response = require("../utils/response");
var helpers = require("./_helpers");
var runtime = require("../runtime");
var authorization = require("../auth/authorization");

function createHandler(dependencies) {
  return function (event) {
    if (helpers.method(event) === "OPTIONS") return response.response(204, {}, null, event);
    if (helpers.method(event) !== "GET") return helpers.methodNotAllowed(["GET", "OPTIONS"], event);
    return helpers.run(function () { var query = helpers.params(event); var threshold = query.threshold === undefined ? undefined : Number(query.threshold); if (threshold !== undefined && (!Number.isFinite(threshold) || threshold < 0 || threshold > 100)) { var invalid = new Error("threshold must be a number between 0 and 100."); invalid.code = "VALIDATION_ERROR"; throw invalid; } return helpers.resolve(dependencies.service.getReport(helpers.pathId(event)), function (report) { if (!report) return response.error(404, "NOT_FOUND", "Report was not found.", undefined, event); helpers.requireAuthorization(dependencies, authorization.ACTIONS.READ_REPORT, event, report); return helpers.ok(200, dependencies.service.getMatches(helpers.pathId(event), threshold), event); }); }, event);
  };
}

module.exports = { handler: createHandler({ service: runtime.service, enforceAuth: runtime.config.enforceAuth }), createHandler: createHandler };
