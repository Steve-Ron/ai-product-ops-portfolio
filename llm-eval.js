document.addEventListener("DOMContentLoaded", () => {
  const records = window.ARENA_RECORDS || [];
  const tests = window.TEST_CASES || [];
  const runsKey = "xq-llm-lens-runs-v1";
  let runs = JSON.parse(localStorage.getItem(runsKey) || "[]");
  let activeCase = null;

  const countBy = (values) => values.reduce((acc, value) => (acc[value] = (acc[value] || 0) + 1, acc), {});
  const modelNames = App.uniq(records.flatMap((x) => [x.modelA, x.modelB]));
  document.querySelector("#kpi-records").textContent = records.length;
  document.querySelector("#kpi-models").textContent = modelNames.length;
  document.querySelector("#lang-cn").textContent = records.filter((x) => x.language === "中文").length;
  document.querySelector("#lang-en").textContent = records.filter((x) => x.language === "英文").length;
  document.querySelector("#clear-wins").textContent = records.filter((x) => ["model_a", "model_b"].includes(x.winner)).length;
  document.querySelector("#both-bad").textContent = records.filter((x) => x.winner === "tie (bothbad)").length;

  const rootCounts = countBy(records.map((x) => x.rootCauseSuggestion));
  App.bars(document.querySelector("#root-bars"), Object.entries(rootCounts).sort((a,b) => b[1]-a[1]).map(([label,value]) => ({ label, value })));

  const stats = {};
  modelNames.forEach((name) => stats[name] = { model: name, appearances: 0, wins: 0 });
  records.forEach((row) => {
    stats[row.modelA].appearances += 1;
    stats[row.modelB].appearances += 1;
    if (row.winner === "model_a") stats[row.modelA].wins += 1;
    if (row.winner === "model_b") stats[row.modelB].wins += 1;
  });
  const modelRows = Object.values(stats).filter((x) => x.appearances >= 3).map((x) => ({ ...x, rate: Math.round(x.wins / x.appearances * 100) })).sort((a,b) => b.appearances-a.appearances || b.rate-a.rate).slice(0, 16);
  document.querySelector("#model-table").innerHTML = modelRows.map((x) => `<tr><td><strong>${App.escape(x.model)}</strong></td><td>${x.appearances}</td><td>${x.wins}</td><td><span class="badge teal">${x.rate}%</span></td></tr>`).join("") || `<tr><td colspan="4" class="empty">没有足够样本</td></tr>`;

  const search = document.querySelector("#bc-search");
  const category = document.querySelector("#bc-category");
  const root = document.querySelector("#bc-root");
  const language = document.querySelector("#bc-language");
  const bcTable = document.querySelector("#badcase-table");
  const bcCount = document.querySelector("#badcase-count");
  const fillSelect = (node, values) => App.uniq(values).sort().forEach((value) => node.insertAdjacentHTML("beforeend", `<option>${App.escape(value)}</option>`));
  fillSelect(category, records.map((x) => x.category));
  fillSelect(root, records.map((x) => x.rootCauseSuggestion));
  fillSelect(language, records.map((x) => x.language));

  const drawer = document.querySelector("#badcase-drawer");
  function closeDrawer() { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); }
  document.querySelector("#drawer-close").addEventListener("click", closeDrawer);
  drawer.addEventListener("click", (event) => { if (event.target === drawer) closeDrawer(); });

  function openRecord(id) {
    const row = records.find((x) => x.id === id);
    if (!row) return;
    document.querySelector("#drawer-title").textContent = `${row.id} · ${row.category}`;
    document.querySelector("#drawer-content").innerHTML = `
      <dl class="detail-grid"><dt>语言</dt><dd>${App.escape(row.language)}</dd><dt>模型 A</dt><dd>${App.escape(row.modelA)}</dd><dt>模型 B</dt><dd>${App.escape(row.modelB)}</dd><dt>偏好结果</dt><dd>${App.escape(row.preferredModel)}</dd><dt>根因建议</dt><dd><span class="badge amber">${App.escape(row.rootCauseSuggestion)}</span></dd><dt>状态</dt><dd>${App.escape(row.annotationStatus)}</dd></dl>
      <div class="response-card"><h4>用户输入</h4><div class="response-text">${App.escape(row.prompt)}</div></div>
      <div class="response-card"><h4>模型 A · ${App.escape(row.modelA)}</h4><div class="response-text">${App.escape(row.answerA)}</div></div>
      <div class="response-card"><h4>模型 B · ${App.escape(row.modelB)}</h4><div class="response-text">${App.escape(row.answerB)}</div></div>
      <div class="notice warn" style="margin-top:16px"><span class="notice-icon">!</span><div><strong>复核提醒</strong><p>胜负标签来自公开偏好；根因并非原数据字段，而是本项目的规则建议。人工复核时应记录具体证据句。</p></div></div>`;
    drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false");
  }

  function renderBadCases() {
    const query = search.value.trim().toLowerCase();
    const rows = records.filter((x) => {
      const hay = `${x.prompt} ${x.modelA} ${x.modelB} ${x.rootCauseSuggestion}`.toLowerCase();
      return (!query || hay.includes(query)) && (!category.value || x.category === category.value) && (!root.value || x.rootCauseSuggestion === root.value) && (!language.value || x.language === language.value);
    });
    bcTable.innerHTML = rows.map((x) => `<tr><td><strong>${App.escape(x.id)}</strong><br><span class="small muted">${App.escape(x.category)} · ${App.escape(x.language)}</span></td><td><div class="truncate" title="${App.escape(x.prompt)}">${App.escape(x.prompt)}</div></td><td><span class="badge ${x.winner === "tie (bothbad)" ? "red" : "teal"}">${App.escape(x.preferredModel)}</span></td><td>${App.escape(x.rootCauseSuggestion)}<br><span class="small muted">${App.escape(x.annotationStatus)}</span></td><td><button class="row-action" data-record="${x.id}">查看证据</button></td></tr>`).join("") || `<tr><td colspan="5" class="empty">没有匹配记录</td></tr>`;
    bcTable.querySelectorAll("[data-record]").forEach((button) => button.addEventListener("click", () => openRecord(button.dataset.record)));
    bcCount.textContent = `当前显示 ${rows.length} / ${records.length} 条记录`;
  }
  [search, category, root, language].forEach((node) => node.addEventListener(node.tagName === "INPUT" ? "input" : "change", renderBadCases));
  renderBadCases();

  const testSearch = document.querySelector("#test-search");
  const dimension = document.querySelector("#test-dimension");
  const testStatus = document.querySelector("#test-status");
  const caseGrid = document.querySelector("#case-grid");
  const caseCount = document.querySelector("#case-count");
  fillSelect(dimension, tests.map((x) => x.dimension));
  const hasRun = (id) => runs.some((x) => x.testCaseId === id);

  function selectCase(id) {
    activeCase = tests.find((x) => x.id === id);
    if (!activeCase) return;
    document.querySelector("#run-empty").hidden = true;
    document.querySelector("#run-form").hidden = false;
    document.querySelector("#run-case-id").value = activeCase.id;
    document.querySelector("#run-case-title").textContent = `${activeCase.id} · ${activeCase.prompt}`;
    document.querySelector("#run-criterion").textContent = activeCase.acceptanceCriteria;
    document.querySelector("#run-model").focus();
  }

  function renderTests() {
    const query = testSearch.value.trim().toLowerCase();
    const rows = tests.filter((x) => {
      const localStatus = hasRun(x.id) ? "已有本地记录" : "待执行";
      return (!query || `${x.prompt} ${x.acceptanceCriteria}`.toLowerCase().includes(query)) && (!dimension.value || x.dimension === dimension.value) && (!testStatus.value || localStatus === testStatus.value);
    });
    caseGrid.innerHTML = rows.map((x) => `<article class="case-card"><div class="case-meta"><span>${App.escape(x.id)} · ${App.escape(x.dimension)}</span><span class="badge ${hasRun(x.id) ? "teal" : "amber"}">${hasRun(x.id) ? "已有记录" : "待执行"}</span></div><h4>${App.escape(x.prompt)}</h4><p><strong>验收：</strong>${App.escape(x.acceptanceCriteria)}</p><div class="case-meta"><span>风险：${App.escape(x.risk)}</span><button class="row-action" data-case="${x.id}">选择执行 →</button></div></article>`).join("") || `<div class="empty">没有匹配用例</div>`;
    caseGrid.querySelectorAll("[data-case]").forEach((button) => button.addEventListener("click", () => selectCase(button.dataset.case)));
    caseCount.textContent = `当前显示 ${rows.length} / ${tests.length} 条用例；浏览器中已有 ${runs.length} 条运行记录。`;
  }
  [testSearch, dimension, testStatus].forEach((node) => node.addEventListener(node.tagName === "INPUT" ? "input" : "change", renderTests));

  document.querySelector("#run-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const run = {
      id: `RUN-${Date.now()}`,
      testCaseId: document.querySelector("#run-case-id").value,
      model: document.querySelector("#run-model").value.trim(),
      response: document.querySelector("#run-response").value,
      score: Number(document.querySelector("#run-score").value),
      result: document.querySelector("#run-result").value,
      note: document.querySelector("#run-note").value,
      recordedAt: new Date().toISOString(),
    };
    runs.push(run);
    localStorage.setItem(runsKey, JSON.stringify(runs));
    event.target.reset();
    document.querySelector("#run-empty").hidden = false;
    document.querySelector("#run-empty").textContent = `已保存 ${run.testCaseId} 的真实运行记录。请选择下一条用例，或导出记录留档。`;
    event.target.hidden = true;
    renderTests();
  });
  renderTests();

  document.querySelector("#export-arena").addEventListener("click", () => {
    const csv = App.toCsv(records, [{key:"id",label:"ID"},{key:"category",label:"任务类型"},{key:"language",label:"语言"},{key:"modelA",label:"模型A"},{key:"modelB",label:"模型B"},{key:"winner",label:"胜负标签"},{key:"rootCauseSuggestion",label:"根因建议"},{key:"annotationStatus",label:"复核状态"}]);
    App.download("llm-lens-arena-sample.csv", `\ufeff${csv}`, "text/csv;charset=utf-8");
  });
  document.querySelector("#export-tests").addEventListener("click", () => App.download("llm-lens-test-cases.json", JSON.stringify(tests, null, 2), "application/json;charset=utf-8"));
  document.querySelector("#export-runs").addEventListener("click", () => App.download("llm-lens-local-runs.json", JSON.stringify(runs, null, 2), "application/json;charset=utf-8"));
});
