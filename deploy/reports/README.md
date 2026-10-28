# HTML 实验报告

文章元数据和摘要保存在私有原稿仓库；完整 HTML、视频及其数据附件保存到腾讯云 `/opt/robot-learning/reports/<内容哈希>/`。不把视频或 HTML 大文件加入 GitHub 仓库。

先运行 `rtk proxy python deploy/reports/prepare_report.py <含 index.html 的目录> <暂存目录>`。工具保留排版、内嵌图表和直接引用的本地附件，检查缺失资源、路径越界和明显凭据；生成不可变内容哈希及 HTTPS 链接。只复制输出的哈希目录到服务器报告根目录，不上传整个实验工作区或 ZIP。

报告采用独立响应的 CSP sandbox 隔离，不能读取主站的登录信息；仅报告目录允许被主站和腾讯云博客嵌入，其余服务仍保留原来的限制。Caddy 负责 MP4 Range 请求，无需经过视频上传 API。

部署报告路由时，主站原有的全局 `X-Frame-Options DENY` 必须改为只匹配非报告地址：`@nonReportFrames not path /robot-media/reports/*`，然后 `header @nonReportFrames X-Frame-Options DENY`。报告路径由精确的 CSP `frame-ancestors` 控制嵌入来源。`deploy/media/install.sh` 已包含这一范围调整；修改前备份并通过 Caddy 校验后再重载。

在文章编辑页填写「HTML 实验报告链接」，选择栏目和章节，按正常文章流程公开并上架。报告会嵌入正文并自动调整高度，也提供独立窗口入口。HTML 文件和附件一经公开，文章下架不会自动撤销它们的直接访问；需要撤回整个报告时应单独移除服务器上的对应报告目录。
