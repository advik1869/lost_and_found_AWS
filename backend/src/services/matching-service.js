"use strict";

// The scoring engine is shared with the browser. This service adds the
// backend-only policy that a score must also have non-title evidence before a
// a confirmed pair may be cleaned up automatically.
var engine = require("./matching-engine.js");

function supportingEvidence(first, second) {
  var sameCategory = engine.normalize(first.category) && engine.normalize(first.category) === engine.normalize(second.category);
  var firstDescription = new Set(engine.normalize(first.description).split(" ").filter(function (word) { return word.length > 2; }));
  var secondDescription = new Set(engine.normalize(second.description).split(" ").filter(function (word) { return word.length > 2; }));
  var sharedDescriptionCount = 0;
  firstDescription.forEach(function (word) { if (secondDescription.has(word)) sharedDescriptionCount += 1; });
  var sameLocation = engine.normalize(first.location) && engine.normalize(first.location) === engine.normalize(second.location);
  // A date is useful scoring evidence, but is intentionally not sufficient by
  // itself: identical titles with conflicting details must remain separate.
  return Boolean(sameCategory && (sharedDescriptionCount >= 2 || sameLocation));
}

function highConfidenceMatches(report, candidates, options) {
  return engine.findMatches(report, candidates, options).filter(function (match) {
    var candidate = (candidates || []).find(function (item) { return item.id === match.matchId; });
    return candidate && supportingEvidence(report, candidate);
  });
}

module.exports = Object.assign({}, engine, {
  hasSupportingEvidence: supportingEvidence,
  highConfidenceMatches: highConfidenceMatches
});

