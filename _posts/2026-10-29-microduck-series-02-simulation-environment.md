---
layout: post
title: MicroDuck 从零到真机（02）：从仿真场景到自己的强化学习环境
description: 用 mjlab 的官方 MicroDuck 环境说明场景、观测、动作、奖励、重置、终止与任务注册，并给出一个低速教学任务的配置示例。
date: 2026-10-29
topic: robotics
chapter: microduck
chapter_order: 30
tags:
- Microduck
- mjlab
- 仿真环境
- MDP
reading_time: 13
visibility: public
published: true
chapter_path:
- Microduck
---

[系列目录](/blog/2026/10/29/microduck-series-00-roadmap/) · 上一篇：[机械建模](/blog/2026/10/29/microduck-series-01-mechanical-model/) · 下一篇：[训练参数](/blog/2026/10/29/microduck-series-03-training-configuration/)

把机器人放在地面上，可以得到一个物理场景。要让强化学习工作，还必须规定它能看见什么、控制什么、追求什么，以及什么时候重新开始。这些约定共同组成训练环境。

## 1. 环境不是一个窗口，而是一个决策问题

一个控制周期可以拆成：

```text
读取物理状态 → 构造 actor 观测 → 策略产生动作
  → 动作变成关节目标 → 执行若干物理步
  → 计算奖励、终止与统计 → 必要时重置对应环境
```

在强化学习语言中，状态转移来自仿真器，动作来自策略，奖励来自任务设计。真实完整状态与 actor 可见观测可以不同：例如仿真中知道机身真实线速度，但实物没有同等传感器时，就不应让部署用的 actor 依赖它。

官方入口是[行走环境工厂](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/src/mjlab_microduck/tasks/microduck_velocity_env_cfg.py) `make_microduck_velocity_env_cfg(play=False, rough=False)`，它在 mjlab 速度任务模板上增加 MicroDuck 的模型、传感器、指令和鲁棒性设置。

## 2. 先理解环境配置的八个部分

| 部分 | 在 MicroDuck 中做什么 | 改动时先问什么 |
| --- | --- | --- |
| scene | 机器人、地形、并行世界与传感器 | 碰撞与模型版本是否正确？ |
| observations | 角速度、重力、关节、历史动作和指令 | 实物能否按相同顺序提供？ |
| actions | 把 14 维网络输出转换成关节位置目标 | 顺序、HOME 和尺度是否匹配？ |
| commands | 采样速度、头部与身体姿态要求 | 训练是否覆盖停止与转向？ |
| rewards | 速度跟踪、姿态、足接触与平滑等项 | 真正想要的行为是否得分更高？ |
| events | 启动、reset 和定时扰动 | 随机化是否每次从基准重新采样？ |
| terminations | 超时、跌倒、越界与数值异常 | 正常任务结束和失败是否区分？ |
| curriculum | 逐步改变权重和随机范围 | 难度上升是否早于技能形成？ |

查看器配置只影响观察实验的方式；它不能替代任务定义。

## 3. 61 维 actor 观测是部署接口

本系列使用的前馈 actor 布局如下，下标为左闭右开：

| 下标 | 内容 | 维数 |
| --- | --- | --- |
| `[0:3]` | 机身坐标系角速度 | 3 |
| `[3:6]` | 机身坐标系中的投影重力 | 3 |
| `[6:20]` | 相对 HOME 的关节位置 | 14 |
| `[20:34]` | 关节速度 | 14 |
| `[34:48]` | 上一策略动作 | 14 |
| `[48:51]` | 速度指令：vx、vy、yaw rate | 3 |
| `[51:55]` | 头部四个关节的姿态指令 | 4 |
| `[55:61]` | 身体六维姿态指令 | 6 |

来源是[观测映射](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/src/mjlab_microduck/tasks/symmetry.py)与行走工厂。actor 去掉了真实机身线速度与地形扫描；critic 可以读取额外的仿真信息来帮助学习。不要为了让训练容易，把这些特权信息悄悄加入 actor。

即使一个任务暂时不用身体姿态指令，也要保持相应槽位与顺序。删掉六个输入，再在真机端补零，无法恢复已经改变的网络接口。关节角和角速度分别使用 rad、rad/s；坐标系、正方向与上一动作语义也必须记录。

## 4. 动作、执行器与时间尺度

行走任务采用关节位置目标，概念上可写为：

```text
q_target = q_HOME + action_scale × action
```

它不是“网络直接输出电机电压”。BAM 模拟执行器根据目标、反馈和自身模型计算动力学响应。行走工厂把动作尺度设为 `1.0`；真机运行时的尺度必须另行核对，不能因为两边都是 14 维就视为一致。

mjlab 1.3.0 的[速度任务模板](https://github.com/mujocolab/mjlab/blob/v1.3.0/src/mjlab/tasks/velocity/velocity_env_cfg.py)使用物理步长 `0.005 s`、`decimation=4`：每个策略周期包含四个物理步，因此控制周期为 `0.02 s`，即 50 Hz。修改其中任何一项，都要重新检查延迟、episode 长度、奖励时间尺度和真机控制频率。

## 5. 接触传感器与 reset 要能回答具体问题

官方行走环境通过左右脚的接触名称识别地面支撑，还配置自碰撞与足部地形高度传感器。接触奖励依赖这些命名，机械导出时丢掉脚底名称，可能让训练“正常运行”却一直看不到正确接触。

reset 至少应恢复基座状态、关节状态、动作历史与任务内部计数。只重置可视姿势而保留上一回合的速度、动作缓存或锁存标记，会造成难以解释的初始冲击。

跌倒终止与翻滚任务也有冲突：日常行走可以把大幅倾倒作为失败，翻滚却必须经过倒置姿态。新任务应根据动作本身定义终止，不应完整复制行走任务的跌倒规则后再责怪算法学不会翻身。

## 6. 创建一个自己的低速行走任务

下面是教学示例，基于上述固定版本，未执行训练。它复用官方工厂，只缩小速度范围，便于理解注册流程；不声称低速范围一定更容易学，也不把它叫作已经调好的配方。

新建 `src/mjlab_microduck/tasks/microduck_lab_walk_env_cfg.py`：

```python
from .microduck_velocity_env_cfg import make_microduck_velocity_env_cfg


def make_lab_walk_env_cfg(play: bool = False):
    cfg = make_microduck_velocity_env_cfg(play=play, rough=False)
    command = cfg.commands["twist"]
    command.ranges.lin_vel_x = (-0.2, 0.2)
    command.ranges.lin_vel_y = (-0.1, 0.1)
    command.ranges.ang_vel_z = (-0.5, 0.5)
    return cfg
```

然后在现有 `tasks/__init__.py` 的末尾增加注册，不替换原来的任务：

```python
from copy import deepcopy
from .microduck_lab_walk_env_cfg import make_lab_walk_env_cfg

lab_walk_agent_cfg = deepcopy(MicroduckRlCfg)
lab_walk_agent_cfg.experiment_name = "microduck_lab_walk"
lab_walk_agent_cfg.run_name = "lab_walk"

register_mjlab_task(
    task_id="Mjlab-LabWalk-Flat-MicroDuck",
    env_cfg=make_lab_walk_env_cfg(),
    play_env_cfg=make_lab_walk_env_cfg(play=True),
    rl_cfg=lab_walk_agent_cfg,
    runner_cls=MicroduckOnPolicyRunner,
)
```

这里复用该文件已经导入的 `MicroduckRlCfg`、`register_mjlab_task` 和已定义的 runner。深复制 agent 配置是为了让新实验的名称和参数独立。训练与回放使用同一任务的两份配置，回放配置的扰动也应单独核对；`play=True` 不等于“所有随机化都关闭”。

安装好项目依赖后，在训练仓库根目录运行：

```bash
rtk proxy uv run list-envs
rtk proxy uv run train Mjlab-LabWalk-Flat-MicroDuck --help
rtk proxy uv run train Mjlab-LabWalk-Flat-MicroDuck --env.scene.num-envs 64 --agent.max-iterations 5 --agent.save-interval 1 --agent.logger tensorboard
```

注册 API 以[官方任务注册文件](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/src/mjlab_microduck/tasks/__init__.py)为准。今后上游改动 runner 或工厂接口时，这段教学代码也要随之核对。

## 7. 环境的完成检查

先用单环境检查 reset 与动作响应，再使用小规模并行训练检查奖励和数值稳定性。至少保存：actor 输入维数、动作维数、各终止条件触发样本、接触读数、初始姿态，以及随机化配置。

特别检查全零指令、正向行走、后退、横移与原地转向。连续均匀采样几乎不会恰好产生完整的零指令；若只依赖均匀分布，训练可能没有学到实机最常用的“停下来”。

环境测试通过后，才进入下一篇讨论的采样规模与 PPO 参数。窗口打开、机器人有运动，都还不是环境正确的充分证据。
