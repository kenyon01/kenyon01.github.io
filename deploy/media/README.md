# 腾讯云视频服务

`server.mjs` 使用 Node.js 24 内置模块，无第三方运行依赖；ffprobe 校验 MP4/H.264/AAC。API 监听 127.0.0.1:8098，只经既有 www.nlearn.net 的 HTTPS 路由访问。其他域名和路径不变。

- POST/GET `/robot-media/api/videos`：以后台 GitHub Bearer token 调用 GitHub `/user`，仅允许固定站主 ID 49362778；不保存、不记录 token。不接受任意远程 URL。GET 返回登录后可见的文件列表。
- `/robot-media/videos/<sha256>.mp4`：Caddy 公开提供视频，支持 Range/HEAD；无目录列表。随机临时文件及元数据不在公开目录。
- 单个最大 200 MiB，总视频容量 8 GiB，至少保留 5 GiB 可用空间；一次处理一个上传。上传中断、校验失败清理临时文件；重启清理未完成上传。
- 只有上传成功后才返回链接。视频移除引用后仍保留，防止其他文章引用失效；删除由管理员按引用情况执行。独立目录必须纳入备份。

部署：将 server.mjs 放到 `/opt/robot-learning/media-service/`，创建无登录用户 robot-media（组 caddy），让它拥有 `/opt/robot-learning/media/{videos,tmp,metadata}`。安装 `robot-media.service` 到 systemd 并启用。将 routes.caddy 放到 `/etc/caddy/snippets/robot-media.caddy`，在既有 `www.nlearn.net` 站点的 fallback handle 之前 import；先 `caddy validate` 再 reload。不要替换整份现有 Caddy 配置。

验证：`node --test server.test.mjs`；未登录请求 401；错误 Origin 403；CORS 只允许 GitHub Pages 的 HTTPS origin；真实视频上传后 HEAD 200、Range 206；错误视频 415；私有目录 404；检查 nlearn 原有首页/API不受影响。

回滚：撤销该 import 并验证、重载 Caddy；停止 robot-media。保留 media 数据目录。恢复修改前 Caddy 备份时，先确认没有其他服务的新修改。公开文章链接需要该 HTTPS 视频路由持续运行。
