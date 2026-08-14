(function () {
  const escapeMap = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  window.App = {
    escape(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => escapeMap[char]);
    },
    fmtDate(value) {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    },
    download(filename, content, type = "text/plain;charset=utf-8") {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    toCsv(rows, columns) {
      const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      return [columns.map((x) => quote(x.label)).join(",")]
        .concat(rows.map((row) => columns.map((x) => quote(row[x.key])).join(",")))
        .join("\n");
    },
    bars(container, items, options = {}) {
      if (!container) return;
      const max = options.max || Math.max(...items.map((x) => x.value), 1);
      container.innerHTML = items.map((item) => `
        <div class="bar-row">
          <div class="bar-label" title="${App.escape(item.label)}">${App.escape(item.label)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, item.value / max * 100)}%"></div></div>
          <div class="bar-value">${App.escape(item.display ?? item.value)}</div>
        </div>`).join("");
    },
    initTabs() {
      document.querySelectorAll("[data-tabs]").forEach((root) => {
        root.querySelectorAll("[data-tab]").forEach((button) => {
          button.addEventListener("click", () => {
            const id = button.dataset.tab;
            root.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("active", x === button));
            root.parentElement.querySelectorAll("[data-tab-panel]").forEach((panel) => {
              panel.hidden = panel.dataset.tabPanel !== id;
            });
          });
        });
      });
    },
    uniq(values) {
      return [...new Set(values.filter(Boolean))];
    },
  };

  document.addEventListener("DOMContentLoaded", () => {
    App.initTabs();
    const current = document.body.dataset.page;
    document.querySelectorAll(".nav a[data-page]").forEach((link) => {
      link.classList.toggle("active", link.dataset.page === current);
    });
  });
})();
