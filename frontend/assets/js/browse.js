(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    var search = LFUI.qs("#browse-search");
    var type = LFUI.qs("#type-filter");
    var category = LFUI.qs("#category-filter");
    var location = LFUI.qs("#location-filter");
    var sort = LFUI.qs("#sort-filter");
    var grid = LFUI.qs("#items-grid");
    var empty = LFUI.qs("#empty-state");
    var count = LFUI.qs("#results-count");
    var items = [];

    var params = new URLSearchParams(window.location.search);
    if (params.get("category")) category.value = params.get("category");

    function populate(select, values) {
      values.sort().forEach(function (value) {
        var option = document.createElement("option"); option.value = value; option.textContent = value; select.appendChild(option);
      });
    }
    function loadItems() {
      LFData.getAllReportsAsync({ status: "ACTIVE" }).then(function (loadedItems) {
        items = loadedItems;
        populate(category, Array.from(new Set(items.map(function (item) { return item.category; }))));
        populate(location, Array.from(new Set(items.map(function (item) { return item.location; }))));
        if (params.get("category")) category.value = params.get("category");
        render();
      }).catch(function (error) {
        items = [];
        count.textContent = error.message || "Listings are unavailable.";
        empty.hidden = false;
      });
    }

    function render() {
      var query = search.value.trim().toLowerCase();
      var filtered = items.filter(function (item) {
        var matchesSearch = !query || LFMatching.normalize(item.title + " " + item.description).includes(LFMatching.normalize(query));
        return matchesSearch && (!type.value || item.reportType === type.value) && (!category.value || item.category === category.value) && (!location.value || item.location === location.value);
      });
      filtered.sort(function (a, b) {
        var aTime = Date.parse((a.date || "") + "T12:00:00") || 0;
        var bTime = Date.parse((b.date || "") + "T12:00:00") || 0;
        var difference = sort.value === "oldest" ? aTime - bTime : bTime - aTime;
        return difference || a.id.localeCompare(b.id);
      });
      grid.replaceChildren();
      filtered.forEach(function (item) { grid.appendChild(LFUI.createItemCard(item)); });
      empty.hidden = filtered.length !== 0;
      count.textContent = filtered.length + (filtered.length === 1 ? " listing" : " listings");
    }

    [search, type, category, location, sort].forEach(function (control) { control.addEventListener("input", render); });
    LFUI.qs("#clear-filters").addEventListener("click", function () { search.value = ""; type.value = ""; category.value = ""; location.value = ""; sort.value = "newest"; render(); });
    loadItems();
  });
})();
