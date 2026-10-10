"use strict";

var crypto = require("node:crypto");
var validation = require("../utils/validation");
var imageValidation = require("../utils/image-validation");
var matching = require("./matching-service");

function now() { return new Date().toISOString(); }
function eventAt(date, time) { return date + "T" + (time || "00:00") + ":00Z"; }
function reportId() { return "report-" + crypto.randomUUID(); }
function transitionAllowed(from, to) {
  var transitions = { ACTIVE: ["ACTIVE", "MATCHED", "CLOSED"], MATCHED: ["MATCHED", "ACTIVE", "RESOLVED", "CLOSED"], RESOLVED: ["RESOLVED", "CLOSED"], CLOSED: ["CLOSED"] };
  return transitions[from] && transitions[from].includes(to);
}
function isPromise(value) { return value && typeof value.then === "function"; }
function resolve(value, callback) { return isPromise(value) ? value.then(callback) : callback(value); }

function ReportService(repository, imageStorage) { this.repository = repository; this.imageStorage = imageStorage; }

function imageStorageError() { var error = new Error("Image storage is not configured for this API."); error.code = "IMAGE_STORAGE_UNAVAILABLE"; return error; }

ReportService.prototype.createReport = function (input, actor) {
  var checked = validation.validateCreateInput(input);
  if (!checked.ok) { var invalid = new Error(checked.errors.join(" ")); invalid.code = "VALIDATION_ERROR"; invalid.details = checked.errors; throw invalid; }
  var timestamp = now();
  var report = { id: reportId(), reportType: input.reportType, title: input.title.trim(), description: input.description.trim(), category: input.category.trim(), location: input.location.trim(), date: input.date, time: input.time || "", status: validation.STATUS.ACTIVE, createdAt: timestamp, updatedAt: timestamp, version: 1, eventAt: eventAt(input.date, input.time), contact: input.contact ? input.contact.trim() : undefined, userId: actor && actor.userId ? actor.userId : undefined };
  var self = this;
  return resolve(this.repository.createReport(report), function (created) {
    var opposite = created.reportType === "LOST" ? "FOUND" : "LOST";
    return resolve(self.repository.listReports({ reportType: opposite, status: validation.STATUS.ACTIVE }, { limit: 50 }), function (result) {
      var candidates = result && Array.isArray(result.items) ? result.items : [];
      var matches = matching.highConfidenceMatches(created, candidates);
      if (!matches.length || typeof self.repository.deleteMatchedPair !== "function") return created;
      var candidate = candidates.find(function (item) { return item.id === matches[0].matchId; });
      return resolve(self.repository.deleteMatchedPair(created.id, candidate.id, { first: created.version, second: candidate.version }), function (deleted) {
        if (deleted && deleted.deleted) {
          var imageEntries = [{ key: created.imageKey, reportId: created.id }, { key: candidate.imageKey, reportId: candidate.id }].filter(function (entry, index, values) { return entry.key && values.findIndex(function (value) { return value.key === entry.key; }) === index; });
          if (!imageEntries.length || !self.imageStorage || typeof self.imageStorage.deleteImage !== "function") return { deleted: true, matched: true, reportId: created.id, matchedReportId: candidate.id };
          var cleanup = imageEntries.map(function (entry) {
            try { return Promise.resolve(self.imageStorage.deleteImage(entry.key, entry.reportId)); }
            catch (error) { return Promise.reject(error); }
          });
          return Promise.allSettled(cleanup).then(function (results) {
            return { deleted: true, matched: true, reportId: created.id, matchedReportId: candidate.id, imageCleanupPending: results.some(function (result) { return result.status === "rejected"; }) };
          });
        }
        return created;
      });
    });
  });
};

ReportService.prototype.getReport = function (id) {
  if (!validation.validId(id)) { var invalid = new Error("Report ID is invalid."); invalid.code = "VALIDATION_ERROR"; throw invalid; }
  var self = this;
  return resolve(this.repository.getReportById(id), function (report) { return self._decorateReport(report); });
};

ReportService.prototype._decorateReport = function (report) {
  if (!report) return report;
  var decorated = Object.assign({}, report);
  delete decorated.pendingImageKey;
  delete decorated.pendingImageMetadata;
  delete decorated.imageKey;
  if (!report.imageKey || !this.imageStorage || typeof this.imageStorage.createReadUrl !== "function") return decorated;
  try {
    return Promise.resolve(this.imageStorage.createReadUrl(report.imageKey)).then(function (imageUrl) { decorated.imageUrl = imageUrl; return decorated; }).catch(function () { return decorated; });
  } catch (error) {
    return decorated;
  }
};

ReportService.prototype._decorateResult = function (result) {
  var self = this;
  if (!result || !Array.isArray(result.items)) return result;
  if (!result.items.some(function (report) { return report && report.imageKey; })) {
    return Object.assign({}, result, { items: result.items.map(function (report) { return self._decorateReport(report); }) });
  }
  var jobs = result.items.map(function (report) { return self._decorateReport(report); });
  return resolve(Promise.all(jobs), function (items) { return Object.assign({}, result, { items: items }); });
};

ReportService.prototype.listReports = function (filters, pagination) {
  if (filters.reportType && !validation.REPORT_TYPES.includes(filters.reportType)) { var invalid = new Error("reportType filter is invalid."); invalid.code = "VALIDATION_ERROR"; throw invalid; }
  if (filters.status && !validation.validateStatus(filters.status)) { var status = new Error("status filter is invalid."); status.code = "VALIDATION_ERROR"; throw status; }
  return this._decorateResult(this.repository.listReports(filters, pagination));
};

ReportService.prototype.listReportsByUser = function (userId, pagination) {
  if (!validation.validId(userId)) { var invalid = new Error("Authenticated user ID is invalid."); invalid.code = "VALIDATION_ERROR"; throw invalid; }
  return this._decorateResult(this.repository.listReportsByUser(userId, pagination));
};

ReportService.prototype.createImageUploadIntent = function (id, input, expectedVersion) {
  var self = this;
  if (!this.imageStorage || typeof this.imageStorage.createUploadIntent !== "function") throw imageStorageError();
  var checkedImage = imageValidation.validateMetadata({ contentType: input && input.contentType, size: input && input.size });
  if (!checkedImage.ok) { var invalidImage = new Error(checkedImage.error); invalidImage.code = "IMAGE_VALIDATION_ERROR"; invalidImage.details = checkedImage.details; throw invalidImage; }
  return resolve(this.repository.getReportById(id), function (report) {
    if (!report) { var missing = new Error("Report was not found."); missing.code = "NOT_FOUND"; throw missing; }
    if (!validation.validateExpectedVersion(expectedVersion) || Number(expectedVersion) !== report.version) { var conflict = new Error("Report changed since it was read."); conflict.code = "VERSION_CONFLICT"; throw conflict; }
    return resolve(self.imageStorage.createUploadIntent({ reportId: id, contentType: input && input.contentType, size: input && input.size }), function (intent) {
      return resolve(self.repository.setPendingImage(id, { pendingImageKey: intent.objectKey, pendingImageMetadata: { contentType: intent.contentType, size: intent.size } }, expectedVersion), function (updated) {
        return { uploadUrl: intent.uploadUrl, headers: intent.headers, expiresIn: intent.expiresIn, version: updated.version };
      });
    });
  });
};

ReportService.prototype.completeImageUpload = function (id, expectedVersion) {
  var self = this;
  if (!this.imageStorage || typeof this.imageStorage.completeUpload !== "function") throw imageStorageError();
  return resolve(this.repository.getReportById(id), function (report) {
    if (!report) { var missing = new Error("Report was not found."); missing.code = "NOT_FOUND"; throw missing; }
    if (!report.pendingImageKey || !report.pendingImageMetadata) { var pending = new Error("No pending image upload exists for this report."); pending.code = "IMAGE_UPLOAD_NOT_FOUND"; throw pending; }
    if (!validation.validateExpectedVersion(expectedVersion) || Number(expectedVersion) !== report.version) { var conflict = new Error("Report changed since it was read."); conflict.code = "VERSION_CONFLICT"; throw conflict; }
    return resolve(self.imageStorage.completeUpload({ reportId: id, objectKey: report.pendingImageKey, contentType: report.pendingImageMetadata.contentType, size: report.pendingImageMetadata.size }), function (verified) {
      return self.repository.completeImageUpload(id, { imageKey: verified.objectKey, imageMetadata: { contentType: verified.contentType, size: verified.size } }, expectedVersion);
    });
  });
};

ReportService.prototype.updateReportStatus = function (id, status, expectedVersion) {
  var self = this;
  return resolve(this.getReport(id), function (current) {
    if (!current) { var missing = new Error("Report was not found."); missing.code = "NOT_FOUND"; throw missing; }
    if (!validation.validateStatus(status)) { var invalid = new Error("status is invalid."); invalid.code = "VALIDATION_ERROR"; throw invalid; }
    if (!transitionAllowed(current.status, status)) { var transition = new Error("That status transition is not allowed."); transition.code = "INVALID_TRANSITION"; throw transition; }
    if (!validation.validateExpectedVersion(expectedVersion)) { var version = new Error("expectedVersion must be a positive integer."); version.code = "VALIDATION_ERROR"; throw version; }
    return self.repository.updateReportStatus(id, status, expectedVersion);
  });
};

ReportService.prototype.getMatches = function (id, threshold) {
  var self = this;
  return resolve(this.getReport(id), function (report) {
    if (!report) { var missing = new Error("Report was not found."); missing.code = "NOT_FOUND"; throw missing; }
    return resolve(self.repository.listReports({ reportType: report.reportType === "LOST" ? "FOUND" : "LOST", status: validation.STATUS.ACTIVE }, { limit: 50 }), function (result) {
      var candidates = result && Array.isArray(result.items) ? result.items : [];
      return { reportId: id, threshold: threshold === undefined ? matching.DEFAULT_THRESHOLD : threshold, matches: matching.findMatches(report, candidates, { threshold: threshold }) };
    });
  });
};

module.exports = ReportService;
