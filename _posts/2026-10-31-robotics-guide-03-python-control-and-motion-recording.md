---
layout: post
title: 第3章 用 Python 控制与记录机器人运动
description: 为第二章的教学机械臂加入位置执行器，按名称读取状态、发送关节目标，建立有明确时间关系的控制与记录循环。用实测曲线分析误差，再分别验证动作回放与状态重放，附完整实验包。
date: 2026-10-31
topic: robotics
chapter: robotics-book-03
chapter_order: 1
tags:
- 具身智能
- 机器人入门实战
- MuJoCo
- 关节控制
- 轨迹记录
reading_time: 3
visibility: public
published: true
chapter_path:
- 机器人入门实战
- 第3章 用 Python 控制与记录机器人运动
---

第二章的机械臂已经出现在桌面上，但它还没有执行器。我们为连杆开启重力补偿，先把模型加载、物理计算和观察显示这些事情检查清楚。这一章撤掉那层辅助设定，给三个关节接上位置伺服，再从 Python 发出真正参与物理计算的控制输入。

本章的第一个目标很小：让底座转动一段角度，再回到起始方向。之后，让肩关节和肘关节一起运动。每次运行，都保留“什么时候要求它去哪儿”“随后测到了什么”“为什么停止”这三类信息。

如果画面中的机械臂转了一下，你还需要能从记录里指出：转的是哪个关节，指令用什么单位，位置误差怎样变化，最后是否真的回来了。等这些关系清楚，再去讨论末端移动和抓取，程序才有可以核对的依据。

本章继续使用 **Python 3.13、MuJoCo 3.3.7、NumPy 2.3.4**，绘图增加 **Matplotlib 3.10.7**。它们是随文实验冻结的版本，不是最新版声明。示例仍然只连接仿真，不连接真实机械臂。

先下载[第三章完整实验包](/article-media/robotics-guide-ch03/robotics-ch03.zip)，解压得到 `robotics-ch03` 文件夹。模型文件已经包含在包内，不要求你先把第二章的目录拼装过来。进入该文件夹，在 PowerShell 中准备环境：

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe inspect_state.py
```

Linux 中的对应解释器路径为 `./.venv/bin/python`，先用已经安装的 Python 3.13 创建环境。本章主线沿用 PowerShell 写法；环境创建和包下载的排错可回看第二章，不需要为关节控制另外安装训练框架。

本章按小节拆分。选择下面的标题进入阅读，小节末尾可以继续前后翻页。

## 3.1 读取机器人当前状态

### 3.1.1 按名称查找关节、执行器与末端

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-01-01/)

### 3.1.2 读取关节位置、速度和仿真时间

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-01-02/)

### 3.1.3 检查数据形状、索引与数值范围

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-01-03/)

## 3.2 发出第一条控制指令

### 3.2.1 理解执行器控制量的含义

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-02-01/)

### 3.2.2 设置单关节目标并观察响应

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-02-02/)

### 3.2.3 限位、动作幅度与停止条件

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-02-03/)

## 3.3 从单关节走向多关节运动

### 3.3.1 固定关节顺序与动作向量

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-03-01/)

### 3.3.2 组织控制循环与退出逻辑

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-03-02/)

### 3.3.3 比较目标关节值与实际关节值

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-03-03/)

## 3.4 保存与回放一次实验

### 3.4.1 记录动作、状态、时间与配置

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-04-01/)

### 3.4.2 绘制轨迹和跟踪误差曲线

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-04-02/)

### 3.4.3 回放动作与重放状态的区别

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-04-03/)

## 3.5 实验 完成一段可追溯的关节运动

### 3.5.1 编写回到初始姿态的程序

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-05-01/)

### 3.5.2 改变目标幅度并比较执行结果

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-05-02/)

### 3.5.3 诊断无响应、突跳与越界问题

[阅读本小节 →](/blog/2026/10/31/robotics-book-03-05-03/)

## 本章验证记录与资料

上述示例于 **2026年10月31日** 在 Windows 11、CPython 3.13.5、MuJoCo 3.3.7、NumPy 2.3.4、Matplotlib 3.10.7 环境验证。单关节与两种多关节幅度均完成500个控制区间，时间对齐、非法目标拒绝与稳定返回检查通过；同初态动作回放的关节差为0，初始偏航扰动后的步进差约0.09448 rad。

图3-2、图3-3来自随文程序实际生成的数值记录。测试采用无窗口模式，未把跨平台行为、真实设备表现或查看器鼠标操作列为通过项。

- [MuJoCo 3.3.7：Python接口](https://mujoco.readthedocs.io/en/3.3.7/python.html)，查看按名称访问、数组语义与被动查看器。
- [MuJoCo 3.3.7：执行器属性](https://mujoco.readthedocs.io/en/3.3.7/XMLreference.html#actuator)，核对位置伺服、控制范围、输出限制与积分器设置。
- [MuJoCo 3.3.7：状态与仿真API](https://mujoco.readthedocs.io/en/3.3.7/APIreference/APIfunctions.html)，查看状态保存恢复和物理更新接口。
- [MuJoCo 3.3.7：执行器计算模型](https://mujoco.readthedocs.io/en/3.3.7/computation/index.html#actuation-model)，进一步理解控制输入、传动与作用生成。

[上一篇：第2章 搭建开发环境与第一个仿真](/blog/2026/10/30/robotics-guide-02-environment-and-first-simulation/) · [下载第三章完整实验包](/article-media/robotics-guide-ch03/robotics-ch03.zip)

**所属书稿：《机器人入门实战：从仿真控制到具身智能》 · 第一篇 建立第一个机器人闭环**
