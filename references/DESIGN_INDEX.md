# Interflow Video Cut — Visual Design Library

This directory is a **reference library** for the interflow-video-cut skill. Style, layout,
and video frame are three **orthogonal** dimensions you can freely mix when
designing a takeaway video.

```
Style  ×  Layout  ×  VideoFrame
 (11)      (7)         (3)        （+ neon-grid-hud 自带 window-scene 专属布局）
```

> **One style breaks the mold:** `editorial-print` is an **asset-driven montage**
> (the images/video clips ARE the content, arranged like a printed spread) — not
> a text card over a talking-head. It has its own multi-asset primitives +
> transitions + asset-staging rules in
> [editorial-print-montage.md](editorial-print-montage.md). Read that companion
> before authoring an editorial-print scene.

Read a reference file when you decide to use that dimension. Each file is a
self-contained HTML fragment that follows the interflow-video-cut card-HTML contract
(scoped `<style>`, no `<script>`, no external URLs, animations only via
`data-anim-*`).

## Layouts — how video and card share the canvas

| key | file | what it does | best for |
|---|---|---|---|
| `split` | [layouts/split.html](layouts/split.html) | 50/50 side-by-side (landscape) or top/bottom (portrait) | speaker + data equal weight |
| `stack` | [layouts/stack.html](layouts/stack.html) | video on top (~52%), card below | talking-head with summary card |
| `pip` | [layouts/pip.html](layouts/pip.html) | card fills canvas, video rounded PiP in corner | content-heavy moment, speaker secondary |
| `overlay` | [layouts/overlay.html](layouts/overlay.html) | video full-bleed, glass card floats on bottom | cinematic / dramatic moments |
| `deck` ◇ | [layouts/deck.html](layouts/deck.html) | 3D fanned card carousel (cover-flow); cards ARE the show, video hides or becomes a corner pip | testimonials / 卖点轮播 / 多条金句 |
| `showcase` ◈ | [layouts/showcase.html](layouts/showcase.html) | bottom talking-head pip (permanent) + a top "evidence wall" of portrait B-roll tiles that accumulates & reflows (1→2→3→grid); each tile a live clip with red label + view-count chip; pip pops to fullscreen then shrinks back | 案例墙 / hook 拆解 / 作品集 / 数据陈列 (asset-driven) |
| `window-scene` ✹ | (`neon-grid-hud` 专属，配方在 [styles/neon-grid-hud.html](styles/neon-grid-hud.html) 头注释) | 真人在一个**竖向霓虹窗口**里，全屏 `#scene` canvas 特效（透视网格+粒子）铺在窗口**后面**；起伏运镜 窗口→PiP→全屏 | neon-grid-hud 炸裂档（特效不糊脸） |

◇ `deck`（**3D 旋转木马 / 卡片叠放**）— 唯一一个**卡片本身就是主角**的 layout：一张卡正对镜头，左右两张退到 3D 扇形里（rotateY + translateZ 后移 + 模糊变暗），每切一张像 cover-flow 一样把当前卡转去左侧、下一张从右侧转上来。**它替代默认的 slip 转场**（卡片不再上滑消失，而是在 3D 扇里轮转）。`#video-wrap` 两种用法：(A) showcase — 直接 `opacity:0` 把口播藏掉，让卡墙独占画面；(B) witness pip — 留一个右上角圆角小窗看着卡墙转。背景别用纯色，配 `pastel-aura` / `glass` 风格把 `#stage` 铺成天空/极光底，让扇形卡片浮在一个世界里。frame 恒 `clean`。整套 perspective + 三槽位 transform + advance 补间写在 [layouts/deck.html](layouts/deck.html) 头注释。最适合：评价墙 / testimonials、产品卖点轮播、多条金句、功能巡览。

◈ `showcase`（**案例陈列墙 + 口播见证 + 焦点呼吸**）— 下方口播 pip 常驻，上方一面**不断累积重排的案例证据墙**：竖屏 B-roll 卡 1→2→3→3×N 网格地长出来，每张卡戴红色分类 label + 黑色观看数 chip，铺在网格纸底上。签名动作是**焦点呼吸**——口播 pip 从底部小窗突然放大到全屏、hold、再缩回，期间上方墙体继续滚动播放（三件事同时发生：信息累积 + 焦点呼吸 + 画面不静止，这是高级感来源）。⚠️**素材驱动**（同 editorial-print）：每张墙卡 = 用户喂的竖屏片段 + 分类 label + 观看数，多视频源机制直接复用 [editorial-print-montage.md](editorial-print-montage.md)（卡内 `<video>` 唯一 id + 自己的 `data-track-index` + muted + data-volume=0）。三段动效（墙体重排 explicit-coord FLIP / 焦点全屏 pop / 活体卡 Ken-Burns）+ 三套画幅 pip 坐标写在 [layouts/showcase.html](layouts/showcase.html) 头注释。frame 恒 `clean`，配 `pastel-aura` / `swiss` 浅色网格纸底最对味。最适合：案例墙 / hook 拆解 / 作品集巡览 / 带证据片段的数据陈列。

A layout is a **two-part recipe**: pick a `card.zone` value to put in
`storyboard.json` AND author a GSAP tween for `#video-wrap` to its
target rect in the composition's `<script>`. Open the layout file's
header for the recommended `zone` + the GSAP statement to paste.
(Earlier docs referenced a `card.layout` field — that field does NOT
exist in the real schema; the strict v3 schema only has `card.zone`.)

## 中文风格词库（一眼挑对 · 选风格时先看这张）

给中国创作者用的中文名 + 大白话「什么时候用」。**选风格时优先按这张表的中文名
和场景来挑**；英文 `key` 只是内部文件名（agent 用它找文件、套 frame 矩阵）。

| 中文名 | key | 一句话什么时候用 | 联想词 |
|---|---|---|---|
| **霓虹网格** | `neon-grid-hud` | 赛博真人霓虹窗口 + 透视网格 + 粒子 + HUD 巨字，**特效永远在人后不糊脸**（炸裂档默认） | 赛博 · 霓虹 · TRON · 发布会 · 短视频高光 · 夸张视觉 |
| **暗夜星河** | `nebula-glass` | 黑底+流动粒子+玻璃，**最高级最有科技感**（旗舰） | 星空 · 粒子 · 未来 · AI · 发布会 |
| **玻璃拟态** | `glass` | 简单两色渐变 + 磨砂玻璃，半透明、干净、高级 | 玻璃 · 磨砂 · 半透明 · 简洁 · 高级 |
| **暖玻 HUD** | `glass-hud` | 暖玻璃面板**浮在真人口播上** + 顶部章节条 + 底部进度轴双语字幕，橙色 accent | 口播 · 叠加 · 章节条 · 双语字幕 · 护城河枚举 · terracotta |
| **暖光太空** | `spatial` | 黑底+暖橙光，温暖又有空间感（唯一的暖黑底） | 暖光 · 深空 · 温暖 · 人物 · 治愈 |
| **撞色大字** | `geom` | 黑底+亮色块+超大字，大胆有冲击力 | 撞色 · 大字 · 态度 · 宣言 · 潮 |
| **瑞士网格** | `swiss` | 白底+红点+大字，干净、专业、权威 | 瑞士 · 网格 · 报告 · 数据 · 严肃 |
| **黑白极简** | `minimal` | 纯黑白大字+极致留白，高级、克制 | 极简 · 黑白 · 留白 · 金句 · 高级 |
| **代码终端** | `terminal` | 黑底绿字代码风，技术、极客、工程感 | 代码 · 终端 · 技术 · 编程 · 极客 |
| **柔光浅色** | `pastel-aura` | 浅色柔和不刺眼，日常、白天、轻松（白天锚点） | 浅色 · 柔和 · 清爽 · 日常 · 温柔 |
| **杂志印刷** | `editorial-print` | 把照片/素材排成杂志跨页（不是文字卡） | 杂志 · 印刷 · 作品集 · 大事记 · 排版 |
**4 大类（选风格题就按这个分）：**
- **暗调电影感**（黑底·高级·有动态）= 霓虹网格（炸裂档默认）/ 暗夜星河 / 玻璃拟态 / 暖玻 HUD / 暖光太空 / 撞色大字
- **干净专业**（数据·报告·严肃）= 瑞士网格 / 黑白极简 / 代码终端
- **浅色清爽**（日常·白天·轻松）= 柔光浅色- **杂志素材**（作品集·素材排版）= 杂志印刷

> 自动匹配（`auto-style.py`）也按中文名回报：亮视频→柔光浅色/瑞士网格；
> 暗+冷视频→暗夜星河/玻璃拟态；暗+暖视频→暖光太空/暖玻 HUD；暗+中性→暖玻 HUD/暗夜星河。

### 炸裂族（dramatic / playground 风格 —— 想要「夸张视觉」时在选风格题里加这一组）

都走 **window-scene 架构**（真人窗口 + 特效在后，永不糊脸）。`neon-grid-hud` 已生产级；
其余 5 款是 playground DNA，**首次被选到时按 `styles/playground-gallery/README.md` 的
render-harden checklist 加固成确定性版本**（neon 是范本）。原稿 + 总览 + 加固清单全在
[styles/playground-gallery/](styles/playground-gallery/)。

| 中文名 | key | 调性 / 什么时候用 | 状态 |
|---|---|---|---|
| **霓虹网格** | `neon-grid-hud` | 赛博 TRON · 科技/发布会/短视频高光（炸裂档默认）| ✅ 生产级 |
| **流光极光** | `liquid-aurora` | 流动液态极光 · 品牌/情绪/治愈/高级 | ✅ **生产级**（`styles/liquid-aurora.html`）|
| **全息虹彩** | `holo-iridescent` | 全息箔色散 · 最前卫/产品揭晓/潮 | ✅ **生产级**（`styles/holo-iridescent.html`）|
| **电影光影** | `cinematic-bloom` | 宽银幕镜头光晕 · 大片质感/情绪/电影感 | ◐ 首用加固 |
| **动态巨字** | `kinetic-megatype` | 瑞士粗野巨字运动 · 态度/宣言/金句 | ◐ 首用加固 |
| **纵深视差** | `depth-parallax` | 多层 3D 景深视差 · 立体/沉浸/空间感 | ◐ 首用加固 |

## Styles — the card's visual language

| key | file | character | accent | suggested font |
|---|---|---|---|---|
| `minimal` | [styles/minimal.html](styles/minimal.html) | pure black/white · huge type · generous space | `#000` | Inter |
| `geom` | [styles/geom.html](styles/geom.html) | black ground · ONE electric accent · oversized bold type · crisp geometry | `#d4ff3a` | Inter bold |
| `terminal` | [styles/terminal.html](styles/terminal.html) | dark · monospace · ASCII border · prompt cursor | `#4ade80` | mono |
| `swiss` | [styles/swiss.html](styles/swiss.html) | white · Helvetica · strict double rules · red accent | `#e8190f` | Helvetica/Inter |
| `pastel-aura` ★ | [styles/pastel-aura.html](styles/pastel-aura.html) | ivory + mint/lavender/peach aura gradients · serif headlines · white floating cards | `#A98F5E` | Georgia + Songti SC serif |
| `glass` ✦ | [styles/glass.html](styles/glass.html) | **玻璃拟态 glassmorphism** · simple two-color gradient · prominent frosted-glass panel · cool palette · film grain | `#5B8CFF` | Inter + PingFang SC |
| `glass-hud` ✺ | [styles/glass-hud.html](styles/glass-hud.html) | **暖玻 HUD** · warm-neutral frosted panel floating **over the live talking-head** · top chapter rail · bottom scrubber + bilingual caption · mono EN labels · numbered list w/ right-aligned notes | `#E0894A` | PingFang SC + ui-monospace |
| `spatial` ✶ | [styles/spatial.html](styles/spatial.html) | single warm-dark atmosphere · faux-3D floating panel (perspective + double shadow) · warm rim light · viewfinder corner chrome · grain + halftone | `#FF8A4C` | Inter + PingFang SC + mono meta |
| `nebula-glass` ✸ | [styles/nebula-glass.html](styles/nebula-glass.html) | pure-black deep space · twin flow-field particle stars (silver + electric-blue hot-core) · frosted-glass panel · Swiss/Guizang type (hollow giant numeral, hairline rules) · viewfinder chrome | `#5B8CFF` | Inter + PingFang SC |
| `neon-grid-hud` ✹ | [styles/neon-grid-hud.html](styles/neon-grid-hud.html) | **炸裂档** cyberpunk · talking-head in a NEON WINDOW with perspective grid floor + rising particles + HUD readouts + giant glowing title — **effects live BEHIND the window, never on the face** · own window-scene layout · A/B/C complexity tiers | `#00fff0` | Inter + PingFang SC + mono |
| `editorial-print` ◆ | [styles/editorial-print.html](styles/editorial-print.html) | warm paper · 3px ink borders · HARD offset shadow (no blur) · grain · ghost serif · hand-drawn arrow — an **asset montage**, not a text card | `#16140F` | serif headline + Inter labels |
★ `pastel-aura` — light/soft branch: ivory + pastel aurora gradients, serif
headlines, white floating cards. Best for 个人分享 / brand storytelling /
AI·SaaS tone. Pairs well with `pip` or `stack`; pip uses a white-ring pill.

✦ `glass`（**玻璃拟态 glassmorphism**，2026-06 重做：去掉彩雾 → 纯磨砂玻璃）—
中文名「玻璃拟态」。背景**只用两个素色之间的简单渐变**（深靛 → 青蓝，可加 1 个极淡冷
光斑），磨砂玻璃面板是绝对主角（backdrop-blur 拉满 + 亮边 + 顶部高光）。**不要多团
彩雾、不要 hue 大范围转**。与 nebula-glass 同为冷调玻璃，但 nebula 是颗粒星场、这个是
纯净玻璃拟态。accent `#5B8CFF`。Best with `overlay` / `stack` / fullscreen hero。

✺ `glass-hud`（**暖玻 HUD** · 口播玻璃叠加）— `glass` 的「口播叠加版」：不再是满屏卡，
而是**暖中性磨砂玻璃面板浮在真人视频上**（面板透明、视频从玻璃后透出），terracotta 橙
`#E0894A` 做唯一 accent，英文小标 + 进度/字幕英文用 **等宽 mono**。三个部件分两层：
**(A) 玻璃信息面板 = per-card**（kicker 章节名 + 大标题 + EN mono 副标 + 发丝线 + 编号列表
「橙序号 · 左 item · 右对齐 dim 批注」，clone `styles/glass-hud.html` 即得）；
**(B) 顶部章节条 + 底部进度轴 + 双语字幕 = composition-level chrome**（常驻整片，贴进
composition-shell 的 `#stage`，配方写在 `styles/glass-hud.html` 头注释「Composition-level」段；
底部双语字幕**复用 skill 的 `subtitles` 机制**只换皮）。**必配可读性渐变**否则亮视频上糊字。
气质：克制地「上下框住人脸」——顶部进度、玻璃信息在上半左、人脸居中、字幕在底。
accent `#E0894A`，字体 PingFang SC + ui-monospace（mono 系统回退已在 terminal 验证）。
Best with `overlay`（恒用）；frame 恒 `clean`；用于：口播枚举（N 个坑 / N 条原则 / 护城河式
清单）/ 销售·方法论拆解 / 「你以为 A 其实 B」反转金句 / 暖调车内·室内·人物口播。
auto-style.py 已列入 dark·warm / dark·neutral 候选。

✶ `spatial`（暗场太空舱 / 空间感）— `glass` 的「立体化升级」：同样
暗场暖光，但把沉浸式 3D 体验页的 DNA（单一氛围色笼罩 + 电影级打光 +
3D 空间纵深 + 取景框仪表盘字 + 颗粒/半调）用纯 CSS 伪造：`perspective` +
倾斜面板 + 双层投影做体积感，`::after` 径向暖光做 rim light。composition 级
配方写在 `styles/spatial.html` 头注释里（中央暖橙辉光 + 「推进式」transZ
转场 + 暗角 + 颗粒常驻）。

**Recommended layout for spatial + talking-head (口播)**: enlarge the speaker
pip to the source's true 9:16 (≈560×996), centre it horizontally and place it
in the upper half (`top≈150`) floating in the deep-space world, with viewfinder
corner ticks + a small `● REC` label; put the spatial text panel **directly
below it** (card `.root`: `justify-content:flex-start; padding-top:≈1180px`,
~30–40px gap) so speaker + caption read as one unit, and keep the empty deep
space at the top/bottom edges — **not** trapped between them. (Anti-pattern: a
tiny pip on top + a panel sunk at the bottom leaves a dead band in the middle.)
This whole composition (atmosphere on `#stage` + pip + transparent cards + GSAP)
is fully worked out in SKILL.md Step 9 — copy that template.

✸ `nebula-glass`（暗场星云 · 磨砂玻璃 · 归藏排版）— 三股 DNA 融合：**flow-field
双星粒子场**（黑底 + 银白星 + 电光蓝热核星 + 拖丝，呼应 Velo/fable 类粒子模型的
沉浸能量感）+ **磨砂玻璃面板**（沿用 glass 的 backdrop-blur DNA）+ **归藏式
瑞士排版**（强字阶、超大空心序号、发丝线、letter-spaced 英文 meta、取景框 chrome）。
**关键**：真粒子场是 composition 级 canvas（卡片禁 `<script>`），必须写成**时间闭式
`pos=f(t)` 并由 GSAP 时间轴 onUpdate 驱动**——这样 hyperframes 的确定性 seek 捕获才能
逐帧精确复现（已实测：同一时刻截两帧 md5 完全一致）。卡片 `.root` 保持透明让粒子透出。
整段可粘贴的 canvas 配方写在 `styles/nebula-glass.html` 头注释「Composition-level」段。
Best with `overlay`（粒子全屏最出彩）/ `stack`；frame 恒 `clean`；用于短视频高光 /
产品·科技发布 / 强情绪开场 / AI 话题 / 电影感收尾。把蓝热核星换暖橙 `#FF8A4C` 即得
「暖星云」变体，与 `spatial` 同温。守则：粒子是壁纸不是主角，口播时整体降亮 ~20%
不与人脸抢。

✹ `neon-grid-hud`（霓虹网格 · 赛博 HUD · 真人窗口 + 特效在后）— 「炸裂档」旗舰，
2026-06 从 interflow-playground 固化进产线。**它和所有「黑底叠特效」风格的根本区别：
真人是一个霓虹边框的「窗口」，透视网格地面 / 上升粒子 / 地平线辉光 / HUD 数据 / 巨字辉光
全在窗口的「后面」和「周围」——特效永远不糊脸。** 这正是 nebula-glass 硬把粒子叠在满屏
人脸前面会糊脸、而 neon-grid-hud 不会的原因。架构三层：场景 canvas（#scene，闭式 draw(t)
GSAP 驱动，铺满 #stage 在最底）→ 真人**竖向窗口**（#video-wrap，霓虹边框/角标/REC/音波 EQ
写在窗口内随缩放）→ HUD 内容层（per-card：eyebrow + 数据 chip + 巨字辉光标题 + sub）。
专属 **window-scene 布局** + 起伏运镜（窗口→PiP→全屏）+ **A/B/C 复杂度档**（A 克制 / B 标准
默认 / C 满配炸裂——扫描线/ticker/EQ/flicker）。**满脸窗口铁律**：窗口必须竖向且比例 ≥ 源
比例，否则只剩上半脸。整套配方（场景 canvas 闭式 draw(t)、三态 videoBounds、A/B/C 增删、
内容类）写在 [styles/neon-grid-hud.html](styles/neon-grid-hud.html) 头注释。frame 恒 `clean`。
accent cyan `#00fff0` + magenta `#ff2db4`。最适合：科技/发布会预告 / 短视频高光 / 强情绪开场 /
AI 话题 / 个人 IP 预告 / 任何想要「夸张视觉」的题材。auto/无需询问 + 题材适合炸裂时即默认选它。

◆ `editorial-print`（暖纸印刷感 montage）— the odd one out: a **fullscreen
asset-driven scene** where user images/video clips are arranged like a printed
editorial spread (warm `#F5F5EE` paper, 3px ink borders, hard offset shadows,
grain, oversized ghost serif, hand-drawn arrows). It ignores the video↔card
split — every card is the whole canvas. Use it for product/portfolio showcases,
大事记, company intros, or a B-roll montage beat inside a 口播 cut (hide
`#video-wrap` during the scene). Full kit — 5 layout primitives (poster /
photo-grid / collage / logo-strip / print-stack), 3 transitions (whip-pan /
blinds-wipe / paper-flash), asset staging, image↔video slot rules, and the two
usage modes — in [editorial-print-montage.md](editorial-print-montage.md).
Frame is always `clean` (panels carry their own border).

Choose by content tone, not by content type — `swiss` works for a reflective
finance piece if the tone is disciplined; `terminal` works for non-tech if the
tone is "engineering rigor".

## Video Frames — decoration around the video element

| key | file | character | when to skip |
|---|---|---|---|
| `clean` | [frames/clean.html](frames/clean.html) | no decoration; raw video | default; safest |
| `hairline` | [frames/hairline.html](frames/hairline.html) | double-stroke + four-corner viewfinder ticks | over `overlay` layout (clashes with full-bleed) |
| `polaroid` | [frames/polaroid.html](frames/polaroid.html) | white photo frame + Caveat label + blue washi tape (no tilt) | over `overlay` layout; portrait PiP gets cramped |

A frame is a decorative div that sits **next to** the `#video-wrap` inside
the composition's `#stage`. It is one-time HTML (not animated), but you can
fade it in/out across cards. See each frame file for the placement snippet
and the inline `<style>` it needs.

## Motion（默认连续运动）

The DEFAULT animation model is **silky / continuous**, not a PPT slideshow.
Cards overlap and slip; nothing freezes; the camera rides along. Author every
composition to this default unless a style/layout file overrides it.

### Slip transition（默认转场，取代硬切）
Adjacent cards **OVERLAP** by a slip window `SLIP ≈ 0.55s` — the incoming card
starts before the outgoing one is gone. Outgoing card slips UP + blur + fade
(`power2.in`); incoming card slips in from below and sits on a higher
`data-track-index` so it paints on top:

```js
// outgoing (ends at T)
tl.to(OUT, { opacity:0, y:-90, filter:'blur(14px)', duration:0.6, ease:'power2.in' }, T - SLIP);
// incoming (starts at T - SLIP, overlaps)
tl.fromTo(IN,
  { opacity:0, y:120, filter:'blur(16px)', scale:0.94 },
  { opacity:1, y:0,   filter:'blur(0px)',  scale:1, duration:0.7, ease:'expo.out' }, T - SLIP);
// IN's card has a higher data-track-index than OUT
```

### Ambient drift（没有东西是死的）
Every card carries an ambient yoyo loop so the frame keeps breathing. Amplitude
tiny (**≤12px or ≤0.6°**), period **8–14s**, `yoyo`. Use a **FINITE** repeat
sized to the composition — **never `repeat:-1`** (HyperFrames' deterministic
capture forbids infinite repeats):

```js
// legSec = 11; repeat covers the whole film
tl.to(SEL, { y:'+=10', duration:11, ease:'sine.inOut', repeat: Math.ceil(compDurationSec/11), yoyo:true }, T);
```

### Continuous easing
- entrances → `expo.out` / `power3.out`
- transitions & `#video-wrap` framing → `power3.inOut`（was `power2.inOut`）

### Shared camera（#video-wrap 跟着卡片一起动）
`#video-wrap` reframes at the **SAME start time** `T` as the card slip and uses
the **matching ease** `power3.inOut`. The video and the card move as one camera
move, never out of sync.

### New data-anim primitives（旧的全部保留）
| primitive | what it does | when to use |
|---|---|---|
| `settle` | damped entrance, `{opacity:0,y:28,filter:'blur(6px)'}`→`{...,ease:'expo.out'}` | **default for body content** — quiet, lands and holds |
| `parallax-in` | entrance that keeps drifting after it lands | hero / panel that should feel alive |
| `drift` | ambient forever loop (the recipe above) | give one persistent element gentle life |

### 恰到好处 guardrails
- **One** primary transition gesture per cut — don't stack slips.
- **≤2** persistent motions on screen at once.
- Ambient motion **never out-moves the speaker** — it's atmosphere, not the act.
- Key info **holds still ≥1.5s** before it drifts or leaves.

## Decision guide (loose, not prescriptive)

| video content | suggested combos |
|---|---|
| 访谈 / 对话 | `swiss` × `stack`, `minimal` × `split` |
| 产品发布 / 公告 | `neon-grid-hud` × `window-scene`（炸裂）, `nebula-glass` × `overlay`, `geom` × `pip` |
| 夸张视觉 / 赛博 / 发布会预告 / 个人 IP 预告 | `neon-grid-hud` × `window-scene`（炸裂档默认；特效在人后不糊脸） |
| 数据分析 / 财报 | `swiss` × `split`, `swiss` × `stack`, `terminal` × `pip`, `minimal` × `stack` |
| 社交剪辑（9:16） | `pastel-aura` × `stack`, `nebula-glass` × `overlay` |
| 技术教程 | `terminal` × `split`, `minimal` × `pip` |
| 情绪故事 / 旁白 | `nebula-glass` × `overlay`, `glass` × `overlay`, `spatial` × `overlay`, `pastel-aura` × `stack` |
| 口播枚举 / 方法论拆解 / 护城河清单 | `glass-hud` × `overlay`（章节条 + 编号列表 + 双语字幕）, `terminal` × `pip` |
| 短视频高光 / 电影感 | `neon-grid-hud` × `window-scene`（炸裂）, `nebula-glass` × `overlay`, `spatial` × `overlay`, `glass` × `overlay`, `geom` × `pip` |
| 产品发布 / 科技沉浸感 | `nebula-glass` × `overlay`, `spatial` × `pip`, `spatial` × `overlay`, `glass` × `overlay` |
| 极简陈述 | `minimal` × `split`, `swiss` × `overlay` |
| 评价墙 / 卖点轮播 / 多条金句 | `pastel-aura` × `deck`, `glass` × `deck` |
| 案例墙 / hook 拆解 / 作品集巡览（带观看数证据） | `pastel-aura` × `showcase`, `swiss` × `showcase` || 素材展示 / 作品集 / 大事记 / 公司介绍 | `editorial-print`（fullscreen scene, no video↔card split — see [montage kit](editorial-print-montage.md)） |

These are starting points only. Look at the transcript, pick the tone, then
pick the visual.

## Auto style-match by video color（明暗 / 冷暖自动匹配）

Before asking the user (SKILL.md Step 7.0), run
`scripts/auto-style.py <video> --json` — it samples frames, reads each frame's
average color via `ffmpeg scale=1:1`, and classifies the video as
**light/dark × warm/cool**, returning a ranked `recommend` list. This is the
**白天/黑夜自动切换**: a bright video → a light style (`swiss` / `pastel-aura` /
`minimal`); a dark video → a dark style (`nebula-glass` / `glass` /
`glass-hud` / `spatial`); warmth picks within (warm/neutral talking-head →
`glass-hud`). Use `recommend[0]` as the default style
(mark it 推荐 in the question, or apply directly when the user pre-approved
defaults). Always overridable by the user's explicit pick.

## Portrait sizing — bigger type for mobile

Every `references/styles/*.html` is sized for a **1920×1080 landscape**
preview. When the final composition is **portrait (1080×1920)** — the
default for social / mobile — scale every visual size up so it reads on a
phone held close.

| token | landscape | **portrait** | scale |
|---|---|---|---|
| hero title (h1/h2) | 64–96px | **88–132px** | ×1.35 |
| detail / body | 24–30px | **30–40px** | ×1.30 |
| kicker / chip / meta | 14–18px | **18–22px** | ×1.25 |
| primary number / stat | 48–60px | **64–88px** | ×1.40 |
| horizontal padding | 40–64px | **24–36px** | ÷1.5 |

`portraitPx ≈ round(landscapePx × 1.3)`. Hero headlines can go ×1.4;
small meta stays at ×1.2. Padding **shrinks** in portrait since the card
is narrower.

For a card that must work in both, use a container query on the card
root: `container-type: inline-size` + `font-size: clamp(64px, 8.5cqi, 132px)`.

## Source aspect ratio independence

Output canvas is independent of source video aspect. Three supported
output ratios (selected by the user in Step 7.0 of SKILL.md):

| ratio | canvas | `storyboard.layout` | best for |
|---|---|---|---|
| `16:9` | 1920×1080 | `"landscape"` | YouTube / TV / desktop playback |
| `9:16` | 1080×1920 | `"portrait"` | TikTok / Reels / 抖音 / 小红书 |
| `4:5` | 1080×1350 | `"portrait"` (schema treats 4:5 as portrait since h>w) | Instagram feed / 微信朋友圈 / 兼顾两端 |

The layout reference files in `layouts/` document **landscape** and
**portrait** bounds only. For **4:5** derive bounds by proportional
vertical scaling from portrait: `4:5 y/h = round(portrait y/h × 0.703)`,
keep `x/w` identical. The composer doesn't care about the named layout
value; it just uses `composition.width × height`.

- Landscape video on landscape canvas → `videoBounds` matches video aspect, no letterbox
- Portrait video on landscape canvas → `videoBounds` is a narrower box (e.g. `pip` becomes 248×440); empty side filled by card or background
- Landscape video on portrait canvas → `videoBounds` becomes a wide-but-short band; `stack` and `overlay` work best
- Portrait video on portrait canvas → most natural; any layout

The layout reference files show landscape values; for portrait you usually
flip the long axis: `split` becomes top/bottom, `pip` video bubble shrinks
~20%, `overlay` card slot widens to full width.

## Constraints you must obey when copying from these references

1. **No `<script>`** — animations only via `data-anim-*` attributes
2. **No external URLs** — no Google Fonts CDN, no remote images; the
   skill provides Caveat / LXGW WenKai TC / Inter / Virgil locally
3. **All `<style>` rules must be prefixed with `.card[data-card-id="..."]`** —
   the interflow-video-cut sanitizer auto-scopes them, but write them already-scoped to
   stay readable
4. **No `on*=` inline handlers**
5. **CSS variables for colors** when you want a card to switch theme cleanly;
   inline hex when you want this specific style's signature look

If a reference uses a font you don't have, fall back:
- Playfair Display / Noto Serif SC → `ui-serif, "Songti SC", "Times New Roman", serif`
- Noto Sans SC → `ui-sans-serif, system-ui, sans-serif`
- JetBrains Mono → `ui-monospace, "SF Mono", Menlo, monospace`
- Kalam → `'Caveat', cursive`
