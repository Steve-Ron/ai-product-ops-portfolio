(function () {
  'use strict';
  const mode = document.body.dataset.workbench;
  const core = CareerCore;
  const esc = App.escape;
  const stateKey = `xq-career-${mode}-v1`;
  const $ = id => document.getElementById(id);
  const labels = {draft:'草稿',submitted:'待复核',approved:'已通过',returned:'已退回',new:'未开始'};
  const modalities = {image:'图像',video:'视频',text:'文本'};
  const preferences = {A:'A 更好',B:'B 更好',tie:'平局',unknown:'无法判断'};
  const errors = {
    aesthetic:['构图失衡','色彩冲突','光影矛盾','主体结构异常','文字或笔画异常','模糊或伪影','Prompt偏离','运动异常','时序跳变','主观偏好分歧'],
    caption:['遗漏主体','错误对象','错误动作','空间关系错误','无依据推断','视频时序错误','描述不完整','语言表达问题','标注规范不一致'],
    modelbench:['事实错误','幻觉','指令遗漏','推理跳步','偏题','表达歧义','内容遗漏','安全风险','冗余']
  };
  const path = `downloads/career-data/${mode}`;
  let records = {};
  let storageAvailable = true;
  let data = [];
  let active;

  try { records = JSON.parse(localStorage.getItem(stateKey) || '{}') || {}; }
  catch { storageAvailable = false; }

  const option = (key, value, selected) => `<option value="${esc(key)}" ${key === selected ? 'selected' : ''}>${esc(value)}</option>`;
  const field = (key, label, row, multiline = true) => `<label>${label}${multiline ? `<textarea name="${key}" rows="2">${esc(row[key])}</textarea>` : `<input name="${key}" value="${esc(row[key])}">`}</label>`;
  const scoreOptions = {1:'1 明显问题',2:'2 较多偏差',3:'3 达到基本要求',4:'4 表现稳定',5:'5 表现充分'};
  const scores = (name, title, dimensions, original = {}) => `<fieldset><legend>${title}</legend><div class="career-score-grid">${dimensions.map(d =>
    `<label>${esc(d)}<select name="${name}" data-dimension="${esc(d)}">${option('', '未评分 / 不适用', original[d] ? null : '')}${Object.entries(scoreOptions).map(([k,v])=>option(k,v,String(original[d]))).join('')}</select></label>`).join('')}</div></fieldset>`;
  const preference = (name, value) => `<label>${name}<select name="choice">${option('', '请选择', value || '')}${Object.entries(preferences).map(([k,v]) => option(k,v,value)).join('')}</select></label>`;

  function compareItems(sample) {
    return data.filter(r => r.sample_id !== sample.sample_id && r.modality === sample.modality).sort((a,b) =>
      Number(Boolean(sample.prompt && b.prompt === sample.prompt)) - Number(Boolean(sample.prompt && a.prompt === sample.prompt)) || Number(b.category === sample.category)-Number(a.category === sample.category));
  }

  function media(sample) {
    const preview = sample.modality === 'video'
      ? `<video controls playsinline preload="metadata" poster="${esc(sample.poster)}" src="${esc(sample.media)}">浏览器不支持视频预览</video>`
      : `<img src="${esc(sample.media)}" alt="${esc(sample.title)}">`;
    return `<figure class="career-media">${preview}<figcaption>${esc(sample.attribution)} · ${esc(sample.license)}${sample.changes ? ` · ${esc(sample.changes)}` : ''} · <a target="_blank" rel="noopener noreferrer" href="${esc(sample.source_url)}">原始来源</a></figcaption></figure>`;
  }

  function display(sample, row) {
    if (mode === 'modelbench') return `<div class="career-answer"><strong>题目</strong><p>${esc(sample.prompt)}</p></div>
      <div class="career-compare">${sample.answers.map((a,i) => `<article class="career-answer"><strong>回答 ${'AB'[i]}</strong><p>${esc(a.text)}</p></article>`).join('')}</div>
      <details class="career-small"><summary>原数据集记录（完成判断后再展开）</summary><p><a href="${esc(sample.source_url)}" target="_blank" rel="noopener noreferrer">${esc(sample.source)}</a> · 源行 ${sample.source_row} · ${esc(sample.source_subset)} · ${esc(sample.license)}。</p><p>${sample.source_human_preference ? `发布方原始人工偏好 ${esc(sample.source_human_preference)}。` : `${sample.answers.map((a,i)=>`${'AB'[i]} ${esc(a.model)}：${esc(a.source_score)} 分`).join('，')}。原分数来自发布方的评审模型。`}</p>${sample.public_reference?.length ? `<p>原始参考 ${esc(JSON.stringify(sample.public_reference))}</p>` : ''}</details>`;
    if (mode === 'caption') return media(sample);
    const other = data.find(r => r.sample_id === row.compare);
    return `<label class="career-control">A/B 对比样本<select id="comparison">${option('', '单样本模式', row.compare || '')}${compareItems(sample).map(r=>option(r.sample_id, `${sample.prompt && r.prompt === sample.prompt ? '同 Prompt · ' : ''}${r.sample_id} · ${r.title}`,row.compare)).join('')}</select></label>
      <div id="career-media" class="${other ? 'career-compare' : ''}">${media(sample)}${other ? media(other) : ''}</div>
      ${sample.prompt ? `<p class="career-small"><b>原 Prompt</b> ${esc(sample.prompt)} · ${esc(JSON.stringify(sample.generation))}</p>` : ''}
      <p id="compare-warning" class="career-small">${other ? (sample.prompt && sample.prompt === other.prompt ? '相同 Prompt，可逐项比较遵循程度。' : '两条素材可比较画面表现。源任务不同或缺失时，Prompt 符合度单独判断。') : ''}</p>`;
  }

  function datasetFields(sample, row) {
    const dims = core.dimensions(mode,sample);
    if (mode === 'caption') return `${field('caption_zh','中文 Caption',row)}${field('caption_en','英文 Caption',row)}
      <div class="career-compare">${field('objects','主体 / 对象',row,false)}${field('actions','可见动作',row,false)}${field('spatial_relations','空间关系',row,false)}${field('style','颜色 / 构图 / 风格',row,false)}</div>
      ${sample.modality === 'video' ? field('time_sequence','时间顺序（标明相对视频时间）',row) : ''}
      ${field('reason','证据或不确定项',row)}<label>描述质量<select name="quality_score">${option('','待评分',!row.quality_score?'':null)}${Object.entries(scoreOptions).map(([k,v])=>option(k,v,String(row.quality_score))).join('')}</select></label>`;
    if (mode === 'aesthetic') return `${scores('scores','样本 A 多维评分',dims,row.scores)}${preference('A/B 结论（单样本时可留空）',row.choice)}
      ${field('reason','评分依据（视频注明时间点）',row)}${field('evidence','缺陷部位、边界或复核材料',row)}`;
    return `<div class="career-compare">${scores('scores_a','回答 A 多维评分',dims,row.scores_a)}${scores('scores_b','回答 B 多维评分',dims,row.scores_b)}</div>
      ${preference('偏好标签',row.choice)}${field('reason','选择理由与依据',row)}${field('evidence','事实引用或无法核验的范围',row)}${field('revised','修订答案（保留原回答）',row)}`;
  }

  function renderItem() {
    const sample = active;
    if (!sample) { $('career-record').innerHTML='<p>没有符合筛选条件的样本。</p>'; return; }
    const record = records[sample.sample_id];
    const row = record?.value || {};
    const reviewEnabled = record?.status === 'submitted';
    $('career-record').innerHTML = `<div class="career-note"><span class="badge teal">${esc(labels[record?.status || 'new'])}</span><span class="career-small">${esc(sample.sample_id)} · ${esc(sample.category)}</span></div>
      <h2>${esc(mode === 'modelbench' ? '回答对比' : sample.title)}</h2>${display(sample,row)}
      <form id="career-form" class="career-stack career-form">${datasetFields(sample,row)}
      <fieldset><legend>错误标签</legend><div class="tag-group">${errors[mode].map(e => `<label><input type="checkbox" name="errors" value="${esc(e)}" ${row.errors?.includes(e) ? 'checked' : ''}>${esc(e)}</label>`).join('')}</div></fieldset>
      <p id="career-qa" class="career-qa" role="status"></p>
      <div class="career-tools"><button class="button small secondary" name="action" value="draft">保存草稿</button><button class="button small" name="action" value="submit">提交复核</button></div>
      <fieldset><legend>复核</legend><p class="career-small">独立复核需将导出的记录交给另一位复核者。这里保留本浏览器的操作轨迹。</p>
      <label>复核意见<textarea name="review_note" rows="2" ${reviewEnabled?'':'disabled'}></textarea></label><div class="career-tools"><button class="button small secondary" name="action" value="approve" ${reviewEnabled?'':'disabled'}>通过</button><button class="button small secondary" name="action" value="return" ${reviewEnabled?'':'disabled'}>退回修改</button></div>
      ${record?.history?.length ? `<details class="career-small"><summary>历史记录（${record.history.length} 次）</summary><ol>${record.history.map(h=>`<li>${esc(h.at)} · ${esc(h.action)}${h.note ? ` · ${esc(h.note)}` : ''}</li>`).join('')}</ol></details>` : ''}</fieldset></form>`;
    const form = $('career-form');
    form.addEventListener('input', updateCheck);
    form.addEventListener('submit', save);
    $('comparison')?.addEventListener('change', () => {
      const other = data.find(r => r.sample_id === $('comparison').value);
      $('career-media').className = other ? 'career-compare' : '';
      $('career-media').innerHTML = media(sample) + (other ? media(other) : '');
      $('compare-warning').textContent = !other ? '' : sample.prompt && other.prompt === sample.prompt ? '相同 Prompt，可逐项比较遵循程度。' : '源任务不同或缺失时，Prompt 符合度单独判断。';
      updateCheck();
    });
    updateCheck();
  }

  function gather() {
    const form = $('career-form');
    const values = new FormData(form);
    const value = {};
    for (const [k,v] of values) if (!['errors','scores','scores_a','scores_b','review_note'].includes(k)) value[k] = v.trim();
    value.errors = values.getAll('errors');
    if (mode === 'caption') value.quality_score = Number(value.quality_score) || null;
    if (mode === 'aesthetic') value.compare = $('comparison').value;
    for (const select of form.querySelectorAll('[data-dimension]')) {
      value[select.name] ??= {};
      value[select.name][select.dataset.dimension] = Number(select.value) || null;
    }
    return value;
  }

  function checks(value) { return core.check(mode,active,value,Object.entries(records).filter(([id])=>id !== active.sample_id).map(([,r])=>r)); }

  function updateCheck() {
    const value = gather();
    const issues = checks(value);
    const result = mode === 'aesthetic' ? `综合分 ${core.average(value.scores) ?? '—'} / 5。 ` : mode === 'modelbench' ? `A 均分 ${core.average(value.scores_a) ?? '—'} · B 均分 ${core.average(value.scores_b) ?? '—'}。 ` : '';
    $('career-qa').classList.toggle('error', Boolean(issues.length));
    $('career-qa').textContent = result + (issues.length ? issues.join(' / ') : '字段校验通过，内容判断进入复核。');
  }

  function save(event) {
    event.preventDefault();
    const previous = records[active.sample_id];
    const action = event.submitter?.value || 'draft';
    const review = ['approve','return'].includes(action);
    const value = gather();
    try {
      if (review && JSON.stringify(previous?.value) !== JSON.stringify(value)) throw new Error('当前表单有改动，请重新提交后复核。');
      const record = core.transition(previous,action,value,checks(value),new FormData(event.currentTarget).get('review_note') || '');
      records[active.sample_id] = record;
      try { localStorage.setItem(stateKey,JSON.stringify(records)); }
      catch { storageAvailable = false; }
      render();
      $('career-status').textContent = `记录${labels[record.status]}。${storageAvailable ? '已保存在当前浏览器。' : '本地存储不可用，请及时导出。'}`;
    } catch (err) { $('career-status').textContent = err.message; }
  }

  function filtered() {
    const query = $('career-search').value.trim().toLowerCase();
    return data.filter(r => (!query || [r.sample_id,r.title,r.prompt,r.category].filter(Boolean).join(' ').toLowerCase().includes(query)) &&
      (!$('career-category').value || r.category === $('career-category').value) && (!$('career-modality').value || r.modality === $('career-modality').value) &&
      (!$('career-filter').value || ($('career-filter').value === 'bad' ? records[r.sample_id]?.value.errors?.length : (records[r.sample_id]?.status || 'new') === $('career-filter').value)));
  }

  function renderReport() {
    const tracked = Object.values(records);
    const counts = {}; const flags = {};
    for (const record of tracked) {
      counts[record.status] = (counts[record.status] || 0) + 1;
      for (const tag of record.value.errors || []) flags[tag] = (flags[tag] || 0) + 1;
    }
    $('career-counts').innerHTML = Object.entries({总样本:data.length, 有记录:tracked.length, 待复核:counts.submitted || 0, 已通过:counts.approved || 0, 已退回:counts.returned || 0,
      字段待修: data.filter(s=>records[s.sample_id] && core.check(mode,s,records[s.sample_id].value,tracked.filter(r=>r !== records[s.sample_id])).length).length}).map(([k,v])=>`<span>${k} <b>${v}</b></span>`).join('');
    const items = Object.entries(flags).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
    $('career-bars').innerHTML = '<p class="career-small">当前没有错误标签。</p>';
    if (items.length) App.bars($('career-bars'),items);
  }

  function render() {
    const results = filtered();
    if (!active || !results.includes(active)) active = results[0];
    $('career-matches').textContent = `显示 ${results.length} / ${data.length} 条`;
    $('career-list').innerHTML = results.map(r=>`<button type="button" data-sample="${esc(r.sample_id)}" aria-current="${r === active}">${esc(r.title)}<small>${esc(r.sample_id)} · ${esc(labels[records[r.sample_id]?.status || 'new'])}</small></button>`).join('');
    $('career-list').querySelector('[aria-current="true"]')?.scrollIntoView({block:'nearest',container:'nearest'});
    renderItem();
    renderReport();
  }

  function exported() {
    return data.flatMap(sample => {
      const r = records[sample.sample_id];
      if (!r) return [];
      return [{sample_id:sample.sample_id,source:sample.source,source_url:sample.source_url,modality:sample.modality,category:sample.category,license:sample.license,
        ...r.value,error_tags:r.value.errors,annotation_status:r.status === 'draft' ? 'draft' : 'completed',review_status:r.status,
        quality_score:mode === 'aesthetic' ? core.average(r.value.scores) : r.value.quality_score,
        record_origin:r.origin,reviewer_type:r.reviewer_type,history:r.history}];
    });
  }

  function csv(rows) {
    const columns = [...new Set(['sample_id','source','modality','category','review_status',...rows.flatMap(Object.keys)])];
    const cell = value => {
      let str = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
      if (/^\s*[=+\-@]/.test(str)) str = "'"+str;
      return `"${str.replace(/"/g,'""')}"`;
    };
    return '\ufeff'+ [columns,...rows.map(row=>columns.map(c=>row[c]))].map(row=>row.map(cell).join(',')).join('\r\n');
  }

  for (const id of ['career-search','career-category','career-modality','career-filter']) $(id).addEventListener(id === 'career-search' ? 'input' : 'change',render);
  $('career-list').addEventListener('click',event=>{
    const button = event.target.closest('[data-sample]');
    if (!button) return;
    active = data.find(s=>s.sample_id === button.dataset.sample);
    render();
    $('career-list').querySelector('[aria-current="true"]')?.focus({preventScroll:true});
  });
  document.querySelectorAll('[data-export]').forEach(button=>button.addEventListener('click',()=>{
    const type = button.dataset.export;
    const rows = type === 'jsonl' ? data.map(s=>core.preference(s,records[s.sample_id])).filter(Boolean) : exported();
    if (!rows.length) { $('career-status').textContent = type === 'jsonl' ? '暂无通过复核的 A/B 方向性偏好。' : '请先保存一条记录再导出。'; return; }
    const contents = type === 'csv' ? csv(rows) : type === 'jsonl' ? rows.map(row=>JSON.stringify(row)).join('\n')+'\n' : JSON.stringify(rows,null,2);
    App.download(`${mode}-local.${type}`,contents,{csv:'text/csv;charset=utf-8',json:'application/json',jsonl:'application/x-ndjson'}[type]);
    $('career-status').textContent = `已导出 ${rows.length} 条本地记录。`;
  }));

  fetch(`${path}.json`).then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }).then(rows=>{
    data = rows;
    $('career-category').innerHTML += [...new Set(data.map(r => r.category))].map(v=>option(v,v)).join('');
    $('career-modality').innerHTML += [...new Set(data.map(r => r.modality))].map(v=>option(v,modalities[v])).join('');
    const requested = new URLSearchParams(location.search).get('sample');
    active = data.find(r=>r.sample_id === requested);
    $('career-summary').textContent = `${data.length} 条可追溯样本 · ${[...new Set(data.map(r=>modalities[r.modality]))].join(' / ')}`;
    render();
  }).catch(err=>{ $('career-status').textContent = `样本读取失败（${err.message}），请通过本地 HTTP 或 GitHub Pages 打开。`; });
})();
