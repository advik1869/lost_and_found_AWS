"use strict";

var response = require("../utils/response");
var helpers = require("./_helpers");
var runtime = require("../runtime");

function createHandler(dependencies) {
  function listBody(result) {
    var body = { items: result.items, nextToken: result.nextToken };
    if (result.totalInLocalRepository !== undefined) body.localRepositoryCount = result.totalInLocalRepository;
    return body;
  }
  return function (event) {
    if (helpers.method(event) === "OPTIONS") return response.response(204, {}, null, event);
    if (helpers.method(event) !== "GET") return helpers.methodNotAllowed(["GET", "OPTIONS"], event);
    return helpers.run(function () {
      var query = helpers.params(event); var page = helpers.pagination(event);
      if (query.userId) {
        var principal = dependencies.enforceAuth ? helpers.requirePrincipal(event) : helpers.actor(event);
        if (!principal) return response.error(401, "AUTHENTICATION_REQUIRED", "User report queries require a trusted authenticated identity.", undefined, event);
        var result = dependencies.service.listReportsByUser(principal.userId, page);
        return helpers.resolve(result, function (resolved) { return helpers.ok(200, listBody(resolved), event); });
      }
      var result = dependencies.service.listReports({ reportType: query.reportType, category: query.category, location: query.location, status: query.status }, page);
      return helpers.resolve(result, function (resolved) { return helpers.ok(200, listBody(resolved), event); });
    }, event);
  };
}

module.exports = { handler: createHandler({ service: runtime.service, enforceAuth: runtime.config.enforceAuth }), createHandler: createHandler };
