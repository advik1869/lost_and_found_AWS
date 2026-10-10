"use strict";

function getHealth(config) {
  return {
    status: "ok",
    application: "available",
    environment: config.appEnvironment,
    dependencies: {
      dynamodb: { status: "not_configured" },
      s3: { status: "not_configured" },
      cognito: { status: "not_configured" }
    },
    checkedAt: new Date().toISOString()
  };
}

module.exports = { getHealth: getHealth };
