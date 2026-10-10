"use strict";

var response = require("../utils/response");
var helpers = require("./_helpers");
var runtime = require("../runtime");
var authorization = require("../auth/authorization");

function createHandler(dependencies) {
  var service = dependencies.service;
  return function (event) {
    if (helpers.method(event) === "OPTIONS") return response.response(204, {}, null, event);
    if (helpers.method(event) !== "POST") return helpers.methodNotAllowed(["POST", "OPTIONS"], event);
    return helpers.run(function () { var principal = helpers.requireAuthorization(dependencies, authorization.ACTIONS.CREATE_REPORT, event); return helpers.ok(201, service.createReport(helpers.requireJson(event), principal || helpers.actor(event)), event); }, event);
  };
}

module.exports = { handler: createHandler({ service: runtime.service, enforceAuth: runtime.config.enforceAuth }), createHandler: createHandler };
