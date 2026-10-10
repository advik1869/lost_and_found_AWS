"use strict";

var assert = require("node:assert/strict");
var S3ImageStorage = require("../src/storage/s3-image-storage");

function Command(input) { this.input = input; }
var commands = { PutObjectCommand: Command, HeadObjectCommand: Command, GetObjectCommand: Command, DeleteObjectCommand: Command };

async function run() {
  var sent = [];
  var storage = new S3ImageStorage({ bucket: "private-images", prefix: "report-images", ttlSeconds: 300, commands: commands, client: { send: function (command) { sent.push(command.input); return Promise.resolve({ ContentType: "image/png", ContentLength: 123 }); } }, getSignedUrl: function (_client, command, options) { sent.push({ signed: command.input, options: options }); return Promise.resolve("https://signed.example/" + command.input.Key); } });
  var intent = await storage.createUploadIntent({ reportId: "report-123", contentType: "image/png", size: 123 });
  assert.match(intent.objectKey, /^report-images\/report-123\/[0-9a-f-]+\.png$/);
  assert.equal(sent[0].signed.ServerSideEncryption, undefined, "ServerSideEncryption must be omitted to prevent signature mismatch");
  assert.equal(intent.headers["Content-Type"], "image/png");
  assert.equal(intent.expiresIn, 300);
  assert.equal((await storage.completeUpload({ reportId: "report-123", objectKey: intent.objectKey, contentType: "image/png", size: 123 })).objectKey, intent.objectKey);
  assert.match(await storage.createReadUrl(intent.objectKey), /^https:\/\/signed/);
  assert.equal(await storage.deleteImage(intent.objectKey, "report-123"), true);
  assert.throws(function () { storage.createUploadIntent({ reportId: "report-123", contentType: "image/gif", size: 10 }); }, function (error) { return error.code === "IMAGE_VALIDATION_ERROR"; });
  assert.throws(function () { storage.createReadUrl("report-images/report-123/../private.png"); }, function (error) { return error.code === "IMAGE_KEY_INVALID"; });
  var mismatch = new S3ImageStorage({ bucket: "private-images", prefix: "report-images", commands: commands, client: { send: function () { return Promise.resolve({ ContentType: "image/jpeg", ContentLength: 123 }); } }, getSignedUrl: function () { return Promise.resolve("signed"); } });
  await assert.rejects(mismatch.completeUpload({ reportId: "report-123", objectKey: intent.objectKey, contentType: "image/png", size: 123 }), function (error) { return error.code === "IMAGE_UPLOAD_VERIFICATION_FAILED" || error.code === "IMAGE_VALIDATION_ERROR"; });
  assert.ok(sent.length >= 4, "presign and storage operations were exercised");
  console.log("PASS S3 image storage adapter tests");
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
