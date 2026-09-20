# 作品集运行说明

## 本次实际运行情况

2026-09-20运行了离线准备与反馈处理：48条用例选择24条、补齐2条输入材料、3条多轮用例拆为逐轮消息；120组历史偏好展开为240条回复任务。156条反馈按原规则标签重新计数，CSV和图表均由脚本生成。源快照日期仍为2026-08-14。

当前API成功任务为0，人工复核记录为0。评分模板只有中文表头；没有示例分数混入正式结果。网站中历史模型回复来自公开数据，不是本次API生成。

## 运行环境

Python 3.10以上，仅使用标准库。Node.js 20以上用于网页逻辑测试。先下载整个仓库，进入仓库根目录。

```powershell
python scripts/run_pipeline.py prepare
python scripts/run_pipeline.py feedback
python -m unittest discover -s tests -p "test_*.py"
node --test tests/workflow.test.cjs
node scripts/validate.mjs
python -m http.server 8000
```

打开 http://localhost:8000 体验。网页也可直接离线打开，依赖数据均为同目录JS文件。

## 国内模型API接入

在阿里云百炼或DeepSeek等支持chat/completions协议的平台开通接口，从自己的控制台取得准确模型ID和Base URL。平台地址及模型能力以官方文档为准：

- https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope
- https://help.aliyun.com/zh/model-studio/qwen-structured-output
- https://api-docs.deepseek.com/

API Key只配置到本机进程环境，不能提交到GitHub或浏览器前端。PowerShell可使用安全输入方式：

```powershell
$privateKey = Read-Host '输入API Key（不回显）' -AsSecureString
$env:PORTFOLIO_API_KEY = [System.Net.NetworkCredential]::new('', $privateKey).Password
$env:PORTFOLIO_BASE_URL = '从平台控制台复制Base URL'
$env:PORTFOLIO_TARGET_MODEL = '被测模型准确ID'
$env:PORTFOLIO_JUDGE_MODEL = '支持JSON输出的评审模型准确ID'
# 只有所选模型支持时才设置，例如关闭混合思考模式；不需要则用空对象。
$env:PORTFOLIO_EXTRA_BODY = '{}'
python scripts/run_pipeline.py run --kind cases --limit 3
python scripts/run_pipeline.py run --kind arena --limit 3
```

完成小批检查后：

```powershell
python scripts/run_pipeline.py run --kind cases --limit 0
python scripts/run_pipeline.py run --kind arena --limit 0
```

真实调用会消耗平台额度。默认每批3个任务，每次请求最多尝试3次。多轮用例需要多次生成调用，随后再调用评审模型。单条历史回复对应一次评审调用。

批次由输入、接口、模型、附加参数及评分规则共同计算。相同批次成功任务续跑时跳过；错误任务可重试。原始响应、请求ID、token用量及完整多轮消息保存到被Git忽略的 `.private-runs/`。无密钥时立即退出，不生成伪造结果。

## 评分与异常

8维得分为1至5或空值。英文任务不强行评价中文写作，缺少完整历史时不评价多轮能力。得分或维度结构不合法则记录失败，不填默认值。模型名称与原始偏好结果不会传给评审模型。

超时、连接错误、429与暂时性5xx有上限重试；401/402/403及参数错误停止批次。内容拦截、空响应、输出截断不参与正式评分。模型合理拒答应按原用例验收，不能与接口拦截混为一谈。

本轮Agent相关用例评价工具/权限意识，没有真实工具执行器，不汇报工具成功率。事实类需要可核验依据；无法确认时允许空值。

## 审核与发布

逐条检查原始输出是否包含个人信息或不宜公开内容，然后针对一个批次导出：

```powershell
python scripts/run_pipeline.py export --log .private-runs/cases-实际批次编号.jsonl
```

输出 `downloads/runs/llm-api-批次.csv` 和对应JSON，保留原回复模型与本次评审模型。默认标记“模型评分·未人工复核”。审核后再更新页面的成功数量、链接与截图；不能仅通过改变页面状态冒充已运行。

## Signal Desk人工标注

下载 `downloads/runs/signal-feedback.csv`，原始标签保留不覆盖。对156条逐条填写人工主主题、根因、证据、复核人、时间；无法确认的写“证据不足”，不能强制归类。优先复核27条其他、9条咨询/待判定及高风险反馈，按ID去重。

主主题9类、反馈类型3类沿用工作台。主主题单选，子问题簇按具体任务和相同问题现象划分；45条API连接是大主题，不等于同一故障重复45次。全部记录都完成复核后，才能报告“156条已复核”。

新版Triage建议：`round(25*(0.40*S+0.25*F+0.20*V+0.15*U)*C)`。S为影响程度、F为具体问题簇频次、V为核心链路关联、U为时效要求，均为0至4；C为证据置信度0.5/0.75/1。关键证据缺失时留空，严重风险进入优先核实，已确认事故由人工升级。网页现有分数仍明确标注原规则初筛，未静默替换为业务优先级。

## 双人一致性

两名真实标注者先共同学习8条练习样例，再独立标注另外30条分层样本。保留双方原始结果，计算BadCase一致率、Cohen κ、主根因一致率以及维度分差不超过1的占比。分歧协商后的标签用于最终结论，不用于计算独立一致性；单人加模型不称为双人标注。

## 导出与复盘

反馈页导出当前筛选CSV和当前筛选Markdown复盘；全量导出另设按钮。开放问题Top20只包含原快照中开放的Issue。LLM页支持将当前筛选的提示词、两份完整回复、偏好标签与候选根因一起导出。浏览器中填写的记录只在该浏览器保存，需要导出后人工审核再发布。

## 下一轮迭代

1. 配置国内模型API，跑3条检查输出和费用，再执行完整批次。
2. 两位标注者完成独立评分，统一评分口径。
3. 全量人工复核反馈，按新标签重算主题统计。
4. 选3至5个确认BadCase，保留修改前后同用例结果。
5. 增加新采集快照后再报告周增量和趋势。
