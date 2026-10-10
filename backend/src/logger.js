"use strict";

var config = require("./config").loadConfig(process.env);
var levels = { error: 0, warn: 1, info: 2, debug: 3 };
var sensitiveKeys = /authorization|password|token|secret|presigned|url|email|phone|contact/i;

function safeValue(key, value) {
  if (sensitiveKeys.test(key)) return "[REDACTED]";
  if (typeof value === "string") return value.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").replace(/https?:\/\/\S+/gi, "[URL_REDACTED]");
  return value;
}

function safeDetails(details) {
  var result = {};
  Object.keys(details || {}).forEach(function (key) { result[key] = safeValue(key, details[key]); });
  return result;
}

function write(level, eventName, details) {
  if (levels[level] > levels[config.logLevel]) return;
  var line = JSON.stringify({ level: level, event: eventName, details: safeDetails(details) });
  if (level === "error") console.error(line); else if (level === "warn") console.warn(line); else console.log(line);
}

module.exports = { error: function (eventName, details) { write("error", eventName, details); }, warn: function (eventName, details) { write("warn", eventName, details); }, info: function (eventName, details) { write("info", eventName, details); }, debug: function (eventName, details) { write("debug", eventName, details); } };
