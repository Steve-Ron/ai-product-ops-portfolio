# aesthetic 数据与质量说明

2026-11-27 快照。样本 111 条，image 103 条，video 8 条。构成 generated 23 条，museum 80 条，animation 8 条。类别分布 商品与静物 1 条，建筑与空间 14 条，生成肖像 8 条，生成风景 5 条，插画与动物 5 条，书法与文字 10 条，山水 10 条，肖像 10 条，器物 10 条，多主体场景 10 条，摄影 10 条，插画与版画 10 条，动画片段 8 条。

抽样目标是覆盖可展示的任务类型。所有样本的 ID、来源和许可字段检查通过。视觉文件可本地预览且哈希与清单匹配。文本样本检查了题目重复、A/B 空白和完全相同回复。程序检查只报告结构结果。视觉素材中，DiffusionDB 是模型历史生成结果。馆藏和动画用于评分校准。公开生成视频、专门电商图占比未覆盖到可单独报告的规模。Prompt 只适用于生成图，视频的时序与运动按时码另判。

## 示范与 Bad Case

- `DB-e76138ca-7832-4e17-a637-4c3388819814`。左图主体区域呈边缘不清的亮色块，无法辨认角色轮廓。逐图检查角色和环境是否可见。。标签 模糊或伪影、Prompt偏离。
- `CMA-162868`。墨字纵向排列，墨色与纸面形成对比。浓淡和连笔是可观察的风格特征，草书字义需另核。。标签 无。
- `VID-sintel-4`。预览帧中连绵的沙丘呈暖色，明暗带形成多层轮廓。预览帧只支持空间和画面判断，先留空时序与运动。。标签 无。

示范由 Codex 辅助编写，状态是待本人实操复核。逐条算法检查或示范标签不代表独立人工正确率。最终标注按用户本地导出记录计算。

## 来源与许可

- Cleveland Museum of Art Open Access，按作品 API 回传的 CC0 择取，保留来源、作者、馆号关联及图像 URL。图像转为 WebP。 [CMA Open Access](https://www.clevelandart.org/open-access)
- DiffusionDB，保留样本文件名、Prompt、seed、CFG、steps、sampler 与首分片路径，图像转为 WebP。 [Polo Club DiffusionDB](https://huggingface.co/datasets/poloclub/diffusiondb)
- © Blender Foundation，Big Buck Bunny CC BY 3.0，Sintel 按 Blender Studio 开放电影 CC BY。保留原预告片与取段区间，经截取、缩放、去音轨。 [Big Buck Bunny](https://peach.blender.org/about/) [Sintel](https://studio.blender.org/projects/sintel/)
- OpenBMB UltraFeedback 的发布版本、分拆及源行，保留原模型回答。MIT 声明随附。 [UltraFeedback](https://huggingface.co/datasets/openbmb/UltraFeedback)
- Meta Community Alignment（Zhang 等），CC BY 4.0。提取第 2 轮部分回答，上轮原提示与获选回答组合为上下文，去除个人和人口属性字段。 [Community Alignment](https://huggingface.co/datasets/facebook/community-alignment-dataset)
