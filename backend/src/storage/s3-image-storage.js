"use strict";

var crypto = require("node:crypto");
var imageValidation = require("../utils/image-validation");
var configLoader = require("../config");

function sdk() {
  try { return { s3: require("@aws-sdk/client-s3"), presigner: require("@aws-sdk/s3-request-presigner") }; }
  catch (error) { var missing = new Error("The AWS SDK S3 dependencies are not installed."); missing.code = "S3_SDK_UNAVAILABLE"; throw missing; }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function invalid(message, code) { var error = new Error(message); error.code = code || "IMAGE_VALIDATION_ERROR"; return error; }
function safeReportId(value) { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{1,127}$/.test(value); }

function S3ImageStorage(options) {
  options = options || {};
  var config = options.config || configLoader.loadConfig(process.env);
  var libraries = options.client && options.commands && options.getSignedUrl ? null : sdk();
  this.client = options.client || new libraries.s3.S3Client({ region: config.awsRegion });
  this.commands = options.commands || libraries.s3;
  this.getSignedUrl = options.getSignedUrl || libraries.presigner.getSignedUrl;
  this.bucket = options.bucket || config.imageBucket;
  this.prefix = (options.prefix || config.imagePrefix).replace(/^\/+|\/+$/g, "");
  this.ttlSeconds = options.ttlSeconds || config.imageUrlTtlSeconds;
  if (!this.bucket || !this.prefix) throw invalid("Private S3 image bucket and prefix are required.", "INVALID_CONFIGURATION");
}

S3ImageStorage.prototype._key = function (reportId, contentType) {
  if (!safeReportId(reportId)) throw invalid("Report ID is invalid.");
  var checked = imageValidation.validateMetadata({ contentType: contentType, size: 1 });
  if (!checked.ok) throw invalid(checked.error);
  return this.prefix + "/" + reportId + "/" + crypto.randomUUID() + "." + checked.extension;
};
S3ImageStorage.prototype._assertKey = function (key, reportId) {
  if (typeof key !== "string" || key.includes("..") || key.includes("\\") || key.startsWith("/") || !key.startsWith(this.prefix + "/" + reportId + "/")) throw invalid("Image object key is invalid.", "IMAGE_KEY_INVALID");
};
S3ImageStorage.prototype._send = function (Command, input) { return this.client.send(new Command(input)); };

S3ImageStorage.prototype.createUploadIntent = function (input) {
  input = input || {};
  var checked = imageValidation.validateMetadata({ contentType: input.contentType, size: input.size });
  if (!checked.ok) throw invalid(checked.error);
  var key = this._key(input.reportId, checked.contentType);
  // Browsers cannot reliably set Content-Length on a cross-origin PUT. The
  // declared size is still retained in the pending report and is enforced by
  // completeUpload through HeadObject before the image reference is committed.
  var command = new this.commands.PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: checked.contentType });
  var self = this;
  return Promise.resolve(this.getSignedUrl(this.client, command, { expiresIn: this.ttlSeconds })).then(function (url) {
    return { uploadUrl: url, headers: { "Content-Type": checked.contentType }, objectKey: key, contentType: checked.contentType, size: checked.size, expiresIn: self.ttlSeconds };
  });
};

S3ImageStorage.prototype.completeUpload = function (input) {
  input = input || {};
  this._assertKey(input.objectKey, input.reportId);
  var self = this;
  return this._send(this.commands.HeadObjectCommand, { Bucket: this.bucket, Key: input.objectKey }).then(function (head) {
    var checked = imageValidation.validateMetadata({ contentType: head.ContentType, size: head.ContentLength });
    if (!checked.ok || checked.contentType !== input.contentType || checked.size !== Number(input.size)) throw invalid("Uploaded image metadata does not match the requested image.");
    return { objectKey: input.objectKey, contentType: checked.contentType, size: checked.size };
  }).catch(function (error) {
    if (error && error.code) throw error;
    var failure = new Error("The uploaded image could not be verified."); failure.code = "IMAGE_UPLOAD_VERIFICATION_FAILED"; failure.cause = error; throw failure;
  });
};

S3ImageStorage.prototype.createReadUrl = function (objectKey) {
  var marker = this.prefix + "/";
  var rest = typeof objectKey === "string" && objectKey.indexOf(marker) === 0 ? objectKey.slice(marker.length) : "";
  var reportId = rest.split("/")[0];
  this._assertKey(objectKey, reportId);
  var command = new this.commands.GetObjectCommand({ Bucket: this.bucket, Key: objectKey });
  return this.getSignedUrl(this.client, command, { expiresIn: this.ttlSeconds });
};

S3ImageStorage.prototype.deleteImage = function (objectKey, reportId) {
  if (!reportId) {
    var marker = this.prefix + "/";
    var rest = typeof objectKey === "string" && objectKey.indexOf(marker) === 0 ? objectKey.slice(marker.length) : "";
    reportId = rest.split("/")[0];
  }
  this._assertKey(objectKey, reportId);
  return this._send(this.commands.DeleteObjectCommand, { Bucket: this.bucket, Key: objectKey }).then(function () { return true; });
};

module.exports = S3ImageStorage;
