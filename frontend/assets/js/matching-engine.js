(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LFMatching = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  var STOP_WORDS = new Set(["a", "an", "and", "at", "for", "found", "in", "item", "lost", "near", "of", "on", "the", "to", "with"]);
  var DEFAULT_THRESHOLD = 42;

  function normalize(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }
  function tokens(value) { return new Set(normalize(value).split(" ").filter(function (word) { return word.length > 2 && !STOP_WORDS.has(word); })); }
  function overlap(one, two) { var shared = []; one.forEach(function (word) { if (two.has(word)) shared.push(word); }); return shared.sort(); }
  function locationSimilarity(a, b) {
    var left = tokens(a), right = tokens(b), shared = overlap(left, right);
    if (normalize(a) === normalize(b) && normalize(a)) return { points: 20, reason: "same location" };
    if (shared.length) return { points: 14, reason: "related location: " + shared.slice(0, 3).join(", ") };
    return { points: 0, reason: "different locations" };
  }
  function dateSimilarity(a, b) {
    if (!a || !b) return { points: 0, reason: "date proximity unavailable" };
    var days = Math.abs(new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 86400000;
    if (!Number.isFinite(days)) return { points: 0, reason: "date proximity unavailable" };
    if (days <= 1) return { points: 15, reason: "within 1 day" };
    if (days <= 3) return { points: 12, reason: "within 3 days" };
    if (days <= 7) return { points: 8, reason: "within 1 week" };
    if (days <= 14) return { points: 4, reason: "within 2 weeks" };
    return { points: 0, reason: "dates are far apart" };
  }
  function eligible(report) { return report && report.status !== "RESOLVED" && report.status !== "CLOSED"; }

  function scorePair(first, second) {
    if (!first || !second || first.id === second.id || first.reportType === second.reportType || !eligible(first) || !eligible(second)) return null;
    var reasons = [], score = 0;
    if (normalize(first.category) && normalize(first.category) === normalize(second.category)) { score += 30; reasons.push("same category"); }
    var firstWords = tokens((first.title || "") + " " + (first.description || ""));
    var secondWords = tokens((second.title || "") + " " + (second.description || ""));
    var shared = overlap(firstWords, secondWords);
    if (shared.length) { score += Math.min(25, shared.length * 8); reasons.push("shared keywords: " + shared.slice(0, 4).join(", ")); }
    var place = locationSimilarity(first.location, second.location); score += place.points; if (place.points) reasons.push(place.reason);
    var date = dateSimilarity(first.date, second.date); score += date.points; if (date.points) reasons.push(date.reason);
    var descriptionWords = overlap(tokens(first.description), tokens(second.description));
    if (descriptionWords.length) { score += Math.min(10, descriptionWords.length * 3); reasons.push("similar description details"); }
    return { score: Math.min(100, score), reasons: reasons, sourceId: first.id, matchId: second.id };
  }

  function findMatches(report, reports, options) {
    options = options || {};
    var threshold = Number.isFinite(options.threshold) ? options.threshold : DEFAULT_THRESHOLD;
    return (Array.isArray(reports) ? reports : []).map(function (candidate) { return scorePair(report, candidate); }).filter(function (result) { return result && result.score >= threshold; }).sort(function (a, b) { return b.score - a.score || a.matchId.localeCompare(b.matchId); });
  }

  return { DEFAULT_THRESHOLD: DEFAULT_THRESHOLD, normalize: normalize, scorePair: scorePair, findMatches: findMatches };
});
