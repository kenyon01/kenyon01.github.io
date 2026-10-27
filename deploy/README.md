# 腾讯云公开站点镜像

- SSH：`root@43.134.239.33`
- 目录：`/opt/robot-learning/`
- 公网入口：`http://43.134.239.33:80/robotics/`（80 可省略）
- 网站进程：`127.0.0.1:8088`，由现有 Caddy 的 IP 专属规则转发。2026-10-27 验证时，公网直连 8088 超时，80 可达。
- 静态文件：`releases/<release>/`，`current` 符号链接指向当前版本。
- 服务：`robot-learning.service`，复用已安装的 Caddy 二进制，独立监听 8088。`public-ip.caddy` 中的规则追加到现有 `/etc/caddy/Caddyfile`，只匹配 IP，不改变既有域名的路由。

## 内容更新

1. 在私有原稿仓库编辑文章，公开并上架后等待同步工作流完成。
2. 等待公开仓库对应提交的 GitHub Pages 构建完成。
3. 下载该构建的 `github-pages` artifact，检查只含公开站点文件，上传解包到新的 release 目录。
4. 校验首页、`robotics/index.html`、文章和静态资源后，原子切换 `current` 符号链接。
5. 从公网检查专题、文章与资源返回 200；核对运行中的其他业务服务。

保留上一版以便回滚。不要把 `.private-storage`、`.private-secrets`、`.git` 或整个本地仓库上传到公开根目录。

GitHub Pages 保持主站身份，腾讯云镜像沿用主站 canonical 链接；写作后台也沿用主站的 HTTPS 登录入口。两个地址的路径一致。GitHub Pages 自动发布，腾讯云镜像需在更新时同步构建产物，目前没有配置自动同步任务。

## 运维

`systemctl status robot-learning` 查看状态，`journalctl -u robot-learning -n 50` 查看日志。服务不需要数据库或 Node.js 进程，构建依赖也无需安装在服务器上。
