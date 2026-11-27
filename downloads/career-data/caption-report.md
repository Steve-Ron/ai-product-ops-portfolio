# caption 数据与质量说明

2026-11-27 快照。样本 191 条，video 8 条，image 183 条。构成 animation 8 条，museum 160 条，generated 23 条。类别分布 动画片段 8 条，书法与文字 20 条，山水 20 条，肖像 20 条，器物 20 条，建筑与空间 24 条，多主体场景 20 条，摄影 20 条，插画与版画 20 条，商品与静物 1 条，生成肖像 8 条，生成风景 5 条，插画与动物 5 条。

抽样目标是覆盖可展示的任务类型。所有样本的 ID、来源和许可字段检查通过。视觉文件可本地预览且哈希与清单匹配。文本样本检查了题目重复、A/B 空白和完全相同回复。程序检查只报告结构结果。数据交付为标注素材清单，未制作全量Caption。部分视觉素材与 Aesthetic Lens 共用，项目规模各自计数。同一作品的不同来源画面按素材哈希检查，未开展语义近重复或独立人工准确率评估。自动必填与文本校验在工作台记录中运行。

## 示范与 Bad Case

- `CMA-162868`。图中没有书写者及其动作，删去练习的动机推断。。标签 无依据推断、描述不完整。
- `VID-sintel-4`。去掉画面和静音素材无法验证的说话，完整时序待本人逐帧补写。。标签 无依据推断、错误动作、视频时序错误。

示范由 Codex 辅助编写，状态是待本人实操复核。逐条算法检查或示范标签不代表独立人工正确率。最终标注按用户本地导出记录计算。

## 来源与许可

- Cleveland Museum of Art Open Access，按作品 API 回传的 CC0 择取，保留来源、作者、馆号关联及图像 URL。图像转为 WebP。 [CMA Open Access](https://www.clevelandart.org/open-access)
- DiffusionDB，保留样本文件名、Prompt、seed、CFG、steps、sampler 与首分片路径，图像转为 WebP。 [Polo Club DiffusionDB](https://huggingface.co/datasets/poloclub/diffusiondb)
- © Blender Foundation，Big Buck Bunny CC BY 3.0，Sintel 按 Blender Studio 开放电影 CC BY。保留原预告片与取段区间，经截取、缩放、去音轨。 [Big Buck Bunny](https://peach.blender.org/about/) [Sintel](https://studio.blender.org/projects/sintel/)
- OpenBMB UltraFeedback 的发布版本、分拆及源行，保留原模型回答。MIT 声明随附。 [UltraFeedback](https://huggingface.co/datasets/openbmb/UltraFeedback)
- Meta Community Alignment（Zhang 等），CC BY 4.0。提取第 2 轮部分回答，上轮原提示与获选回答组合为上下文，去除个人和人口属性字段。 [Community Alignment](https://huggingface.co/datasets/facebook/community-alignment-dataset)
