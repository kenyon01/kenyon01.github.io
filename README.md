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
published: false
---
```

推送到 `main` 后，GitHub Pages 会自动构建；准备公开时将 `published` 改为 `true`。

## 在线写作后台

访问 [`/admin/`](https://kenyon01.github.io/admin/)，使用 GitHub 登录，即可在线新建、编辑和发布文章。

1. 新建文章，点击保存：文章显示为“未上架”，不会出现在公开博客。
2. 在文章列表点击“编辑”继续完善，保存不会改变上架状态。
3. 准备好后，在列表点击“上架”。状态变成“已上架”，GitHub Pages 构建成功后上线。
4. 点击“下架”可隐藏文章，内容保留，可随时编辑并重新上架。
5. 已上架文章的编辑保存会更新公开内容；如需先完善再上线，请先下架。

后台直接保存到 `main`，通过 Jekyll 的 `published` 字段控制可见性，不使用发布工作流。新文章默认 `false`；上架改为 `true`，下架改为 `false`。列表状态反映已保存的设置，网站更新需要等待 GitHub Pages 构建。仓库公开，未上架文章仍可从仓库查看，不能存放私密内容。

- 如使用细粒度 Token 登录，需要本仓库 Contents 和 Pull requests 读写权限；Token 不应写入任何仓库文件。
- 图片上传到 `assets/uploads`。
- 列表按钮管理上下架，编辑器中不显示可见性开关。

## 后台定制维护

后台基于 Sveltia CMS 0.218.0，固定源码提交 `00c44da6b919d15e559f51ca54cd96237ae556ee`。定制补丁位于 `cms-customization/publication.patch`，只增加文章列表操作与状态，复用原生保存、冲突检测与登录。

使用 Node.js 24.19+ 和 pnpm，运行 `powershell -File cms-customization/build.ps1` 可重建 `admin/vendor/sveltia-cms.js`。构建目录 `.cms-build` 不提交。保留上游 MIT 许可证；语言包等按上游固定版本从 CDN 加载。
