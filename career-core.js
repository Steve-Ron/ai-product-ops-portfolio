(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CareerCore = factory();
})(globalThis, function () {
  const aesthetic = ['构图合理性', '色彩协调性', '光影表现', '视觉层次', '风格一致性', '画面清晰度', '主体结构', '文字与书法', '生成瑕疵控制'];
  const text = ['事实准确性', '指令遵循', '逻辑完整性', '内容相关性', '表达清晰度', '回答完整性', '抗幻觉', '安全性', '去冗余', '综合质量'];
  const normalized = value => String(value || '').toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, '');
  const filled = value => String(value ?? '').trim().length > 0;
  const scores = row => Object.values(row || {}).filter(x => Number.isInteger(x) && x >= 1 && x <= 5);
  const average = row => {
    const all = scores(row);
    return all.length ? Number((all.reduce((sum, x) => sum + x, 0) / all.length).toFixed(2)) : null;
  };

  function dimensions(mode, sample) {
    if (mode === 'modelbench') return text;
    if (mode !== 'aesthetic') return [];
    return [...aesthetic, ...(sample.prompt ? ['Prompt符合度'] : []), ...(sample.modality === 'video' ? ['时序一致性', '运动自然度'] : [])];
  }

  function check(mode, sample, row, others) {
    const issues = [];
    if (mode === 'caption') {
      const {caption_zh: zh, caption_en: en} = row;
      if (!/[\p{Script=Han}]/u.test(zh || '')) issues.push('中文 Caption 缺少汉字');
      if (!/[A-Za-z]{2,}/.test(en || '') || (en?.match(/\p{Script=Han}/gu) || []).length > (en?.match(/[A-Za-z]/g) || []).length) issues.push('英文 Caption 语言或内容待核');
      if (!filled(row.objects)) issues.push('缺少主体字段');
      if (!filled(row.actions) || !filled(row.spatial_relations)) issues.push('缺少动作或空间关系，可明确填不适用');
      if (sample.modality === 'video' && !filled(row.time_sequence)) issues.push('视频缺少时序字段');
      if (filled(zh) && filled(en) && normalized(zh) === normalized(en)) issues.push('两种语言字段疑似复制');
      if (others.some(item => ['caption_zh','caption_en'].some(k => normalized(row[k]) && normalized(item.value[k]) === normalized(row[k])))) issues.push('与其他样本 Caption 重复');
    } else {
      if (!filled(row.reason)) issues.push('缺少可定位的评测理由');
      if (mode === 'aesthetic' && scores(row.scores).length < 3) issues.push('至少填写 3 个适用维度');
      if (mode === 'aesthetic' && row.compare && !['A','B','tie','unknown'].includes(row.choice)) issues.push('缺少 A/B 对比结论');
      if (mode === 'modelbench') {
        if (!['A','B','tie','unknown'].includes(row.choice)) issues.push('需要选择偏好、平局或无法判断');
        if (scores(row.scores_a).length < 3 || scores(row.scores_b).length < 3) issues.push('A 和 B 各填写至少 3 个适用维度');
        if ((row.errors?.includes('事实错误') || row.errors?.includes('幻觉')) && !filled(row.evidence)) issues.push('事实或幻觉标签需要证据或待核说明');
      }
    }
    return issues;
  }

  function transition(previous, action, value, issues, note = '', now = new Date().toISOString()) {
    const review = action === 'approve' || action === 'return';
    if (review && (previous?.status !== 'submitted' || !filled(note))) throw new Error('请先送审并填写复核意见');
    if ((action === 'submit' || action === 'approve') && issues.length) throw new Error(issues.join('；'));
    const status = {draft:'draft', submit:'submitted', approve:'approved', return:'returned'}[action];
    if (!status) throw new Error('未知操作');
    const history = [...(previous?.history || []), {action, at:now, note, previous:previous?.value ?? null}];
    return {status, value:review ? previous.value : value, history, updated_at:now, origin:'browser-entry', reviewer_type:'same-browser-unverified'};
  }

  function preference(sample, record) {
    const row = record?.value;
    if (record?.status !== 'approved' || !['A','B'].includes(row?.choice)) return null;
    const index = row.choice === 'A' ? 0 : 1;
    return {sample_id:sample.sample_id, prompt:sample.prompt, chosen:sample.answers[index].text, rejected:sample.answers[1-index].text,
      revised_answer:row.revised || null, source:sample.source_url, source_row:sample.source_row, reason:row.reason, evidence:row.evidence,
      error_tags:row.errors, review_status:'approved', reviewer_type:record.reviewer_type};
  }

  return {average, dimensions, check, transition, preference};
});
