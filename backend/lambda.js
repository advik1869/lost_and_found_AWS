"use strict";

var runtime = require("./src/runtime");
var response = require("./src/utils/response");
var routes = require("./src/http-routes");

function eventPath(event) {
  return event.rawPath || event.requestContext && event.requestContext.http && event.requestContext.http.path || "/";
}

function eventMethod(event) {
  return event.requestContext && event.requestContext.http && event.requestContext.http.method || event.httpMethod || "GET";
}

function toHandlerEvent(event, route) {
  var method = eventMethod(event);
  var suppliedPathParameters = event.pathParameters || {};
  // Derive known parameters from rawPath as a fallback for HTTP API routes
  // whose integration supplies a differently named or empty parameter map.
  // This keeps the validated route ID intact without accepting arbitrary IDs.
  var pathParameters = Object.assign({}, suppliedPathParameters, route.pathParameters || {});
  return Object.assign({}, event, {
    version: event.version || "2.0",
    routeKey: event.routeKey || method + " " + eventPath(event),
    rawPath: eventPath(event),
    httpMethod: method,
    pathParameters: pathParameters,
    queryStringParameters: event.queryStringParameters || {},
    headers: event.headers || {},
    requestContext: event.requestContext || { http: { method: method, path: eventPath(event) } }
  });
}

function createHandler(dependencies) {
  dependencies = dependencies || runtime;
  var handlers = routes.createHandlers(dependencies);
  return function (event) {
    event = event || {};
    var path = eventPath(event);
    var method = eventMethod(event);
    var route = routes.routeFor(path, method);
    if (!route) return Promise.resolve(response.error(404, "NOT_FOUND", "Route was not found.", undefined, event));
    try {
      return Promise.resolve(handlers[route.handler](toHandlerEvent(event, route)));
    } catch (error) {
      return Promise.resolve(response.error(500, "INTERNAL_ERROR", "An unexpected error occurred.", undefined, event));
    }
  };
}

var handler = createHandler();

module.exports = { handler: handler, createHandler: createHandler, toHandlerEvent: toHandlerEvent };
