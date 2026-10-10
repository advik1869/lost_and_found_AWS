"use strict";

var response = require("../utils/response");
var validation = require("../utils/validation");
var principal = require("../auth/principal");
var authorization = require("../auth/authorization");
var logger = require("../logger");

function method(event) { return event && (event.httpMethod || event.requestContext && event.requestContext.http && event.requestContext.http.method) || "GET"; }
function params(event) { return (event && event.queryStringParameters) || {}; }
function pathId(event) { return event && event.pathParameters && event.pathParameters.id; }
function actor(event) { return event && event.requestContext && event.requestContext.authorizer && event.requestContext.authorizer.userId ? { userId: event.requestContext.authorizer.userId } : null; }
function trustedPrincipal(event) { var result = principal.extractPrincipal(event); if (!result.ok) { var error = new Error(result.error); error.code = "AUTHENTICATION_INVALID"; throw error; } return result.principal; }
function requirePrincipal(event) { var current = trustedPrincipal(event); if (!current) { var error = new Error("Authentication is required for this action."); error.code = "AUTHENTICATION_REQUIRED"; throw error; } return current; }
function requireAuthorization(dependencies, action, event, report) {
  if (!dependencies || !dependencies.enforceAuth) return null;
  if (action === authorization.ACTIONS.BROWSE || (action === authorization.ACTIONS.READ_REPORT && report && report.status === "ACTIVE")) return null;
  var current = requirePrincipal(event);
  var decision = authorization.authorize(action, current, report);
  if (!decision.ok) { var error = new Error(decision.message); error.code = decision.code; throw error; }
  return current;
}
function errorToResponse(error) {
  if (error && error.code === "VALIDATION_ERROR") return response.error(400, "VALIDATION_ERROR", error.message, error.details, error.event);
  if (error && error.code === "DUPLICATE_REPORT") return response.error(409, "DUPLICATE_REPORT", "A report with that ID already exists.", undefined, error.event);
  if (error && error.code === "NOT_FOUND") return response.error(404, "NOT_FOUND", "Report was not found.", undefined, error.event);
  if (error && error.code === "INVALID_TRANSITION") return response.error(400, "INVALID_TRANSITION", error.message, undefined, error.event);
  if (error && error.code === "VERSION_CONFLICT") return response.error(409, "VERSION_CONFLICT", error.message, undefined, error.event);
  if (error && ["IMAGE_VALIDATION_ERROR", "IMAGE_BYTES_REQUIRED", "IMAGE_KEY_INVALID", "IMAGE_UPLOAD_NOT_FOUND"].includes(error.code)) return response.error(400, error.code, error.message, error.details, error.event);
  if (error && error.code === "IMAGE_UPLOAD_VERIFICATION_FAILED") return response.error(400, error.code, error.message, undefined, error.event);
  if (error && ["IMAGE_STORAGE_UNAVAILABLE", "LOCAL_UPLOAD_INTENT_UNSUPPORTED", "S3_SDK_UNAVAILABLE", "IMAGE_STORAGE_FAILURE", "INVALID_CONFIGURATION"].includes(error.code)) return response.error(503, error.code, "Image storage is unavailable.", undefined, error.event);
  if (error && error.code === "INVALID_NEXT_TOKEN") return response.error(400, "INVALID_NEXT_TOKEN", "nextToken is invalid.", undefined, error.event);
  if (error && error.code === "AUTHENTICATION_REQUIRED") return response.error(401, "AUTHENTICATION_REQUIRED", "Authentication is required for this action.", undefined, error.event);
  if (error && error.code === "AUTHENTICATION_INVALID") return response.error(401, "AUTHENTICATION_INVALID", "Authentication context is invalid.", undefined, error.event);
  if (error && ["ACCESS_DENIED", "ADMIN_REQUIRED"].includes(error.code)) return response.error(403, error.code, error.message, undefined, error.event);
  return response.error(500, "INTERNAL_ERROR", "An unexpected error occurred.", undefined, error && error.event);
}
function isPromise(value) { return value && typeof value.then === "function"; }
function resolve(value, callback) { return isPromise(value) ? value.then(callback) : callback(value); }
function ok(statusCode, data, event) { return resolve(data, function (resolved) { return response.ok(statusCode, resolved, event); }); }
function handleFailure(error, event) { var expected = ["VALIDATION_ERROR", "NOT_FOUND", "DUPLICATE_REPORT", "INVALID_TRANSITION", "VERSION_CONFLICT", "INVALID_NEXT_TOKEN", "AUTHENTICATION_REQUIRED", "AUTHENTICATION_INVALID", "ACCESS_DENIED", "ADMIN_REQUIRED", "IMAGE_VALIDATION_ERROR", "IMAGE_BYTES_REQUIRED", "IMAGE_KEY_INVALID", "IMAGE_UPLOAD_NOT_FOUND", "IMAGE_UPLOAD_VERIFICATION_FAILED", "IMAGE_STORAGE_UNAVAILABLE", "LOCAL_UPLOAD_INTENT_UNSUPPORTED", "S3_SDK_UNAVAILABLE", "IMAGE_STORAGE_FAILURE", "INVALID_CONFIGURATION"].includes(error && error.code); logger[expected ? "warn" : "error"]("request_failed", { code: error && error.code || "INTERNAL_ERROR", errorType: error && error.name || "Error" }); error.event = event; return errorToResponse(error); }
function run(operation, event) { try { var result = operation(); return isPromise(result) ? result.catch(function (error) { return handleFailure(error, event); }) : result; } catch (error) { return handleFailure(error, event); } }
function requireJson(event) { var parsed = validation.parseJsonBody(event); return parsed.ok ? parsed.value : (function () { var error = new Error(parsed.error); error.code = "VALIDATION_ERROR"; error.details = [parsed.error]; throw error; })(); }
function pagination(event) { var parsed = validation.parsePagination(params(event)); if (!parsed.ok) { var error = new Error(parsed.error); error.code = "VALIDATION_ERROR"; error.details = [parsed.error]; throw error; } return parsed; }

module.exports = { method: method, params: params, pathId: pathId, actor: actor, trustedPrincipal: trustedPrincipal, requirePrincipal: requirePrincipal, requireAuthorization: requireAuthorization, run: run, requireJson: requireJson, pagination: pagination, isPromise: isPromise, resolve: resolve, ok: ok, methodNotAllowed: response.methodNotAllowed };
