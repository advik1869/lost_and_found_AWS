"use strict";

var ReportRepository = require("./report-repository");
var validation = require("../utils/validation");

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function encodeOffset(offset) { return Buffer.from(JSON.stringify({ offset: offset }), "utf8").toString("base64url"); }
function decodeOffset(token) {
  if (!token) return 0;
  try {
    var parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    if (!Number.isInteger(parsed.offset) || parsed.offset < 0) throw new Error("invalid");
    return parsed.offset;
  } catch (error) {
    var invalid = new Error("nextToken is invalid."); invalid.code = "INVALID_NEXT_TOKEN"; throw invalid;
  }
}

function sdk() {
  try {
    return {
      client: require("@aws-sdk/client-dynamodb"),
      util: require("@aws-sdk/util-dynamodb")
    };
  } catch (error) {
    var missing = new Error("The AWS SDK DynamoDB dependencies are not installed.");
    missing.code = "DYNAMODB_SDK_UNAVAILABLE";
    throw missing;
  }
}

function derivedKeys(report) {
  var eventAt = report.eventAt || report.date + "T" + (report.time || "00:00") + ":00Z";
  var type = report.reportType;
  var status = report.status;
  var category = String(report.category || "").trim().toUpperCase();
  var keys = {
    gsi1pk: "BROWSE#" + status + "#" + type,
    gsi1sk: eventAt + "#" + report.updatedAt + "#" + report.id,
    gsi2pk: "CATEGORY#" + category + "#" + status,
    gsi2sk: eventAt + "#" + report.id
  };
  if (report.userId) {
    keys.gsi3pk = "USER#" + report.userId;
    keys.gsi3sk = report.updatedAt + "#" + report.id;
  }
  return keys;
}

function toItem(report) {
  var keys = derivedKeys(report);
  var item = { pk: "REPORT#" + report.id, sk: "REPORT", reportId: report.id };
  Object.keys(report).forEach(function (key) { if (report[key] !== undefined) item[key] = clone(report[key]); });
  Object.keys(keys).forEach(function (key) { item[key] = keys[key]; });
  return item;
}

function fromItem(item) {
  if (!item) return null;
  var report = {};
  Object.keys(item).forEach(function (key) {
    if (!/^pk$|^sk$|^gsi[123](pk|sk)$/.test(key)) report[key] = clone(item[key]);
  });
  report.id = report.reportId;
  delete report.reportId;
  return report;
}

function DynamoDBReportRepository(options) {
  options = options || {};
  ReportRepository.call(this);
  this.tableName = options.tableName;
  this.region = options.region;
  if (!this.tableName) { var tableError = new Error("FOUNDLY_REPORTS_TABLE is required for DynamoDB storage."); tableError.code = "INVALID_CONFIGURATION"; throw tableError; }
  var libraries = options.client && options.commands && options.marshall && options.unmarshall ? null : sdk();
  this.client = options.client || new libraries.client.DynamoDBClient({ region: this.region });
  this.commands = options.commands || libraries.client;
  this.marshall = options.marshall || libraries.util.marshall;
  this.unmarshall = options.unmarshall || libraries.util.unmarshall;
}

DynamoDBReportRepository.prototype = Object.create(ReportRepository.prototype);
DynamoDBReportRepository.prototype.constructor = DynamoDBReportRepository;

DynamoDBReportRepository.prototype._values = function (values) { return this.marshall(values); };
DynamoDBReportRepository.prototype._item = function (item) { return this.marshall(item, { removeUndefinedValues: true }); };
DynamoDBReportRepository.prototype._read = function (item) { return this.unmarshall(item); };
DynamoDBReportRepository.prototype._send = function (Command, input) { return this.client.send(new Command(input)); };
DynamoDBReportRepository.prototype._failure = function (error) {
  if (error && ["VALIDATION_ERROR", "NOT_FOUND", "DUPLICATE_REPORT", "VERSION_CONFLICT", "INVALID_NEXT_TOKEN"].includes(error.code)) return error;
  var unavailable = new Error("DynamoDB is unavailable."); unavailable.code = "DYNAMODB_UNAVAILABLE"; unavailable.cause = error; return unavailable;
};

DynamoDBReportRepository.prototype.createReport = function (report) {
  var checked = validation.validateStoredReport(report);
  if (!checked.ok) { var invalid = new Error(checked.errors.join(" ")); invalid.code = "VALIDATION_ERROR"; invalid.details = checked.errors; throw invalid; }
  var self = this;
  return this._send(this.commands.PutItemCommand, { TableName: this.tableName, Item: this._item(toItem(report)), ConditionExpression: "attribute_not_exists(#pk)", ExpressionAttributeNames: { "#pk": "pk" } }).then(function () { return clone(report); }).catch(function (error) {
    if (error && error.name === "ConditionalCheckFailedException") { var duplicate = new Error("Report ID already exists."); duplicate.code = "DUPLICATE_REPORT"; throw duplicate; }
    throw self._failure(error);
  });
};

DynamoDBReportRepository.prototype.getReportById = function (id) {
  var self = this;
  return this._send(this.commands.GetItemCommand, { TableName: this.tableName, Key: this._item({ pk: "REPORT#" + id, sk: "REPORT" }) }).then(function (result) { return result.Item ? fromItem(self._read(result.Item)) : null; }).catch(function (error) { throw self._failure(error); });
};

DynamoDBReportRepository.prototype._query = function (indexName, keyName, keyValue, limit) {
  var self = this;
  return this._send(this.commands.QueryCommand, {
    TableName: this.tableName,
    IndexName: indexName,
    KeyConditionExpression: "#partition = :partition",
    ExpressionAttributeNames: { "#partition": keyName },
    ExpressionAttributeValues: this._values({ ":partition": keyValue }),
    Limit: Math.min(50, Math.max(1, limit)),
    ScanIndexForward: false
  }).then(function (result) { return (result.Items || []).map(function (item) { return fromItem(self._read(item)); }); });
};

DynamoDBReportRepository.prototype.listReports = function (filters, pagination) {
  filters = filters || {}; pagination = pagination || { limit: 20 };
  var offset = decodeOffset(pagination.nextToken);
  var statuses = filters.status ? [filters.status] : validation.VALID_STATUSES;
  var types = filters.reportType ? [filters.reportType] : validation.REPORT_TYPES;
  var self = this;
  var jobs = [];
  statuses.forEach(function (status) { types.forEach(function (type) { jobs.push(self._query("GSI1Browse", "gsi1pk", "BROWSE#" + status + "#" + type, offset + pagination.limit)); }); });
  return Promise.all(jobs).then(function (groups) {
    var reports = [].concat.apply([], groups).filter(function (report) {
      return (!filters.category || report.category === filters.category) && (!filters.location || report.location === filters.location) && (!filters.userId || report.userId === filters.userId);
    });
    var unique = {};
    reports.forEach(function (report) { unique[report.id] = report; });
    reports = Object.keys(unique).map(function (id) { return unique[id]; }).sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id); });
    var page = reports.slice(offset, offset + pagination.limit).map(clone);
    return { items: page, nextToken: offset + page.length < reports.length ? encodeOffset(offset + page.length) : null };
  }).catch(function (error) { throw self._failure(error); });
};

DynamoDBReportRepository.prototype.listReportsByUser = function (userId, pagination) {
  var self = this; pagination = pagination || { limit: 20 }; var offset = decodeOffset(pagination.nextToken);
  return this._query("GSI3Owner", "gsi3pk", "USER#" + userId, offset + pagination.limit).then(function (reports) {
    reports.sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id); });
    var page = reports.slice(offset, offset + pagination.limit).map(clone);
    return { items: page, nextToken: offset + page.length < reports.length ? encodeOffset(offset + page.length) : null };
  }).catch(function (error) { throw self._failure(error); });
};

DynamoDBReportRepository.prototype.updateReportStatus = function (id, status, expectedVersion) {
  var self = this;
  return this.getReportById(id).then(function (current) {
    if (!current) { var missing = new Error("Report was not found."); missing.code = "NOT_FOUND"; throw missing; }
    var timestamp = new Date().toISOString();
    var nextVersion = current.version + 1;
    var next = Object.assign({}, current, { status: status, version: nextVersion, updatedAt: timestamp });
    var keys = derivedKeys(next);
    var values = { ":status": status, ":version": nextVersion, ":updatedAt": timestamp };
    var names = { "#status": "status", "#version": "version", "#updatedAt": "updatedAt", "#pk": "pk" };
    var assignments = ["#status = :status", "#version = :version", "#updatedAt = :updatedAt"];
    Object.keys(keys).forEach(function (key) { names["#" + key] = key; values[":" + key] = keys[key]; assignments.push("#" + key + " = :" + key); });
    var condition = "attribute_exists(#pk)";
    if (expectedVersion !== undefined) { condition += " AND #version = :expectedVersion"; values[":expectedVersion"] = Number(expectedVersion); }
    return self._send(self.commands.UpdateItemCommand, { TableName: self.tableName, Key: self._item({ pk: "REPORT#" + id, sk: "REPORT" }), UpdateExpression: "SET " + assignments.join(", "), ConditionExpression: condition, ExpressionAttributeNames: names, ExpressionAttributeValues: self._values(values), ReturnValues: "ALL_NEW" }).then(function (result) { return fromItem(self._read(result.Attributes)); });
  }).catch(function (error) {
    if (error && error.name === "ConditionalCheckFailedException") { var conflict = new Error("Report changed since it was read."); conflict.code = "VERSION_CONFLICT"; throw conflict; }
    throw self._failure(error);
  });
};

DynamoDBReportRepository.prototype.deleteMatchedPair = function (firstId, secondId, expectedVersions) {
  var self = this;
  expectedVersions = expectedVersions || {};
  return Promise.all([this.getReportById(firstId), this.getReportById(secondId)]).then(function (reports) {
    var first = reports[0]; var second = reports[1];
    if (!first || !second || first.reportType === second.reportType || first.status !== "ACTIVE" || second.status !== "ACTIVE" || first.version !== Number(expectedVersions.first) || second.version !== Number(expectedVersions.second)) return { deleted: false, reason: "MATCH_CONFLICT" };
    function transactionItem(report, expectedVersion) {
      return { Delete: { TableName: self.tableName, Key: self._item({ pk: "REPORT#" + report.id, sk: "REPORT" }), ConditionExpression: "attribute_exists(#pk) AND #status = :active AND #version = :expectedVersion AND #reportType = :reportType", ExpressionAttributeNames: { "#pk": "pk", "#status": "status", "#version": "version", "#reportType": "reportType" }, ExpressionAttributeValues: self._values({ ":active": "ACTIVE", ":expectedVersion": expectedVersion, ":reportType": report.reportType }) } };
    }
    return self._send(self.commands.TransactWriteItemsCommand, { TransactItems: [transactionItem(first, expectedVersions.first), transactionItem(second, expectedVersions.second)] }).then(function () {
      return { deleted: true, reportIds: [firstId, secondId] };
    });
  }).catch(function (error) {
    if (error && (error.name === "TransactionCanceledException" || error.name === "ConditionalCheckFailedException")) return { deleted: false, reason: "MATCH_CONFLICT" };
    throw self._failure(error);
  });
};

function imageUpdate(repo, id, changes, expectedVersion, complete) {
  var values = { ":version": Number(expectedVersion) + 1, ":expectedVersion": Number(expectedVersion), ":updatedAt": new Date().toISOString() };
  var names = { "#version": "version", "#expectedVersion": "version", "#updatedAt": "updatedAt", "#pk": "pk" };
  var assignments = ["#version = :version", "#updatedAt = :updatedAt"];
  if (complete) {
    names["#imageKey"] = "imageKey"; names["#imageMetadata"] = "imageMetadata"; names["#pendingImageKey"] = "pendingImageKey"; names["#pendingImageMetadata"] = "pendingImageMetadata";
    values[":imageKey"] = changes.imageKey; values[":imageMetadata"] = changes.imageMetadata; assignments.push("#imageKey = :imageKey", "#imageMetadata = :imageMetadata");
  } else {
    names["#pendingImageKey"] = "pendingImageKey"; names["#pendingImageMetadata"] = "pendingImageMetadata"; values[":pendingImageKey"] = changes.pendingImageKey; values[":pendingImageMetadata"] = changes.pendingImageMetadata; assignments.push("#pendingImageKey = :pendingImageKey", "#pendingImageMetadata = :pendingImageMetadata");
  }
  var expression = "SET " + assignments.join(", ") + (complete ? " REMOVE #pendingImageKey, #pendingImageMetadata" : "");
  return repo._send(repo.commands.UpdateItemCommand, { TableName: repo.tableName, Key: repo._item({ pk: "REPORT#" + id, sk: "REPORT" }), UpdateExpression: expression, ConditionExpression: "attribute_exists(#pk) AND #expectedVersion = :expectedVersion", ExpressionAttributeNames: names, ExpressionAttributeValues: repo._values(values), ReturnValues: "ALL_NEW" }).then(function (result) { return fromItem(repo._read(result.Attributes)); });
}

DynamoDBReportRepository.prototype.setPendingImage = function (id, pending, expectedVersion) {
  var self = this;
  return imageUpdate(this, id, pending, expectedVersion, false).catch(function (error) { if (error && error.name === "ConditionalCheckFailedException") { var conflict = new Error("Report changed since it was read."); conflict.code = "VERSION_CONFLICT"; throw conflict; } throw self._failure(error); });
};

DynamoDBReportRepository.prototype.completeImageUpload = function (id, image, expectedVersion) {
  var self = this;
  return imageUpdate(this, id, image, expectedVersion, true).catch(function (error) { if (error && error.name === "ConditionalCheckFailedException") { var conflict = new Error("Report changed since it was read."); conflict.code = "VERSION_CONFLICT"; throw conflict; } throw self._failure(error); });
};

module.exports = DynamoDBReportRepository;
module.exports.toItem = toItem;
module.exports.fromItem = fromItem;
