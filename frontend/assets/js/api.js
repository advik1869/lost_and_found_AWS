(function (root) {
  "use strict";

  function config() {
    return root.LFConfig || { mode: "local-demo", apiBaseUrl: "" };
  }

  function isEnabled() {
    return config().mode === "api" && Boolean(config().apiBaseUrl);
  }

  function apiError(code, message, status) {
    var error = new Error(message);
    error.code = code;
    if (status !== undefined) error.status = status;
    return error;
  }

  function buildUrl(path, query) {
    var base = String(config().apiBaseUrl || "").replace(/\/+$/, "");
    var normalizedPath = "/" + String(path || "").replace(/^\/+/, "");
    var url = new URL(base + normalizedPath, root.location && root.location.href ? root.location.href : undefined);
    Object.keys(query || {}).forEach(function (key) {
      var value = query[key];
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  function request(path, options) {
    options = options || {};
    if (!isEnabled()) return Promise.reject(apiError("API_NOT_CONFIGURED", "The Foundly API is not configured."));
    var headers = Object.assign({}, options.headers || {});
    var requestOptions = { method: options.method || "GET", headers: headers, cache: "no-store" };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      requestOptions.body = JSON.stringify(options.body);
    }
    return root.fetch(buildUrl(path, options.query), requestOptions).then(function (response) {
      return response.text().then(function (text) {
        var payload = null;
        if (text) {
          try { payload = JSON.parse(text); } catch (error) { throw apiError("INVALID_JSON_RESPONSE", "The API returned invalid JSON.", response.status); }
        }
        if (!response.ok) {
          var apiFailure = payload && payload.error;
          throw apiError(apiFailure && apiFailure.code || "API_REQUEST_FAILED", apiFailure && apiFailure.message || "The API request could not be completed.", response.status);
        }
        return payload;
      });
    }).catch(function (error) {
      if (error && error.code) throw error;
      throw apiError("API_UNAVAILABLE", "The Foundly API is unavailable.");
    });
  }

  function listReports(filters) { return request("/reports", { query: filters || {} }); }
  function getReport(id) { return request("/reports/" + encodeURIComponent(id)); }
  function createReport(report) { return request("/reports", { method: "POST", body: report }); }
  function updateReportStatus(id, status, expectedVersion) {
    return request("/reports/" + encodeURIComponent(id) + "/status", {
      method: "PATCH",
      body: { status: status, expectedVersion: expectedVersion }
    });
  }
  function getMatches(id, threshold) { return request("/reports/" + encodeURIComponent(id) + "/matches", { query: { threshold: threshold } }); }
  function createImageUploadIntent(id, metadata, expectedVersion) { return request("/reports/" + encodeURIComponent(id) + "/image-upload", { method: "POST", body: { contentType: metadata.contentType, size: metadata.size, expectedVersion: expectedVersion } }); }
  function completeImageUpload(id, expectedVersion) { return request("/reports/" + encodeURIComponent(id) + "/image-complete", { method: "POST", body: { expectedVersion: expectedVersion } }); }

  root.LFAPI = Object.freeze({
    isEnabled: isEnabled,
    buildUrl: buildUrl,
    request: request,
    listReports: listReports,
    getReport: getReport,
    createReport: createReport,
    updateReportStatus: updateReportStatus,
    getMatches: getMatches,
    createImageUploadIntent: createImageUploadIntent,
    completeImageUpload: completeImageUpload
  });
})(window);
