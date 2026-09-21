const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = require('../workflow-core.js');
const rows = JSON.parse(fs.readFileSync('feedback_issues.json', 'utf8'));

test('筛选45条API反馈与导出使用同一集合', () => {
  const filtered = core.filterFeedback(rows, {theme:'模型与API连接'});
  assert.equal(filtered.length,45);
  assert.equal(core.csv(filtered,[{key:'id',label:'编号'}]).split('\n').length,46);
  assert.equal(core.filterFeedback(rows,{query:'NOT_A_REAL_ISSUE_987'}).length,0);
});
test('周报使用筛选范围并转义Markdown标题', () => {
  const report=core.report([{number:1,title:'a|b\nheading',theme:'模型与API连接',state:'开放',triageScore:77,url:'https://github.com/x/y/issues/1'}]);
  assert.match(report,/1 条/);
  assert.match(report,/a\\\|b heading/);
  assert.match(report,/规则初筛/);
});
test('CSV转义引号并防止公式执行',()=>{
  assert.equal(core.csv([{v:'=1+1'},{v:'a"b'}],[{key:'v',label:'值'}]),'"值"\n"\'=1+1"\n"a""b"');
});
test('未解决Top清单不会混入已关闭问题',()=>{
  assert.ok(core.openPriority(rows).every(r=>r.state==='开放'));
  assert.ok(core.openPriority(rows).length<=20);
});
