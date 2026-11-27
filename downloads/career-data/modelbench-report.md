# modelbench 数据与质量说明

2026-11-27 快照。样本 127 条，text 127 条。构成 OpenBMB UltraFeedback 120 条，Meta Community Alignment 7 条。类别分布 摘要 11 条，提取与格式 20 条，基础数学 20 条，经济商业 20 条，写作与表达 20 条，文化艺术 9 条，一般问答 20 条，多轮与上下文 7 条。

抽样目标是覆盖可展示的任务类型。所有样本的 ID、来源和许可字段检查通过。视觉文件可本地预览且哈希与清单匹配。文本样本检查了题目重复、A/B 空白和完全相同回复。程序检查只报告结构结果。公开回答按可读长度、样本去重及类别采样。发布方模型分与源人工偏好分别保留。问答和多轮数据以英文为主，未把中文示范规则当成中文回答覆盖量。已有示范偏好供校准，独立复核与生成 API 实验当前为 0。

## 示范与 Bad Case

- `UF-00095`。B 把 (1+2+3+4+5)/5 写成 16，正确为 3。平方偏差之和 10。A 按总体公式得 √2。题目未指定样本/总体。。标签 事实错误、推理跳步。
- `UF-00147`。按题内原文审核摘要。B 省略人名，将“18 世纪之前”模糊成 prior to that。原文自身历史陈述未经独立核验。。标签 内容遗漏。
- `CA-00086`。A、B 都建议角落书桌或紧凑矩形书桌，都不再推荐壁挂式。尺寸是建议。偏好取决于房间面积及家具尺寸，保留平局。。标签 无。

示范由 Codex 辅助编写，状态是待本人实操复核。逐条算法检查或示范标签不代表独立人工正确率。最终标注按用户本地导出记录计算。

## 来源与许可

- Cleveland Museum of Art Open Access，按作品 API 回传的 CC0 择取，保留来源、作者、馆号关联及图像 URL。图像转为 WebP。 [CMA Open Access](https://www.clevelandart.org/open-access)
- DiffusionDB，保留样本文件名、Prompt、seed、CFG、steps、sampler 与首分片路径，图像转为 WebP。 [Polo Club DiffusionDB](https://huggingface.co/datasets/poloclub/diffusiondb)
- © Blender Foundation，Big Buck Bunny CC BY 3.0，Sintel 按 Blender Studio 开放电影 CC BY。保留原预告片与取段区间，经截取、缩放、去音轨。 [Big Buck Bunny](https://peach.blender.org/about/) [Sintel](https://studio.blender.org/projects/sintel/)
- OpenBMB UltraFeedback 的发布版本、分拆及源行，保留原模型回答。MIT 声明随附。 [UltraFeedback](https://huggingface.co/datasets/openbmb/UltraFeedback)
- Meta Community Alignment（Zhang 等），CC BY 4.0。提取第 2 轮部分回答，上轮原提示与获选回答组合为上下文，去除个人和人口属性字段。 [Community Alignment](https://huggingface.co/datasets/facebook/community-alignment-dataset)
