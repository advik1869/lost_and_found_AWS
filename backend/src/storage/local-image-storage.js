"use strict";

var crypto = require("node:crypto");
var validation = require("../utils/image-validation");
var config = require("../config");

function cloneMetadata(metadata) { return JSON.parse(JSON.stringify(metadata)); }
function safeSegment(value) { return typeof value === "string" && /^[A-Za-z0-9_-]{2,128}$/.test(value) ? value : "anonymous"; }

function LocalImageStorage(options) {
  options = options || {};
  this.images = new Map();
  this.failWrites = Boolean(options.failWrites);
  this.maxBytes = Number.isInteger(options.maxBytes) ? options.maxBytes : config.loadConfig(process.env).maxImageSizeBytes;
}

LocalImageStorage.prototype.putImage = function (input) {
  if (this.failWrites) { var failure = new Error("Local image storage write failed."); failure.code = "IMAGE_STORAGE_FAILURE"; throw failure; }
  var checked = validation.validateImage(input, { maxBytes: this.maxBytes });
  if (!checked.ok) { var invalid = new Error(checked.error); invalid.code = "IMAGE_VALIDATION_ERROR"; invalid.details = checked.details; throw invalid; }
  var body = input.body || input.buffer || input.bytes;
  if (!body) { var missing = new Error("Local image storage requires image bytes."); missing.code = "IMAGE_BYTES_REQUIRED"; throw missing; }
  var key = "images/" + safeSegment(input.userId) + "/" + safeSegment(input.reportId) + "/" + crypto.randomUUID() + "." + checked.extension;
  var bytes = Buffer.isBuffer(body) ? Buffer.from(body) : Buffer.from(body);
  var metadata = { objectKey: key, contentType: checked.contentType, size: checked.size, metadataOnly: checked.metadataOnly };
  this.images.set(key, { metadata: metadata, bytes: bytes });
  return cloneMetadata(metadata);
};

LocalImageStorage.prototype.getImage = function (objectKey) {
  if (typeof objectKey !== "string" || !objectKey || objectKey.includes("..") || objectKey.includes("\\") || objectKey.startsWith("/")) { var invalid = new Error("Image object key is invalid."); invalid.code = "IMAGE_KEY_INVALID"; throw invalid; }
  var stored = this.images.get(objectKey);
  return stored ? { metadata: cloneMetadata(stored.metadata), body: Buffer.from(stored.bytes) } : null;
};

LocalImageStorage.prototype.deleteImage = function (objectKey) {
  if (typeof objectKey !== "string" || !objectKey || objectKey.includes("..") || objectKey.includes("\\") || objectKey.startsWith("/")) { var invalid = new Error("Image object key is invalid."); invalid.code = "IMAGE_KEY_INVALID"; throw invalid; }
  return this.images.delete(objectKey);
};

LocalImageStorage.prototype.createUploadIntent = function () { var unsupported = new Error("Local adapter does not issue presigned URLs."); unsupported.code = "LOCAL_UPLOAD_INTENT_UNSUPPORTED"; throw unsupported; };

module.exports = LocalImageStorage;
