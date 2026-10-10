"use strict";

var assert = require("node:assert/strict");
var childProcess = require("node:child_process");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");
var configModule = require("../src/config");

function baseEnv(overrides) { return Object.assign({ APP_ENV: "development", LOG_LEVEL: "debug", MAX_IMAGE_SIZE_BYTES: "5242880", AUTH_MODE: "demo", CORS_ALLOWED_ORIGINS: "http://localhost:8000", REPORT_REPOSITORY: "in-memory", IMAGE_STORAGE: "local" }, overrides || {}); }
function throwsConfig(env, fragment) { assert.throws(function () { configModule.loadConfig(env); }, function (error) { return error.code === "INVALID_CONFIGURATION" && error.message.includes(fragment); }); }

var defaults = configModule.loadConfig({});
assert.equal(defaults.appEnvironment, "development", "local default environment is development");
assert.equal(defaults.authMode, "demo", "local default auth mode is demo");
assert.equal(defaults.enforceAuth, false, "local demo mode does not enforce trusted auth");
assert.equal(defaults.maxImageSizeBytes, 5 * 1024 * 1024, "local default image limit is 5 MiB");
assert.deepEqual(defaults.corsAllowedOrigins, ["http://localhost:8000", "http://foundly-frontend-380030254399.s3-website-us-east-1.amazonaws.com"], "CORS defaults are the exact local and deployed origins");

var overridden = configModule.loadConfig(baseEnv({ APP_ENV: "test", LOG_LEVEL: "warn", MAX_IMAGE_SIZE_BYTES: "1048576", AUTH_MODE: "trusted-authorizer", CORS_ALLOWED_ORIGINS: "http://localhost:3000,https://demo.example" }));
assert.equal(overridden.appEnvironment, "test", "valid environment override is accepted");
assert.equal(overridden.logLevel, "warn", "valid log level override is accepted");
assert.equal(overridden.maxImageSizeBytes, 1048576, "valid image limit override is accepted");
assert.equal(overridden.enforceAuth, true, "trusted-authorizer mode enables handler enforcement");
assert.deepEqual(overridden.corsAllowedOrigins, ["http://localhost:3000", "https://demo.example"], "multiple CORS origins are parsed");
var storageConfig = childProcess.spawnSync(process.execPath, ["-e", "console.log(new (require('./backend/src/storage/local-image-storage'))().maxBytes)"], { cwd: path.join(__dirname, "../.."), encoding: "utf8", env: baseEnv({ MAX_IMAGE_SIZE_BYTES: "1048576" }) });
assert.equal(storageConfig.status, 0, "local storage initializes with valid configuration");
assert.equal(Number(storageConfig.stdout.trim()), 1048576, "local storage uses the centralized image-size limit");

throwsConfig(baseEnv({ APP_ENV: "staging" }), "APP_ENV");
throwsConfig(baseEnv({ LOG_LEVEL: "trace" }), "LOG_LEVEL");
throwsConfig(baseEnv({ MAX_IMAGE_SIZE_BYTES: "0" }), "MAX_IMAGE_SIZE_BYTES");
throwsConfig(baseEnv({ CORS_ALLOWED_ORIGINS: "not-an-origin" }), "CORS_ALLOWED_ORIGINS");
throwsConfig(baseEnv({ REPORT_REPOSITORY: "dynamodb" }), "AWS_REGION");
var dynamoConfig = configModule.loadConfig(baseEnv({ REPORT_REPOSITORY: "dynamodb", AWS_REGION: "us-east-1", FOUNDLY_REPORTS_TABLE: "FoundlyReports" }));
assert.equal(dynamoConfig.reportRepository, "dynamodb", "DynamoDB repository mode is accepted only with explicit configuration");
assert.equal(dynamoConfig.awsRegion, "us-east-1", "DynamoDB region is read from environment");
assert.equal(dynamoConfig.reportsTable, "FoundlyReports", "DynamoDB table name is read from environment");
throwsConfig(baseEnv({ APP_ENV: "production", AUTH_MODE: "demo" }), "trusted-authorizer");
assert.deepEqual(configModule.loadConfig(baseEnv({ APP_ENV: "production", AUTH_MODE: "trusted-authorizer", CORS_ALLOWED_ORIGINS: "http://localhost:8000,http://foundly-frontend-380030254399.s3-website-us-east-1.amazonaws.com" })).corsAllowedOrigins, ["http://localhost:8000", "http://foundly-frontend-380030254399.s3-website-us-east-1.amazonaws.com"], "explicit production CORS origins are accepted");
throwsConfig(baseEnv({ APP_ENV: "production", AUTH_MODE: "trusted-authorizer", CORS_ALLOWED_ORIGINS: "*" }), "CORS_ALLOWED_ORIGINS");

var health = childProcess.spawnSync(process.execPath, [path.join(__dirname, "../health-check.js")], { encoding: "utf8", env: baseEnv({ NODE_ENV: "test" }) });
assert.equal(health.status, 0, "health check succeeds with valid local configuration");
var healthBody = JSON.parse(health.stdout);
assert.equal(healthBody.status, "ok", "health check reports application availability");
assert.equal(healthBody.dependencies.dynamodb.status, "not_configured", "health check does not claim DynamoDB is healthy");
assert.equal(healthBody.dependencies.s3.status, "not_configured", "health check does not claim S3 is healthy");

var invalidHealth = childProcess.spawnSync(process.execPath, [path.join(__dirname, "../health-check.js")], { encoding: "utf8", env: baseEnv({ APP_ENV: "production", AUTH_MODE: "demo" }) });
assert.equal(invalidHealth.status, 1, "health check fails invalid production configuration");
assert.equal(JSON.parse(invalidHealth.stderr).error.code, "INVALID_CONFIGURATION", "health check returns a safe configuration error");

var loggerSource = fs.readFileSync(path.join(__dirname, "../src/logger.js"), "utf8");
assert.equal(loggerSource.includes("[REDACTED]"), true, "logger contains redaction behavior");
assert.equal(loggerSource.includes("console.error(line)"), true, "logger emits useful local diagnostics");
var logged = childProcess.spawnSync(process.execPath, ["-e", "require('./backend/src/logger').error('audit', { authorization: 'Bearer secret-token', contact: 'person@example.test' })"], { cwd: path.join(__dirname, "../.."), encoding: "utf8", env: baseEnv({ LOG_LEVEL: "error" }) });
assert.equal(logged.status, 0, "logger emits without crashing");
assert.equal(logged.stderr.includes("secret-token"), false, "authorization tokens are redacted from logs");
assert.equal(logged.stderr.includes("person@example.test"), false, "contact data is redacted from logs");

var context = { window: {}, console: { log: function () {} }, Set: Set, JSON: JSON, Date: Date, Number: Number, Object: Object, Array: Array, RegExp: RegExp, Math: Math };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../frontend/assets/js/config.js"), "utf8"), context);
assert.equal(context.window.LFConfig.mode, "local-demo", "frontend defaults to local demo mode");
assert.equal(context.window.LFConfig.apiBaseUrl, "", "frontend has no nonexistent API endpoint by default");
assert.equal(context.window.LFConfig.isValid, true, "frontend local default is valid");
var invalidFrontend = { window: { FOUNDLY_CONFIG: { mode: "api" } } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../frontend/assets/js/config.js"), "utf8"), invalidFrontend);
assert.equal(invalidFrontend.window.LFConfig.mode, "local-demo", "incomplete frontend API config falls back to local demo");
assert.equal(invalidFrontend.window.LFConfig.isValid, false, "incomplete frontend API config is marked invalid");
var validFrontend = { window: { FOUNDLY_CONFIG: { mode: "api", apiBaseUrl: "https://api.example.test" } } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../../frontend/assets/js/config.js"), "utf8"), validFrontend);
assert.equal(validFrontend.window.LFConfig.mode, "api", "complete public frontend API config is accepted");

console.log("PASS Phase 8 configuration and health-check tests");
