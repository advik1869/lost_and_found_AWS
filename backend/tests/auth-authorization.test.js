"use strict";

var assert = require("node:assert/strict");
var principal = require("../src/auth/principal");
var policy = require("../src/auth/authorization");
var InMemoryReportRepository = require("../src/repositories/in-memory-report-repository");
var ReportService = require("../src/services/report-service");
var createHandler = require("../src/handlers/create-report").createHandler;
var getHandler = require("../src/handlers/get-report").createHandler;
var updateHandler = require("../src/handlers/update-report-status").createHandler;

function stored(overrides) { return Object.assign({ id: "owned-report", reportType: "LOST", title: "Keys", description: "Silver keys", category: "Other", location: "Main Quad", date: "2026-10-10", time: "10:00", eventAt: "2026-10-10T10:00:00Z", status: "ACTIVE", createdAt: "2026-10-10T11:00:00.000Z", updatedAt: "2026-10-10T11:00:00.000Z", version: 1, userId: "student-1" }, overrides || {}); }
function event(method, overrides) { return Object.assign({ httpMethod: method, pathParameters: { id: "owned-report" }, queryStringParameters: {} }, overrides || {}); }
function claims(userId, groups) { return { requestContext: { authorizer: { jwt: { claims: Object.assign({ sub: userId }, groups ? { "cognito:groups": groups } : {}) } } } }; }
function body(result) { return JSON.parse(result.body); }

assert.equal(principal.validatePrincipal({ userId: "student-1", roles: ["STUDENT"] }).ok, true, "valid principal is accepted");
assert.equal(principal.validatePrincipal({ userId: "", roles: ["ADMIN"] }).ok, false, "malformed principal is rejected");
assert.equal(principal.extractPrincipal({}).principal, null, "missing authentication is anonymous");
assert.equal(principal.extractPrincipal(claims("student-1", ["admin"])).principal.roles.includes("ADMIN"), true, "trusted JWT claim maps admin role");
assert.equal(principal.extractPrincipal({ headers: { "x-user-id": "student-1", "x-role": "ADMIN" } }).principal, null, "arbitrary headers are ignored");
assert.equal(principal.extractPrincipal({ requestContext: { authorizer: { jwt: { claims: { sub: "" } } } } }).ok, false, "malformed trusted claims are rejected");

var student = { userId: "student-1", roles: ["STUDENT"] };
var otherStudent = { userId: "student-2", roles: ["STUDENT"] };
var admin = { userId: "admin-1", roles: ["ADMIN"] };
var report = stored();
assert.equal(policy.authorize(policy.ACTIONS.BROWSE, null).ok, true, "browse is public");
assert.equal(policy.authorize(policy.ACTIONS.CREATE_REPORT, null).ok, false, "create requires authentication");
assert.equal(policy.authorize(policy.ACTIONS.UPDATE_STATUS, student, report).ok, true, "owner can update status");
assert.equal(policy.authorize(policy.ACTIONS.UPDATE_STATUS, otherStudent, report).ok, false, "other student cannot update status");
assert.equal(policy.authorize(policy.ACTIONS.ADMIN_ACTION, admin).ok, true, "admin can perform admin actions");
assert.equal(policy.authorize(policy.ACTIONS.ADMIN_ACTION, student).ok, false, "student cannot perform admin actions");

var service = new ReportService(new InMemoryReportRepository([report]));
var secureCreate = createHandler({ service: service, enforceAuth: true });
var secureGet = getHandler({ service: service, enforceAuth: true });
var secureUpdate = updateHandler({ service: service, enforceAuth: true });
var reportInput = { reportType: "FOUND", title: "Bottle", description: "Green bottle", category: "Other", location: "Union", date: "2026-10-10" };
assert.equal(secureCreate(event("POST", { pathParameters: {}, body: JSON.stringify(reportInput) })).statusCode, 401, "protected create rejects missing authentication");
var created = secureCreate(event("POST", Object.assign(claims("student-1"), { pathParameters: {}, body: JSON.stringify(Object.assign({}, reportInput, { userId: "student-2" })) })));
assert.equal(created.statusCode, 400, "client cannot spoof user ownership in create body");
var createdTrusted = secureCreate(event("POST", Object.assign(claims("student-1"), { pathParameters: {}, body: JSON.stringify(reportInput) })));
assert.equal(createdTrusted.statusCode, 201, "trusted principal can create");
assert.equal(body(createdTrusted).data.userId, "student-1", "server derives owner from trusted principal");

var deniedUpdate = secureUpdate(event("PATCH", Object.assign(claims("student-2"), { body: JSON.stringify({ status: "MATCHED" }) })));
assert.equal(deniedUpdate.statusCode, 403, "another user's status update is denied");
assert.equal(deniedUpdate.body.includes("student-1"), false, "denial does not leak owner identity");
var allowedUpdate = secureUpdate(event("PATCH", Object.assign(claims("student-1"), { body: JSON.stringify({ status: "MATCHED" }) })));
assert.equal(allowedUpdate.statusCode, 200, "owner status update is allowed");
var adminUpdate = secureUpdate(event("PATCH", Object.assign(claims("admin-1", ["ADMIN"]), { body: JSON.stringify({ status: "RESOLVED" }) })));
assert.equal(adminUpdate.statusCode, 200, "admin status update is allowed");
var spoofedAdmin = secureUpdate(event("PATCH", { headers: { "x-role": "ADMIN" }, body: JSON.stringify({ status: "CLOSED" }) }));
assert.equal(spoofedAdmin.statusCode, 401, "role header cannot authenticate a requester");

var privateReport = new ReportService(new InMemoryReportRepository([stored({ status: "RESOLVED" })]));
var privateGet = getHandler({ service: privateReport, enforceAuth: true });
assert.equal(privateGet(event("GET", { pathParameters: { id: "owned-report" } })).statusCode, 401, "non-public report requires authentication");
assert.equal(privateGet(event("GET", Object.assign(claims("student-2"), { pathParameters: { id: "owned-report" } }))).statusCode, 403, "non-owner cannot read restricted report");
assert.equal(privateGet(event("GET", Object.assign(claims("student-1"), { pathParameters: { id: "owned-report" } }))).statusCode, 200, "owner can read restricted report");

console.log("PASS Phase 7 authentication and authorization tests");
