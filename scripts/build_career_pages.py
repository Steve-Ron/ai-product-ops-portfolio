"""Generate static detail pages from the three validated dataset manifests."""
from html import escape
from json import loads
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'downloads/career-data'
RESUME = 'downloads/许强-AI模型评测与多模态数据标注-简历.pdf'
SPECS = {
    'aesthetic': ('Aesthetic Lens', '图像与视频美学评测', '按统一尺度判断构图、色彩、光影与技术缺陷。对比同一 Prompt 的生成结果，也可逐段检查动画的运动与时序。', 'AIGC 美学评测 · 视觉内容质检', 'DiffusionDB 生成图、Cleveland Museum of Art 开放馆藏和 Blender 开放电影片段。馆藏样本校准视觉判断，生成图检查 Prompt 和瑕疵。', '先读 Prompt 和适用维度，再观察主体、画面结构与时间点，完成评分、缺陷归类和复核。'),
    'caption': ('Caption Studio', '多模态 Caption 标注与质检', '为图像和视频填写中英文 Caption，核对主体、动作、空间关系与时间顺序，保留质量检查和修订记录。', '图像与视频 Caption · 多模态数据质检', 'Cleveland Museum of Art、DiffusionDB 与 Blender 开放素材。来源元数据可核对，Caption 依据可见内容填写。', '观察素材 → 填写双语描述及结构字段 → 字段校验 → 复核或退回 → 修订后导出。'),
    'modelbench': ('ModelBench', '文本评测与偏好数据生产', '逐题比较两条历史模型回答，记录偏好、证据、错误和修订。审核后的方向性偏好可输出 chosen/rejected JSONL。', 'AI 训练数据 · 大模型文本评测', 'OpenBMB UltraFeedback 的历史回复与 Meta Community Alignment 多轮样本。两套公开数据的原始评审记录随源行保留。', '盲看 A/B → 分项打分 → 记录理由与证据 → 保留修订 → 复核 → 导出。LLM Lens 另用于产品评测、回归用例和 Bad Case 台账。'),
}


def nav():
    return f'''<header class="topbar career-nav"><div class="topbar-inner">
      <a class="brand" href="index.html"><span class="brand-mark">XQ</span><span>许强的作品集</span></a>
      <nav class="nav" aria-label="主导航"><a href="index.html#projects">五个项目</a><a href="analysis-results.html">历史项目复核</a><a class="nav-cta" href="{RESUME}">下载简历</a></nav>
    </div></header>'''


def wrap(title, description, body, script='', mode=''):
    canonical = f'https://steve-ron.github.io/ai-product-ops-portfolio/{mode + ".html" if mode else ""}'
    return f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)}</title><meta name="description" content="{escape(description,quote=True)}">
<link rel="canonical" href="{canonical}"><meta property="og:type" content="website"><meta property="og:url" content="{canonical}">
<meta property="og:title" content="{escape(title,quote=True)}"><meta property="og:description" content="{escape(description,quote=True)}"><meta name="twitter:card" content="summary">
<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="career.css"></head>
<body class="career-surface"{f' data-workbench="{mode}"' if mode else ''}><div class="shell">{nav()}<main class="page">{body}</main>
<footer class="footer"><div class="footer-inner"><span>许强 · AI 模型评测与多模态数据标注</span><a href="mailto:3420260662@bit.edu.cn">邮件联系</a></div></footer></div>{script}</body></html>
'''


def details(mode, spec, rows):
    name, title, intro, roles, sources, flow = spec
    links = f'downloads/career-data/{mode}'
    matching = [r for r in rows if r['sample_id'] in ('DB-e76138ca-7832-4e17-a637-4c3388819814','VID-sintel-4','UF-00147')]
    case = (matching or rows)[0]['sample_id']
    return wrap(f'{name}｜{title}',intro,f'''
<section class="career-hero" aria-labelledby="title"><p class="eyebrow">{roles}</p><h1 class="page-title career-title" id="title">{name}</h1>
  <p class="hero-lede"><strong>{title}</strong>。{intro}</p><div class="career-tools"><a class="button" href="#workbench">进入工作台</a><a class="button secondary" href="{links}.json" download>原始数据 JSON</a><a class="text-link" href="{links}.csv" download>CSV</a><a class="text-link" href="{links}-examples.json" download>示范记录 JSON</a></div></section>
<div class="career-details">
  <section class="project-card"><h2>数据来源与工作流程</h2><p>{sources}</p><p>{flow}</p><div class="career-tools"><a class="text-link" href="{links}-rubric.md">操作规范</a><a class="text-link" href="{links}-report.md">质量报告与典型案例</a><a class="text-link" href="{mode}.html?sample={case}#workbench">打开案例 {case if len(case)<18 else case[:11]}</a></div></section>
  <section class="project-card"><h2>可检查成果</h2><p id="career-summary">{len(rows)} 条可追溯样本</p><p>个人作品集项目，按岗位任务定义评测或标注流程。数据整理、规范、代码和示范记录由 Codex 辅助制作。示范记录待本人实操复核。</p></section>
</div>
<section id="workbench" aria-labelledby="work-heading"><div class="section-head"><div><h2 id="work-heading">工作台</h2><p>显式保存后记录保留在当前浏览器，可随时导出。</p></div></div>
<div class="career-workspace">
  <aside class="project-card career-stack career-controls" aria-label="样本筛选"><label>搜索样本<input id="career-search" type="search" placeholder="编号、标题或关键词"></label><label>类别<select id="career-category"><option value="">全部类别</option></select></label><label>模态<select id="career-modality"><option value="">全部模态</option></select></label><label>状态<select id="career-filter"><option value="">全部状态</option><option value="new">未开始</option><option value="draft">草稿</option><option value="submitted">待复核</option><option value="approved">已通过</option><option value="returned">已退回</option><option value="bad">有错误标签</option></select></label>
  <span id="career-matches" class="career-small">正在读取样本</span><div class="career-sample-list" id="career-list"></div></aside>
  <article class="project-card career-record" id="career-record"><p>正在读取样本…</p></article>
</div>
<p id="career-status" class="career-qa" role="status" aria-live="polite">选择样本，填写后保存。切换前请保存草稿。</p>
</section>
<section class="project-card career-report"><h2>质检与导出</h2><div class="career-counts" id="career-counts"></div><div id="career-bars"></div><p class="career-small">统计以当前浏览器的记录为分母。标签分布和字段检查属于流程数据。</p>
<div class="career-tools"><button type="button" class="button small" data-export="json">导出本地 JSON</button><button type="button" class="button small secondary" data-export="csv">导出本地 CSV</button>{'<button type="button" class="button small secondary" data-export="jsonl">导出已复核偏好 JSONL</button>' if mode == 'modelbench' else ''}</div></section>
''','<script src="workflow-core.js"></script><script src="common.js"></script><script src="career-core.js"></script><script src="career-workbench.js"></script>',mode)


def home(datasets):
    cards = []
    for mode, (name,title,intro,roles,_,_) in SPECS.items():
        rows = datasets[mode]
        if mode == 'modelbench':
            preview = '<div class="text-preview"><small>偏好数据记录</small><strong>A / B 对比 → 证据 → 修订 → 复核</strong></div>'
        else:
            preferred = 'CMA-162868' if mode == 'aesthetic' else 'VID-sintel-4'
            sample = next((r for r in rows if r['sample_id'] == preferred),rows[0])
            preview = f'<figure><img src="{sample.get("poster",sample["media"])}" alt="{escape(sample["title"],quote=True)}"><figcaption>{escape(sample["attribution"])}</figcaption></figure>'
        cards.append(f'<article class="project-card">{preview}<div><h3>{name}</h3><p class="project-subtitle">{title}</p></div><p>{intro}</p><p class="career-small"><b>{len(rows)} 条</b>可追溯样本</p><a class="button small" href="{mode}.html">查看项目 →</a></article>')
    return wrap('许强｜AI 模型评测与多模态数据标注','许强的 AI 评测与数据标注作品集。北京理工大学数字经济硕士在读，成都文理学院书法学本科。',f'''
<section class="hero career-hero"><div class="hero-copy"><p class="hero-name">许强</p><h1>AI 模型评测与<br>多模态数据标注</h1><p class="hero-lede">书法学本科形成的视觉判断，结合标准化评分、双语 Caption、文本偏好标注与数据质检。</p><div class="hero-actions"><a class="button" href="#projects">查看项目 ↓</a><a class="button secondary" href="{RESUME}">下载单页简历</a></div></div>
<aside class="hero-card profile-card"><strong>北京理工大学</strong><p>数字经济硕士在读 · 非全日制<br>2026.09 — 2028.06（预计）</p><div class="contact-list"><div class="contact-item"><span>本科</span><b>成都文理学院 · 书法学</b></div><div class="contact-item"><span>求职</span><b>北京全职 · 周末授课 · 工作日可全勤</b></div><div class="contact-item"><span>邮箱</span><a href="mailto:3420260662@bit.edu.cn">3420260662@bit.edu.cn</a></div></div></aside></section>
<section class="section" id="projects"><div class="section-head"><div><h2>评测与数据标注</h2><p>三个工作台均有真实样本、规范、案例和数据下载。</p></div></div><div class="project-grid career-featured">{''.join(cards)}</div></section>
<section class="section"><div class="section-head"><div><h2>产品评测与反馈分析</h2></div></div><div class="project-grid">
<article class="project-card"><h3>LLM Lens</h3><p>8 维评测口径、48 条已设计回归用例、120 组公开偏好样本。24 条历史回复经 AI 辅助评审，归集 9 条候选 Bad Case。</p><div class="career-tools"><a class="button small" href="llm-eval.html">打开评测工作台</a><a class="text-link" href="downloads/evidence-20261015/llm-review-24.csv">评分记录</a></div></article>
<article class="project-card"><h3>Signal Desk</h3><p>156 条 Open WebUI 公开问题按 9 类主题和 3 类反馈类型归集。可按 Triage Score 初筛，回溯原问题并导出。</p><div class="career-tools"><a class="button small" href="feedback-insight.html">打开反馈工作台</a><a class="text-link" href="downloads/runs/signal-feedback.csv">反馈台账</a></div></article></div></section>
''')


def main():
    datasets = {mode: loads((DATA/f'{mode}.json').read_text(encoding='utf-8')) for mode in SPECS}
    for mode, spec in SPECS.items():
        (ROOT/f'{mode}.html').write_text(details(mode,spec,datasets[mode]),encoding='utf-8')
    (ROOT/'index.html').write_text(home(datasets),encoding='utf-8')
    for name in ('llm-eval.html','feedback-insight.html'):
        target = ROOT/name
        content = target.read_text(encoding='utf-8')
        content = content.replace('downloads/许强-北京理工大学-AI产品运营.pdf', RESUME)
        content = content.replace('许强 AI产品运营作品集首页', '许强作品集首页').replace('AI Product Ops Portfolio','许强的作品集')
        target.write_text(content,encoding='utf-8')


if __name__ == '__main__':
    main()
