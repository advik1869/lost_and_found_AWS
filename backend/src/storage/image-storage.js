"use strict";

function unsupported(operation) { var error = new Error("IMAGE_STORAGE_NOT_IMPLEMENTED: " + operation); error.code = "IMAGE_STORAGE_NOT_IMPLEMENTED"; return error; }

function ImageStorage() {}
ImageStorage.prototype.putImage = function () { throw unsupported("putImage"); };
ImageStorage.prototype.getImage = function () { throw unsupported("getImage"); };
ImageStorage.prototype.deleteImage = function () { throw unsupported("deleteImage"); };
ImageStorage.prototype.createUploadIntent = function () { throw unsupported("createUploadIntent"); };

module.exports = ImageStorage;
