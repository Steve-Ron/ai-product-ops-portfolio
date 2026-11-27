"""Validate shipped data and build example records and public reports."""
from collections import Counter
from csv import DictReader
from hashlib import sha256
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'downloads/career-data'
MODE = ('aesthetic','caption','modelbench')


def rows(mode):
    return json.loads((DATA/f'{mode}.json').read_text(encoding='utf-8'))


def output(name, items):
    (DATA/name).write_text(json.dumps(items,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')


EXAMPLES = {
    'aesthetic': [
        {'sample_id':'DB-e76138ca-7832-4e17-a637-4c3388819814','compare':'DB-e68ccbf5-c8a9-4f0c-9aed-d71f535f2618','scores':{'画面清晰度':1,'主体结构':1,'Prompt符合度':1},'choice':'B','error_tags':['模糊或伪影','Prompt偏离'],'evidence':'左图主体区域呈边缘不清的亮色块，无法辨认角色轮廓。逐图检查角色和环境是否可见。'},
        {'sample_id':'CMA-162868','scores':{'构图合理性':4,'视觉层次':4,'文字与书法':4},'error_tags':[],'evidence':'墨字纵向排列，墨色与纸面形成对比。浓淡和连笔是可观察的风格特征，草书字义需另核。'},
        {'sample_id':'VID-sintel-4','scores':{'构图合理性':4,'风格一致性':4,'视觉层次':4},'error_tags':[],'evidence':'预览帧中连绵的沙丘呈暖色，明暗带形成多层轮廓。预览帧只支持空间和画面判断，先留空时序与运动。'},
    ],
    'caption': [
        {'sample_id':'CMA-162868','before':{'caption_zh':'作者在纸上练习写字。','caption_en':'The artist is practising writing on paper.'},
         'after':{'caption_zh':'浅色纸上有多列黑色竖书，笔画粗细和墨色深浅有变化。','caption_en':'Several vertical columns of black calligraphy appear on the light paper, with variations in stroke width and ink density.','objects':'纸面、黑色书迹','actions':'不适用（静态原作）','spatial_relations':'竖书按列排列在纸面上','quality_score':4},
         'error_tags':['无依据推断','描述不完整'],'review_note':'图中没有书写者及其动作，删去练习的动机推断。'},
        {'sample_id':'VID-sintel-4','before':{'caption_zh':'旅行者走向沙漠并说话。','caption_en':'A traveller walks into the desert and speaks.'},
         'after':{'caption_zh':'暖黄色的沙丘占据画面，起伏的丘脊延向远处。','caption_en':'Warm yellow dunes fill the frame, with undulating ridges extending into the distance.','objects':'沙丘、丘脊','actions':'沙丘预览帧无可确认的人物动作','spatial_relations':'丘脊由前景向远处延伸','time_sequence':'当前只确认片内 1 秒预览帧，完整片段待复核。','quality_score':3},
         'error_tags':['无依据推断','错误动作','视频时序错误'],'review_note':'去掉画面和静音素材无法验证的说话，完整时序待本人逐帧补写。'},
    ],
    'modelbench': [
        {'sample_id':'UF-00095','choice':'A','scores_a':{'事实准确性':5,'逻辑完整性':5,'回答完整性':4},'scores_b':{'事实准确性':1,'逻辑完整性':1,'回答完整性':2},'error_tags':['事实错误','推理跳步'],
         'evidence':'B 把 (1+2+3+4+5)/5 写成 16，正确为 3。平方偏差之和 10。A 按总体公式得 √2。题目未指定样本/总体。','revised':'The mean is 3 and the sum of squared deviations is 10. The population standard deviation is √(10/5) ≈ 1.4142. If the values are a sample, the sample standard deviation is √(10/4) ≈ 1.5811.'},
        {'sample_id':'UF-00147','choice':'A','scores_a':{'指令遵循':5,'回答完整性':5,'事实准确性':4},'scores_b':{'指令遵循':5,'回答完整性':3,'事实准确性':3},'error_tags':['内容遗漏'],'evidence':'按题内原文审核摘要。B 省略人名，将“18 世纪之前”模糊成 prior to that。原文自身历史陈述未经独立核验。','revised':'The passage traces the modern oil industry to shale-oil refining in Romania in 1857 and credits Petrache Poenaru. It states that wooden drills were the main method of producing oil before the 18th century.'},
        {'sample_id':'CA-00086','choice':'tie','scores_a':{'指令遵循':5,'内容相关性':4,'表达清晰度':4},'scores_b':{'指令遵循':5,'内容相关性':4,'表达清晰度':4},'error_tags':[],'evidence':'A、B 都建议角落书桌或紧凑矩形书桌，都不再推荐壁挂式。尺寸是建议。偏好取决于房间面积及家具尺寸，保留平局。'},
    ],
}


def validate(mode, records):
    ids = {r['sample_id'] for r in records}
    assert len(ids) == len(records)
    sources = set()
    for r in records:
        assert all(r.get(k) for k in ('sample_id','source','source_url','modality','category','license'))
        assert r['source_url'].startswith('https://')
        if r.get('media'):
            media = ROOT/r['media']
            assert media.is_file() and sha256(media.read_bytes()).hexdigest() == r['sha256']
            source = r['sha256']
            if r['modality'] == 'video':
                assert (ROOT/r['poster']).is_file() and r['interval_seconds'][0] < r['interval_seconds'][1]
            if r['media_kind'] == 'generated':
                assert r['prompt'] and r['generation']['se'] is not None
        else:
            source = re.sub(r'\s+', ' ', r['prompt']).strip().casefold()
            assert all(a.get('text') for a in r['answers']) and len(r['answers']) == 2 and r['answers'][0]['text'] != r['answers'][1]['text']
            assert r['source_row'] >= 0
            assert not any(key in r for key in ('annotator_id','annotator_age','user_name'))
        assert source not in sources, f'duplicate {mode} {r["sample_id"]}'
        sources.add(source)
    with (DATA/f'{mode}.csv').open(encoding='utf-8-sig',newline='') as file:
        assert set(row['sample_id'] for row in DictReader(file)) == ids
    for item in EXAMPLES[mode]:
        assert item['sample_id'] in ids
        assert not item.get('compare') or item['compare'] in ids


def report(mode, records):
    distribution = Counter(r.get('media_kind',r['source']) for r in records)
    counts = '，'.join(f'{name} {count} 条' for name,count in distribution.items())
    modalities = '，'.join(f'{k} {v} 条' for k,v in Counter(r['modality'] for r in records).items())
    categories = '，'.join(f'{k} {v} 条' for k,v in Counter(r['category'] for r in records).items())
    examples = EXAMPLES[mode]
    incidences = '\n'.join(f'- `{r["sample_id"]}`。{r.get("evidence") or r.get("review_note")}。标签 {"、".join(r["error_tags"]) or "无"}。' for r in examples)
    notes = {
        'aesthetic':'视觉素材中，DiffusionDB 是模型历史生成结果。馆藏和动画用于评分校准。公开生成视频、专门电商图占比未覆盖到可单独报告的规模。Prompt 只适用于生成图，视频的时序与运动按时码另判。',
        'caption':'数据交付为标注素材清单，未制作全量Caption。部分视觉素材与 Aesthetic Lens 共用，项目规模各自计数。同一作品的不同来源画面按素材哈希检查，未开展语义近重复或独立人工准确率评估。自动必填与文本校验在工作台记录中运行。',
        'modelbench':'公开回答按可读长度、样本去重及类别采样。发布方模型分与源人工偏好分别保留。问答和多轮数据以英文为主，未把中文示范规则当成中文回答覆盖量。已有示范偏好供校准，独立复核与生成 API 实验当前为 0。',
    }
    (DATA/f'{mode}-report.md').write_text(f'''# {mode} 数据与质量说明

2026-11-27 快照。样本 {len(records)} 条，{modalities}。构成 {counts}。类别分布 {categories}。

抽样目标是覆盖可展示的任务类型。所有样本的 ID、来源和许可字段检查通过。视觉文件可本地预览且哈希与清单匹配。文本样本检查了题目重复、A/B 空白和完全相同回复。程序检查只报告结构结果。{notes[mode]}

## 示范与 Bad Case

{incidences}

示范由 Codex 辅助编写，状态是待本人实操复核。逐条算法检查或示范标签不代表独立人工正确率。最终标注按用户本地导出记录计算。

## 来源与许可

- Cleveland Museum of Art Open Access，按作品 API 回传的 CC0 择取，保留来源、作者、馆号关联及图像 URL。图像转为 WebP。 [CMA Open Access](https://www.clevelandart.org/open-access)
- DiffusionDB，保留样本文件名、Prompt、seed、CFG、steps、sampler 与首分片路径，图像转为 WebP。 [Polo Club DiffusionDB](https://huggingface.co/datasets/poloclub/diffusiondb)
- © Blender Foundation，Big Buck Bunny CC BY 3.0，Sintel 按 Blender Studio 开放电影 CC BY。保留原预告片与取段区间，经截取、缩放、去音轨。 [Big Buck Bunny](https://peach.blender.org/about/) [Sintel](https://studio.blender.org/projects/sintel/)
- OpenBMB UltraFeedback 的发布版本、分拆及源行，保留原模型回答。MIT 声明随附。 [UltraFeedback](https://huggingface.co/datasets/openbmb/UltraFeedback)
- Meta Community Alignment（Zhang 等），CC BY 4.0。提取第 2 轮部分回答，上轮原提示与获选回答组合为上下文，去除个人和人口属性字段。 [Community Alignment](https://huggingface.co/datasets/facebook/community-alignment-dataset)
''',encoding='utf-8')


if __name__ == '__main__':
    for name in MODE:
        data = rows(name)
        validate(name,data)
        demo = [dict(r,record_origin='codex_assisted_example',review_status='pending_candidate_review') for r in EXAMPLES[name]]
        output(f'{name}-examples.json',demo)
        report(name,data)
        print(f'{name}: {len(data)} unique records; {len(demo)} linked examples')
