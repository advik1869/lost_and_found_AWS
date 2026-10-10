"use strict";

var ALLOWED_ENVIRONMENTS = ["development", "test", "production"];
var ALLOWED_LOG_LEVELS = ["error", "warn", "info", "debug"];
var ALLOWED_AUTH_MODES = ["demo", "trusted-authorizer"];
var ALLOWED_REPOSITORIES = ["in-memory", "dynamodb"];
var ALLOWED_IMAGE_STORAGE = ["local", "s3"];
var DEFAULT_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
var DEFAULT_CORS_ALLOWED_ORIGINS = "http://localhost:8000,http://foundly-frontend-380030254399.s3-website-us-east-1.amazonaws.com";

function configurationError(message) {
  var error = new Error("Configuration error: " + message);
  error.code = "INVALID_CONFIGURATION";
  return error;
}

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function valueFrom(env, key, fallback) { return env[key] === undefined ? fallback : text(env[key]); }

function positiveInteger(value, key, minimum, maximum) {
  if (!/^\d+$/.test(value)) throw configurationError(key + " must be a whole number.");
  var parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw configurationError(key + " must be between " + minimum + " and " + maximum + ".");
  }
  return parsed;
}

function origins(value, environment) {
  var entries = value.split(",").map(function (origin) { return origin.trim(); }).filter(Boolean);
  if (!entries.length) throw configurationError("CORS_ALLOWED_ORIGINS must contain at least one origin.");
  if (entries.some(function (origin) { return origin !== "*" && !/^https?:\/\/[^\s/]+(?::\d+)?$/.test(origin); })) {
    throw configurationError("CORS_ALLOWED_ORIGINS must contain absolute HTTP(S) origins or '*'.");
  }
  if (environment === "production" && entries.includes("*")) throw configurationError("CORS_ALLOWED_ORIGINS cannot be '*' in production.");
  return entries;
}

function loadConfig(env) {
  env = env || process.env;
  var environment = valueFrom(env, "APP_ENV", valueFrom(env, "NODE_ENV", "development"));
  if (!ALLOWED_ENVIRONMENTS.includes(environment)) throw configurationError("APP_ENV must be development, test, or production.");

  var logLevel = valueFrom(env, "LOG_LEVEL", environment === "production" ? "info" : "debug");
  if (!ALLOWED_LOG_LEVELS.includes(logLevel)) throw configurationError("LOG_LEVEL must be error, warn, info, or debug.");

  var authMode = valueFrom(env, "AUTH_MODE", "demo");
  if (!ALLOWED_AUTH_MODES.includes(authMode)) throw configurationError("AUTH_MODE must be demo or trusted-authorizer.");
  if (environment === "production" && authMode !== "trusted-authorizer") {
    throw configurationError("AUTH_MODE must be explicitly set to trusted-authorizer in production.");
  }

  var corsValue = valueFrom(env, "CORS_ALLOWED_ORIGINS", DEFAULT_CORS_ALLOWED_ORIGINS);
  var corsAllowedOrigins = origins(corsValue, environment);

  var repository = valueFrom(env, "REPORT_REPOSITORY", "in-memory");
  if (!ALLOWED_REPOSITORIES.includes(repository)) throw configurationError("REPORT_REPOSITORY must be in-memory or dynamodb.");
  var awsRegion = valueFrom(env, "AWS_REGION", valueFrom(env, "AWS_DEFAULT_REGION", ""));
  var reportsTable = valueFrom(env, "FOUNDLY_REPORTS_TABLE", "");
  if (repository === "dynamodb" && !awsRegion) throw configurationError("AWS_REGION is required when REPORT_REPOSITORY is dynamodb.");
  if (repository === "dynamodb" && !reportsTable) throw configurationError("FOUNDLY_REPORTS_TABLE is required when REPORT_REPOSITORY is dynamodb.");
  var imageStorage = valueFrom(env, "IMAGE_STORAGE", "local");
  if (!ALLOWED_IMAGE_STORAGE.includes(imageStorage)) throw configurationError("IMAGE_STORAGE must be local or s3.");
  var imageBucket = valueFrom(env, "FOUNDLY_IMAGE_BUCKET", "");
  var imagePrefix = valueFrom(env, "FOUNDLY_IMAGE_PREFIX", "report-images").replace(/^\/+|\/+$/g, "");
  var imageUrlTtlSeconds = positiveInteger(valueFrom(env, "IMAGE_URL_TTL_SECONDS", "300"), "IMAGE_URL_TTL_SECONDS", 60, 900);
  if (imageStorage === "s3" && (!awsRegion || !imageBucket || !imagePrefix)) throw configurationError("AWS_REGION, FOUNDLY_IMAGE_BUCKET, and FOUNDLY_IMAGE_PREFIX are required when IMAGE_STORAGE is s3.");

  return Object.freeze({
    appEnvironment: environment,
    logLevel: logLevel,
    maxImageSizeBytes: positiveInteger(valueFrom(env, "MAX_IMAGE_SIZE_BYTES", String(DEFAULT_MAX_IMAGE_SIZE_BYTES)), "MAX_IMAGE_SIZE_BYTES", 1, 10 * 1024 * 1024),
    authMode: authMode,
    enforceAuth: authMode === "trusted-authorizer",
    corsAllowedOrigins: Object.freeze(corsAllowedOrigins),
    reportRepository: repository,
    awsRegion: awsRegion,
    reportsTable: reportsTable,
    imageStorage: imageStorage,
    imageBucket: imageBucket,
    imagePrefix: imagePrefix,
    imageUrlTtlSeconds: imageUrlTtlSeconds,
    cloudDependenciesConfigured: false
  });
}

module.exports = {
  ALLOWED_ENVIRONMENTS: ALLOWED_ENVIRONMENTS,
  ALLOWED_LOG_LEVELS: ALLOWED_LOG_LEVELS,
  ALLOWED_AUTH_MODES: ALLOWED_AUTH_MODES,
  DEFAULT_MAX_IMAGE_SIZE_BYTES: DEFAULT_MAX_IMAGE_SIZE_BYTES,
  DEFAULT_CORS_ALLOWED_ORIGINS: DEFAULT_CORS_ALLOWED_ORIGINS,
  loadConfig: loadConfig
};
