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
};

const readme = read('README.md');
const allPublicCopy = `${Object.values(pages).join('\n')}\n${readme}`;

requireText('首页', pages['index.html'], '<title>许强｜AI 产品经理作品集</title>');
requireText('首页', pages['index.html'], 'AI 产品经理实习生');
requireText('首页', pages['index.html'], '北京理工大学数字经济硕士在读');
requireText('首页', pages['index.html'], '非全日制');
requireText('首页', pages['index.html'], '工作日可全勤 5 天');
requireText('首页', pages['index.html'], '可连续实习 6 个月以上');
requireText('首页', pages['index.html'], '产品定义');
requireText('首页', pages['index.html'], 'AI 产品理解');
requireText('首页', pages['index.html'], '用户洞察');
requireText('首页', pages['index.html'], '快速验证');
requireText('首页', pages['index.html'], '识别问题');
requireText('首页', pages['index.html'], '个人产品项目');

const expectedResumeLinks = [
  'downloads/许强-北京理工大学-AI产品经理实习生.pdf',
  'downloads/Qiang-Xu-BIT-AI-Product-Management-Intern.pdf',
];
for (const resumeLink of expectedResumeLinks) {
  requireText('首页', pages['index.html'], resumeLink);
  if (!fs.existsSync(path.join(root, resumeLink))) errors.push(`缺少最新简历：${resumeLink}`);
}

forbidText('公开内容', allPublicCopy, '拟入学');
forbidText('公开内容', allPublicCopy, 'AI 产品运营实习生');
forbidText('公开内容', allPublicCopy, 'AI 产品运营');
forbidText('公开内容', allPublicCopy, 'AI Product Ops Portfolio');
forbidText('公开内容', allPublicCopy, '许强-AI产品运营实习简历.pdf');
requireText('README', readme, 'AI 产品经理实习生');
if (fs.existsSync(path.join(root, 'resume.pdf'))) errors.push('根目录仍保留过期简历：resume.pdf');

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
  '中英文简历链接有效',
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
