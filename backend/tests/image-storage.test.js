"use strict";

var assert = require("node:assert/strict");
var imageValidation = require("../src/utils/image-validation");
var LocalImageStorage = require("../src/storage/local-image-storage");

var jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
var png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
var webp = Buffer.from("524946460000000057454250", "hex");

assert.equal(imageValidation.validateImage({ contentType: "image/jpeg", body: jpeg }).ok, true, "JPEG bytes are accepted");
assert.equal(imageValidation.validateImage({ contentType: "image/png", body: png }).ok, true, "PNG bytes are accepted");
assert.equal(imageValidation.validateImage({ contentType: "image/webp", body: webp }).ok, true, "WebP bytes are accepted");
assert.equal(imageValidation.validateImage({ contentType: "image/gif", body: jpeg }).ok, false, "unsupported type is rejected");
assert.equal(imageValidation.validateImage({ contentType: "image/png" }).ok, false, "missing size/bytes are rejected");
assert.equal(imageValidation.validateImage({ contentType: "image/png", body: Buffer.alloc(0) }).ok, false, "empty image is rejected");
assert.equal(imageValidation.validateImage({ contentType: "image/png", body: png }, { maxBytes: 4 }).ok, false, "oversized image is rejected");
assert.equal(imageValidation.validateImage({ contentType: "image/png", body: jpeg }).ok, false, "mismatched bytes are rejected");
var metadataOnly = imageValidation.validateMetadata({ contentType: "image/png", size: 12 });
assert.equal(metadataOnly.ok, true, "metadata-only validation is supported for pre-upload metadata");
assert.equal(Boolean(metadataOnly.warning), true, "metadata-only limitation is explicit");

var storage = new LocalImageStorage();
var saved = storage.putImage({ userId: "user-1", reportId: "report-1", contentType: "image/png", body: png });
assert.match(saved.objectKey, /^images\/user-1\/report-1\//, "adapter generates a safe object key");
assert.equal(saved.objectKey.includes(".."), false, "object key cannot contain traversal");
var loaded = storage.getImage(saved.objectKey);
assert.equal(loaded.metadata.contentType, "image/png", "stored metadata is returned");
assert.deepEqual(Array.from(loaded.body), Array.from(png), "stored bytes are returned intact");
assert.equal(storage.getImage("images/missing.png"), null, "missing image returns null");
assert.equal(storage.deleteImage(saved.objectKey), true, "existing image can be deleted locally");
assert.equal(storage.deleteImage(saved.objectKey), false, "deleting a missing image is safe");
assert.throws(function () { storage.putImage({ userId: "user-1", reportId: "report-1", contentType: "image/png", size: png.length }); }, function (error) { return error.code === "IMAGE_BYTES_REQUIRED"; }, "local storage requires bytes");
assert.throws(function () { storage.getImage("../private.png"); }, function (error) { return error.code === "IMAGE_KEY_INVALID"; }, "unsafe keys are rejected");
assert.throws(function () { storage.createUploadIntent({}); }, function (error) { return error.code === "LOCAL_UPLOAD_INTENT_UNSUPPORTED"; }, "local adapter does not pretend to issue presigned URLs");
assert.throws(function () { new LocalImageStorage({ failWrites: true }).putImage({ userId: "user-1", reportId: "report-1", contentType: "image/png", body: png }); }, function (error) { return error.code === "IMAGE_STORAGE_FAILURE"; }, "storage failures are surfaced safely");

console.log("PASS Phase 6 image validation and local storage tests");
