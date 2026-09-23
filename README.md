# Qingyan — Personal site

阿岩的个人主页与博客，托管于 GitHub Pages。

## 写一篇新文章

在 `_posts` 目录新建 Markdown 文件，文件名格式：

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
---
```

推送到 `main` 后，GitHub Pages 会自动构建并发布。

## 在线写作后台

访问 [`/admin/`](https://kenyon01.github.io/admin/)，使用 GitHub 登录，即可在线新建、编辑和发布文章。

1. 新建文章或修改现有文章，点击保存：内容先保存为草稿，不会立即更新公开网站。
2. 可以反复打开草稿继续完善；保存后若提示送审，选择稍后即可继续保留草稿。
3. 准备好后，在编辑器或发布流程中将文章标为待发布，再点击发布。GitHub Pages 构建成功后，文章才会上线。
4. 修改已发布文章时，旧版本继续在线，直到手动发布新版本。

后台启用 Sveltia CMS 的 Editorial Workflow：草稿保存在独立的 `cms/` 分支和拉取请求中，发布时才合并到 `main`。草稿不会展示在博客中，但仓库是公开的，草稿分支也可被访问，不能用来存放私密内容。

- 如使用细粒度 Token 登录，需要本仓库 Contents 和 Pull requests 读写权限；Token 不应写入任何仓库文件。
- 图片上传到 `assets/uploads`。
- 草稿与已发布状态由后台发布流程管理，不再通过文章中的布尔开关控制。
