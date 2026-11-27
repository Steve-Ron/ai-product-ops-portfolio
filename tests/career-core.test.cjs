const assert = require('node:assert/strict');
const test = require('node:test');
const core = require('../career-core.js');

test('applies Prompt only to generated samples and motion only to videos', () => {
  assert.deepEqual(core.dimensions('aesthetic', { modality: 'video' }).slice(-2), ['时序一致性', '运动自然度']);
  assert(!core.dimensions('aesthetic', { modality: 'video' }).includes('Prompt符合度'));
  assert(core.dimensions('aesthetic', { modality: 'image', prompt: 'test' }).includes('Prompt符合度'));
  assert.equal(core.average({ a: 5, b: null, c: 3 }), 4);
});

test('only valid records enter review and revision invalidates approval', () => {
  const draft = core.transition(undefined, 'draft', { caption_zh: '文字' }, ['缺英文']);
  assert.throws(() => core.transition(draft, 'submit', draft.value, ['缺英文']));
  const pending = core.transition(draft, 'submit', draft.value, []);
  assert.throws(() => core.transition(pending, 'approve', {}, [], ''));
  const approved = core.transition(pending, 'approve', {}, [], '已核对');
  assert.equal(approved.value.caption_zh, '文字');
  const changed = core.transition(approved, 'draft', { caption_zh: '修订' }, []);
  assert.equal(changed.status, 'draft');
  assert.equal(changed.history.at(-1).previous.caption_zh, '文字');
});

test('duplicate Captions and copied-language fields flag quality issues', () => {
  const r = {caption_zh:'一只白兔。',caption_en:'A white rabbit.',objects:'兔',actions:'站立',spatial_relations:'画面中央',time_sequence:'0–4 秒站立'};
  assert.deepEqual(core.check('caption', {modality:'video'}, r, []), []);
  assert(core.check('caption', {modality:'video'}, {...r,time_sequence:''}, []).length);
  assert(core.check('caption', {modality:'image'}, r, [{value:{...r,caption_zh:'一只白兔！'}}]).some(v => v.includes('重复')));
});

test('only reviewed directional preferences enter chosen/rejected export', () => {
  const sample = {sample_id:'023', prompt:'问题', answers:[{text:'one'}, {text:'two'}]};
  assert.equal(core.preference(sample, {status:'approved', value:{choice:'tie'}}), null);
  assert.equal(core.preference(sample, {status:'submitted', value:{choice:'B'}}), null);
  assert.equal(core.preference(sample, {status:'approved', value:{choice:'B', revised:'corrected'}}).chosen, 'two');
  assert.equal(core.preference(sample, {status:'approved', value:{choice:'B', revised:'corrected'}}).revised_answer, 'corrected');
});
