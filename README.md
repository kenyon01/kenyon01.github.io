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

访问 [`/admin/`](https://kenyon01.github.io/admin/)，使用具有本仓库 Contents 读写权限的 GitHub 细粒度 Token 登录，即可在线新建、编辑和发布文章。

- Token 只在登录时由 Sveltia CMS 使用，不应写入任何仓库文件。
- 图片上传到 `assets/uploads`。
- 关闭“发布”开关可以保存草稿；Jekyll 不会将其发布到网站。
