(function () {
  "use strict";

  function qs(selector, root) { return (root || document).querySelector(selector); }

  function createText(tag, text, className) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text || "";
    return element;
  }

  function formatDate(dateString) {
    if (!dateString) return "Date not provided";
    var date = new Date(dateString + "T12:00:00");
    return Number.isNaN(date.getTime()) ? dateString : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function formatDateTime(item) {
    return formatDate(item.date) + (item.time ? " · " + item.time : "");
  }

  function itemVisual(item, large) {
    var visual = document.createElement("div");
    visual.className = "item-visual visual-" + (item.image || "other") + (large ? " item-visual-large" : "");
    visual.setAttribute("aria-label", "Illustration for " + item.title);
    var icon = document.createElement("i");
    icon.className = "bi " + ({ headphones: "bi-headphones", backpack: "bi-backpack2", "id-card": "bi-person-vcard", book: "bi-book", key: "bi-key", bottle: "bi-cup-straw", laptop: "bi-laptop", umbrella: "bi-umbrella", glasses: "bi-eyeglasses", calculator: "bi-calculator", wallet: "bi-wallet2", scarf: "bi-wind", other: "bi-box-seam" }[item.image] || "bi-box-seam");
    icon.setAttribute("aria-hidden", "true");
    visual.appendChild(icon);
    if (item.imageUrl) {
      var image = document.createElement("img");
      image.src = item.imageUrl;
      image.alt = "Photo of " + (item.title || "reported item");
      image.loading = "lazy";
      image.addEventListener("error", function () { image.remove(); });
      visual.appendChild(image);
    }
    return visual;
  }

  function typeBadge(type) {
    return createText("span", type, "type-badge type-" + type.toLowerCase());
  }

  function statusBadge(status) {
    var labels = { ACTIVE: "Active", MATCHED: "Potential match", RESOLVED: "Resolved", CLOSED: "Closed" };
    return createText("span", labels[status] || status, "status-badge status-" + status.toLowerCase().replace(/\s+/g, "-"));
  }

  function createItemCard(item) {
    var article = document.createElement("article");
    article.className = "item-card";
    var link = document.createElement("a");
    link.className = "item-card-link";
    link.href = "item.html?id=" + encodeURIComponent(item.id);
    link.setAttribute("aria-label", "View details for " + item.title);
    link.appendChild(itemVisual(item));
    var body = document.createElement("div");
    body.className = "item-card-body";
    var meta = document.createElement("div");
    meta.className = "item-card-meta";
    meta.appendChild(typeBadge(item.reportType));
    meta.appendChild(statusBadge(item.status));
    body.appendChild(meta);
    body.appendChild(createText("h3", item.title, "item-card-title"));
    body.appendChild(createText("p", item.description, "item-card-description"));
    var footer = document.createElement("div");
    footer.className = "item-card-footer";
    footer.appendChild(createText("span", item.category, "text-muted-small"));
    footer.appendChild(createText("span", formatDate(item.date), "text-muted-small"));
    body.appendChild(footer);
    link.appendChild(body);
    article.appendChild(link);
    return article;
  }

  function showToast(message, type) {
    var toast = qs("#site-toast");
    if (!toast) return;
    toast.className = "site-toast toast-" + (type || "info");
    toast.textContent = message;
    toast.hidden = false;
    window.setTimeout(function () { toast.hidden = true; }, 4200);
  }

  function initNav() {
    var toggle = qs(".nav-toggle");
    var menu = qs("#main-navigation");
    if (!toggle || !menu) return;
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  function initDemoBanner() {
    if (window.LFConfig && window.LFConfig.mode === "api") {
      var footer = qs(".site-footer .footer-shell");
      if (footer) {
        var p = footer.querySelector("p");
        if (p && p.textContent.indexOf("Local demonstration") !== -1) {
          p.remove();
        }
      }
    }
  }

  window.LFUI = { qs: qs, createText: createText, formatDate: formatDate, formatDateTime: formatDateTime, itemVisual: itemVisual, typeBadge: typeBadge, statusBadge: statusBadge, createItemCard: createItemCard, showToast: showToast };
  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initDemoBanner();
  });
})();
