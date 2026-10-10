"use strict";

var configModule = require("./src/config");
var health = require("./src/health");

try {
  var config = configModule.loadConfig(process.env);
  console.log(JSON.stringify(health.getHealth(config), null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: "unhealthy", application: "configuration_invalid", error: { code: error.code || "INVALID_CONFIGURATION", message: error.message } }, null, 2));
  process.exitCode = 1;
}
