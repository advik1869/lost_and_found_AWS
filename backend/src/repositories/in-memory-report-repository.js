"use strict";

var validation = require("../utils/validation");
var ReportRepository = require("./report-repository");

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function encodeOffset(offset) { return Buffer.from(JSON.stringify({ offset: offset }), "utf8").toString("base64url"); }
function decodeOffset(token) {
  if (!token) return 0;
  try { var parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8")); if (!Number.isInteger(parsed.offset) || parsed.offset < 0) throw new Error("invalid"); return parsed.offset; }
  catch (error) { var invalid = new Error("INVALID_NEXT_TOKEN"); invalid.code = "INVALID_NEXT_TOKEN"; throw invalid; }
}

function InMemoryReportRepository(seed) {
  ReportRepository.call(this);
  this.records = new Map();
  (seed || []).forEach(this.createReport.bind(this));
}

InMemoryReportRepository.prototype = Object.create(ReportRepository.prototype);
InMemoryReportRepository.prototype.constructor = InMemoryReportRepository;

InMemoryReportRepository.prototype.createReport = function (report) {
  var checked = validation.validateStoredReport(report);
  if (!checked.ok) { var invalid = new Error(checked.errors.join(" ")); invalid.code = "VALIDATION_ERROR"; invalid.details = checked.errors; throw invalid; }
  if (this.records.has(report.id)) { var conflict = new Error("Report ID already exists."); conflict.code = "DUPLICATE_REPORT"; throw conflict; }
  this.records.set(report.id, clone(report));
  return clone(report);
};

InMemoryReportRepository.prototype.getReportById = function (id) { return this.records.has(id) ? clone(this.records.get(id)) : null; };

InMemoryReportRepository.prototype.listReports = function (filters, pagination) {
  filters = filters || {}; pagination = pagination || { limit: 20 };
  var offset = decodeOffset(pagination.nextToken);
  var items = Array.from(this.records.values()).filter(function (report) {
    return (!filters.reportType || report.reportType === filters.reportType) && (!filters.category || report.category === filters.category) && (!filters.location || report.location === filters.location) && (!filters.status || report.status === filters.status) && (!filters.userId || report.userId === filters.userId);
  }).sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id); });
  var page = items.slice(offset, offset + pagination.limit).map(clone);
  return { items: page, nextToken: offset + page.length < items.length ? encodeOffset(offset + page.length) : null, totalInLocalRepository: items.length };
};

InMemoryReportRepository.prototype.listReportsByUser = function (userId, pagination) {
  return this.listReports({ userId: userId }, pagination);
};

InMemoryReportRepository.prototype.updateReportStatus = function (id, status, expectedVersion) {
  var current = this.records.get(id);
  if (!current) { var missing = new Error("Report was not found."); missing.code = "NOT_FOUND"; throw missing; }
  if (expectedVersion !== undefined && current.version !== Number(expectedVersion)) { var conflict = new Error("Report changed since it was read."); conflict.code = "VERSION_CONFLICT"; throw conflict; }
  var next = clone(current); next.status = status; next.version += 1; next.updatedAt = new Date().toISOString();
  this.records.set(id, next); return clone(next);
};

InMemoryReportRepository.prototype.deleteMatchedPair = function (firstId, secondId, expectedVersions) {
  var first = this.records.get(firstId); var second = this.records.get(secondId);
  expectedVersions = expectedVersions || {};
  if (!first || !second || first.reportType === second.reportType || first.status !== "ACTIVE" || second.status !== "ACTIVE" || first.version !== Number(expectedVersions.first) || second.version !== Number(expectedVersions.second)) return { deleted: false, reason: "MATCH_CONFLICT" };
  this.records.delete(firstId); this.records.delete(secondId);
  return { deleted: true, reportIds: [firstId, secondId] };
};

InMemoryReportRepository.prototype.setPendingImage = function (id, pending, expectedVersion) {
  var current = this.records.get(id);
  if (!current) { var missing = new Error("Report was not found."); missing.code = "NOT_FOUND"; throw missing; }
  if (current.version !== Number(expectedVersion)) { var conflict = new Error("Report changed since it was read."); conflict.code = "VERSION_CONFLICT"; throw conflict; }
  var next = clone(current); next.pendingImageKey = pending.pendingImageKey; next.pendingImageMetadata = clone(pending.pendingImageMetadata); next.version += 1; next.updatedAt = new Date().toISOString(); this.records.set(id, next); return clone(next);
};

InMemoryReportRepository.prototype.completeImageUpload = function (id, image, expectedVersion) {
  var current = this.records.get(id);
  if (!current) { var missing = new Error("Report was not found."); missing.code = "NOT_FOUND"; throw missing; }
  if (current.version !== Number(expectedVersion)) { var conflict = new Error("Report changed since it was read."); conflict.code = "VERSION_CONFLICT"; throw conflict; }
  var next = clone(current); next.imageKey = image.imageKey; next.imageMetadata = clone(image.imageMetadata); delete next.pendingImageKey; delete next.pendingImageMetadata; next.version += 1; next.updatedAt = new Date().toISOString(); this.records.set(id, next); return clone(next);
};

module.exports = InMemoryReportRepository;
