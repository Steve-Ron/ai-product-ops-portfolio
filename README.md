# 许强 AI 产品运营作品集

主投 AI 产品运营，侧重大模型评测、用户反馈与应用优化；数据处理与 SQL 分析支持数据运营相关岗位。

两项均为个人项目，使用 AI 辅助实现与评审。基于 GitHub Pages 发布；本目录为2026年10月15日的作品集版本。

## 已完成

- Signal Desk：156条原始反馈与源链接；156条标题级AI复核；74条分类分歧；6组可复算SQL；51条快照开放记录队列。
- LLM Lens：120组公开偏好、240条历史回复的完整性检查；12组24条回复的逐条AI评审，9条候选问题；4条确定性计数核验；48条补齐输入与验收口径的回归设计。
- 2个交互式MVP、2份PRD、反馈与回复导出、复核记录、最新结果页与简历。

## 使用

直接打开 index.html 可离线浏览；新版结果位于 analysis-results.html。也可使用 Python 启动本地HTTP服务器。

```
python scripts/complete_evidence.py
python -m unittest discover -s tests -p "test_*.py"
node --test tests/workflow.test.cjs
node scripts/validate.mjs
```

scripts/complete_evidence.py 复算并导出本次已保存的AI评审，不重新生成模型评审。review_decisions.py 和 session_llm_reviews.py 为本次Codex会话产生的决策记录。

## 结果边界

公开反馈是2026年8月14日快照。标题级复核不是人工金标，74条分歧不是错误率；24条历史回复是目的抽样，不用于模型排名。48条回归设计未进行独立API实测，本轮API调用0次，无虚构成本、延迟或业务增长数字。需要用户本人复核与掌握后再用于面试。
