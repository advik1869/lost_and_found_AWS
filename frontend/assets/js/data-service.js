(function () {
  "use strict";

  // Keep one shared service if a page or test harness evaluates this file
  // more than once.
  if (window.LFData) return;

  // Pages remain local-first even when no public configuration file is supplied.
  var runtimeConfig = window.LFConfig || { mode: "local-demo", apiBaseUrl: "", isValid: true, warning: "" };

  var STORAGE_KEY = "lostFoundLocalReports";
  var STATUS = Object.freeze({ ACTIVE: "ACTIVE", MATCHED: "MATCHED", RESOLVED: "RESOLVED", CLOSED: "CLOSED" });
  var VALID_STATUSES = Object.keys(STATUS).map(function (key) { return STATUS[key]; });
  var statusAliases = { CLAIMED: STATUS.RESOLVED, "UNDER REVIEW": STATUS.ACTIVE };
  var lastStorageStatus = { ok: true, invalidCount: 0, message: "" };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function cleanText(value) { return typeof value === "string" ? value.trim() : ""; }
  function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value + "T12:00:00").getTime()); }
  function validTime(value) { return value === "" || value === undefined || /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
  function validTimestamp(value) { return value === undefined || (typeof value === "string" && !Number.isNaN(Date.parse(value))); }
  function canonicalStatus(value) { return statusAliases[value] || value; }

  function validateReport(report, options) {
    options = options || {};
    var errors = [];
    if (!report || typeof report !== "object") return { ok: false, errors: ["Report must be an object."] };
    if (!cleanText(report.id) && !options.allowMissingId) errors.push("Report ID is required.");
    if (!cleanText(report.title)) errors.push("Title is required.");
    if (!cleanText(report.description)) errors.push("Description is required.");
    if (report.reportType !== "LOST" && report.reportType !== "FOUND") errors.push("Report type must be LOST or FOUND.");
    if (!cleanText(report.category)) errors.push("Category is required.");
    if (!cleanText(report.location)) errors.push("Location is required.");
    if (!validDate(report.date)) errors.push("Date must use YYYY-MM-DD.");
    if (!validTime(report.time || "")) errors.push("Time must use HH:MM.");
    if (!VALID_STATUSES.includes(canonicalStatus(report.status))) errors.push("Status is not supported.");
    if (report.userId !== undefined && !cleanText(report.userId)) errors.push("User ID must be a non-empty string when present.");
    if (report.imageKey !== undefined && !cleanText(report.imageKey)) errors.push("Image key must be a non-empty string when present.");
    if (!validTimestamp(report.createdAt) || !validTimestamp(report.updatedAt)) errors.push("Timestamps must be valid ISO date strings.");
    if (report.imageMetadata && typeof report.imageMetadata === "object") {
      if (report.imageMetadata.type && typeof report.imageMetadata.type !== "string") errors.push("Image type is invalid.");
      if (report.imageMetadata.size !== undefined && (!Number.isFinite(report.imageMetadata.size) || report.imageMetadata.size < 0)) errors.push("Image size is invalid.");
    } else if (report.imageMetadata !== undefined && report.imageMetadata !== null) {
      errors.push("Image metadata is invalid.");
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function normalizeReport(report) {
    var normalized = clone(report);
    normalized.id = cleanText(normalized.id);
    normalized.title = cleanText(normalized.title);
    normalized.description = cleanText(normalized.description);
    normalized.category = cleanText(normalized.category);
    normalized.location = cleanText(normalized.location);
    normalized.time = normalized.time || "";
    normalized.status = canonicalStatus(normalized.status || STATUS.ACTIVE);
    return normalized;
  }

  function readLocalReports() {
    try {
      var stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) { lastStorageStatus = { ok: true, invalidCount: 0, message: "" }; return []; }
      var parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        lastStorageStatus = { ok: false, invalidCount: 1, message: "Saved local reports were not an array, so they could not be restored." };
        return [];
      }
      var valid = [];
      var invalidCount = 0;
      parsed.forEach(function (item) {
        var normalized = normalizeReport(item || {});
        if (validateReport(normalized).ok) valid.push(normalized); else invalidCount += 1;
      });
      lastStorageStatus = { ok: invalidCount === 0, invalidCount: invalidCount, message: invalidCount ? invalidCount + " saved report(s) could not be restored because their data is invalid." : "" };
      return valid;
    } catch (error) {
      lastStorageStatus = { ok: false, invalidCount: 1, message: "Saved local reports could not be read in this browser." };
      return [];
    }
  }

  function sampleReports() {
    return (Array.isArray(window.LOST_FOUND_SAMPLE_ITEMS) ? window.LOST_FOUND_SAMPLE_ITEMS : []).map(normalizeReport);
  }

  function getAllReports() {
    var merged = {};
    sampleReports().concat(readLocalReports()).forEach(function (report) { merged[report.id] = report; });
    return Object.keys(merged).map(function (id) { return clone(merged[id]); });
  }

  function getReportById(id) { return getAllReports().find(function (report) { return report.id === id; }) || null; }

  function writeLocalReports(reports) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: "This browser could not save the local demo report. Check storage permissions or available space." };
    }
  }

  function uniqueId() {
    var ids = new Set(getAllReports().map(function (report) { return report.id; }));
    var base = Date.now();
    var candidate = "local-" + base;
    var suffix = 1;
    while (ids.has(candidate)) candidate = "local-" + base + "-" + suffix++;
    return candidate;
  }

  function createReport(input) {
    input = input || {};
    var report = normalizeReport(Object.assign({}, input, { id: input.id || uniqueId(), status: input.status || STATUS.ACTIVE }));
    var validation = validateReport(report);
    if (!validation.ok) return { ok: false, errors: validation.errors, error: validation.errors.join(" ") };
    if (getReportById(report.id)) return { ok: false, errors: ["Report ID already exists."], error: "Report ID already exists." };
    var saved = writeLocalReports(readLocalReports().concat([report]));
    return saved.ok ? { ok: true, report: clone(report) } : saved;
  }

  function canTransition(from, to) {
    from = canonicalStatus(from); to = canonicalStatus(to);
    var transitions = {};
    transitions[STATUS.ACTIVE] = [STATUS.ACTIVE, STATUS.MATCHED, STATUS.CLOSED];
    transitions[STATUS.MATCHED] = [STATUS.MATCHED, STATUS.ACTIVE, STATUS.RESOLVED, STATUS.CLOSED];
    transitions[STATUS.RESOLVED] = [STATUS.RESOLVED, STATUS.CLOSED];
    transitions[STATUS.CLOSED] = [STATUS.CLOSED];
    return VALID_STATUSES.includes(from) && VALID_STATUSES.includes(to) && transitions[from].includes(to);
  }

  function allowedStatuses(report) {
    if (!report || (report.reportType !== "LOST" && report.reportType !== "FOUND")) return [];
    return VALID_STATUSES.filter(function (status) { return canTransition(report.status, status); });
  }

  function updateReport(id, changes) {
    var current = getReportById(id);
    if (!current) return { ok: false, error: "Report was not found." };
    var next = normalizeReport(Object.assign({}, current, changes || {}, { id: id }));
    var validation = validateReport(next);
    if (!validation.ok) return { ok: false, errors: validation.errors, error: validation.errors.join(" ") };
    if (!canTransition(current.status, next.status)) return { ok: false, error: "That status change is not allowed." };
    next.updatedAt = new Date().toISOString();
    var remaining = readLocalReports().filter(function (report) { return report.id !== id; });
    var saved = writeLocalReports(remaining.concat([next]));
    return saved.ok ? { ok: true, report: clone(next) } : saved;
  }

  function apiEnabled() { return window.LFAPI && window.LFAPI.isEnabled(); }
  function getAllReportsAsync(filters) {
    if (!apiEnabled()) {
      filters = filters || {};
      return Promise.resolve(getAllReports().filter(function (report) {
        return (!filters.status || report.status === filters.status) && (!filters.reportType || report.reportType === filters.reportType) && (!filters.category || report.category === filters.category) && (!filters.location || report.location === filters.location);
      }));
    }
    return window.LFAPI.listReports(filters).then(function (response) { return response && response.data && Array.isArray(response.data.items) ? response.data.items : []; });
  }
  function getReportAsync(id) {
    if (!apiEnabled()) return Promise.resolve(getReportById(id));
    return window.LFAPI.getReport(id).then(function (response) { return response && response.data ? response.data : null; });
  }
  function createdReportFromResponse(response) {
    var data = response && response.data;
    var report = data && data.report && typeof data.report === "object" ? data.report : data;
    return report && typeof report === "object" && typeof report.id === "string" && report.id.trim() ? report : null;
  }
  function createReportAsync(report) {
    if (!apiEnabled()) return Promise.resolve(createReport(report));
    return window.LFAPI.createReport(report).then(function (response) {
      var deleted = response && response.data && response.data.deleted === true;
      if (deleted) return { ok: true, deleted: true, reportId: response.data.reportId, matchedReportId: response.data.matchedReportId };
      var created = createdReportFromResponse(response);
      return created ? { ok: true, report: created } : { ok: false, error: "The API created the report but did not return a valid report ID." };
    });
  }
  function updateReportAsync(id, changes) {
    if (!apiEnabled()) return Promise.resolve(updateReport(id, changes));
    return window.LFAPI.updateReportStatus(id, changes.status, changes.expectedVersion).then(function (response) {
      var report = response && response.data && response.data.report;
      return report ? { ok: true, report: report } : { ok: false, error: "The API did not return the updated report." };
    });
  }
  function getMatchesAsync(id, threshold) {
    if (!apiEnabled()) return Promise.resolve(null);
    return window.LFAPI.getMatches(id, threshold).then(function (response) { return response && response.data ? response.data.matches || [] : []; });
  }
  function uploadImageAsync(id, file, expectedVersion) {
    if (!apiEnabled()) return Promise.resolve({ ok: true, skipped: true });
    return window.LFAPI.createImageUploadIntent(id, { contentType: file.type, size: file.size }, expectedVersion).then(function (response) {
      var image = response && response.data && response.data.image;
      if (!image || !image.uploadUrl || !image.version) throw new Error("The API did not return a valid image upload URL.");
      return window.fetch(image.uploadUrl, { method: "PUT", headers: image.headers || {}, body: file, cache: "no-store" }).then(function (uploadResponse) {
        if (!uploadResponse.ok) throw new Error("The image upload failed.");
        return window.LFAPI.completeImageUpload(id, image.version);
      });
    }).then(function (response) {
      var report = response && response.data && response.data.report;
      return report ? { ok: true, report: report } : { ok: false, error: "The API did not return the uploaded image." };
    }).catch(function (error) { return { ok: false, error: error.message || "The image could not be uploaded." }; });
  }

  window.LFData = {
    STORAGE_KEY: STORAGE_KEY,
    STATUS: STATUS,
    VALID_STATUSES: VALID_STATUSES,
    getAllItems: getAllReports,
    getAllReports: getAllReports,
    getItemById: getReportById,
    getReportById: getReportById,
    createReport: createReport,
    updateReport: updateReport,
    getAllReportsAsync: getAllReportsAsync,
    getReportAsync: getReportAsync,
    createReportAsync: createReportAsync,
    updateReportAsync: updateReportAsync,
    getMatchesAsync: getMatchesAsync,
    uploadImageAsync: uploadImageAsync,
    validateReport: validateReport,
    canTransition: canTransition,
    allowedStatuses: allowedStatuses,
    getStorageStatus: function () { readLocalReports(); return clone(lastStorageStatus); },
    getRuntimeConfig: function () { return clone(runtimeConfig); }
  };
})();
