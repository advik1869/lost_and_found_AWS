"use strict";

var response = require("../utils/response");
var helpers = require("./_helpers");
var runtime = require("../runtime");
var authorization = require("../auth/authorization");

function createHandler(dependencies) {
  return function (event) {
    if (helpers.method(event) === "OPTIONS") return response.response(204, {}, null, event);
    if (helpers.method(event) !== "POST") return helpers.methodNotAllowed(["POST", "OPTIONS"], event);
    return helpers.run(function () {
      var body = helpers.requireJson(event);
      if (!body || Object.keys(body).some(function (key) { return key !== "expectedVersion"; })) {
        var invalid = new Error("Only expectedVersion may be supplied."); invalid.code = "VALIDATION_ERROR"; invalid.details = [invalid.message]; throw invalid;
      }
      return helpers.resolve(dependencies.service.getReport(helpers.pathId(event)), function (report) {
        if (!report) return response.error(404, "NOT_FOUND", "Report was not found.", undefined, event);
        var principal = helpers.requireAuthorization(dependencies, authorization.ACTIONS.REQUEST_IMAGE_UPLOAD, event, report);
        return helpers.resolve(dependencies.service.completeImageUpload(helpers.pathId(event), body.expectedVersion), function (updated) {
          return helpers.resolve(dependencies.service._decorateReport(updated), function (publicReport) {
            return helpers.ok(200, { report: publicReport, authorization: principal ? "policy checked; verified authentication still required at deployment" : "not implemented; local demo mode only" }, event);
          });
        });
      });
    }, event);
  };
}

module.exports = { handler: createHandler({ service: runtime.service, enforceAuth: runtime.config.enforceAuth }), createHandler: createHandler };
