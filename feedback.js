document.addEventListener("DOMContentLoaded", () => {
  const issues = window.FEEDBACK_ISSUES || [];
  const summary = window.FEEDBACK_SUMMARY || { themeCounts: [], typeCounts: [] };
  document.querySelector("#fb-total").textContent = issues.length;
  document.querySelector("#fb-open").textContent = summary.openCount ?? issues.filter((x) => x.state === "开放").length;
  document.querySelector("#fb-median").textContent = summary.medianTriageScore ?? "-";
  document.querySelector("#fb-top-theme").textContent = summary.themeCounts?.[0]?.count ?? "-";
  App.bars(document.querySelector("#theme-bars"), (summary.themeCounts || []).map((x) => ({ label: x.name, value: x.count })));
  App.bars(document.querySelector("#type-bars"), (summary.typeCounts || []).map((x) => ({ label: x.name, value: x.count })));

  const search = document.querySelector("#fb-search");
  const theme = document.querySelector("#fb-theme");
  const type = document.querySelector("#fb-type");
  const state = document.querySelector("#fb-state");
  const band = document.querySelector("#fb-band");
  const table = document.querySelector("#feedback-table");
  const count = document.querySelector("#feedback-count");
  const fill = (node, values) => App.uniq(values).sort().forEach((value) => node.insertAdjacentHTML("beforeend", `<option>${App.escape(value)}</option>`));
  fill(theme, issues.map((x) => x.theme)); fill(type, issues.map((x) => x.feedbackType)); fill(state, issues.map((x) => x.state)); fill(band, issues.map((x) => x.priorityBand));

  function render() {
    const query = search.value.trim().toLowerCase();
    const rows = issues.filter((x) => {
      const hay = `${x.title} ${x.labels.join(" ")}`.toLowerCase();
      return (!query || hay.includes(query)) && (!theme.value || x.theme === theme.value) && (!type.value || x.feedbackType === type.value) && (!state.value || x.state === state.value) && (!band.value || x.priorityBand === band.value);
    });
    table.innerHTML = rows.map((x) => `<tr><td class="nowrap"><strong>#${x.number}</strong><br><span class="small muted">${App.fmtDate(x.createdAt)}</span></td><td><div class="truncate" title="${App.escape(x.title)}">${App.escape(x.title)}</div><span class="small muted">${App.escape(x.state)}</span></td><td><span class="badge teal">${App.escape(x.theme)}</span><br><span class="small muted">${App.escape(x.feedbackType)}</span></td><td class="nowrap">${x.comments} 评论<br><span class="small muted">${x.reactions} reactions</span></td><td><strong>${x.triageScore}</strong><br><span class="badge ${x.priorityBand.includes("P0") ? "red" : x.priorityBand.includes("P2") ? "amber" : ""}">${App.escape(x.priorityBand)}</span></td><td><a class="row-action" href="${App.escape(x.url)}" target="_blank" rel="noreferrer">原 Issue ↗</a></td></tr>`).join("") || `<tr><td colspan="6" class="empty">没有匹配反馈</td></tr>`;
    count.textContent = `当前显示 ${rows.length} / ${issues.length} 条公开 Issue`;
  }
  [search, theme, type, state, band].forEach((node) => node.addEventListener(node.tagName === "INPUT" ? "input" : "change", render));
  render();

  const top = [...issues].sort((a,b) => b.triageScore-a.triageScore || b.comments-a.comments).slice(0,20);
  document.querySelector("#priority-grid").innerHTML = top.map((x) => `<article class="case-card"><div class="case-meta"><span>#${x.number} · ${App.escape(x.theme)}</span><span class="badge ${x.triageScore >= 75 ? "red" : "amber"}">${x.triageScore}</span></div><h4>${App.escape(x.title)}</h4><p>${x.comments} 条评论 · ${x.reactions} reactions · ${App.escape(x.state)}</p><div class="case-meta"><span>${App.escape(x.feedbackType)}</span><a class="row-action" href="${App.escape(x.url)}" target="_blank" rel="noreferrer">人工复核 ↗</a></div></article>`).join("");

  document.querySelector("#export-feedback").addEventListener("click", () => {
    const csv = App.toCsv(issues, [{key:"id",label:"ID"},{key:"title",label:"标题"},{key:"state",label:"状态"},{key:"theme",label:"主题"},{key:"feedbackType",label:"类型"},{key:"comments",label:"评论数"},{key:"reactions",label:"Reaction数"},{key:"triageScore",label:"Triage Score"},{key:"priorityBand",label:"初筛档位"},{key:"url",label:"源链接"}]);
    App.download("signal-desk-open-webui-issues.csv", `\ufeff${csv}`, "text/csv;charset=utf-8");
  });
});
