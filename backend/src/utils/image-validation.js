"use strict";

var MAX_IMAGE_BYTES = 5 * 1024 * 1024;
var ALLOWED_IMAGE_TYPES = Object.freeze(["image/jpeg", "image/png", "image/webp"]);
var EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
var config = require("../config");

function metadataError(message, details) { return { ok: false, error: message, details: details || [message] }; }
function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
}
function detectedType(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function validateImage(input, options) {
  options = options || {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return metadataError("Image input must be an object.");
  var contentType = input.contentType || input.type;
  var buffer = asBuffer(input.body || input.buffer || input.bytes);
  var size = buffer ? buffer.length : input.size;
  if (typeof contentType !== "string" || !ALLOWED_IMAGE_TYPES.includes(contentType.toLowerCase())) return metadataError("Unsupported image type.", ["Supported types are JPEG, PNG, and WebP."]);
  if (!Number.isInteger(size) || size <= 0) return metadataError("Image must not be empty and must include a valid byte size.");
  var maxBytes = Number.isInteger(options.maxBytes) ? options.maxBytes : config.loadConfig(process.env).maxImageSizeBytes;
  if (size > maxBytes) return metadataError("Image exceeds the maximum allowed size.", ["Maximum image size is " + maxBytes + " bytes."]);
  var detected = detectedType(buffer);
  if (buffer && !detected) return metadataError("Image bytes do not match a supported image format.");
  if (buffer && detected !== contentType.toLowerCase()) return metadataError("Image metadata does not match the supplied bytes.");
  return { ok: true, contentType: contentType.toLowerCase(), size: size, extension: EXTENSIONS[contentType.toLowerCase()], detectedType: detected, metadataOnly: !buffer, warning: buffer ? null : "Metadata-only validation cannot verify the file bytes." };
}

function validateMetadata(metadata, options) { return validateImage(Object.assign({}, metadata || {}, { body: undefined, buffer: undefined, bytes: undefined }), options); }

module.exports = { MAX_IMAGE_BYTES: MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES: ALLOWED_IMAGE_TYPES, detectedType: detectedType, validateImage: validateImage, validateMetadata: validateMetadata };
