"use strict";

var config = require("../config").loadConfig(process.env);
var CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": config.corsAllowedOrigins[0],
  "Cache-Control": "no-store",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS"
};

function requestOrigin(event) {
  var requestHeaders = event && event.headers || {};
  var origin = requestHeaders.origin || requestHeaders.Origin;
  if (!origin) return CORS_HEADERS["Access-Control-Allow-Origin"];
  return config.corsAllowedOrigins.includes(origin) ? origin : "null";
}
function response(statusCode, body, headers, event) {
  var cors = Object.assign({}, CORS_HEADERS, { "Access-Control-Allow-Origin": requestOrigin(event) });
  return { statusCode: statusCode, headers: Object.assign(cors, headers || {}), body: JSON.stringify(body) };
}

function ok(statusCode, data, event) { return response(statusCode, { data: data }, null, event); }
function error(statusCode, code, message, details, event) {
  var body = { error: { code: code, message: message } };
  if (details && details.length) body.error.details = details;
  return response(statusCode, body, null, event);
}

function methodNotAllowed(allowed, event) { return response(405, { error: { code: "METHOD_NOT_ALLOWED", message: "HTTP method is not supported for this operation." } }, { Allow: allowed.join(", ") }, event); }

module.exports = { response: response, ok: ok, error: error, methodNotAllowed: methodNotAllowed };
