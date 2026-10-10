(function () {
  "use strict";

  function apiMode() { return Boolean(window.LFConfig && window.LFConfig.mode === "api" && window.LFAPI && window.LFAPI.isEnabled()); }
  var MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  var IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
  function createdReportForRedirect(result) {
    var report = result && result.report;
    return report && typeof report.id === "string" && report.id.trim() ? report : null;
  }
  function updateModeCopy() {
    var connected = apiMode();
    var label = document.querySelector(".report-layout aside .section-kicker");
    var heading = document.querySelector(".report-layout aside .section-heading");
    var copy = document.querySelector(".report-layout aside .section-intro");
    var submit = document.querySelector("#report-form button[type='submit']");
    var success = document.querySelector("#form-success strong");
    if (label) label.textContent = connected ? "Connected board" : "Local demo";
    if (heading) heading.textContent = connected ? "Your report goes live." : "Your report stays close.";
    if (copy) copy.textContent = connected ? "This report will be submitted to the Foundly API and shared with the connected campus board." : "This demonstration saves new reports only in this browser's local storage.";
    if (submit) submit.textContent = connected ? "Submit report" : "Save local report";
    if (success) success.textContent = connected ? "Report submitted." : "Report saved locally.";
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateModeCopy();
    var form = LFUI.qs("#report-form");
    var imageInput = LFUI.qs("#item-image");
    imageInput.accept = "image/jpeg,image/png,image/webp";
    var imageHelp = imageInput.parentElement && imageInput.parentElement.querySelector(".form-text");
    if (imageHelp) imageHelp.textContent = "Optional JPEG, PNG, or WebP image up to 5 MB.";
    var preview = LFUI.qs("#image-preview");
    var previewImage = LFUI.qs("#preview-image");
    var previewUrl = null;
    var typeButtons = Array.from(document.querySelectorAll("[data-report-type]"));
    var typeInput = LFUI.qs("#report-type");

    var requestedType = new URLSearchParams(window.location.search).get("type");
    if (requestedType === "LOST" || requestedType === "FOUND") {
      var requestedButton = document.querySelector('[data-report-type="' + requestedType + '"]');
      requestedButton.click();
    }

    typeButtons.forEach(function (button) { button.addEventListener("click", function () { typeButtons.forEach(function (item) { item.classList.remove("is-selected"); }); button.classList.add("is-selected"); typeInput.value = button.dataset.reportType; }); });
    imageInput.addEventListener("change", function () {
      var file = imageInput.files && imageInput.files[0];
      if (file && (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES)) { error.textContent = "Choose a JPEG, PNG, or WebP image no larger than 5 MB."; error.hidden = false; return; }
      if (!file) { preview.hidden = true; return; }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file); previewImage.src = previewUrl; preview.hidden = false;
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      form.classList.add("was-validated");
      var error = LFUI.qs("#form-error");
      error.hidden = true;
      if (!form.checkValidity() || !typeInput.value) { error.textContent = "Choose a report type and complete the required fields."; error.hidden = false; return; }
      var date = LFUI.qs("#item-date").value;
      if (date > new Date().toISOString().slice(0, 10)) { error.textContent = "The item date cannot be in the future."; error.hidden = false; return; }
      var file = imageInput.files && imageInput.files[0];
      var report = { reportType: typeInput.value, title: LFUI.qs("#item-title").value.trim(), description: LFUI.qs("#item-description").value.trim(), category: LFUI.qs("#item-category").value, location: LFUI.qs("#item-location").value.trim(), date: date, time: LFUI.qs("#item-time").value, status: LFData.STATUS.ACTIVE, image: "other", imageMetadata: file ? { name: file.name, type: file.type, size: file.size } : undefined, contact: LFUI.qs("#contact-info").value.trim() || (apiMode() ? "Reply through the connected Foundly board." : "Contact details are stored only in this browser's local demo.") };
      LFData.createReportAsync(report).then(function (result) {
        if (!result.ok) { error.textContent = result.error; error.hidden = false; return; }
        if (result.deleted) {
          form.reset(); form.classList.remove("was-validated"); typeInput.value = ""; typeButtons.forEach(function (item) { item.classList.remove("is-selected"); }); preview.hidden = true;
          LFUI.qs("#form-success strong").textContent = "Report matched and removed from the board.";
          LFUI.qs("#view-new-report").hidden = true;
          LFUI.qs("#form-success").hidden = false;
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        var savedReport = createdReportForRedirect(result);
        if (!savedReport) { error.textContent = result.error || "The report was created, but no valid report ID was returned."; error.hidden = false; return; }
        var finish = function (message) {
          form.reset(); form.classList.remove("was-validated"); typeInput.value = ""; typeButtons.forEach(function (item) { item.classList.remove("is-selected"); }); preview.hidden = true;
          if (message) LFUI.qs("#form-success strong").textContent = message;
          LFUI.qs("#form-success").hidden = false;
        };
        var upload = file && apiMode() && typeof LFData.uploadImageAsync === "function" ? LFData.uploadImageAsync(savedReport.id, file, savedReport.version) : Promise.resolve({ ok: true });
        upload.then(function (uploadResult) { finish(uploadResult.ok ? "Report submitted." : "Report submitted, but the image could not be uploaded."); });
        LFUI.qs("#view-new-report").hidden = false;
        LFUI.qs("#view-new-report").href = "item.html?id=" + encodeURIComponent(savedReport.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }).catch(function (requestError) {
        error.textContent = requestError.message || "The report could not be saved.";
        error.hidden = false;
      });
    });
  });
  window.LFReport = { updateModeCopy: updateModeCopy, createdReportForRedirect: createdReportForRedirect };
})();
