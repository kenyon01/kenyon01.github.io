---
layout: post
title: MicroDuck 官方训练启动指南：从环境准备到 ONNX 回放
description: 识别 Pollen Robotics 的官方 MicroDuck 仓库，使用 mjlab、MuJoCo Warp 和 PPO 完成环境准备、小规模训练、日志查看、断点续训与
  ONNX 导出。
topic: robotics
chapter: microduck
chapter_order: 10
date: 2026-10-29
published: true
visibility: public
tags:
- Microduck
- 强化学习
- MuJoCo
- mjlab
- PPO
reading_time: 10
videos: []
html_report_url: ''
chapter_path:
- Microduck
---

MicroDuck 的官方训练入口是 **Pollen Robotics 的 `microduck_rl`**。它使用 mjlab、MuJoCo Warp 与 PPO；启动这条训练链路不需要安装 ROS 2 或 Isaac Sim。

本文于 **2026-10-29** 核对上游文档与源码，记录从准备环境到回放策略的操作路径。训练部分是基于源码整理的启动指南，**尚未在本文涉及的 Tesla T4 服务器上执行训练，不构成跑通报告或性能基准**。

## 1. 先确认仓库，避免走到另一套训练环境

| 仓库 | 负责什么 | 本文是否使用 |
| --- | --- | --- |
| [pollen-robotics/microduck](https://github.com/pollen-robotics/microduck) | 官方机器人主项目、实机控制与运行时 | 理解部署关系 |
| [pollen-robotics/microduck_rl](https://github.com/pollen-robotics/microduck_rl) | 官方策略训练、机器人仿真模型与导出工具 | **训练使用这个仓库** |
| [osrbot/microduck-ros2-isaac](https://github.com/osrbot/microduck-ros2-isaac) | 社区 ROS 2／Isaac 集成与教程 | 本文不采用此训练入口 |

服务器原先存在的是第三个仓库。它的 Isaac 版本要求只约束自身集成，不能据此判断官方训练缺少依赖。原始训练链路是：

```text
microduck_rl 中的任务与机器人模型
    → MuJoCo Warp 在 GPU 上并行采样
    → PPO 更新策略并保存 .pt 检查点
    → 官方导出工具生成 ONNX
    → 在 MuJoCo 中回放，再进入实机部署流程
```

项目用途与训练框架依据：[官方 README](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/README.md)。

## 2. 准备独立的 Python 环境

本文针对 Linux NVIDIA GPU 服务器。需要可工作的驱动、网络、Git 和 [uv](https://docs.astral.sh/uv/getting-started/installation/)。使用项目自己的 `.venv`，便于把训练依赖和已有演示环境分开管理。

核对时 `develop` 分支指向：

```text
bae39f5900b318f7e87fc485c30a31213cfa14eb
```

该版本的关键依赖如下。后续更新时应重新读取项目文件，而不是沿用这张表手工拼装环境。

| 项目 | 上游声明 |
| --- | --- |
| Python | `>=3.12, <3.13` |
| mjlab | `1.3.0` |
| Warp | `1.12.0` |
| PyTorch | `2.9.1` |
| BAM | 从上游指定的 Git 分支解析，由锁文件固定具体版本 |

依赖依据：[该提交的 pyproject.toml](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/pyproject.toml)。不要把演示环境中的 Python 3.11 或单独安装的旧版 RSL-RL 直接当成此项目的环境。

下文命令使用 `rtk proxy` 保留原始工具输出；未安装 RTK 的读者可去掉命令开头的 `rtk proxy`，直接运行后面的程序。所有训练命令都在 `microduck_rl` 仓库根目录执行。

先查看 GPU：

```bash
rtk proxy nvidia-smi
```

选择放置代码的目录后克隆项目：

```bash
rtk proxy git clone --branch develop https://github.com/pollen-robotics/microduck_rl.git
```

进入新建的 `microduck_rl` 目录。如需严格对齐本文版本，在全新克隆中切换到上述提交：

```bash
rtk proxy git checkout --detach bae39f5900b318f7e87fc485c30a31213cfa14eb
rtk proxy git rev-parse HEAD
rtk proxy env UV_HTTP_TIMEOUT=600 uv sync --locked --python 3.12
```

`--locked` 用来检查依赖声明与锁文件一致；它并不会将缺失依赖变成可离线安装。首次同步需要下载 Python 或较大的依赖包，应等待命令完成。若已有 Conda 环境处于激活状态，可以先退出该环境，再按本文建立项目环境。参数说明见 [uv 命令参考](https://docs.astral.sh/uv/reference/cli/#uv-sync)。

## 3. 确认 CUDA 与任务注册

依赖同步完成后，在项目环境中检查 Python、PyTorch 和 CUDA：

```bash
rtk proxy uv run python -c 'import sys, torch; print(sys.version); print("torch:", torch.__version__); print("CUDA runtime:", torch.version.cuda); print("CUDA available:", torch.cuda.is_available()); print("GPU:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "unavailable")'
rtk proxy uv run list-envs
rtk proxy uv run train Mjlab-Velocity-Flat-MicroDuck --help
```

继续训练前，应确认 `CUDA available` 为 `True`，环境列表中存在 `Mjlab-Velocity-Flat-MicroDuck`，且帮助信息可以解析该任务的参数。

`nvidia-smi` 能看到显卡与项目环境里的 CUDA 可用是两项检查。若前者正常、后者失败，优先核对实际使用的 Python、PyTorch 安装及驱动兼容性。[任务注册源码](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/src/mjlab_microduck/tasks/__init__.py)定义了本文使用的任务名。

## 4. 先运行一个小规模训练

第一次先检查完整训练链路：创建并行环境、采样、执行 PPO 更新、保存检查点。

```bash
rtk proxy uv run train Mjlab-Velocity-Flat-MicroDuck \
  --env.scene.num-envs 64 \
  --agent.max-iterations 5 \
  --agent.save-interval 1 \
  --agent.logger tensorboard \
  --agent.run-name smoke
```

这组 **64 个环境、5 次迭代**是本文给出的起始检查配置，尚未在 T4 上验证。若出现显存不足，可先降到 16 个环境；是否可用仍以运行结果为准。

选择 `tensorboard` 日志，使这条入门路径不必先配置 W&B 登录。参数含义如下：

| 参数 | 作用 |
| --- | --- |
| `--env.scene.num-envs` | 同时采样的仿真环境数量 |
| `--agent.max-iterations` | 本次交给学习器的迭代次数 |
| `--agent.save-interval` | 检查点保存间隔 |
| `--agent.logger` | 日志后端 |
| `--agent.run-name` | 添加到运行目录名中的标签 |

以上参数依据 [mjlab 1.3.0 训练入口](https://github.com/mujocolab/mjlab/blob/v1.3.0/src/mjlab/scripts/train.py)和 [RSL-RL 配置定义](https://github.com/mujocolab/mjlab/blob/v1.3.0/src/mjlab/rl/config.py)。

五次迭代只能用于检查流程，不能据此宣称鸭子已经学会走路。首次编译或初始化也不能直接当作稳定训练速度。

## 5. 找到训练产物并查看曲线

训练入口将运行目录放在：

```text
logs/rsl_rl/<experiment_name>/<时间戳>_<run_name>/
```

实际路径以本次终端输出为准。运行目录中应检查 `params/env.yaml`、`params/agent.yaml`、日志事件文件和 `model_*.pt`：

```bash
rtk proxy find logs/rsl_rl -type f -name 'model_*.pt'
rtk proxy find logs/rsl_rl -type f -name 'events.out.tfevents*'
```

**官方训练不能沿用社区 Isaac 包装脚本的 `model_final.pt` 或 `training_summary.json` 作为完成判据。** 应检查当前运行是否正常退出、检查点是否生成，并实际加载检查点回放。

在另一个终端中进入同一仓库，启动 TensorBoard：

```bash
rtk proxy uv run tensorboard --logdir logs/rsl_rl --host 127.0.0.1 --port 6006
```

如果训练在远程服务器，在自己的电脑上另开终端建立转发，将 `<user@host>` 替换成实际 SSH 目标：

```bash
rtk proxy ssh -N -L 6006:127.0.0.1:6006 <user@host>
```

然后访问本机 `http://127.0.0.1:6006/`。先确认曲线持续更新，再结合速度跟踪、跌倒、动作平滑等表现判断学习效果；单一奖励上升不能替代回放检查。

## 6. 再增加训练规模

小规模运行成功后，可以尝试 256 个环境：

```bash
rtk proxy uv run train Mjlab-Velocity-Flat-MicroDuck \
  --env.scene.num-envs 256 \
  --agent.max-iterations 4000 \
  --agent.logger tensorboard \
  --agent.run-name walk256
```

这也是需要实测的配置。观察显存、采样速度和训练稳定性后，再决定是否增加到 512、1024 或更高环境数。官方快速开始采用 4096 个环境，但不能把它直接当作所有显卡的合适设置。

本文核查 GPU 时，服务器是 Tesla T4，驱动 `580.178.04`，总显存约 15 GiB，已有演示进程占用约 4.3 GiB。这是 **2026-10-29 的现场快照**；启动前仍要重新运行 `nvidia-smi`，不能据此承诺可用环境数或训练耗时。

长时间运行可放入自己管理的 tmux 会话。先确认已有任务，再启动新训练，避免重复占用显卡。

## 7. 从指定检查点续训

在同一任务的日志目录下，显式选择旧运行目录和检查点：

```bash
rtk proxy uv run train Mjlab-Velocity-Flat-MicroDuck \
  --env.scene.num-envs 256 \
  --agent.resume True \
  --agent.load-run '<原运行目录名>' \
  --agent.load-checkpoint 'model_<编号>.pt' \
  --agent.max-iterations 1000 \
  --agent.logger tensorboard \
  --agent.run-name resume
```

替换尖括号中的占位符后再执行；`load-run` 填实验目录下的运行子目录名，检查点必须实际存在。启动时检查日志打印出的加载路径，避免默认匹配误选其他运行。这里的 1000 会传给学习器作为续训调用的迭代次数，不应理解成必然训练到全局第 1000 轮。[加载逻辑](https://github.com/mujocolab/mjlab/blob/v1.3.0/src/mjlab/scripts/train.py)在创建学习器后加载旧状态，再调用 `learn`。

## 8. 回放检查点

使用实际生成的本地 `.pt` 文件：

```bash
rtk proxy uv run play Mjlab-Velocity-Flat-MicroDuck \
  --checkpoint-file '/实际绝对路径/model_编号.pt' \
  --num-envs 1 \
  --viewer viser
```

`viser` 提供浏览器查看方式，适合远程服务器；按终端打印的地址和端口连接，必要时建立 SSH 转发。有图形桌面时可选择 `--viewer native`。

`--checkpoint-file`、`--num-envs` 和 viewer 选项依据 [mjlab 1.3.0 回放入口](https://github.com/mujocolab/mjlab/blob/v1.3.0/src/mjlab/scripts/play.py)。回放时观察能否站稳、是否跟随速度指令、是否持续跌倒，以及动作是否异常抖动。短训练的检查点可以被加载，并不代表已经形成可用步态。

## 9. 导出 ONNX，再用 CPU MuJoCo 复查

使用项目提供的导出工具，输入实际检查点路径：

```bash
rtk proxy uv run scripts/export.py Mjlab-Velocity-Flat-MicroDuck \
  --checkpoint-file '/实际绝对路径/model_编号.pt' \
  --onnx-file output.onnx \
  --num-envs 1
```

该版本的导出程序会创建仿真环境、加载检查点、写入 ONNX 和元数据，随后关闭环境并退出；导出本身不等于已经回放验收。导出时会把观测归一化纳入模型，避免手工转换时遗漏这一步。[导出实现](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/src/mjlab_microduck/export.py)是这一步的依据。

在有图形显示的 Linux 会话中，可进一步运行：

```bash
rtk proxy uv run scripts/infer_policy.py --walking output.onnx --new-cmd-obs
```

当前策略使用统一的 61 维观测，`--new-cmd-obs` 选择对应命令布局。该脚本打开原生 MuJoCo 窗口，普通无桌面的 SSH 会话需要另行提供显示环境；它与前面的浏览器 viewer 是两种查看方式。[推理脚本](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/scripts/infer_policy.py)支持键盘控制及 BAM 执行器模拟。

## 10. 启动中遇到问题时先查什么

| 现象 | 首先检查 |
| --- | --- |
| 提示 Python 版本不满足要求 | 是否由 uv 使用 Python 3.12 创建了项目环境 |
| `torch.cuda.is_available()` 为 `False` | 驱动、实际 Python 路径与项目中的 PyTorch 安装 |
| 找不到 MicroDuck 任务 | 是否在官方训练仓库根目录完成依赖同步，并运行 `uv run list-envs` |
| `train` 打印了无关程序的报错 | 是否使用 `uv run train`；项目声明了同名训练入口，系统 PATH 中也可能存在其他 `train` |
| CUDA 显存不足 | 先检查其他任务占用，再降低并行环境数 |
| 首次下载中断 | 核对具体下载错误；必要时延长 uv 网络超时后重新同步 |
| SSH 下打不开原生窗口 | 训练先不录制视频；回放优先尝试 `viser` 并转发实际端口 |
| 找不到 `model_final.pt` | 查找官方训练产生的 `model_*.pt`，不要套用社区 Isaac 项目的文件名 |
| 奖励在涨，动作却不合理 | 保留运行配置和检查点，结合回放检查奖励与行为 |

关于同名 `train` 的安装与 PATH 问题，官方专门在 [train_cli.py](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/src/mjlab_microduck/train_cli.py)中解释了入口保留原因。

## 11. 本文的验证范围

本次完成了 GPU 服务器连接、硬件状态查看、既有仓库来源确认，以及官方 README、依赖声明、任务注册和训练／回放／导出参数的源码核对。

本次没有安装官方训练环境、没有执行 PPO 训练、没有生成或回放新检查点。因此，本文的小规模和正式训练配置是待运行验证的操作方案，训练速度、显存峰值和最终步态质量仍待实测。

实际运行后，应补充对应的代码提交、锁文件、完整启动参数、环境版本、日志路径和检查点，再记录回放观察。这样后续可以清楚区分“启动方法已核对”“训练链路已跑通”和“策略行为达到要求”。
