"use strict";

var InMemoryReportRepository = require("./repositories/in-memory-report-repository");
var DynamoDBReportRepository = require("./repositories/dynamodb-report-repository");
var ReportService = require("./services/report-service");
var LocalImageStorage = require("./storage/local-image-storage");
var S3ImageStorage = require("./storage/s3-image-storage");
var config = require("./config").loadConfig(process.env);

var repository = config.reportRepository === "dynamodb" ? new DynamoDBReportRepository({ region: config.awsRegion, tableName: config.reportsTable }) : new InMemoryReportRepository();
var imageStorage = config.imageStorage === "s3" ? new S3ImageStorage({ config: config }) : new LocalImageStorage({ maxBytes: config.maxImageSizeBytes });
var service = new ReportService(repository, imageStorage);

module.exports = { repository: repository, imageStorage: imageStorage, service: service, config: config };
