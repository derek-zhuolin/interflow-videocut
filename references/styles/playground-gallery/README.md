# Playground 炸裂族风格库（dramatic visual gallery）

2026-06 从 `interflow-playground` 引进的一批「炸裂」视觉风格。它们和 `references/styles/`
里的常规风格是**同一个槽位填充流程（Step 7 选风格题）的候选**——选风格时把这批作为
「炸裂族」呈现给用户。

## 一句话定位（选风格题用这张）

本目录**只留「待加固 DNA」原稿** + neon 的 C 档配方源；已生产化的风格原稿已删（去 `../<key>.html`
看加固后的生产 fragment，避免重复）。

| 中文名 | key | 调性 | 什么时候用 | 状态 / 文件 |
|---|---|---|---|---|
| **霓虹网格** | `neon-grid-hud` | 赛博·TRON·冷霓虹 | 科技/发布会预告/短视频高光/夸张视觉（炸裂档默认） | ✅ 生产级 → `../neon-grid-hud.html`（本目录 `neon-grid-hud.html` 仅留作 C 档 scanline/ticker/sweep 配方源）|
| **流光极光** | `liquid-aurora` | 流动极光·液态·梦幻 | 品牌/情绪/高级感/治愈 | ✅ 生产级 → `../liquid-aurora.html`（原稿已删）|
| **全息虹彩** | `holo-iridescent` | 全息箔·色散·最贵感 | 最前卫/产品揭晓/潮牌 | ✅ 生产级 → `../holo-iridescent.html`（原稿已删）|
| **电影光影** | `cinematic-bloom` | 宽银幕·镜头光晕·暖 | 大片质感/情绪/电影感开场收尾 | ◐ DNA 待加固 → 本目录 `cinematic-bloom.html` |
| **动态巨字** | `kinetic-megatype` | 瑞士粗野·巨字运动 | 态度/宣言/金句/标题主导 | ◐ DNA 待加固 → 本目录 `kinetic-megatype.html` |
| **纵深视差** | `depth-parallax` | 多层 3D 景深·视差 | 立体/沉浸/空间感 | ◐ DNA 待加固 → 本目录 `depth-parallax.html` |
| **暖玻 HUD·简洁** | `glass-hud-clean` | 暖玻克制 | 日常口播 | ✅ 直接用现有 `../glass-hud.html`（demo 已删，无需另做）|

## 架构：都走 window-scene（真人窗口 + 特效在后）

这批和 neon-grid-hud 同一条铁律：**真人是一个边框「窗口」，所有特效（极光/光晕/虹彩/
网格/巨字背景）在窗口的后面和周围——永不糊脸。** 复用 neon-grid-hud 的三层架构
（场景层 `#scene` 在最底 → 真人窗口 `#video-wrap` → HUD 内容层 per-card）。两条铁律
（见 `../neon-grid-hud.html` 头注释）对全族通用：
- **满脸窗口**：窗口竖向且比例 ≥ 源比例，否则只剩上半脸。
- **垂直预算 / 不溢出**：默认 9:16；标题 `clamp()`+容器查询；内容 host `overflow:hidden`
  + 底部 ≥100px 安全边距。**绝不让字贴边出血。**

## ◐「首用时加固」是什么意思（render-harden checklist）

playground 原稿是**静态网页 demo**，用了 `requestAnimationFrame` / `Math.random` /
CSS `infinite` 动画——直接拿去 hyperframes 渲染会**花屏 / 卡帧 / 逐帧不一致**。第一次
有人选到某款时，按这张清单把它加固成确定性版本（neon-grid-hud 已是范本，照抄它的做法）：

1. **canvas 动画**：把 `requestAnimationFrame(loop)` + `t++` 累积，改成**闭式 `draw(tt)`**
   （tt = 时间轴秒），由 master timeline 的一个 proxy tween `onUpdate` 驱动：
   `tl.to(clock,{t:DUR,duration:DUR,ease:'none',onUpdate:()=>draw(clock.t)},0)`。
2. **随机**：`Math.random()` 全部换 `mulberry32(seed)`，且**只在初始化用一次**，`draw` 内纯 `f(tt)`。
3. **CSS 动画**：`animation: ... infinite` 这类小 chrome（闪烁/EQ/脉冲）hyperframes 能确定性
   捕获，可保留；但**主运动**（背景流动/粒子）务必走第 1 条的 canvas-by-timeline。
4. 适配 window-scene：把 demo 里的「人物剪影占位」换成真 `#video-wrap` 窗口；HUD 文案层
   拆成 per-card；起伏运镜 window→pip→fullscreen 复用 neon 的 videoBounds 三态。
5. 产出一个 `references/styles/<key>.html` 生产 fragment（头注释写全配方），再 lint + 逐帧 snapshot QA。

待加固原稿存放：本目录 `cinematic-bloom.html` / `kinetic-megatype.html` / `depth-parallax.html`。
加固后的生产 fragment 放到上一级 `references/styles/<key>.html`，**删掉本目录的原稿**（避免重复），
并把 DESIGN_INDEX「炸裂族」表里该款的状态从「◐ 首用加固」改成「✅ 生产级」。
