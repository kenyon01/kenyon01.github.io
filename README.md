# Qingyan — Personal site

阿岩的个人主页与博客，托管于 GitHub Pages。

## 写一篇新文章

在私有原稿仓库 `kenyon01/blog-private` 的 `_posts` 目录新建 Markdown 文件，文件名格式：

```text
YYYY-MM-DD-english-slug.md
```

文章开头使用以下 Front Matter：

```yaml
---
layout: post
title: "文章标题"
description: "一句话摘要"
tags: [标签一, 标签二]
reading_time: 5
published: false
visibility: private
---
```

私有仓库推送到 `main` 后会同步公开内容；只有 `published: true` 且 `visibility: public` 的文章才会进入公开博客。本仓库的 `_posts`、`article-media` 是生成的公开副本，不要直接编辑。

## 在线写作后台

访问 [`/admin/`](https://kenyon01.github.io/admin/)，使用 GitHub 登录，即可在线新建、编辑和发布文章。

1. 新建文章默认“未上架 · 私有”，点击保存后保存在私有仓库。
2. 在文章列表点击“编辑”继续完善，保存不会改变上架状态。
3. 私有文章上架后，在后台列表点“阅读”。其他人无法通过公开网站或公开仓库访问。
4. 想对外公开时，点击“设为公开”并上架；同步及 GitHub Pages 构建成功后上线。
5. 点击“下架”或“设为私有”会在同步完成后撤下公开副本，原稿保留。
6. 已上架且公开的文章编辑保存会更新网站。状态反映保存设置，可点击“查看同步结果”检查是否成功；网站更新还需等待 Pages 构建。

原稿和新上传图片保存在私有仓库，GitHub 验证登录权限；当前仅站主有仓库权限。后台阅读使用经认证获取的内容和图片，外部图片不会自动加载。公开转私有无法清除既有 Git 历史、搜索缓存或他人副本。

- 如使用细粒度 Token 登录，需要本仓库 Contents 和 Pull requests 读写权限；Token 不应写入任何仓库文件。
- 图片上传到私有仓库的 `article-media`；仅公开文章引用的图片同步到公开仓库。
- 列表按钮管理上下架，编辑器中不显示可见性开关。

## 后台定制维护

后台基于 Sveltia CMS 0.218.0，固定源码提交 `00c44da6b919d15e559f51ca54cd96237ae556ee`。定制补丁位于 `cms-customization/publication.patch`，只增加文章列表操作与状态，复用原生保存、冲突检测与登录。

使用 Node.js 24.19+ 和 pnpm，运行 `powershell -File cms-customization/build.ps1` 可重建 `admin/vendor/sveltia-cms.js`。构建目录 `.cms-build` 不提交。保留上游 MIT 许可证；语言包等按上游固定版本从 CDN 加载。
