---
layout: page
title: 文章
kicker: FIELD NOTES
description: 记录研究、构建与学习过程。不是标准答案，是持续更新的现场笔记。
permalink: /blog/
---

<div class="archive">
{% for post in site.posts %}
  <a class="archive-item" href="{{ post.url | relative_url }}">
    <div class="archive-date">
      <strong>{{ post.date | date: '%d' }}</strong>
      <span>{{ post.date | date: '%Y.%m' }}</span>
    </div>
    <div class="archive-copy">
      <h2>{{ post.title }}</h2>
      <p>{{ post.description | default: post.excerpt | strip_html | truncate: 120 }}</p>
      {% if post.tags %}<div class="tag-row">{% for tag in post.tags %}<span>{{ tag }}</span>{% endfor %}</div>{% endif %}
    </div>
    <span class="post-arrow" aria-hidden="true">↗</span>
  </a>
{% endfor %}
</div>

