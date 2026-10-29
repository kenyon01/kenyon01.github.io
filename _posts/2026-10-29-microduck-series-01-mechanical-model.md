---
layout: post
title: MicroDuck 从零到真机（01）：机械建模、关节约定与 MJCF 导出
description: 从 Onshape 装配拆解 MicroDuck 的运动学、惯量、碰撞与传感器，建立 CAD 到 MuJoCo 模型的可检查接口。
date: 2026-10-29
topic: robotics
chapter: microduck
chapter_order: 20
tags:
- Microduck
- 机械建模
- Onshape
- MJCF
- MuJoCo
reading_time: 12
visibility: public
published: true
chapter_path:
- Microduck
---

[系列目录](/blog/2026/10/29/microduck-series-00-roadmap/) · 上一篇：[工程路线](/blog/2026/10/29/microduck-series-00-roadmap/) · 下一篇：[创建仿真环境](/blog/2026/10/29/microduck-series-02-simulation-environment/)

这一篇的目标，是得到一份“能解释为什么这样动”的机器人模型。外观网格只是其中一层；真正影响训练的，还有关节坐标、质量分布、惯量、接触形状与执行器能力。

## 1. 从官方装配开始，而不是重新拼一个相似外形

官方训练仓库把模型放在 `src/mjlab_microduck/robot/microduck/`，包括导出配置、网格、MJCF、传感器和场景。`config_mjcf_walk.json` 内的 `url` 指向实际使用的 Onshape 装配；应从[这个配置](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/src/mjlab_microduck/robot/microduck/config_mjcf_walk.json)进入 CAD，避免误用外观相似但关节约定不同的版本。

如果要改腿长、脚底或电池安装位置，先复制装配到自己的工作区，记录修改后的 Onshape 版本、零件材料和修改原因。上游配置中的工作区 URL 会随 CAD 更新而变化；复现实验应同时保存导出后的 XML、网格及其哈希。

机械设计时建议先整理四张表：零件／材料表、连杆质量表、关节表、装配零位表。螺钉、线束、外壳和电池的位置虽不一定需要逐个形成动力学连杆，却会影响总质量和重心。

## 2. 区分运动学链与外观零件

MuJoCo 的 `body` 描述刚体间的父子关系，`joint` 描述允许的相对运动，`geom` 描述外观或碰撞。一个刚体可以包含多个网格，不必每块外壳都独立成为可动连杆。

建模时依次回答：

1. 哪些零件在运动时保持刚性连接？将其合并看作一个刚体。
2. 哪些连接真的有转动自由度？检查转轴位置、方向与机械行程。
3. 哪些零件只是随动或被动连接？不要给它们分配独立策略动作。
4. 实物怎样定义零位？关节正方向与舵机编码器增长方向如何转换？

关节轴不是显示用箭头。把右腿的正方向照搬左腿，可能造成同一组动作让两腿朝相反的物理方向运动。应逐关节施加小幅正负位移，观察末端运动并记录结果。

## 3. 固定 14 维策略关节顺序

本系列采用官方前馈策略的 14 维动作约定：

| 动作下标 | 关节 |
| --- | --- |
| 0–4 | 左腿：hip_yaw、hip_roll、hip_pitch、knee、ankle |
| 5–8 | neck_pitch、head_pitch、head_yaw、head_roll |
| 9–13 | 右腿：hip_yaw、hip_roll、hip_pitch、knee、ankle |

来源是[关节与对称映射](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/src/mjlab_microduck/tasks/symmetry.py)。真机另有嘴部等硬件控制，不能把“实物舵机数量”直接等同于“策略动作维度”。

轮子、联动或齿隙模型可能增加被动关节。官方约定使用 `passive_` 前缀，主动关节选择排除它们。此时 XML 中的原始位置索引可能改变，奖励、观测和动作应按名称解析；不要继续把任意第 9 个 `qpos` 当成右髋。

## 4. 质量、重心与惯量为什么必须一起检查

只有质量、没有合理惯量，模型仍可能以错误的速度翻转。只匹配总质量、却把电池质量放在错误位置，也会改变站立与恢复难度。

```text
总质量 M = Σ m_i
重心 p_com = (Σ m_i × p_i) / M
```

这些计算要求把各部件的重心转换到同一坐标系。惯量还涉及方向变换和平行轴项，不能只对三列数字做加法。检查导出器使用的材料密度、惯量单位与惯性坐标系；用 CAD 和称重结果互相校验。

建议记录空壳、舵机、电池和完整装配的质量；实际打印件的填充率、胶、线束和加装摄像头都会造成差异。教学上的质量预算不是官方 BOM，改造机器人应以自己的测量为准。

在静态站姿下，先看重心投影与脚底支撑区域，再看仿真是否能稳定保持。只检查机身高度会漏掉侧躺或靠头支撑的状态，应同时检查姿态、足接触和关节受力。

## 5. 碰撞模型按任务选择

| 模型 | 主要用途 | 需要注意 |
| --- | --- | --- |
| `robot_walk.xml` | 日常行走训练 | 采用精简接触，含脚底及特定自碰撞设置 |
| `robot_groundcontact.xml` | 需要身体接触地面的任务 | 保留一组经过选择的接触部件 |
| `robot_allcollisions.xml` | 需要更完整部件碰撞的实验 | 接触更复杂，成本和数值稳定性需评估 |
| rollers／backlash 变体 | 轮滑或齿隙实验 | 被动关节与反馈语义发生变化 |

具体任务使用哪个模型，以[机器人配置工厂](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/src/mjlab_microduck/robot/microduck_constants.py)和该任务的工厂函数为准。不能只看文件名判断两个实验拥有相同物理条件。

视觉模型通常适合保留细节，碰撞模型更关心形状、支撑和接触。过多细碎网格会增加接触计算；过度简化脚底、髋部或头部，则可能允许实物做不到的支撑方式。

## 6. 在独立目录重新导出

以下步骤在 Linux 上执行，假设已克隆官方训练仓库并进入根目录。命令中的 `rtk proxy` 可在没有 RTK 的环境中去掉。

```bash
rtk proxy mkdir -p ../microduck-walk-export
rtk proxy cp src/mjlab_microduck/robot/microduck/config_mjcf_walk.json ../microduck-walk-export/config.json
rtk proxy cp src/mjlab_microduck/robot/microduck/joints_properties.xml ../microduck-walk-export/
rtk proxy cp src/mjlab_microduck/robot/microduck/sensors.xml ../microduck-walk-export/
rtk proxy cp src/mjlab_microduck/robot/microduck/additional.xml ../microduck-walk-export/
```

先在导出目录的 `config.json` 中填写自己的 CAD 装配 URL；Onshape 认证使用导出器支持的环境变量或本机 `.env`，不要写进文章、XML 或代码仓库。安装与认证见 [onshape-to-robot 文档](https://onshape-to-robot.readthedocs.io/en/latest/getting_started.html)。

```bash
rtk proxy onshape-to-robot ../microduck-walk-export
```

这是待执行的导出方案，本文没有重新导出模型。上游配置包含后处理命令，涉及脚底碰撞命名、机身初始位置等；应检查执行结果，而不是只看到生成 XML 就覆盖训练模型。导出器新版本采用 snake_case 配置键，并兼容旧式 camelCase；使用前核对[配置参考](https://onshape-to-robot.readthedocs.io/en/latest/config.html)。

## 7. 为模型建立最小验收

在可以使用 MuJoCo 的独立 Python 环境中，先编译 MJCF：

```bash
rtk proxy python -c 'import mujoco; m=mujoco.MjModel.from_xml_path("../microduck-walk-export/robot_walk.xml"); print("nq",m.nq,"nv",m.nv,"nu",m.nu); print("total mass",m.body_mass.sum())'
```

`nq`、`nv` 与 `nu` 不是同一个数量：浮动基座及被动关节会影响它们。之后再检查关节名称、轴、限位、主动关节选择和 HOME，避免把维数不等简单判成错误。

| 检查 | 应留下的证据 |
| --- | --- |
| 关节正负方向 | 单关节小幅运动记录，与实物方向表一致 |
| HOME | 正侧视图、姿态、足接触，而不只是高度 |
| 质量和重心 | CAD 统计与实际测量差异 |
| 碰撞 | 足底接触正常，关键部件没有明显穿透 |
| 数值稳定性 | 静置与小扰动后没有 NaN 或离谱速度 |
| 执行器 | 明确是 XML 位置控制还是训练中的 BAM 模型 |

XML 编译成功并不代表上述检查已经通过。`joints_properties.xml` 中的旧 PD 参数也不能替代后续 BAM 执行器配置；下一篇会把静态机器人接入真正的训练任务。

模型语法可查 [MuJoCo MJCF 参考](https://mujoco.readthedocs.io/en/stable/XMLreference.html)。复用模型或网格时还需检查仓库中的 `LICENSE-MODELS.md`，代码与三维资源不一定使用同一许可证。
