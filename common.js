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
      document.querySelectorAll("[data-tabs]").forEach((root, groupIndex) => {
        const buttons = [...root.querySelectorAll("[data-tab]")];
        const panels = [...root.parentElement.querySelectorAll("[data-tab-panel]")];
        root.setAttribute("role", "tablist");

        const activate = (button, moveFocus = false) => {
          const id = button.dataset.tab;
          buttons.forEach((item) => {
            const active = item === button;
            item.classList.toggle("active", active);
            item.setAttribute("aria-selected", String(active));
            item.tabIndex = active ? 0 : -1;
          });
          panels.forEach((panel) => { panel.hidden = panel.dataset.tabPanel !== id; });
          if (moveFocus) button.focus();
        };

        buttons.forEach((button, index) => {
          const panel = panels.find((item) => item.dataset.tabPanel === button.dataset.tab);
          const buttonId = `tab-${groupIndex}-${button.dataset.tab}`;
          const panelId = `panel-${groupIndex}-${button.dataset.tab}`;
          button.id = buttonId;
          button.setAttribute("role", "tab");
          button.setAttribute("aria-controls", panelId);
          if (panel) {
            panel.id = panelId;
            panel.setAttribute("role", "tabpanel");
            panel.setAttribute("aria-labelledby", buttonId);
          }
          button.addEventListener("click", () => activate(button));
          button.addEventListener("keydown", (event) => {
            let targetIndex = null;
            if (event.key === "ArrowRight") targetIndex = (index + 1) % buttons.length;
            if (event.key === "ArrowLeft") targetIndex = (index - 1 + buttons.length) % buttons.length;
            if (event.key === "Home") targetIndex = 0;
            if (event.key === "End") targetIndex = buttons.length - 1;
            if (targetIndex === null) return;
            event.preventDefault();
            activate(buttons[targetIndex], true);
          });
        });

        activate(buttons.find((button) => button.classList.contains("active")) || buttons[0]);
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
      const active = link.dataset.page === current;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  });
})();
