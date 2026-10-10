(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var content = LFUI.qs("#item-content");
    var missing = LFUI.qs("#item-not-found");
    var id = new URLSearchParams(window.location.search).get("id");
    if (!id) { missing.hidden = false; content.hidden = true; return; }
    LFData.getReportAsync(id).then(function (item) {
      if (!item) { missing.hidden = false; content.hidden = true; return; }

    content.appendChild(LFUI.itemVisual(item, true));
    var column = document.createElement("div"); column.className = "detail-copy";
    var meta = document.createElement("div"); meta.className = "item-card-meta"; meta.appendChild(LFUI.typeBadge(item.reportType)); meta.appendChild(LFUI.statusBadge(item.status)); column.appendChild(meta);
    column.appendChild(LFUI.createText("h1", item.title, "detail-title"));
    column.appendChild(LFUI.createText("p", item.description, "detail-description"));
    var facts = document.createElement("dl"); facts.className = "detail-facts";
    [["Category", item.category], ["Last seen / found", item.location], ["Date and time", LFUI.formatDateTime(item)]].forEach(function (pair) { var div = document.createElement("div"); div.appendChild(LFUI.createText("dt", pair[0])); div.appendChild(LFUI.createText("dd", pair[1])); facts.appendChild(div); });
    column.appendChild(facts);
    var actions = document.createElement("div"); actions.className = "detail-actions";
    if (item.contact && item.status === LFData.STATUS.ACTIVE) { var contact = document.createElement("button"); contact.className = "btn btn-primary"; contact.type = "button"; contact.textContent = "Contact about this listing"; contact.addEventListener("click", function () { LFUI.showToast(item.contact, "info"); }); actions.appendChild(contact); }
    var back = document.createElement("a"); back.className = "btn btn-outline-dark"; back.href = "browse.html"; back.textContent = "Back to browse"; actions.appendChild(back); column.appendChild(actions);
    addDemoStatusControl(column, item, meta);
    content.appendChild(column);
      renderMatches(item, content);
    }).catch(function (error) {
      missing.hidden = false;
      content.hidden = true;
      LFUI.showToast(error.message || "This listing is unavailable.", "error");
    });
  });

  function addDemoStatusControl(column, item, meta) {
    var connected = Boolean(window.LFAPI && LFAPI.isEnabled());
    var panel = document.createElement("section"); panel.className = "demo-status-panel";
    panel.appendChild(LFUI.createText("h2", connected ? "Report status" : "Local demo status", "h5"));
    panel.appendChild(LFUI.createText("p", connected ? "Updates are sent to the Foundly API and use the report version for concurrency protection." : "This updates only this browser. It is not administrator authorization.", "form-text"));
    var row = document.createElement("div"); row.className = "status-control-row";
    var select = document.createElement("select"); select.className = "form-select"; select.setAttribute("aria-label", connected ? "Change report status" : "Change local demo status");
    LFData.allowedStatuses(item).forEach(function (status) { var option = document.createElement("option"); option.value = status; option.textContent = status.charAt(0) + status.slice(1).toLowerCase(); option.selected = status === item.status; select.appendChild(option); });
    var button = document.createElement("button"); button.className = "btn btn-outline-dark"; button.type = "button"; button.textContent = "Update";
    button.addEventListener("click", function () {
      LFData.updateReportAsync(item.id, { status: select.value, expectedVersion: item.version }).then(function (result) {
        if (!result.ok) { LFUI.showToast(result.error, "error"); return; }
        item.status = result.report.status;
        item.version = result.report.version;
        meta.replaceChildren(LFUI.typeBadge(item.reportType), LFUI.statusBadge(item.status));
        LFUI.showToast(connected ? "Report status updated on the connected board." : "Local demo status updated.", "info");
      }).catch(function (error) { LFUI.showToast(error.message || "The status could not be updated.", "error"); });
    });
    row.append(select, button); panel.appendChild(row); column.appendChild(panel);
  }

  function renderMatches(item, content) {
    var section = document.createElement("section"); section.className = "matches-panel";
    section.appendChild(LFUI.createText("div", "Possible connections", "section-kicker"));
    section.appendChild(LFUI.createText("h2", "Potential matches", "h2 section-heading"));
    section.appendChild(LFUI.createText("p", "Suggestions are transparent hints for human review, not proof of ownership.", "section-intro"));
    var matches = LFMatching.findMatches(item, LFData.getAllReports());
    if (!matches.length) { section.appendChild(LFUI.createText("p", "No potential matches yet. New reports may change this.", "match-empty")); content.appendChild(section); return; }
    var list = document.createElement("div"); list.className = "match-list";
    matches.slice(0, 3).forEach(function (match) { var candidate = LFData.getReportById(match.matchId); if (!candidate) return; var link = document.createElement("a"); link.className = "match-row"; link.href = "item.html?id=" + encodeURIComponent(candidate.id); var copy = document.createElement("div"); copy.appendChild(LFUI.createText("strong", candidate.title)); copy.appendChild(LFUI.createText("span", match.reasons.join(" · "), "match-reasons")); link.appendChild(copy); link.appendChild(LFUI.createText("span", match.score + "/100", "match-score")); list.appendChild(link); });
    section.appendChild(list); content.appendChild(section);
  }
})();
