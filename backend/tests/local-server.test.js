var assert = require("node:assert/strict");
var http = require("node:http");
var InMemoryReportRepository = require("../src/repositories/in-memory-report-repository");
var ReportService = require("../src/services/report-service");
var createServer = require("../server").createServer;

function request(base, method, path, body) {
  return new Promise(function (resolve, reject) {
    var parsed = new URL(path, base);
    var payload = body === undefined ? "" : JSON.stringify(body);
    var req = http.request({ hostname: parsed.hostname, port: parsed.port, path: parsed.pathname + parsed.search, method: method, headers: { "Content-Type": "application/json", Origin: "http://localhost:8000", "Content-Length": Buffer.byteLength(payload) } }, function (res) {
      var chunks = [];
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () { resolve({ status: res.statusCode, headers: res.headers, body: res.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null }); });
    });
    req.on("error", reject);
    req.end(payload);
  });
}

async function run() {
  var repository = new InMemoryReportRepository();
  var server = createServer({ dependencies: { service: new ReportService(repository), config: { enforceAuth: false }, enforceAuth: false } });
  await new Promise(function (resolve) { server.listen(0, "127.0.0.1", resolve); });
  var address = server.address();
  var base = "http://127.0.0.1:" + address.port;
  try {
    var created = await request(base, "POST", "/reports", { reportType: "FOUND", title: "Green bottle", description: "Found near union", category: "Other", location: "Student Union", date: "2026-10-10" });
    assert.equal(created.status, 201);
    assert.ok(created.body.data.id);
    var listed = await request(base, "GET", "/reports?limit=20");
    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.items.length, 1);
    var invalid = await request(base, "POST", "/reports", { title: "Missing required fields" });
    assert.equal(invalid.status, 400);
    var missing = await request(base, "GET", "/reports/not-found");
    assert.equal(missing.status, 404);
    var unsupported = await request(base, "DELETE", "/reports");
    assert.equal(unsupported.status, 405);
    console.log("PASS local HTTP API server tests");
  } finally {
    await new Promise(function (resolve) { server.close(resolve); });
  }
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
