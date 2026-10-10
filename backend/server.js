"use strict";

var http = require("node:http");
var runtime = require("./src/runtime");
var response = require("./src/utils/response");
var routes = require("./src/http-routes");

var MAX_BODY_BYTES = 1024 * 1024;

function queryObject(url) {
  var result = {};
  url.searchParams.forEach(function (value, key) { result[key] = value; });
  return result;
}

function readBody(request) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var size = 0;
    request.on("data", function (chunk) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        var tooLarge = new Error("Request body is too large.");
        tooLarge.code = "PAYLOAD_TOO_LARGE";
        reject(tooLarge);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", function () { resolve(Buffer.concat(chunks).toString("utf8")); });
    request.on("error", reject);
  });
}

function createServer(options) {
  options = options || {};
  var dependencies = options.dependencies || runtime;
  var handlers = routes.createHandlers(dependencies);
  return http.createServer(function (request, serverResponse) {
    var parsed = new URL(request.url, "http://localhost");
    var route = routes.routeFor(parsed.pathname, request.method);
    var event = {
      version: "2.0",
      routeKey: request.method + " " + parsed.pathname,
      rawPath: parsed.pathname,
      httpMethod: request.method,
      headers: request.headers,
      pathParameters: route ? route.pathParameters : {},
      queryStringParameters: queryObject(parsed),
      requestContext: { http: { method: request.method, path: parsed.pathname } }
    };

    function send(result) {
      var headers = result.headers || {};
      serverResponse.writeHead(result.statusCode, headers);
      if (result.statusCode !== 204) serverResponse.end(result.body || ""); else serverResponse.end();
    }

    if (!route) {
      send(response.error(404, "NOT_FOUND", "Route was not found.", undefined, event));
      return;
    }

    readBody(request).then(function (body) {
      event.body = body;
      return Promise.resolve(handlers[route.handler](event)).then(send);
    }).catch(function (error) {
      if (error.code === "PAYLOAD_TOO_LARGE") {
        send(response.error(413, "PAYLOAD_TOO_LARGE", "Request body is too large.", undefined, event));
        return;
      }
      send(response.error(500, "INTERNAL_ERROR", "An unexpected error occurred.", undefined, event));
    });
  });
}

if (require.main === module) {
  var port = Number(process.env.PORT || 3000);
  var host = process.env.HOST || "127.0.0.1";
  var server = createServer();
  server.listen(port, host, function () { console.log("Foundly local API listening at http://" + host + ":" + port); });
}

module.exports = { createServer: createServer, routeFor: routes.routeFor, createHandlers: routes.createHandlers, MAX_BODY_BYTES: MAX_BODY_BYTES };
