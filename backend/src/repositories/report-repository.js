"use strict";

function ReportRepository() {}
ReportRepository.prototype.createReport = function () { throw new Error("REPORT_REPOSITORY_NOT_IMPLEMENTED"); };
ReportRepository.prototype.getReportById = function () { throw new Error("REPORT_REPOSITORY_NOT_IMPLEMENTED"); };
ReportRepository.prototype.listReports = function () { throw new Error("REPORT_REPOSITORY_NOT_IMPLEMENTED"); };
ReportRepository.prototype.listReportsByUser = function () { throw new Error("REPORT_REPOSITORY_NOT_IMPLEMENTED"); };
ReportRepository.prototype.updateReportStatus = function () { throw new Error("REPORT_REPOSITORY_NOT_IMPLEMENTED"); };
ReportRepository.prototype.deleteMatchedPair = function () { throw new Error("REPORT_REPOSITORY_NOT_IMPLEMENTED"); };
ReportRepository.prototype.setPendingImage = function () { throw new Error("REPORT_REPOSITORY_NOT_IMPLEMENTED"); };
ReportRepository.prototype.completeImageUpload = function () { throw new Error("REPORT_REPOSITORY_NOT_IMPLEMENTED"); };

module.exports = ReportRepository;
