---
layout: post
title: MicroDuck 从零到真机（06）：系统烧录、策略部署与真机验收
description: 区分板卡镜像烧录、robotd 运行时安装和 ONNX 策略更新，按官方开发板流程说明安装、加载、检查与回退。
date: 2026-10-29
topic: robotics
chapter: microduck
chapter_order: 70
tags:
- Microduck
- 真机部署
- 烧录
- ONNX
- robotd
reading_time: 14
visibility: public
published: true
chapter_path:
- Microduck
---

[系列目录](/blog/2026/10/29/microduck-series-00-roadmap/) · 上一篇：[Sim2Real 与导出](/blog/2026/10/29/microduck-series-05-sim2real-export/)

到了真机阶段，先确定自己面对的是空白开发板、已经装好系统的实验机器人，还是有完整出厂运行时的产品。三者需要的操作不同。普通训练迭代通常只部署 ONNX，不需要重新烧录操作系统。

本文依据官方 `microduck` 仓库提交 `6cdfdaad21bed25e01b450c0dd4e0aee0ae19fde`。下面的命令是操作指南，未在本次写作中执行；示例 IP `192.168.1.42` 与账户需要替换成自己的板卡信息。

命令中的 `rtk proxy` 可在没有 RTK 的电脑或板卡上去掉；机器人端不需要为此额外安装命令包装工具。

## 1. 先选对部署入口

| 当前情况 | 从哪里开始 | 需要写入什么 |
| --- | --- | --- |
| 官方机器人已经可以正常运行 | 第 5 节 | 新 ONNX 与策略槽位 |
| 已有 Linux，但没有 MicroDuck 运行时 | 第 3 节 | 驱动配置、依赖、服务与运行时 |
| 全新 Radxa Zero 3 开发板 | 第 2 节 | 系统镜像，然后安装运行时 |
| 自制或改版控制板 | 先确认该硬件对应文档 | 不能直接套用 Zero 3 的镜像和串口配置 |

计算板负责运行 Linux 与策略推理；XL330 舵机、IMU 桥接板等外设有各自的固件与寄存器协议。ONNX 不烧进舵机，也不能替代外设固件。缺少具体板卡型号与 bootloader 资料时，不应编造一个通用外设烧录地址或流程。

## 2. 空白开发板：用正确镜像写入正确介质

官方[开发板安装文档](https://github.com/pollen-robotics/microduck/blob/6cdfdaad21bed25e01b450c0dd4e0aee0ae19fde/docs/robot/install-dev.md)指定 Radxa Zero 3，并记录了 Armbian 26.2.1 Minimal 的安装路径。本次查看的 [Armbian 板卡页面](https://armbian.com/boards/radxa-zero3)已经提供更新的镜像；“当前能下载”不等于“已经验证兼容这份 MicroDuck 安装脚本”。

建议按以下顺序操作：

1. 确认板卡型号、版本、启动方式与将写入的 microSD／eMMC；先保存需要保留的数据和配置。
2. 从官方渠道选择与硬件、MicroDuck 版本相容的镜像，核对下载完整性。
3. 在 Armbian Imager 中选择对应板卡和镜像，确认目标设备容量与标识，避免写到电脑的数据盘。
4. 按需预设 Wi-Fi、登录账户和 SSH；密码保存在自己的安装工具中，不放进公开实验记录。
5. 写入并完成校验，按板卡对应的启动方法插卡或启动。
6. 从路由器租约或可用的官方工具找到板卡地址，核对首次 SSH 主机指纹。
7. 记录镜像名称、版本、校验值、内核和板卡信息，再进入运行时安装。

这里没有提供一个不区分设备的 `dd` 命令。写卡是覆盖存储的操作，图形工具中的目标确认与写后校验属于流程的一部分。已经正常工作的成品机器人不需要为了更新策略走这一步。

## 3. 安装板卡运行时

在自己的电脑上克隆官方 `microduck` 仓库、进入仓库根目录，并阅读当前版本的安装文档。先配置 SSH 公钥访问：

```bash
rtk proxy ssh-copy-id microduck@192.168.1.42
```

官方提供 `scripts/provision-board.sh`，用于发送配置、处理重启、安装软件并查看过程。以下是面向确认兼容的 Zero 3 实验板的示例：

```bash
rtk proxy bash scripts/provision-board.sh --pause-btd-on-pair --no-dev-key --name MyDuck microduck@192.168.1.42
```

`--no-dev-key` 适用于只需要正式发布版本的板卡。只有需要测试开发构建、且理解开发签名信任范围时，才按开发板文档启用相应设置。`--pause-btd-on-pair` 针对文档中部分无线电配对问题，不应据此给其他板卡随意套用全部蓝牙兼容选项。

运行前先查该提交的脚本帮助与硬件参数；不同自定义板卡可能需要明确的 board 选项。脚本会配置板卡外设、总线相关设置和服务，并可能重启系统。不要在机器人正站立或运动时开始系统安装。

手动分步路径见[安装参考](https://github.com/pollen-robotics/microduck/blob/6cdfdaad21bed25e01b450c0dd4e0aee0ae19fde/docs/robot/install-by-hand.md)，但其中个别蓝牙说明与较新的开发板指南有历史差异，应优先核对当前脚本及对应硬件，不把旧参数无条件复制。

## 4. 首次通电，先检查系统与控制链

在机器人上执行：

```bash
rtk proxy robotctl version
rtk proxy robotctl health
rtk proxy robotctl configure --list
rtk proxy robotctl policy list
rtk proxy robotctl monitor
```

`configure --list` 主要显示对默认配置的覆盖，不等于列出了所有最终生效值。结合 `/etc/robot/robotd.toml`、运行版本的默认值和启动日志核对。

| 检查对象 | 要看什么 |
| --- | --- |
| 串口与总线 | 正确设备、舵机 ID、连续读取错误与实际刷新率 |
| IMU | 静置姿态与缓慢倾斜时，方向、单位和重力投影合理 |
| 舵机 | 安装方向、零位、限位、温度、供电与异常电流 |
| 控制循环 | 实际频率和抖动，而不只是配置写着 50 Hz |
| 策略 | 加载文件、形状、来源、HOME、尺度与滤波 |

总线应由拥有它的 `robotd` 管理；同时开另一个底层控制进程会竞争同一个 UART。没有电机供电的测试板报告硬件不健康，可能是如实描述当前状态，而不是系统安装失败。

初始化会驱动关节。按官方说明，把机器人放在合适支架上、确认运动区域后再执行：

```bash
rtk proxy sudo robotctl robot init
```

需要解除扭矩时，先支撑机器人，再使用：

```bash
rtk proxy sudo robotctl robot relax --yes
```

解除扭矩会使未被支撑的双足机器人倒下。停止策略、速度清零和切断扭矩是不同动作，应在首次行走前明确各自的控制方式。

## 5. 已有机器人：复制并加载新策略

先完成上一篇的 ONNX 数值与闭环验收。在电脑上计算模型哈希并复制到持久目录：

```bash
rtk proxy sha256sum microduck-walk.onnx
rtk proxy scp microduck-walk.onnx microduck@192.168.1.42:/home/microduck/microduck-walk.onnx
```

在机器人上核对哈希，保存当前策略与配置记录，再加载：

```bash
rtk proxy sha256sum /home/microduck/microduck-walk.onnx
rtk proxy robotctl policy list
rtk proxy sudo robotctl policy load walk /home/microduck/microduck-walk.onnx
rtk proxy robotctl policy list
rtk proxy robotctl health
```

官方 `policy load` 支持本地文件，会记录槽位选择，并在加载时检查策略。实际行为取决于机器人当前状态：加载正在使用的槽位可能触发回 HOME 和重新驱动，因此上面的加载步骤也应在受控条件下进行。[策略命令与槽位说明](https://github.com/pollen-robotics/microduck/blob/6cdfdaad21bed25e01b450c0dd4e0aee0ae19fde/docs/robot/cheatsheet.md)是操作依据。

不要把策略长期放在会被清理的 `/tmp`。文件路径写入配置后，重启仍需要能访问它。加载成功也只说明软件接受了模型，不等于模型适合这台机械结构。

## 6. 把训练配置与实机配置逐项对照

前馈网络的 61→14 形状只是第一道门。还要核对关节顺序、HOME、命令编码、控制周期、动作尺度、目标滤波、增益与电压适配。上一篇已经指出训练说明与运行时低通注释存在版本差异，不能在这里跳过。

特别是 `stand` 与 `walk` 槽位的切换：能够在零命令下自行站立的联合策略，与单独依赖站立网络的组合方式不同。应根据当前策略的训练任务确定槽位配置，不能一边加载新步态、一边让旧站立网络掩盖其零命令行为。

训练中的机身坐标、实机 IMU 安装、编码器零偏和实际舵机方向，应通过固定测试姿态逐项验证。硬件校准不可用一个“增加随机化”的参数代替。

## 7. 分阶段试验，先确认停止路径

建议先以原策略验证硬件基线，再换新策略，每一步记录当前模型哈希与配置：

| 阶段 | 观察目标 | 何时停止 |
| --- | --- | --- |
| 支架初始化 | HOME、方向、限位、总线与电流 | 关节冲撞、方向不符、持续异常读数 |
| 受控承重站立 | 重力输入、左右对称、稳定与停止动作 | 大幅偏姿、持续抖动、异常升温 |
| 低速短程 | 前进、后退、原地转向与归零 | 不响应停止、连续失稳、碰撞 |
| 扩展指令 | 更多速度、头部指令和不同电量 | 超出已验证能力或控制约定 |

这张表是实验方法，不是官方通过标准。实际阈值应结合硬件规格、场地和实验目的确定；本系列没有测得温度、电流或成功率数据，因此不填入虚构的合格数值。

## 8. 区分策略回退与软件回退

回到当前官方套件的默认行走槽位：

```bash
rtk proxy sudo robotctl policy reset walk
```

若要回到自己上一版策略，应加载上一版已记录的持久 ONNX 文件；`policy reset walk` 不等于回到任意自定义前一版。

系统软件更新出现问题时，是另一条路径：

```bash
rtk proxy robotctl update status
rtk proxy robotctl update log
rtk proxy sudo robotctl update rollback daemon
```

回滚需要板卡确有可用的历史版本；刚安装完成的板卡可能没有前一版。策略文件不必随着 daemon 回滚而恢复，因此也要检查独立的策略槽位和配置。官方更新设计保留签名、哈希与健康检查，普通策略试验不需要关闭这些机制。

## 9. 发布一个技能与加载一个步态不同

持续运行的步态适合策略槽位；固定时长的技能可以通过 manifest 描述执行时间；需要相位或坐站标志的策略则要求运行时持续写入特定命令，不能只当作“全零指令运行几秒”的通用技能。

若以后要分享策略，使用官方发布工具生成对应 manifest，并检查 `kind`、`command.encoding`、观测维数与动作维数。[策略 manifest 协议](https://github.com/pollen-robotics/microduck/blob/6cdfdaad21bed25e01b450c0dd4e0aee0ae19fde/docs/policy-manifest.md)规定了这些含义。本文只说明本地加载流程，没有向模型平台上传任何策略或检查点。

## 10. 最后留下什么记录

一次完整部署应能回答：哪块板、哪套机械、哪个镜像、哪个运行时、哪个策略、哪些配置、做过哪些动作、在哪个条件下失败，以及怎样恢复。

把训练检查点、ONNX、模型哈希、运行时版本、板卡配置、日志和视频放进同一份实验索引，才形成从机械建模到真机表现的闭环。系列讲解到这里结束，真实工程则应从每一次可复查的小实验继续。
