"use strict";

var USER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{1,127}$/;

function invalid(message) { return { ok: false, error: message }; }
function rolesFromClaims(claims) {
  var groups = claims && (claims["cognito:groups"] || claims.groups) || [];
  if (typeof groups === "string") groups = groups.split(/[ ,]+/).filter(Boolean);
  if (!Array.isArray(groups)) groups = [];
  return groups.map(String).map(function (role) { return role.toUpperCase(); }).filter(function (role) { return role === "ADMIN" || role === "STUDENT"; }).filter(function (role, index, all) { return all.indexOf(role) === index; });
}

function validatePrincipal(principal) {
  if (!principal || typeof principal !== "object" || Array.isArray(principal)) return invalid("Authentication context is missing or malformed.");
  if (typeof principal.userId !== "string" || !USER_ID_PATTERN.test(principal.userId)) return invalid("Authentication subject is malformed.");
  var roles = Array.isArray(principal.roles) ? principal.roles.map(String).map(function (role) { return role.toUpperCase(); }) : [];
  if (roles.some(function (role) { return role !== "STUDENT" && role !== "ADMIN"; })) return invalid("Authentication roles are malformed.");
  if (!roles.length) roles = ["STUDENT"];
  return { ok: true, principal: { userId: principal.userId, roles: roles.filter(function (role, index, all) { return all.indexOf(role) === index; }), claims: principal.claims || {} } };
}

function extractPrincipal(event) {
  var authorizer = event && event.requestContext && event.requestContext.authorizer;
  if (!authorizer) return { ok: true, principal: null };
  var claims = authorizer.jwt && authorizer.jwt.claims;
  if (claims) {
    if (typeof claims !== "object" || typeof claims.sub !== "string") return invalid("Verified authorizer claims are malformed.");
    return validatePrincipal({ userId: claims.sub, roles: rolesFromClaims(claims), claims: claims });
  }
  // Custom-authorizer shape is accepted only from the trusted authorizer context, never headers/body/query.
  if (authorizer.principalId || authorizer.userId) return validatePrincipal({ userId: authorizer.principalId || authorizer.userId, roles: authorizer.roles, claims: authorizer });
  return invalid("Authentication context is malformed.");
}

module.exports = { validatePrincipal: validatePrincipal, extractPrincipal: extractPrincipal };
