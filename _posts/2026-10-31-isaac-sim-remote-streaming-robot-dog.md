---
layout: post
title: 从零配置 Isaac Sim：远程串流与机械狗仿真入门
description: 从 Ubuntu GPU 环境、Isaac Lab 安装到 Windows WebRTC 串流，逐步认识界面、运行 ANYmal 机械狗并接入键盘控制。
date: 2026-10-31
topic: robotics
chapter: chapter-79b1d5cfe41b
chapter_order: 50
tags:
- Isaac Sim
- Isaac Lab
- 机械狗
- 仿真
- 远程串流
reading_time: 18
visibility: public
published: true
chapter_path:
- 第二章 · 仿真与接触
---

## 先看我们要搭建什么

一台 Ubuntu GPU 服务器运行 Isaac Sim 和 Isaac Lab；Windows 电脑运行 NVIDIA 的 WebRTC 客户端，通过可信的内网或 VPN 接收画面。仿真、物理计算和渲染都在服务器上完成，Windows 主要负责显示和输入。

这篇记录的实验日期是 **2026 年 10 月 31 日**。实际环境是 Ubuntu 22.04、Tesla T4（15 GB 显存）、Python 3.11、Isaac Sim 5.1.0 和 Isaac Lab 2.3.2。已经验证 ANYmal C 机械狗场景能运行，Windows 客户端能显示其画面；键盘控制代码已经接入，但**尚未完成每个方向的端到端动作验证**。首次安装步骤来自官方文档，不代表本次在这台已有环境上重新安装过。

> 版本提示：本文复现的是已有的 5.1 环境；NVIDIA 已将 5.1 标记为不再支持。新项目应先查看[当前 Isaac Sim 安装文档](https://docs.isaacsim.omniverse.nvidia.com/latest/installation/index.html)，并选择与之匹配的 Isaac Lab 版本，不能直接混用新版命令。

## 第一步：了解几个名字

| 名称 | 作用 |
| --- | --- |
| Isaac Sim | NVIDIA 的机器人仿真软件，负责场景、渲染、物理和机器人模型。 |
| Isaac Lab | 建立在 Isaac Sim 上的机器人学习与仿真框架，提供环境、传感器、任务和训练工具。 |
| WebRTC Streaming Client | Windows 上的画面客户端，连接服务器上的 Isaac Sim。 |
| USD | 场景文件格式，可描述机器人、地形、灯光等。 |
| ANYmal C | 本文演示的四足机器人模型；其他示例还包括 Unitree Go1、Go2 等。 |

下面的服务器命令在 Ubuntu 的终端执行；Windows 命令在 PowerShell 执行。文中 `<GPU服务器地址>` 和 `<用户名>` 是需要替换的占位符，不要原样输入。

## 第二步：检查服务器

在 Windows PowerShell 登录服务器：

```powershell
ssh <用户名>@<GPU服务器地址>
```

在服务器检查系统、GPU、内存和磁盘：

```bash
cat /etc/os-release
nvidia-smi
free -h
df -h
```

`nvidia-smi` 应能列出 NVIDIA 显卡和驱动。本文机器的 T4 成功渲染了演示，但它不等于 NVIDIA 5.1 推荐配置的性能保证。NVIDIA 5.1 的[系统要求](https://docs.isaacsim.omniverse.nvidia.com/5.1.0/installation/requirements.html)列出至少 32 GB 内存、16 GB 显存等参考配置；复杂场景可能需要更多资源。串流需要支持 NVENC 的 GPU，A100 不支持此串流方式。

## 第三步：选择复用还是全新安装

### 已有环境：先检查，不要覆盖

如果服务器已经运行其他仿真，先找到已有环境，并检查是否有任务正在占用 GPU：

```bash
nvidia-smi
conda env list
```

本次机器已有一个独立的 Conda 环境和 Isaac Lab 源码，因此直接复用。不要为了这篇教程覆盖已有环境、升级依赖，或结束不属于自己的任务。后续命令中的路径应替换为自己的实际安装路径。

### 全新安装：创建独立环境

以下是 Linux x86_64 上按官方 5.1/2.3.1 文档整理的安装路径；假定 Miniconda 已安装，且系统和驱动符合要求。5.1 pip 包需要 Python 3.11 和 GLIBC 2.35 及以上。完整前提与许可请先阅读 [Isaac Lab 2.3.1 pip 安装文档](https://isaac-sim.github.io/IsaacLab/v2.3.1/source/setup/installation/pip_installation.html)。

```bash
conda create -n isaaclab python=3.11
conda activate isaaclab
python -m pip install --upgrade pip
python -m pip install 'isaacsim[all,extscache]==5.1.0' --extra-index-url https://pypi.nvidia.com
python -m pip install torch==2.7.0 torchvision==0.22.0 --index-url https://download.pytorch.org/whl/cu128
```

首次使用时按提示阅读并决定是否接受 NVIDIA 许可。首次启动可能需要下载扩展和资产，耗时数分钟。接下来安装对应版本的 Isaac Lab：

```bash
sudo apt install cmake build-essential
git clone --branch v2.3.1 https://github.com/isaac-sim/IsaacLab.git
cd IsaacLab
./isaaclab.sh --install
```

官方文档中的 `--install` 默认安装多种学习框架，会占用时间和空间；可按文档选择所需框架。检查安装：

```bash
python -m pip show isaacsim
python -c 'import torch; print(torch.cuda.is_available())'
./isaaclab.sh -p scripts/tutorials/00_sim/create_empty.py --headless
```

`torch.cuda.is_available()` 输出 `True` 表示 PyTorch 能看到 CUDA；它本身不证明图形渲染或串流正常。无图形桌面的服务器使用后面的串流测试更直观。

## 第四步：启动 Isaac Sim 串流

最直接的初次测试是在已经激活的 Isaac Sim Python 环境中运行：

```bash
isaacsim isaacsim.exp.full.streaming --no-window
```

等待应用完全加载；初次运行会慢一些。普通的同一可信网络连接通常使用 **TCP 49100** 做信令、**UDP 47998** 传视频。具体行为和参数以 [Isaac Sim 5.1 串流文档](https://docs.isaacsim.omniverse.nvidia.com/5.1.0/installation/manual_livestream_clients.html)为准。服务端可用下面的命令检查 TCP 监听：

```bash
ss -lntup | grep 49100
```

Windows 上从 [NVIDIA 官方下载页面](https://docs.isaacsim.omniverse.nvidia.com/5.1.0/installation/download.html)安装 Isaac Sim WebRTC Streaming Client，打开后在 **Server** 填入服务器的内网或 VPN 地址，选择分辨率并点击 **Connect**。若跨网络连接，5.1 文档提供 `--/app/livestream/publicEndpointAddress=<服务器可达地址>` 参数；地址必须是客户端实际能到达的地址。

**网络范围很重要：**串流接口不应直接暴露在公网。优先使用可信内网或 VPN，并限制访问来源；TCP 信令通了不代表 UDP 视频也通了。客户端一般一次只连接一个仿真实例。

### 端口已被其他仿真占用怎么办？

本次机器已有项目使用 TCP 49100。为了保留原任务，我们让机械狗演示使用 TCP 49101、UDP 48030–48040，并在 Windows 上建立**只监听本机**的 SSH 信令转发：

```powershell
ssh -N -L 127.0.0.1:49100:127.0.0.1:49101 <用户名>@<GPU服务器地址>
```

保持 PowerShell 窗口打开，再在串流客户端的 Server 填 `127.0.0.1`。这条隧道只转发 TCP 信令，视频 UDP 仍需要 Windows 能通过可信网络访问服务器宣告的地址和对应 UDP 端口；它不是完整的 UDP 隧道。本次采用这种方式成功看到画面。客户端、VPN、服务器或防火墙配置不同，仍可能需要按实际情况排查。

## 第五步：运行机械狗示例

进入 Isaac Lab 根目录、激活对应环境。官方教程提供 ANYmal C 的地形行走示例，使用预训练策略，并需要能访问相关模型和策略资产：

```bash
cd <IsaacLab目录>
python scripts/tutorials/03_envs/create_quadruped_base_env.py --num_envs 1 --livestream 2
```

等待日志显示环境初始化和重置，再连接客户端。这个原始示例的速度指令是固定的：机械狗会自动运动，并不会自动支持方向键。模型配置存在也不等于 USD 和策略文件已经缓存；如果加载失败，先检查日志中的资产地址、网络和缓存。

如果需要像本次实验一样与已有实例共存，可在启动参数后增加独立端口。以下是 5.1 环境中的示例；将地址替换成客户端可通过 VPN 到达的服务器地址：

```bash
python scripts/tutorials/03_envs/create_quadruped_base_env.py \
  --num_envs 1 --livestream 2 \
  --kit_args="--/app/livestream/port=49101 --/app/livestream/minHostPort=48030 --/app/livestream/maxHostPort=48040 --/exts/omni.services.transport.server.http/port=8012 --/app/livestream/publicEndpointAddress=<服务器VPN地址>"
```

选择未占用的端口，不要随意终止已有进程。按 `Ctrl+C` 结束自己在当前终端启动的演示。

## 第六步：看懂界面

连接后看到的不是单纯的视频播放器，而是远程 Isaac Sim 界面：

1. **中间 Viewport**：三维场景和机械狗。点击画面可将输入焦点交给仿真窗口。
2. **右上 Stage**：场景树，列出机器人、地形、灯光等对象。展开层级可以查看关节、碰撞体和模型。
3. **右下 Property / IsaacLab**：查看选中对象属性、视角和调试设置。不同示例的面板可能略有差异。
4. **底部 Content / Console**：浏览资源和查看控制台信息。服务器上的启动终端日志也很重要。
5. **左侧播放控制**：控制时间线播放和暂停；如果画面停住，先检查是否处于暂停状态。

地面上整齐排列的红点通常是示例中的高度扫描传感器调试可视化，不是障碍物。可在 IsaacLab 面板的 **Scene Debug Visualization → Height Scanner** 取消勾选；不同场景或脚本可能重新设置这个选项。

## 第七步：给机械狗接入键盘控制

这部分是对上面 ANYmal 教程的**代码改造**，不是 Isaac Sim 的通用默认快捷键。先复制脚本，不修改官方原文件：

```bash
cp scripts/tutorials/03_envs/create_quadruped_base_env.py keyboard_dog.py
```

在 `keyboard_dog.py` 的 Isaac Lab 导入区域添加：

```python
from isaaclab.devices.keyboard import Se2Keyboard, Se2KeyboardCfg
```

找到 `constant_commands`，把原来固定的速度返回值替换为键盘指令：

```python
def constant_commands(env: ManagerBasedEnv) -> torch.Tensor:
    return keyboard.advance().to(env.device).unsqueeze(0).repeat(env.num_envs, 1)
```

在 `main()` 开头、创建环境之前初始化键盘：

```python
global keyboard
keyboard = Se2Keyboard(
    Se2KeyboardCfg(
        v_x_sensitivity=0.5,
        v_y_sensitivity=0.3,
        omega_z_sensitivity=0.6,
        sim_device=args_cli.device,
    )
)
```

使用 `python keyboard_dog.py --num_envs 1 --livestream 2` 启动；若共用服务器，沿用上一步的独立端口参数。客户端连接后点击三维画面，预期操作如下：

| 按键 | 给策略的指令 |
| --- | --- |
| ↑ / ↓ | 前进 / 后退 |
| ← / → | 向左 / 向右横移 |
| Z / X | 左转 / 右转 |
| 松开 | 释放对应移动指令 |
| L | 清除当前指令；先松开其他键再按 |

方向按机器人自身坐标理解。脚本会周期性重置环境，机器人可能回到初始位置；画面卡顿、键盘焦点、远程事件传递及策略对地形的适应性都会影响操作。本次改造已能启动并显示机器人，但各按键动作尚待逐项验证，不应当把代码接入等同于遥操作已经完全验证。

要让镜头跟随机器人，可以在仿真循环中获取 `env.scene["robot"].data.root_pos_w[0]`，再用 `env.sim.set_camera_view()` 设置相对位置；这会持续覆盖手动调整镜头。正式项目应考虑减少更新频率和资源消耗。

## 常见问题

- **客户端黑屏**：先等服务器启动完成；检查客户端地址、TCP 和 UDP、防火墙以及服务器日志。SSH 的 TCP 转发成功不代表视频 UDP 也能到达。
- **画面能看但按键无效**：点击三维画面获取焦点，确认启动的是改造后的脚本而非原版自动演示；再检查远程键盘事件和日志。不能仅凭键盘映射判断动作已经生效。
- **能看到场景却找不到狗**：机器人可能在其他地形位置；选择机器人聚焦，或使用跟随镜头。摄像机视角与机器人控制是两件事。
- **提示资产或策略不存在**：检查网络、NVIDIA 资产路径和缓存，不要假设源码目录已包含所有 USD 文件。
- **画面卡顿或仿真很慢**：尝试更低分辨率、减少环境数量与传感器，检查 `nvidia-smi`。本次 T4 与另一个任务共用 GPU，不能据此保证实时帧率。
- **关闭后如何恢复**：这次演示及 Windows SSH 隧道是手动启动的，不会因为电脑重启自动恢复。重新启动服务端演示、建立隧道，再用客户端连接。

## 延伸阅读

- [Isaac Sim 5.1 Python 安装](https://docs.isaacsim.omniverse.nvidia.com/5.1.0/installation/install_python.html)
- [Isaac Lab 2.3.1 安装与示例](https://isaac-sim.github.io/IsaacLab/v2.3.1/source/setup/installation/pip_installation.html)
- [Isaac Sim 5.1 WebRTC 串流](https://docs.isaacsim.omniverse.nvidia.com/5.1.0/installation/manual_livestream_clients.html)
