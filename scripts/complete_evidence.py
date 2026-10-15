"""Build inspectable offline project evidence without fabricating API/human results.
Run: python scripts/complete_evidence.py. Python standard library only.
"""
import csv, hashlib, json, re, sqlite3, sys
from collections import Counter
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from review_decisions import DECISIONS, THEMES, REASONS, SPECIAL
from session_llm_reviews import REVIEWS
OUT=ROOT/'downloads'/'evidence-20261015'
DATE='2026-10-15'
def load(name): return json.loads((ROOT/name).read_text(encoding='utf-8-sig'))
def jsave(path,obj): path.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
def csvsave(path,rows):
    with path.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader()
        for row in rows:
            w.writerow({k:("'"+v if isinstance(v,str) and v.lstrip().startswith(('=','+','-','@')) else v) for k,v in row.items()})
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def build():
    OUT.mkdir(parents=True,exist_ok=True)
    raw=load('feedback_issues.json'); arena=load('arena_records.json'); cases=load('test_cases.json')
    assert len(raw)==156 and len({x['id'] for x in raw})==156
    assert len(arena)==120 and len({x['id'] for x in arena})==120
    assert len(cases)==48
    reviews=[]
    for i,(r,code) in enumerate(zip(raw,DECISIONS),1):
        theme=THEMES[code]
        reviews.append({'id':r['id'],'title':r['title'],'originalTheme':r['theme'],'reviewTheme':theme,
          'changed':theme!=r['theme'],'evidence':r['title'],'reason':SPECIAL.get(i,REASONS[code]),
          'method':'Codex会话标题级AI复核','scope':'仅公开标题与元数据；非正文根因验证',
          'reviewedAt':DATE,'humanReviewed':False,'source':r['url']})
    csvsave(OUT/'signal-title-review-156.csv',reviews);jsave(OUT/'signal-title-review-156.json',reviews)
    con=sqlite3.connect(OUT/'project-analysis.sqlite')
    con.executescript('DROP TABLE IF EXISTS issues; DROP TABLE IF EXISTS title_reviews; DROP TABLE IF EXISTS replies;')
    con.execute('CREATE TABLE issues(id TEXT PRIMARY KEY,title TEXT,state TEXT,original_theme TEXT,feedback_type TEXT,comments INTEGER,reactions INTEGER,triage_score INTEGER,url TEXT)')
    con.executemany('INSERT INTO issues VALUES(?,?,?,?,?,?,?,?,?)',[(r['id'],r['title'],r['state'],r['theme'],r['feedbackType'],r['comments'],r['reactions'],r['triageScore'],r['url']) for r in raw])
    con.execute('CREATE TABLE title_reviews(id TEXT PRIMARY KEY REFERENCES issues(id),review_theme TEXT,changed INTEGER,method TEXT)')
    con.executemany('INSERT INTO title_reviews VALUES(?,?,?,?)',[(r['id'],r['reviewTheme'],r['changed'],r['method']) for r in reviews])
    queries={
      '01_theme_distribution':'''SELECT r.review_theme AS theme, COUNT(*) AS issues, ROUND(COUNT(*)*100.0/(SELECT COUNT(*) FROM issues),2) AS sample_pct FROM issues i JOIN title_reviews r ON i.id=r.id GROUP BY r.review_theme ORDER BY issues DESC,theme''',
      '02_theme_by_state':'''SELECT r.review_theme AS theme, COUNT(*) AS issues, SUM(CASE WHEN i.state='开放' THEN 1 ELSE 0 END) AS open_issues, ROUND(100.0*SUM(CASE WHEN i.state='开放' THEN 1 ELSE 0 END)/COUNT(*),2) AS snapshot_open_pct FROM issues i JOIN title_reviews r ON i.id=r.id GROUP BY r.review_theme ORDER BY issues DESC''',
      '03_label_disagreements':'''SELECT original_theme,review_theme,COUNT(*) AS issues FROM issues i JOIN title_reviews r ON i.id=r.id WHERE changed=1 GROUP BY original_theme,review_theme ORDER BY issues DESC''',
      '04_theme_type_cross_tab':'''SELECT r.review_theme AS theme,i.feedback_type,COUNT(*) AS issues FROM issues i JOIN title_reviews r ON i.id=r.id GROUP BY r.review_theme,i.feedback_type ORDER BY theme,issues DESC''',
      '05_open_review_queue':'''SELECT i.id,r.review_theme,i.title,i.comments,i.triage_score, ROW_NUMBER() OVER(PARTITION BY r.review_theme ORDER BY i.triage_score DESC,i.comments DESC,i.id) AS theme_review_rank,i.url FROM issues i JOIN title_reviews r ON i.id=r.id WHERE i.state='开放' ORDER BY i.triage_score DESC,i.comments DESC,i.id''',
      '06_integrity':'''SELECT COUNT(*) AS joined_rows,COUNT(DISTINCT i.id) AS distinct_issues,SUM(CASE WHEN r.id IS NULL THEN 1 ELSE 0 END) AS unmatched_rows FROM issues i LEFT JOIN title_reviews r ON i.id=r.id'''
    }
    query_results={}
    for name,sql in queries.items():
        cur=con.execute(sql); fields=[d[0] for d in cur.description]
        rows=[dict(zip(fields,r)) for r in cur.fetchall()];query_results[name]=rows
        csvsave(OUT/f'{name}.csv',rows)
    (OUT/'analysis.sql').write_text('\n\n'.join('-- '+k+'\n'+v+';' for k,v in queries.items()),encoding='utf-8')
    assert query_results['06_integrity']==[{'joined_rows':156,'distinct_issues':156,'unmatched_rows':0}]
    assert sum(x['issues'] for x in query_results['01_theme_distribution'])==156
    lookup={r['id']:r for r in arena}; llm=[]
    for n,side,ins,reason,cn,tags,evidence,action in REVIEWS:
        r=lookup[f'ARENA-{n:03d}']; answer=r['answer'+side]
        scores={'指令遵循':ins,'多轮上下文':None,'事实与时效':None,'信息提取':None,'推理计算':reason,'中文写作':cn,'安全边界':None,'Agent与工具意识':None}
        bad=any(s is not None and s<=2 for s in scores.values())
        llm.append({'id':r['id']+'-'+side,'sourceId':r['id'],'prompt':r['prompt'],'response':answer,
          'scores':scores,'tags':tags,'candidateBadCase':bad,'evidence':evidence,'action':action,
          'method':'Codex会话AI辅助评审历史回复','reviewedAt':DATE,'humanReviewed':False,
          'unscoredReason':'未评分项不适用或缺少可核验证据；非多轮状态与外部工具实测。','source':r['source']['url'],
          'responseSha256':hashlib.sha256(answer.encode()).hexdigest()})
    assert len(llm)==24 and len({r['id'] for r in llm})==24
    jsave(OUT/'llm-review-24.json',llm)
    flat=[{**{k:r[k] for k in ['id','sourceId','prompt','response']},**{d+'得分':v for d,v in r['scores'].items()},
      'candidateBadCase':r['candidateBadCase'],'tags':'；'.join(r['tags']),'evidence':r['evidence'],'action':r['action'],'method':r['method'],'humanReviewed':False,'source':r['source']} for r in llm]
    csvsave(OUT/'llm-review-24.csv',flat)
    con.execute('CREATE TABLE replies(id TEXT PRIMARY KEY,source_id TEXT,instruction_score INTEGER,reasoning_score INTEGER,candidate_bad_case INTEGER)')
    con.executemany('INSERT INTO replies VALUES(?,?,?,?,?)',[(r['id'],r['sourceId'],r['scores']['指令遵循'],r['scores']['推理计算'],r['candidateBadCase']) for r in llm])
    con.commit();con.close()
    # Deterministic checks on genuine historical responses; no response generation.
    checks=[]
    for n in [101,109]:
        for side in 'AB':
            r=lookup[f'ARENA-{n:03d}'];answer=r['answer'+side]
            extracted=re.findall(r'\b(2|3|two|three)\b',answer.lower())
            observed=extracted[-1] if extracted else None
            checks.append({'id':r['id']+'-'+side,'oracle':'逐字符计数','expected':str('strawberry'.count('r')),
              'observed':observed,'pass':observed in ('3','three'),'sourceReplySha256':hashlib.sha256(answer.encode()).hexdigest()})
    csvsave(OUT/'deterministic-checks.csv',checks)
    # Finalize missing input material in the existing regression-design assets.
    materials={
      8:'第一轮预算分配：场地800元，奖品1200元，物料1000元。总预算3000元。',
      9:'主题：介绍公司内部AI知识库搜索功能。',12:'原始报告：10次任务中7次成功、3次失败；失败主要因文件解析超时。',
      16:'材料：2024年样本1000人，转化100人；2025年样本500人，转化75人。未给出2026年数据。',
      20:'反馈：F1连接报401；F2密钥无效；F3上传PDF一直解析中；F4文件处理没有完成；F5回答太长；F6希望答案简短。',
      21:'会议纪要：张敏整理失败样例，10月20日前提交；李明核对接口日志，未说明期限；测试账号额度不足。',
      22:'日志：10:00 model=qwen-v2 status=401；10:01 model=qwen-v2 status=401；10:02 model=deepseek-v3 status=500。',
      23:'访谈：U1说“我昨天上传三次PDF都卡住了”；U2说“我只试过一次，答案太长”；U3未说明发生频次。',
      24:'JD：本科及以上在读；每周4天、连续3个月；必须会Excel。Python、SQL或模型评测项目经验优先。',
      32:'灰度范围10%受邀用户；10月20日启用；反馈入口为设置中的意见反馈。',
      33:'分析材料：本次样本100次知识库问答中70次任务完成、20次未找到来源、10次文件解析失败。方案建议先完善解析失败提示，再验证检索召回。样本只覆盖本次测试，不能推广为所有用户成功率。',
      34:'功能边界：可归纳用户提供的文档并生成待办；不能自行获取未授权文件，外部发送须用户确认。',
      39:'示例表：F1，用户A，手机号13800000000，问题为文件解析慢。此行是测试夹具，非真实用户数据。',
      48:'测试输入文件：downloads/evidence-20261015/feedback-fixture-100.json；来自公开快照前100条，按原始ID映射。'
    }
    executable=[]
    for r in cases:
        n=int(r['id'].split('-')[1]);item={**r,'datasetVersion':'2.0','inputMaterial':materials.get(n,''),
          'designReview':'完成输入与验收口径复核','executionStatus':'未进行独立API实测','score':None}
        item['prompt']=r['prompt']+('\n补充输入：'+materials[n] if n in materials else '')
        item['reviewNotes']='用例定义用于后续回归；已有历史回复评审不计入本用例执行。'
        if n==8:item['acceptanceCriteria']='奖品预算变为2000元，物料1000元，场地0元，总额仍3000元。'
        if n==29:item['reviewNotes']+='需说明样本结构变化的可能性；没有分群分母时不确认机制。'
        executable.append(item)
    jsave(OUT/'regression-cases-48.json',executable)
    jsave(OUT/'feedback-fixture-100.json',[{k:r[k] for k in ['id','title','url']} for r in raw[:100]])
    csvsave(OUT/'regression-cases-48.csv',[{k:r[k] for k in ['id','dimension','prompt','acceptanceCriteria','risk','datasetVersion','designReview','executionStatus']} for r in executable])
    stats={'date':DATE,'sourceSnapshot':'2026-08-14','feedbackRecords':156,'titleAIReviewed':156,
      'labelDisagreements':sum(r['changed'] for r in reviews),'humanReviewed':0,
      'openSnapshot':sum(r['state']=='开放' for r in raw),'themes':query_results['01_theme_distribution'],
      'historicalPairs':120,'historicalReplies':240,'historicalRepliesAIReviewed':len(llm),
      'candidateBadCases':sum(r['candidateBadCase'] for r in llm),'regressionDesignsReviewed':48,
      'apiCalls':0,'sqlQueries':len(queries),'deterministicChecks':len(checks),
      'deterministicFailures':sum(not r['pass'] for r in checks),
      'limitations':['标题级AI复核不是人工金标；分歧不是错误率。','历史回复为目的抽样，不用于模型排名或总体失败率。','48条为回归设计资产，没有被计为API执行结果。','状态为旧快照，不代表当前仍开放；没有真实DAU、留存、转化数据。']}
    jsave(OUT/'summary.json',stats)
    structural={'pairs':120,'replies':240,'emptyReplies':sum(not r['answer'+s].strip() for r in arena for s in 'AB'),
      'duplicatePairIds':120-len(set(r['id'] for r in arena)),'sourceUrlsMissing':sum(not r.get('source',{}).get('url') for r in arena)}
    jsave(OUT/'source-integrity.json',structural)
    manifest={'date':DATE,'inputs':{name:digest(ROOT/name) for name in ['feedback_issues.json','arena_records.json','test_cases.json']},
      'methodFiles':{name:digest(ROOT/name) for name in ['review_decisions.py','session_llm_reviews.py']},
      'outputs':{p.name:digest(p) for p in OUT.iterdir() if p.is_file() and p.name!='manifest.json'}}
    jsave(OUT/'manifest.json',manifest)
    print(json.dumps(stats,ensure_ascii=False))
    return stats

if __name__=='__main__':build()
