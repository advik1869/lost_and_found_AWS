var assert = require("node:assert/strict");
var ReportService = require("../src/services/report-service");
var InMemoryReportRepository = require("../src/repositories/in-memory-report-repository");

function input(overrides) {
  return Object.assign({ reportType: "LOST", title: "iPhone 15", description: "Natural titanium case", category: "Electronics", location: "Central Library", date: "2026-10-08", time: "10:00", contact: "student" }, overrides || {});
}

async function run() {
  var repository = new InMemoryReportRepository();
  var service = new ReportService(repository);
  var lost = await service.createReport(input());
  var found = await service.createReport(input({ reportType: "FOUND" }));
  assert.equal(found.deleted, true, "the high-confidence opposite-type pair is deleted on confirmation");
  assert.equal((await service.getReport(lost.id)), null, "deleted LOST reports are not retrievable");
  assert.equal((await service.getReport(found.matchedReportId)), null, "deleted FOUND reports are not retrievable");
  assert.equal((await service.listReports({ status: "ACTIVE" }, { limit: 20 })).items.length, 0, "deleted pairs leave active browse results");
  assert.equal((await service.listReports({}, { limit: 20 })).items.length, 0, "deleted pairs leave all browse results");

  var conflictingRepo = new InMemoryReportRepository();
  var conflicting = new ReportService(conflictingRepo);
  await conflicting.createReport(input({ title: "iPhone 15", description: "Blue silicone case", location: "North Gym", date: "2026-10-01" }));
  var other = await conflicting.createReport(input({ reportType: "FOUND", title: "iPhone 15", description: "Cracked screen and black case", location: "South Parking", date: "2026-10-20" }));
  assert.equal(other.status, "ACTIVE", "identical titles with conflicting details are not auto-matched");

  var sameTypeRepo = new InMemoryReportRepository();
  var sameType = new ReportService(sameTypeRepo);
  await sameType.createReport(input());
  var secondLost = await sameType.createReport(input({ title: "iPhone 15", description: "Natural titanium case" }));
  assert.equal(secondLost.status, "ACTIVE", "same-type reports never match");

  var duplicate = repository.deleteMatchedPair(lost.id, found.matchedReportId, { first: 1, second: 1 });
  assert.equal(duplicate.deleted, false, "a second matching attempt is rejected without deleting unrelated records");

  var secondPairRepo = new InMemoryReportRepository();
  var secondPair = new ReportService(secondPairRepo);
  var backpack = await secondPair.createReport(input({ title: "Canvas backpack", description: "Canvas backpack with red stitching", category: "Bags", location: "Science Hall" }));
  var backpackFound = await secondPair.createReport(input({ reportType: "FOUND", title: "Canvas backpack", description: "Canvas backpack with red stitching", category: "Bags", location: "Science Hall" }));
  assert.equal(backpackFound.deleted, true, "a separate high-confidence category pair is also deleted");
  assert.equal(await secondPair.getReport(backpack.id), null, "the second LOST pair member is deleted");

  var resolvedRepo = new InMemoryReportRepository();
  var resolvedService = new ReportService(resolvedRepo);
  var resolvedLost = await resolvedService.createReport(input({ title: "Manual resolution", description: "Unmatched manual resolution", category: "Books" }));
  await resolvedRepo.updateReportStatus(resolvedLost.id, "RESOLVED", 1);
  var resolvedFound = await resolvedService.createReport(input({ reportType: "FOUND", title: "Different object", description: "No matching details", category: "Clothing" }));
  await resolvedRepo.updateReportStatus(resolvedFound.id, "RESOLVED", 1);
  assert.equal((await resolvedService.listReports({ status: "RESOLVED" }, { limit: 20 })).items.length, 2, "manually resolved unmatched reports are preserved");
  console.log("PASS automatic matching integration tests");
}

run().catch(function (error) { console.error(error); process.exitCode = 1; });
