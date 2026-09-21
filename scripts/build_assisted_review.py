"""将已有回复与本轮AI评审记录合并，复算统计；不调用模型、不生成虚构回复或人工标签。"""
import json
from collections import Counter
from run_pipeline import ROOT, PUBLIC, DIMENSIONS, load, write_csv, write_json, feedback_summary

review = json.loads((PUBLIC / 'llm-assisted-review.json').read_text(encoding='utf-8'))
source = load('arena_records.json')
selected = [r for r in source if r['language'] == '中文'][:3]
expected = {f"{r['id']}-{s}" for r in selected for s in 'AB'}
assert {r['id'] for r in review['reviews']} == expected
assert len(review['reviews']) == 6
lookup = {r['id']: r for r in selected}
rows = []
for entry in review['reviews']:
    source_id, side = entry['id'].rsplit('-', 1)
    record = lookup[source_id]
    assert set(entry['scores']) | set(review['unscored']) == set(DIMENSIONS)
    assert all(type(v) is int and 1 <= v <= 5 for v in entry['scores'].values())
    assert set(entry['scoreEvidence']) == set(entry['scores'])
    assert all(entry['scoreEvidence'].values())
    bad = any(v <= 2 for v in entry['scores'].values())
    rows.append({'样本编号':entry['id'],'提示词':record['prompt'],'模型回复':record['answer'+side],
        '历史模型':record['model'+side], **{d+'得分':entry['scores'].get(d,'') for d in DIMENSIONS},
        '根因标签':'；'.join(entry['tags']) or '无明显严重缺陷','BadCase标记':'候选' if bad else '否',
        '逐维评分依据':json.dumps(entry['scoreEvidence'],ensure_ascii=False),'问题依据':entry['evidence'],'改进建议':entry['action'],'未评分原因':json.dumps(review['unscored'],ensure_ascii=False),
        '评审方式':review['method'],'人工复核状态':'未复核','评审日期':review['date'],'来源':record['source']['url']})
write_csv(PUBLIC/'llm-assisted-review.csv', rows, list(rows[0]))
tags = Counter(t for r in review['reviews'] for t in r['tags'])
bad_count = sum(r['BadCase标记']=='候选' for r in rows)
summary = {'date':review['date'],'samplePairs':len(selected),'responsesReviewed':len(rows),
    'candidateBadCases':bad_count,'candidateRate':round(bad_count/len(rows),4),
    'tagCounts':dict(tags),'apiCalls':0,'humanReviewed':0,
    'sampling':review['sampling'],'method':review['method'],
    'limitation':'仅3个提示词的便利小样本，两条回复共享同一提示词；不能外推模型整体质量或用于模型排名。标签可重叠，不计算总体八维平均分。'}
write_json(PUBLIC/'llm-assisted-summary.json',summary)
feedback = feedback_summary(load('feedback_issues.json'))
report = f'''# 两个项目的最小运行结果

运行日期：{review['date']}。本轮无需外部API密钥。

## LLM Lens

- 逐条评审3组现有中文对话、6条真实历史回复，输出中文CSV。
- 发现{bad_count}条候选Bad Case（{bad_count/len(rows):.1%}，仅限本次小样本）。
- 回复语言不匹配2条、推理前提混淆2条、歧义输入过度解释2条；标签可重叠。
- 优先改进：跟随用户语言；区分“可无限参选”和“无需选举”；遇到疑似错字先澄清。
- 8维字段完整保留，本次只评分指令遵循、推理计算、中文写作；其余5维留空并记录原因。
- 这是对历史回复的AI辅助评审，不是DeepSeek实跑，不是人工双人标注。API调用0次，人工复核0条。
- 取样：{review['sampling']}。本轮已看到原模型身份及公开偏好，不宣称盲评或独立一致性验证。

## Signal Desk

- 已对{feedback['total']}条公开Issue快照重新执行规则统计与CSV导出，快照中开放状态{feedback['open']}条。
- 模型/API连接45条、界面流程22条、知识库/RAG 21条，合计88条，占56.41%。
- 问题反馈95条、功能建议52条、咨询/待判定9条。
- 建议首先细分API连接问题的配置环节与错误码，再整理界面阻塞和RAG检索失败的复现清单。
- 原始数据快照为2026-08-14；使用已有规则标签，尚未完成逐条人工标注，不等同于已确认业务优先级。

## 交付物

- [历史回复评分CSV](llm-assisted-review.csv)
- [逐条评分依据](llm-assisted-review.json)
- [评审统计](llm-assisted-summary.json)
- [156条反馈台账](signal-feedback.csv)
- [反馈主题统计](signal-themes.csv)
'''
(PUBLIC/'simple-results.md').write_text(report,encoding='utf-8')
print(json.dumps({'llm':summary,'signal':feedback},ensure_ascii=False))
