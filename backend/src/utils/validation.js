"use strict";

var imageValidation = require("./image-validation");
var STATUS = Object.freeze({ ACTIVE: "ACTIVE", MATCHED: "MATCHED", RESOLVED: "RESOLVED", CLOSED: "CLOSED" });
var VALID_STATUSES = Object.keys(STATUS).map(function (key) { return STATUS[key]; });
var REPORT_TYPES = ["LOST", "FOUND"];

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function validDate(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value + "T12:00:00").getTime()); }
function validTime(value) { return value === undefined || value === "" || (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)); }
function validId(value) { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{1,127}$/.test(value); }
function validTimestamp(value) { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }

function validateCreateInput(input) {
  var options = arguments.length > 1 && arguments[1] ? arguments[1] : {};
  var errors = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, errors: ["Request body must be a JSON object."] };
  if (!text(input.title)) errors.push("title is required.");
  if (!text(input.description)) errors.push("description is required.");
  if (!REPORT_TYPES.includes(input.reportType)) errors.push("reportType must be LOST or FOUND.");
  if (!text(input.category)) errors.push("category is required.");
  if (!text(input.location)) errors.push("location is required.");
  if (!validDate(input.date)) errors.push("date must use YYYY-MM-DD.");
  if (!validTime(input.time)) errors.push("time must use HH:MM.");
  if (input.imageKey !== undefined && !options.allowServerFields) errors.push("imageKey is server-controlled and cannot be supplied by a client.");
  if (input.imageKey !== undefined && options.allowServerFields && !text(input.imageKey)) errors.push("imageKey must be a non-empty string when present.");
  if (input.userId !== undefined && !options.allowServerFields) errors.push("userId is server-controlled and cannot be supplied by a client.");
  if (input.imageMetadata !== undefined) {
    var image = imageValidation.validateMetadata({ contentType: input.imageMetadata && (input.imageMetadata.contentType || input.imageMetadata.type), size: input.imageMetadata && input.imageMetadata.size });
    if (!image.ok) errors.push("imageMetadata is invalid: " + image.error);
  }
  if (input.contact !== undefined && typeof input.contact !== "string") errors.push("contact must be a string when present.");
  return { ok: errors.length === 0, errors: errors };
}

function validateStoredReport(report) {
  var errors = [];
  if (!report || typeof report !== "object") return { ok: false, errors: ["Report must be an object."] };
  if (!validId(report.id)) errors.push("id is invalid.");
  var input = validateCreateInput(report, { allowServerFields: true });
  errors = errors.concat(input.errors);
  if (!VALID_STATUSES.includes(report.status)) errors.push("status is invalid.");
  if (!validTimestamp(report.createdAt) || !validTimestamp(report.updatedAt)) errors.push("createdAt and updatedAt must be valid timestamps.");
  if (!Number.isInteger(report.version) || report.version < 1) errors.push("version must be a positive integer.");
  return { ok: errors.length === 0, errors: errors };
}

function validateStatus(status) { return VALID_STATUSES.includes(status); }
function validateExpectedVersion(value) { return value === undefined || (Number.isInteger(Number(value)) && Number(value) >= 1); }
function parseJsonBody(event) {
  if (!event || event.body === undefined || event.body === null || event.body === "") return { ok: true, value: {} };
  try {
    var raw = typeof event.body === "string" ? event.body : JSON.stringify(event.body);
    if (event.isBase64Encoded) raw = Buffer.from(raw, "base64").toString("utf8");
    return { ok: true, value: JSON.parse(raw) };
  }
  catch (error) { return { ok: false, error: "Request body must contain valid JSON." }; }
}
function parsePagination(params) {
  params = params || {};
  var limit = params.limit === undefined || params.limit === "" ? 20 : Number(params.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return { ok: false, error: "limit must be an integer between 1 and 50." };
  if (params.nextToken !== undefined && params.nextToken !== "" && typeof params.nextToken !== "string") return { ok: false, error: "nextToken must be a string." };
  return { ok: true, limit: limit, nextToken: params.nextToken || undefined };
}

module.exports = { STATUS: STATUS, VALID_STATUSES: VALID_STATUSES, REPORT_TYPES: REPORT_TYPES, text: text, validId: validId, validateCreateInput: validateCreateInput, validateStoredReport: validateStoredReport, validateStatus: validateStatus, validateExpectedVersion: validateExpectedVersion, parseJsonBody: parseJsonBody, parsePagination: parsePagination };
