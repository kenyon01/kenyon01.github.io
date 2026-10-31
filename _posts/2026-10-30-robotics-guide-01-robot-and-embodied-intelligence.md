---
layout: post
title: 第1章 认识机器人与具身智能
description: 从一个关节和一次抓取放置出发，认识机械结构、执行器、传感器、状态与动作，理解反馈、时间尺度，以及机器人怎样判断任务真正完成。附系统图设计练习与参考答案。
date: 2026-10-30
topic: robotics
chapter: robotics-book-01
chapter_order: 1
tags:
- 具身智能
- 机器人入门实战
- 机器人基础
- 反馈控制
reading_time: 3
visibility: public
published: true
chapter_path:
- 机器人入门实战
- 第1章 认识机器人与具身智能
---

桌上放着一个物体，旁边有一只盒子。你想让机械臂把物体夹起来，放进盒子。这件事用一句话就能说清，真正执行时却会连续遇到问题：物体在哪里？夹爪应该从哪个方向靠近？夹爪合上以后，物体是否跟着抬起来？到了盒子上方，什么时候才能松手？

如果中途有人把物体挪开，程序还会不会沿着原来的路线继续走？如果夹爪已经闭合，物体却留在桌上，系统会怎样发现？

这些问题把机器人系统里的几条线连在了一起：机械结构决定它能怎样动，执行器提供运动所需的力，传感器提供测量，程序根据测量安排下一步。学习机器人，可以先沿着这几条线走一遍。

本章不要求你准备机械臂，也不用先安装仿真软件。我们从常见的关节和传感器讲起，最后为一个抓取放置任务画出系统图、列出接口，并写下成功与失败的判断依据。下一章再把这张图逐步变成可以运行的仿真。

本章按小节拆分。选择下面的标题进入阅读，小节末尾可以继续前后翻页。

## 1.1 从一个关节认识机器人

### 1.1.1 机械结构、关节与自由度

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-01-01/)

### 1.1.2 执行器怎样让关节运动

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-01-02/)

### 1.1.3 传感器怎样告诉我们发生了什么

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-01-03/)

## 1.2 理解机器人的输入与输出

### 1.2.1 观测、状态与任务目标

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-02-01/)

### 1.2.2 动作、控制指令与实际响应

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-02-02/)

### 1.2.3 位置、速度、力矩与常用单位

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-02-03/)

## 1.3 建立观察与行动的闭环

### 1.3.1 从开环执行到反馈控制

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-03-01/)

### 1.3.2 物理步长、控制周期与决策周期

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-03-02/)

### 1.3.3 指令执行成功与任务完成的区别

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-03-03/)

## 1.4 从机器人控制走向具身智能

### 1.4.1 手工规则、控制器与学习策略

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-04-01/)

### 1.4.2 感知、规划、控制与学习怎样协作

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-04-02/)

### 1.4.3 机械臂、移动机器人与行走机器人的共性

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-04-03/)

## 1.5 实验 为第一个任务画出系统图

### 1.5.1 把抓取放置任务拆成可观察的步骤

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-05-01/)

### 1.5.2 标注每个模块的输入、输出与单位

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-05-02/)

### 1.5.3 本章练习与完成检查

[阅读本小节 →](/blog/2026/10/30/robotics-book-01-05-03/)

## 延伸阅读与资料

- [Modern Robotics：刚体的构型与自由度](https://modernrobotics.northwestern.edu/nu-gm-book-resource/2-1-degrees-of-freedom-of-a-rigid-body/)。理解用独立参数描述构型的含义。
- [Modern Robotics：机器人的自由度](https://modernrobotics.northwestern.edu/nu-gm-book-resource/2-2-degrees-of-freedom-of-a-robot/)。进一步了解关节、约束与机构自由度。
- [MuJoCo：执行器与模型参数](https://mujoco.readthedocs.io/en/stable/XMLreference.html#actuator)。后续使用仿真时，对照模型配置检查控制输入的含义。
- [Gymnasium：环境接口](https://gymnasium.farama.org/api/env/)。了解观察、动作、辅助信息以及终止与截断的区分。
- [NIST：国际单位制中的基本量与导出量](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-4-two-classes-si-units-and-si-prefixes)。查阅本章出现的单位符号。
- [MIT Underactuated Robotics](https://underactuated.mit.edu/intro.html)。进一步认识机械动力学与控制之间的关系。

**所属书稿：《机器人入门实战：从仿真控制到具身智能》 · 第一篇 建立第一个机器人闭环**
