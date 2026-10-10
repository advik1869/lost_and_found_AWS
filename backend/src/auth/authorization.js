"use strict";

var ACTIONS = Object.freeze({ BROWSE: "BROWSE", CREATE_REPORT: "CREATE_REPORT", READ_REPORT: "READ_REPORT", UPDATE_STATUS: "UPDATE_STATUS", REQUEST_IMAGE_UPLOAD: "REQUEST_IMAGE_UPLOAD", DELETE_IMAGE: "DELETE_IMAGE", ADMIN_ACTION: "ADMIN_ACTION" });

function allow(reason) { return { ok: true, reason: reason }; }
function deny(code, message) { return { ok: false, code: code, message: message }; }
function authenticated(principal) { return principal && typeof principal.userId === "string"; }
function admin(principal) { return authenticated(principal) && principal.roles.includes("ADMIN"); }
function owner(principal, report) { return authenticated(principal) && report && typeof report.userId === "string" && principal.userId === report.userId; }

function authorize(action, principal, report) {
  if (action === ACTIONS.BROWSE) return allow("public browse");
  if (action === ACTIONS.READ_REPORT && report && report.status === "ACTIVE") return allow("active report is publicly readable");
  if (action === ACTIONS.CREATE_REPORT) return authenticated(principal) ? allow("authenticated user") : deny("AUTHENTICATION_REQUIRED", "Authentication is required for this action.");
  if (action === ACTIONS.READ_REPORT) return owner(principal, report) || admin(principal) ? allow("owner or administrator") : deny("ACCESS_DENIED", "This report is not available to this requester.");
  if (action === ACTIONS.UPDATE_STATUS) return owner(principal, report) || admin(principal) ? allow("owner or administrator") : deny("ACCESS_DENIED", "You are not allowed to update this report.");
  if (action === ACTIONS.REQUEST_IMAGE_UPLOAD || action === ACTIONS.DELETE_IMAGE) return owner(principal, report) || admin(principal) ? allow("owner or administrator") : deny("ACCESS_DENIED", "You are not allowed to manage this image.");
  if (action === ACTIONS.ADMIN_ACTION) return admin(principal) ? allow("administrator") : deny("ADMIN_REQUIRED", "Administrator privileges are required.");
  return deny("ACCESS_DENIED", "This action is not allowed.");
}

module.exports = { ACTIONS: ACTIONS, authorize: authorize, isOwner: owner, isAdmin: admin };
