---
layout: post
title: MicroDuck 从零到真机（05）：执行器建模、Sim2Real 与 ONNX 导出
description: 从 BAM、域随机化和接口一致性出发检查仿真到真机的差距，完成检查点到 ONNX 的正确导出与部署前回放。
date: 2026-10-29
topic: robotics
chapter: microduck
chapter_order: 60
tags:
- Microduck
- Sim2Real
- BAM
- ONNX
reading_time: 13
visibility: public
published: true
chapter_path:
- Microduck
---

[系列目录](/blog/2026/10/29/microduck-series-00-roadmap/) · 上一篇：[PPO 与奖励](/blog/2026/10/29/microduck-series-04-ppo-reward-design/) · 下一篇：[真机部署](/blog/2026/10/29/microduck-series-06-hardware-deployment/)

仿真里走得好，说明策略适应了那个仿真世界。要把它移到真机，需要分别核对物理响应和数据接口。前者决定电机是否像训练中那样响应，后者决定网络究竟有没有收到它熟悉的输入。

## 1. 先把迁移差距分开定位

| 差距 | 例子 | 优先处理的方法 |
| --- | --- | --- |
| 机械 | 电池位置、实际质量、脚垫、松动 | 测量、模型更新与合理随机化 |
| 执行器 | 电压、摩擦、饱和、齿隙 | 执行器辨识与模型 |
| 传感与时序 | IMU 安装偏角、编码器偏置、延迟 | 校准、日志和对应扰动 |
| 接口 | 关节顺序、HOME、单位、归一化 | 逐字段对照和固定向量测试 |
| 运行时 | 动作尺度、滤波、限位与控制频率 | 仿真复现实际后处理 |

随机化不能修复关节顺序写反；多训练几千轮也不能补回丢掉的观测归一化。应先修接口，再讨论策略鲁棒性。

## 2. 为什么使用 BAM，而不是理想位置伺服

把目标角度直接交给很强的理想 PD，机器人可能在仿真里拥有现实舵机没有的瞬时控制能力。实际 XL330 的响应受到电压、电机反电动势、摩擦、负载和控制器约束影响。

官方通过 [BAM](https://github.com/Rhoban/bam) 建模执行器；训练仓库的[机器人配置](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/src/mjlab_microduck/robot/microduck_constants.py)选择 XL330 的 M6 模型，并为电压、压降和延迟设置范围。这些参数不是任意机器人都可以复制的物理常数。

固定阅读版本的示例值包括 `kp_fw=200`、供电范围 6.5–8.2 V、有效电压下限 6.0 V，以及执行器延迟 lag 3–6。换算延迟为毫秒前应先确认 lag 在实现中对应哪个采样周期，不能直接套用策略的 20 ms 周期。

辨识时可先在单舵机测试台比较阶跃响应、静摩擦、不同负载下的跟踪和电压变化，再扩展到整机。不要用整机策略的失稳表现，同时反推十几个执行器参数。

## 3. 随机化必须真的作用在模型上

官方实现了[摩擦随机化执行器](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/src/mjlab_microduck/actuator/friction_dr_bam.py)。原因是 BAM 自己计算摩擦，直接随机化某些原生 MuJoCo 摩擦字段可能被覆盖或不起作用。

检查随机化不要停在配置表：抽样后读取实际执行器尺度、质量、重心和传感器偏置，验证不同环境确实不同。多次 reset 后还要检查分布没有不断漂移。若随机化采用“在上一次值上再乘一个倍率”，参数会随 episode 累积，训练过程便在解决不断变形的机器人。

课程范围应围绕测量误差和合理工作区间。IMU 的零均值姿态扰动可以训练对安装误差的容忍，但无法自动补偿每台机器人固定的安装偏差；后者仍要在运行时校准。

## 4. 齿隙不仅改变动力学，也改变反馈

backlash 变体为主动关节串入被动齿隙关节。现实编码器若测量齿隙输出侧，就应在仿真中反馈主关节角与齿隙角的组合，而不是只读电机侧角度。

观测与奖励也必须使用同一种角度定义。否则策略看到的是“已经接近目标”，奖励却按另一侧角度惩罚它，会形成内部矛盾。比较有无齿隙时，还要保持碰撞模型一致，避免把两种差异混在一次 A/B 实验里。

## 5. 导出的是 actor，且必须包含归一化

训练时输入会经过观测归一化。如果只把 MLP 权重转成 ONNX，实机端输入原始角度、速度和指令，就可能与训练时的数值分布完全不同。

正确路径应表达：

```text
原始 61 维观测 → 已保存的归一化统计 → actor → 14 维动作
```

官方[导出实现](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/src/mjlab_microduck/export.py)调用 runner 的导出方法，并写入模型来源等元数据。使用它而不是手工转换，能保留这条路径；元数据还应与训练记录和检查点哈希对应。

在训练仓库根目录，用实际检查点替换下面的示例路径：

```bash
rtk proxy uv run scripts/export.py Mjlab-Velocity-Flat-MicroDuck \
  --checkpoint-file '/actual/run/model_4000.pt' \
  --onnx-file microduck-walk.onnx \
  --num-envs 1
```

自定义任务必须使用自己的任务 ID，因为模型工厂和 agent 配置也属于导出依据。不要把不同任务的同形状网络当成可以随意混用。

## 6. 做三层导出验收

第一层是文件与图检查。假设已安装项目依赖，在导出目录执行：

```bash
rtk proxy uv run python -c 'import onnx; m=onnx.load("microduck-walk.onnx"); onnx.checker.check_model(m); print("graph check: OK"); print({x.key:x.value for x in m.metadata_props})'
rtk proxy uv run python -c 'import onnxruntime as ort; s=ort.InferenceSession("microduck-walk.onnx",providers=["CPUExecutionProvider"]); print("inputs",[(x.name,x.shape,x.type) for x in s.get_inputs()]); print("outputs",[(x.name,x.shape,x.type) for x in s.get_outputs()])'
```

这适用于本系列的前馈网络，应看到语义上对应 61 输入、14 输出的接口。循环网络还包含隐藏状态，有不同的生命周期与 `model_api`，必须按官方循环策略说明处理。

第二层是数值对比：准备一组有物理意义的观测，分别通过训练框架的确定性推理路径与 ONNX 运行，比较最大绝对误差、输出是否有限、输入顺序是否正确。不要凭任意全零向量的输出判定姿态安全，也不要把训练框架已归一化的张量再次送入含归一化的 ONNX。

第三层是闭环行为：在 MuJoCo 中让 ONNX 驱动机器人，并覆盖静止、前后行走、横移、转向、头部命令及有代表性的扰动。网络逐点相似是必要检查，但不替代闭环稳定性。

## 7. 先在 CPU MuJoCo 复查部署路径

在有图形显示的 Linux 会话中：

```bash
rtk proxy uv run scripts/infer_policy.py --walking microduck-walk.onnx --new-cmd-obs
```

该[推理脚本](https://github.com/pollen-robotics/microduck_rl/blob/bae39f5900b318f7e87fc485c30a31213cfa14eb/scripts/infer_policy.py)支持统一命令布局和 BAM 模拟。远程无桌面 SSH 需要另行提供显示环境；训练框架中的 `play --viewer viser` 可以用来查看检查点，但不是同一条 ONNX 部署复查路径。

记录所用场景、执行器、供电、指令和脚本参数。换一套模型后表现变好，并不能证明原迁移问题已经修复。

## 8. 动作尺度与滤波要逐项对齐

这是本次阅读发现的一个需要实测的版本边界：训练仓库的说明明确写着策略未使用动作低通；运行时的 [robotd.toml](https://github.com/pollen-robotics/microduck/blob/6cdfdaad21bed25e01b450c0dd4e0aee0ae19fde/deploy/robotd.toml)却仍保留头部／腿部低通默认值和“与训练匹配”的旧注释。

因此，不能依据注释就认定两边已经一致。对自己新训练的策略，列出实际生效的动作尺度、HOME、关节限幅、目标滤波、供电适配与控制周期，再在仿真里复现。既有官方策略的尺度或滤波可能是实际运行配方的一部分，也不能为了新策略直接全局覆盖所有槽位。

动作滤波和指令滤波同样要区分。平滑手柄速度命令，与对每个关节目标做低通，会产生不同的闭环延迟。

## 9. 把一个策略作为可追溯版本保存

建议为每个待上机策略保存：ONNX、检查点编号与哈希、训练代码提交、机器人模型哈希、完整配置、导出日志、数值对比结果，以及回放视频和失败样本。文件名可读，但识别内容应使用哈希。

这些记录能帮助区分“上机错文件”“命令含义错了”“执行器响应不匹配”和“策略本身还不够好”。下一篇才会把已验收的模型放到真实机器人上；本文没有执行实机试验。
