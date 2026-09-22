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

