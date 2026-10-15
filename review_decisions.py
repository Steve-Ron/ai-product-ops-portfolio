"""2026-10-15 Codex session title-only review. AI suggestions, not human gold labels.
The indexed decisions were made after reading all 156 original titles in this session.
"""
THEMES = {
 'U':'界面与对话流程','A':'模型与API连接','K':'知识库与RAG',
 'T':'Agent/工具/搜索','P':'账号与权限','I':'安装与升级',
 'M':'多媒体与语音','S':'性能与稳定性','O':'其他'
}
# Preserve original ordering and original labels in the audit export.
DECISIONS = '''
U U U P K P K T A T S I P O A S A K M A
U A U U A M M A A U M T T A T S T U U T
K T T O O M P P U K M T P U I U S P A M
U T U U U U U U K P T P A A A P U T I S
I K I T U U P T I A P T U U A S S S S S
S S S S S K A A P T A M U U U A P K P U
T U U U U K M P I U A U S T U A U S I T
T I T U U U I U K K T K K K P M
'''.split()
assert len(DECISIONS) == 156

REASONS = {
 'U':'按用户可见交互、展示或操作路径归类；标题不足以确认后端根因。',
 'A':'标题主要涉及模型参数、供应商兼容、接口响应或调用配置。',
 'K':'标题主要涉及知识库、向量索引、检索或记忆数据资产。',
 'T':'标题主要涉及工具调用、Agent上下文、搜索或工具结果交付。',
 'P':'标题主要涉及身份认证、授权、权限开关或访问控制。',
 'I':'标题主要涉及安装、升级、依赖、部署或运行环境。',
 'M':'标题主要涉及图像、音视频或语音能力。',
 'S':'标题主要涉及性能、缓存、资源开销、崩溃或数据一致性。',
 'O':'仓库流程或维护事项，暂不归入面向终端用户的功能主题。'
}
SPECIAL = {
 1:'PPTX缩略图可见但主预览空白，归入附件预览交互。',
 8:'工具生成文件缺少原生下载入口，归入工具结果交付。',
 11:'多人协作笔记可能被空文档覆盖，归入数据一致性风险。',
 18:'记忆重新索引属于知识资产索引；不能因为endpoint一词自动归入API连接。',
 30:'折叠侧栏隐藏固定模型，属于显示路径，不是模型连接失败。',
 44:'Ruff格式检查是开发流程维护，不属于对话界面。',
 50:'更换embedding后不能更新memory，按索引与记忆资产处理，升级仅是背景。',
 63:'共享聊天作者头像归属展示错误，标题未证明权限绕过。',
 65:'删除用户后的头像回退显示问题，不属于知识库与RAG。',
 66:'共享聊天引用选择器漏项，当前按交互入口处理，权限因素待查。',
 70:'删除成员仍计数且DM无法打开，身份生命周期与访问问题待复现。',
 76:'禁用knowledge access后入口仍显示，作为权限控制一致性候选问题。',
 96:'每实例重复解码Redis事件属于性能开销。',
 97:'同步session pool阻塞事件循环属于性能与稳定性。',
 104:'每个认证请求都写last_active_at属于性能开销；认证不是此条主诉求。',
 113:'Search chats中的未读标记操作失效属于界面流程，搜索只是入口。',
 117:'新增OIDC身份声明字段属于认证资料配置。',
 122:'删除对话影响分析报表属于数据展示口径，需要先确认产品定义。',
 130:'将API请求纳入usage evaluation属于统计口径与分析展示。',
 132:'登录注册页面视觉模板属于界面定制，未报告身份认证故障。',
 143:'原生function calling不能使用web search，归入工具调用链路。',
 146:'用户头像在窄屏变形属于响应式界面，与RAG无关。',
 149:'知识清理后遗留文件与向量集合属于知识资产一致性。',
 155:'terminal功能禁用后仍展示Ports面板，按权限开关一致性处理。'
}
