(function (scope) {
  const core = {
    filterFeedback(rows, filters = {}) {
      const query = (filters.query || '').trim().toLowerCase();
      return rows.filter(x => (!query || `${x.title} ${(x.labels || []).join(' ')}`.toLowerCase().includes(query)) &&
        (!filters.theme || x.theme === filters.theme) && (!filters.type || x.feedbackType === filters.type) &&
        (!filters.state || x.state === filters.state) && (!filters.band || x.priorityBand === filters.band));
    },
    openPriority(rows) {
      return rows.filter(x => x.state === '开放').sort((a,b) => b.triageScore-a.triageScore || b.comments-a.comments).slice(0,20);
    },
    csv(rows, columns) {
      const quote = value => {
        let s = String(value ?? '');
        if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
        return `"${s.replaceAll('"','""')}"`;
      };
      return [columns.map(c=>quote(c.label)).join(',')].concat(rows.map(r=>columns.map(c=>quote(r[c.key])).join(','))).join('\n');
    },
    report(rows) {
      const clean = s => String(s ?? '').replace(/[\r\n]+/g,' ').replaceAll('|','\\|');
      return `# 本批反馈复盘\n\n当前筛选：${rows.length} 条。原始快照：2026-08-14。分类与分数为规则初筛，行动建议需人工确认。\n\n| Issue | 反馈 | 主题 | 状态 | 初筛分 | 来源 |\n| --- | --- | --- | --- | ---: | --- |\n` + rows.map(x=>`| ${x.number} | ${clean(x.title)} | ${clean(x.theme)} | ${clean(x.state)} | ${x.triageScore} | ${x.url} |`).join('\n');
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  else scope.WorkflowCore = core;
})(typeof window !== 'undefined' ? window : globalThis);
