"use strict";

var createReport = require("./handlers/create-report").createHandler;
var getReport = require("./handlers/get-report").createHandler;
var listReports = require("./handlers/list-reports").createHandler;
var updateReportStatus = require("./handlers/update-report-status").createHandler;
var getMatches = require("./handlers/get-matches").createHandler;
var imageUpload = require("./handlers/image-upload").createHandler;
var imageComplete = require("./handlers/image-complete").createHandler;

function routeFor(pathname, method) {
  var match;
  if (pathname === "/reports") return { handler: method === "POST" ? "create" : "list", pathParameters: {} };
  match = pathname.match(/^\/reports\/([^/]+)\/image-upload$/);
  if (match) return { handler: "imageUpload", pathParameters: { id: decodeURIComponent(match[1]) } };
  match = pathname.match(/^\/reports\/([^/]+)\/image-complete$/);
  if (match) return { handler: "imageComplete", pathParameters: { id: decodeURIComponent(match[1]) } };
  match = pathname.match(/^\/reports\/([^/]+)\/status$/);
  if (match) return { handler: "update", pathParameters: { id: decodeURIComponent(match[1]) } };
  match = pathname.match(/^\/reports\/([^/]+)\/matches$/);
  if (match) return { handler: "matches", pathParameters: { id: decodeURIComponent(match[1]) } };
  match = pathname.match(/^\/reports\/([^/]+)$/);
  if (match) return { handler: "get", pathParameters: { id: decodeURIComponent(match[1]) } };
  return null;
}

function createHandlers(dependencies) {
  var service = dependencies.service;
  var enforceAuth = Boolean(dependencies.enforceAuth);
  return {
    create: createReport({ service: service, enforceAuth: enforceAuth }),
    get: getReport({ service: service, enforceAuth: enforceAuth }),
    list: listReports({ service: service, enforceAuth: enforceAuth }),
    update: updateReportStatus({ service: service, enforceAuth: enforceAuth }),
    matches: getMatches({ service: service, enforceAuth: enforceAuth }),
    imageUpload: imageUpload({ service: service, enforceAuth: enforceAuth }),
    imageComplete: imageComplete({ service: service, enforceAuth: enforceAuth })
  };
}

module.exports = { routeFor: routeFor, createHandlers: createHandlers };
