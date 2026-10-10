# Rule-Based Matching Design

This is a transparent local matching approach implemented in `frontend/assets/js/matching-engine.js`. It does not use paid AI services or external APIs.

## Candidate selection

When a report is created or a user requests suggestions, select a bounded candidate set of active reports with the opposite type (`LOST` versus `FOUND`). Prefer candidates sharing the same category or normalized campus area. Use pagination and a maximum candidate count so matching never requires an unbounded table scan.

## Suggested score

Score each candidate out of 100 using simple, explainable signals:

| Signal | Weight | Example rule |
|---|---:|---|
| Category | 30 | Exact normalized category match receives full points. |
| Keywords | Up to 25 | Normalized title/description tokens overlap, with a small cap per shared keyword. |
| Location | 14–20 | Same location receives 20; shared location terms receive 14. |
| Date proximity | 4–15 | Full points within one day, decreasing through a two-week window. |
| Description similarity | Up to 10 | Additional overlap in descriptions receives a small capped score. |

One possible interpretation is:

`score = category + keywords + location + dateProximity + descriptionSimilarity`

The current default review threshold is **42/100**, configurable through `findMatches(report, reports, { threshold })`. Backend report creation reuses this score and automatically cleans up only high-confidence candidates that also share the normalized category plus description evidence or an exact location. A title match by itself is never enough. Lower-confidence candidates remain suggestions for review.

## Transparency and safety

For every suggestion, retain or display the contributing signals, for example: “same category, nearby location, and date two days apart.” Do not expose a private user's contact information. A confirmed automatic match deletes both existing report records in one conditional transaction; neither report remains in browse results or detail retrieval. Active reports cannot be manually resolved as a substitute for matching. Conditional deletes prevent a second concurrent cleanup from partially removing a pair.

## Limitations

Keyword overlap is sensitive to spelling, language, vague descriptions, and common words. Location names may be inconsistent, date information may be missing, and similar items can produce false positives. The algorithm cannot verify ownership, identify a person, or replace campus procedures. It should be treated as a prioritization aid, not an automated decision system.

## Implementation order

The engine remains a pure shared function with fixture-based tests in `tests/phase2.test.js`; `backend/src/services/matching-service.js` adds only the automatic-match evidence gate. It excludes same-type, self, `RESOLVED`, and `CLOSED` comparisons, and sorts equal-score results by stable ID. Consider SQS and a worker Lambda only if matching becomes slow or needs retries; synchronous matching is sufficient for the current MVP.

