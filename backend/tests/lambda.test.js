var assert = require("node:assert/strict");
var InMemoryReportRepository = require("../src/repositories/in-memory-report-repository");
var ReportService = require("../src/services/report-service");
var createLambdaHandler = require("../lambda").createHandler;

function fixture(overrides) {
  return Object.assign({ id: "lambda-seed", reportType: "LOST", title: "Black laptop", description: "Black laptop with a silver sticker", category: "Electronics", location: "Central Library", date: "2026-10-08", time: "10:00", eventAt: "2026-10-08T10:00:00Z", status: "ACTIVE", createdAt: "2026-10-08T11:00:00.000Z", updatedAt: "2026-10-08T11:00:00.000Z", version: 1 }, overrides || {});
}
function event(method, path, overrides) {
  return Object.assign({ version: "2.0", rawPath: path, routeKey: method + " " + path, requestContext: { http: { method: method, path: path } }, headers: { origin: "http://localhost:8000" }, queryStringParameters: {}, pathParameters: {} }, overrides || {});
}
function json(result) { return JSON.parse(result.body); }

async function run() {
  var repository = new InMemoryReportRepository([fixture()]);
  var handler = createLambdaHandler({ service: new ReportService(repository), enforceAuth: false });
  var listed = await handler(event("GET", "/reports"));
  assert.equal(listed.statusCode, 200, "Lambda routes GET /reports");
  assert.equal(json(listed).data.items.length, 1, "Lambda returns report data");
  assert.equal(listed.headers["Access-Control-Allow-Origin"], "http://localhost:8000", "Lambda preserves CORS");

  var created = await handler(event("POST", "/reports", { body: JSON.stringify({ reportType: "FOUND", title: "Green bottle", description: "Found near union", category: "Other", location: "Student Union", date: "2026-10-10" }) }));
  assert.equal(created.statusCode, 201, "Lambda routes POST /reports");
  assert.ok(json(created).data.id, "Lambda returns generated report ID");

  var malformed = await handler(event("POST", "/reports", { body: "{" }));
  assert.equal(malformed.statusCode, 400, "Lambda returns validation error for malformed JSON");
  var missing = await handler(event("GET", "/reports/missing-report"));
  assert.equal(missing.statusCode, 404, "Lambda returns not found for missing reports");
  var unsupported = await handler(event("DELETE", "/reports"));
  assert.equal(unsupported.statusCode, 405, "Lambda preserves unsupported-method response");
  var unknown = await handler(event("GET", "/unknown"));
  assert.equal(unknown.statusCode, 404, "Lambda returns not found for unknown routes");
  var preflight = await handler(event("OPTIONS", "/reports"));
  assert.equal(preflight.statusCode, 204, "Lambda handles CORS preflight");

  var asyncService = {
    listReports: function () { return Promise.resolve({ items: [fixture()], nextToken: null }); },
    listReportsByUser: function () { return Promise.resolve({ items: [], nextToken: null }); },
    getReport: function () { return Promise.resolve(fixture()); },
    getMatches: function () { return Promise.resolve({ reportId: "lambda-seed", threshold: 42, matches: [] }); },
    createReport: function () { return Promise.resolve(fixture({ id: "async-created" })); },
    updateReportStatus: function () { return Promise.resolve(fixture({ status: "MATCHED", version: 2 })); }
  };
  var asyncResponse = await createLambdaHandler({ service: asyncService, enforceAuth: false })(event("GET", "/reports/lambda-seed"));
  assert.equal(asyncResponse.statusCode, 200, "Lambda resolves asynchronous repository responses");
  assert.equal(json(asyncResponse).data.id, "lambda-seed", "Lambda serializes resolved async data");

  var deployedId = "report-a764caf3-2550-40c4-9e79-df0b3dccfce6";
  var detailCalls = [];
  var detailResponse = await createLambdaHandler({ service: {
    getReport: function (id) { detailCalls.push(id); return Promise.resolve(fixture({ id: deployedId })); }
  }, enforceAuth: false })(event("GET", "/reports/" + deployedId, { pathParameters: { proxy: deployedId } }));
  assert.equal(detailResponse.statusCode, 200, "Lambda opens a UUID report detail route");
  assert.deepEqual(detailCalls, [deployedId], "Lambda derives the report ID when the integration parameter key differs");
  console.log("PASS Lambda adapter routing and response tests");
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
