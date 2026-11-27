import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const errors = [];
const checks = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`缺少文件：${relativePath}`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function readJson(relativePath) {
  const text = read(relativePath);
  if (!text) return [];
  try {
    return JSON.parse(text);
  } catch (error) {
    errors.push(`${relativePath} 不是有效 JSON：${error.message}`);
    return [];
  }
}

function requireText(label, text, expected) {
  if (!text.includes(expected)) errors.push(`${label} 缺少：${expected}`);
}

function forbidText(label, text, prohibited) {
  if (text.includes(prohibited)) errors.push(`${label} 仍包含过期表述：${prohibited}`);
}

function countBy(items, key) {
  return items.reduce((result, item) => {
    const value = item[key];
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function assertUniqueIds(label, items) {
  const ids = items.map((item) => item.id);
  if (ids.some((id) => !id)) errors.push(`${label} 存在空 ID`);
  if (new Set(ids).size !== ids.length) errors.push(`${label} ID 不唯一`);
}

function validateRelativeLinks(pageName, html) {
  const references = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map((match) => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|mailto:|tel:|#|javascript:)/i.test(reference)) continue;
    const cleanReference = decodeURIComponent(reference.split(/[?#]/)[0]);
    if (!cleanReference) continue;
    const target = path.resolve(root, path.dirname(pageName), cleanReference);
    if (!target.startsWith(root) || !fs.existsSync(target)) {
      errors.push(`${pageName} 存在失效本地链接：${reference}`);
    }
  }
}

const pages = {
  'index.html': read('index.html'),
  'llm-eval.html': read('llm-eval.html'),
  'feedback-insight.html': read('feedback-insight.html'),
  'analysis-results.html': read('analysis-results.html'),
  'aesthetic.html': read('aesthetic.html'),
  'caption.html': read('caption.html'),
  'modelbench.html': read('modelbench.html'),
};

const readme = read('README.md');
const latestSummary = readJson('downloads/evidence-20261015/summary.json');
if (latestSummary.titleAIReviewed !== 156 || latestSummary.historicalRepliesAIReviewed !== 24 || latestSummary.candidateBadCases !== 9 || latestSummary.apiCalls !== 0) errors.push('新版结果数量或执行方式不一致');
const allPublicCopy = `${Object.values(pages).join('\n')}\n${readme}`;

const home = pages['index.html'];
for (const value of ['AI 模型评测与多模态数据标注','北京理工大学','数字经济硕士在读','非全日制','成都文理学院','2026.09 — 2028.06（预计）',
  '书法学','周末授课','工作日可全勤','9 条候选 Bad Case','Aesthetic Lens','Caption Studio','ModelBench','LLM Lens','Signal Desk']) requireText('首页',home,value);
for (const value of ['可连续实习','拟入学']) forbidText('首页',home,value);
forbidText('公开内容', allPublicCopy, '星智云科');
forbidText('公开内容', allPublicCopy, '数字经济本科');
const resume = 'downloads/许强-AI模型评测与多模态数据标注-简历.pdf';
requireText('首页',home,resume);
read(resume);

forbidText('公开内容', allPublicCopy, '拟入学');
forbidText('公开内容', allPublicCopy, '许强-AI产品运营实习简历.pdf');
forbidText('公开内容', allPublicCopy, 'resume.pdf');
requireText('README', readme, 'AI 模型评测与多模态数据标注');

const llm = pages['llm-eval.html'];
for (const expected of [
  '招聘官摘要',
  '目标用户',
  '我的角色',
  '关键产品判断',
  '已完成交付',
  '个人产品项目',
  'AI 辅助前端实现与数据处理',
  '48 条结构化评测用例',
  '120 条双语人类偏好样本',
  '双人标注一致性',
  '真实 API 基线',
]) requireText('LLM Lens', llm, expected);

const feedback = pages['feedback-insight.html'];
for (const expected of [
  '招聘官摘要',
  '目标用户',
  '我的角色',
  '关键产品判断',
  '已完成交付',
  '个人产品项目',
  'AI 辅助前端实现与数据处理',
  '156 条公开用户反馈',
  '9 类主题',
  '3 类反馈类型',
  'Triage Score ≠ 产品优先级',
  '人工标注抽检',
]) requireText('Signal Desk', feedback, expected);

for (const [pageName, html] of Object.entries(pages)) {
  requireText(pageName, html, 'rel="canonical"');
  requireText(pageName, html, 'property="og:title"');
  requireText(pageName, html, 'property="og:description"');
  requireText(pageName, html, 'name="twitter:card"');
  validateRelativeLinks(pageName, html);
}

if (!fs.existsSync(path.join(root, 'og.png'))) errors.push('缺少社交分享图：og.png');

const arena = readJson('arena_records.json');
const testCases = readJson('test_cases.json');
const feedbackIssues = readJson('feedback_issues.json');

if (arena.length !== 120) errors.push(`LMArena 样本应为 120，实际为 ${arena.length}`);
if (testCases.length !== 48) errors.push(`评测用例应为 48，实际为 ${testCases.length}`);
if (feedbackIssues.length !== 156) errors.push(`用户反馈应为 156，实际为 ${feedbackIssues.length}`);

assertUniqueIds('LMArena 样本', arena);
assertUniqueIds('评测用例', testCases);
assertUniqueIds('用户反馈', feedbackIssues);

const dimensions = countBy(testCases, 'dimension');
if (Object.keys(dimensions).length !== 8 || Object.values(dimensions).some((count) => count !== 6)) {
  errors.push(`评测维度应为 8 类且每类 6 条，实际为 ${JSON.stringify(dimensions)}`);
}

for (const item of testCases) {
  if (item.status !== '待执行') errors.push(`评测用例 ${item.id} 不应伪装为已执行`);
  if (item.score !== null) errors.push(`评测用例 ${item.id} 在无真实执行证据时分数必须为空`);
}

for (const item of feedbackIssues) {
  if ('user' in item || 'body' in item || 'pull_request' in item) {
    errors.push(`反馈 ${item.id} 包含不应公开的身份、正文或 PR 字段`);
  }
  if (!/^https:\/\/github\.com\/open-webui\/open-webui\/issues\//.test(item.url || '')) {
    errors.push(`反馈 ${item.id} 缺少可追溯原始 Issue 链接`);
  }
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

checks.push(
  '招聘定位与在读状态一致',
  '项目职责与真实性边界完整',
  '最新单页简历链接有效',
  '页面元数据与本地链接有效',
  '数据数量与状态真实',
  '公开反馈隐私字段已最小化',
);

console.log(JSON.stringify({
  ok: true,
  counts: {
    arena: arena.length,
    tests: testCases.length,
    dimensions,
    issues: feedbackIssues.length,
  },
  checks,
}, null, 2));
