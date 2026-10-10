(function () {
  "use strict";

  // This object is intentionally public. Never put credentials, tokens, or secrets here.
  // For an S3 upload, change these public values in this file or define
  // window.FOUNDLY_CONFIG before this script loads. Local demo mode is the safe default.
  var defaultPublicConfig = { mode: "api", apiBaseUrl: "https://zxq2nijwo7.execute-api.us-east-1.amazonaws.com" };
  var supplied = Object.assign({}, defaultPublicConfig, window.FOUNDLY_CONFIG || {});
  var mode = supplied.mode || "local-demo";
  var apiBaseUrl = typeof supplied.apiBaseUrl === "string" ? supplied.apiBaseUrl.trim() : "";
  var validModes = ["local-demo", "api"];
  var validApiUrl = !apiBaseUrl || /^https:\/\/[^\s/]+/.test(apiBaseUrl) || /^http:\/\/localhost(?::\d+)?/.test(apiBaseUrl);

  window.LFConfig = Object.freeze({
    mode: validModes.includes(mode) && (mode !== "api" || validApiUrl && apiBaseUrl) ? mode : "local-demo",
    apiBaseUrl: validApiUrl ? apiBaseUrl.replace(/\/$/, "") : "",
    isValid: validModes.includes(mode) && (mode === "local-demo" || Boolean(apiBaseUrl && validApiUrl)),
    warning: validModes.includes(mode) && (mode === "local-demo" || Boolean(apiBaseUrl && validApiUrl)) ? "" : "Invalid public API configuration; using local demo mode."
  });

  // Keep the adapter ahead of data-service.js. The closing tag must be emitted
  // literally; a backslash here would make the parser swallow later scripts.
  if (typeof document !== "undefined" && document.write && document.currentScript) {
    document.write('<script src="/assets/js/api.js"></script>');
  }
})();
