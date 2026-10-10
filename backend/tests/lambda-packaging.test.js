"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var projectRoot = path.resolve(__dirname, "../..");
var entryPoint = path.join(projectRoot, "backend/lambda.js");

function resolveLocalImport(fromFile, request) {
  if (!request.startsWith(".")) return null;
  var base = path.resolve(path.dirname(fromFile), request);
  var candidates = [base, base + ".js", base + ".json", path.join(base, "index.js")];
  return candidates.find(function (candidate) {
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  }) || null;
}

function collectRuntimeImports(file, visited, missing) {
  if (visited.has(file)) return;
  visited.add(file);
  var source = fs.readFileSync(file, "utf8");
  var requirePattern = /require\(["']([^"']+)["']\)/g;
  var match;
  while ((match = requirePattern.exec(source))) {
    var request = match[1];
    var resolved = resolveLocalImport(file, request);
    if (request.startsWith(".") && !resolved) missing.push(file + " -> " + request);
    if (resolved && path.extname(resolved) === ".js") collectRuntimeImports(resolved, visited, missing);
  }
}

var visited = new Set();
var missing = [];
collectRuntimeImports(entryPoint, visited, missing);
assert.deepStrictEqual(missing, [], "Lambda runtime imports must resolve: " + missing.join(", "));
assert.ok(!fs.readFileSync(entryPoint, "utf8").includes('require("./server")'), "Lambda entry point must not load the local HTTP server");

var backendRoot = path.join(projectRoot, "backend");
visited.forEach(function (file) {
  assert.ok(file === entryPoint || file.startsWith(path.join(backendRoot, "src") + path.sep), "Lambda dependency is outside the packaged runtime tree: " + file);
});

var matchingService = fs.readFileSync(path.join(projectRoot, "backend/src/services/matching-service.js"), "utf8");
assert.ok(!matchingService.includes("frontend/assets"), "backend runtime must not depend on frontend asset paths");
assert.ok(fs.existsSync(path.join(projectRoot, "backend/src/services/matching-engine.js")), "backend matching engine must be packaged");

var packageScript = fs.readFileSync(path.join(projectRoot, "scripts/package-lambda.sh"), "utf8");
assert.ok(packageScript.includes("backend/src"), "package script must include backend runtime sources");
assert.ok(!packageScript.includes("frontend/assets"), "package script must not include the frontend asset tree");
assert.ok(packageScript.includes('cp "$PROJECT_ROOT/backend/lambda.js"'), "package script must include the Lambda entry point");

console.log("PASS Lambda packaging runtime import regression test (" + visited.size + " modules checked)");
