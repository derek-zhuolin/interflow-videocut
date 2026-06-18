# Interflow Video Cut — 口播成片 Skill

把一条本地口播 / talking-head 视频，自动变成**卡片式成片**：抽音轨 → 转录 →
逐句设计卡片 → AI 在对话里手写每张卡的 HTML → 拼装 → 渲染成 MP4。

> **Interflow AI 出品** — 这是 Interflow AI 俱乐部维护的开源 Agent Skill。

---

## 它解决什么

口播视频很容易录，但「录完 → 配字卡 → 排版 → 出成片」很费时。Interflow Video Cut
把这条流水线交给 Agent：它读你的文字稿，自己决定切几张卡、每张讲什么、用什么
视觉，然后**直接写 HTML 卡片**并渲染成可发布的竖屏/横屏成片。

- 没有固定模板套路——卡片从文字稿真实内容里长出来
- **10 种精选视觉风格** × 4 种布局 × 3 种视频边框，自由组合；旗舰 **暗夜星河** `nebula-glass` 是黑底双星粒子场 + 磨砂玻璃 + 归藏排版
- **自动匹配视觉风格**——读源视频的明暗/冷暖，自动选浅色（白天）或深色（黑夜）风格，也可手动覆盖
- **默认悬浮面板留白**——视频和卡片都是带圆角、四周留距的悬浮窗，不顶天立地铺满（更有空间感，避免「太满」）
- 输出 9:16 / 16:9 / 4:5，适配抖音 / 小红书 / YouTube / Instagram
- 结尾自带 **Interflow** 俱乐部落款（一句视频回扣 + wordmark + 一句延伸 + slogan，可一键换成你自己的品牌）

## 工作流程（SKILL.md 全文）

```
input.mp4
  → extract     (ffmpeg)        metadata.json + audio.mp3
  → transcribe  (ElevenLabs ASR) transcript.json（词级时间戳）
  → 修订文字稿
  → storyboard  (在对话里规划：切几张卡、每张的时间/内容)
  → 逐张手写 public/cards/card-XX.html
  → 拼装 public/index.html（GSAP 主时间轴 + 视频层 + 卡片层）
  → 预览迭代（hyperframes preview，热重载）
  → 渲染 output.mp4（hyperframes render）
```

## 安装

1. 把本仓库 clone 进你的 Agent skills 目录，**文件夹名固定为 `interflow-video-cut`**
   （要和 SKILL.md 里的 `name:` 一致，skill 才能被正确识别）：

   ```bash
   # Claude Code / Codex 等通用：~/.claude/skills/ 或 ~/.agents/skills/
   cd ~/.claude/skills
   git clone https://github.com/derek-zhuolin/interflow-video-cut.git interflow-video-cut
   ```

   > clone 时末尾的 `interflow-video-cut` 就是目标文件夹名，别省略——
   > 否则会落成默认的仓库名，导致文件夹名和 skill `name` 对不上。
2. 确保系统已装依赖（见下）。
3. 在对话里说「用 interflow-video-cut 剪这条视频 /path/to/video.mp4」即可。

### 依赖

| 依赖 | 用途 | 安装 |
|---|---|---|
| `ffmpeg` / `ffprobe` | 抽音轨、读元数据、烘焙旋转、自动配色匹配 | `brew install ffmpeg` |
| `python3`（标准库） | 自动日夜配色匹配 `scripts/auto-style.py` | 系统自带 |
| Node.js + `npx` | 跑 vtake / hyperframes CLI | nodejs.org |
| `@notedit/vtake` (CLI) | extract / transcribe 引擎 | 首次自动 `npx` 下载 |
| `hyperframes` (CLI) | HTML → MP4 渲染引擎 | 首次自动 `npx` 下载 |

> **转录只走 ElevenLabs，永不下载本地语音模型。** 默认就是代理模式——不需要 API Key、零模型下载、开箱即跑（限流：每 IP 每分钟 3 次）。想绕过限流再设 `ELEVEN_API_KEY` 直连 ElevenLabs 即可。

字体（Inter / Caveat / LXGW WenKai TC / Virgil）和 GSAP 已打包在 `assets/`，无需额外安装。

## 关于转录引擎（为什么只用 ElevenLabs，不下本地 Whisper）

转录有两条路线。本 skill **只走 ElevenLabs，刻意不接本地 Whisper**——这里把取舍讲清，方便你按需求量选配置。

**本地 Whisper 路线**（本 skill 不采用）

- 好处：免费、离线、不限速，纯本地跑，不依赖任何外部服务。
- 代价：首次要下载几百 MB ~ 数 GB 的模型，慢且占磁盘；中文标点和**词级时间戳**通常更糙——而本 skill 的卡片排版高度依赖精确的词级时间戳来对齐字卡。
- 因此转录命令写死了 `--asr elevenlabs`，**不存在"手滑下载到本地模型"的可能**。

**ElevenLabs 路线**（本 skill 默认）——底层用 [`@notedit/vtake`](https://github.com/notedit/vtake-skills) CLI（即 vtake），分两种模式：

| 模式 | 怎么用 | 适合 | 限制 |
|---|---|---|---|
| **代理模式**（默认） | 不配任何 key，开箱即跑 | 偶尔剪一两条 | 公共代理限流 **每 IP 每分钟 3 次请求**；一条视频 = 1 次请求，所以单条没问题，**一分钟内别超过 3 条**即可 |
| **自有 key 直连** | `export ELEVEN_API_KEY=你的key` | 需求量大 / 批量出片 | 跳过代理和限流，**直连自己的 ElevenLabs 账户，可并发批量，量大时整体更快更稳** |

> ⚠️ 单条视频两种模式速度**一样**（背后是同一个 ElevenLabs 引擎）；自有 key 的价值是**量大时不撞限流墙、可并发**，而不是让单条更快。每天批量出片的场景，建议配自有 key。

## 使用

调用后，skill 会先问你 5 个视觉决策（自动推荐：画幅匹配源视频比例，风格匹配源视频明暗/冷暖）：

1. **画幅** — 16:9 / 9:16 / 4:5
2. **布局** — split 左右 / stack 上下 / pip 画中画 / overlay 全屏浮层 / deck 3D 卡片轮播
3. **风格** — 5 大类，见下（亮视频自动推浅色、暗视频自动推深色，可手动覆盖）
4. **卡片数量** — 按时长+密度自动推断，或自定义
5. **运镜节奏** — 固定人像（人脸始终在画面，稳）或起伏运镜（人像大→缩 PiP→消失做全屏 highlight→切回，有张力）

然后它设计 storyboard、逐张写卡、拼装，**先开本地预览让你看**，你满意了才渲染成片。

## 10 种视觉风格（中文名一眼挑对）

选风格时按「内容想要什么感觉」挑，分 4 大类：

| 大类 | 风格（中文名 · key） |
|---|---|
| **暗调电影感**（黑底·高级·有动态） | **暗夜星河** `nebula-glass`（旗舰：黑底双星粒子场 + 玻璃 + 归藏排版，最高级最科技）· **玻璃拟态** `glass`（简单两色 + 磨砂玻璃，半透明干净）· **暖玻 HUD** `glass-hud`（暖玻璃面板浮在真人口播上 + 章节条 + 双语字幕，橙色 accent，口播枚举/护城河清单专用）· **暖光太空** `spatial`（黑底暖橙光，温暖有空间感）· **撞色大字** `geom`（黑底亮色块超大字，大胆有冲击） |
| **干净专业**（数据·报告·严肃） | **瑞士网格** `swiss`（白底红点大字，专业权威）· **黑白极简** `minimal`（纯黑白大字 + 大留白）· **代码终端** `terminal`（黑底绿字代码风，技术极客） |
| **浅色清爽**（日常·白天·轻松） | **柔光浅色** `pastel-aura`（浅色柔和，白天/日常感） |
| **杂志素材**（作品集·素材排版） | **杂志印刷** `editorial-print`（把照片/素材排成杂志跨页，不是文字卡） |

完整中文词库、布局/边框矩阵、组合建议、自动日夜匹配规则见 [`references/DESIGN_INDEX.md`](references/DESIGN_INDEX.md)。
每种风格都是一个自包含的 HTML 参考卡，可直接复制改写。两个特别说明：

- **暗夜星河 `nebula-glass`** 的粒子场是 composition 级**确定性 canvas**（写成时间闭式 `pos=f(t)` 并由 GSAP 时间轴驱动，逐帧可复现），整段可粘贴的配方在它的文件头注释里。
- **杂志印刷 `editorial-print`** 是唯一的「素材驱动」风格——多素材排版原语、签名转场、素材入栈规则在 [`references/editorial-print-montage.md`](references/editorial-print-montage.md)。
- **3D 卡片轮播 `deck`** 是新加的布局（不是风格）：卡片本身是主角，一张正对、左右两张退到 3D 扇形里像 cover-flow 轮转，替代默认的 slip 转场；配 `pastel-aura` / `glass` 铺天空底最好看。扇形三槽位 + advance 补间在 [`references/layouts/deck.html`](references/layouts/deck.html)。
- **陈列墙 `showcase`** 是新加的布局：下方口播 pip 常驻 + 上方「案例证据墙」不断累积重排（竖屏 B-roll 卡 1→2→3→网格，红标签 + 观看数 chip + 网格纸底），口播会从底部小窗突然放大全屏再缩回、上方一直滚动播放。**素材驱动**（每张墙卡是喂进来的竖屏片段），多视频源机制复用 [`references/editorial-print-montage.md`](references/editorial-print-montage.md)；三段动效配方在 [`references/layouts/showcase.html`](references/layouts/showcase.html)。

## 换成你自己的品牌落款

结尾卡默认是 Interflow 俱乐部落款，约 3.5 秒，节奏放慢、动效收敛，让收尾「安顿」
下来。结构从上到下是：**一句视频回扣**（recap）→ wordmark → **一句延伸**（purpose）
→ tagline。要换成你自己的：打开 SKILL.md 里 `card-cta` 模板（Step 8），改这几处即可，
动效不用动——

- **视频回扣 recap**：`你只管讲，成片交给我们` → **改成这条视频的核心一句**
  （这是「有内容」的关键——让结尾是内容收束，而不是干贴一张 logo 卡）
- 大字 wordmark：`<span class="name-accent">Inter</span>flow` → 你的名字
- **延伸句 purpose**：`让每个想法，都有更好的呈现` → 你这个品牌/账号是做什么的
  （若 recap 已经把话说透，可删掉这一句，避免两行意思重复）
- 招牌句 tagline：`Interflow AI 出品` → 你的一行 slogan
- 顶部/底部 meta：`INTERFLOW` / `© 2026 Interflow` → 你的
- 中间的 ▶ 标记：可换成你的 logo SVG，或保留这个中性播放标

整张卡是 flex 居中 + `gap`/`clamp` 排版，竖屏 / 4:5 / 横屏都不会撞到角标或溢出。
不想要任何品牌？删掉 wordmark 那一段即可，结尾会是干净的收尾。

## 设计契约（写卡片时必须遵守）

- 单根 `<div class="card" data-card-id="...">`
- 所有 `<style>` 规则用 `.card[data-card-id="..."]` 前缀作用域
- **禁止 `<script>`**、**禁止外链 URL**、**禁止内联事件**
- 动效只用 `data-anim-*` 声明，最后统一编译进一条 GSAP 主时间轴
- **动效默认是「丝滑」**：卡与卡**重叠滑移**转场（不硬切）+ 每张卡挂极慢**环境漂移**（入场后不冻住）+ 镜头 `#video-wrap` 与卡同相移动。恰到好处护栏：一次切换只用一个主转场动作、同屏持续运动 ≤2 个、关键信息落位后静止 ≥1.5s。详见 SKILL.md「Motion Philosophy」与 `references/DESIGN_INDEX.md` 的 Motion 段。

## 第三方资源与许可

本仓库自带代码（SKILL.md、参考卡、本 README）以 [MIT](LICENSE) 授权。
打包的第三方资源各自遵循其原始许可：

- **GSAP** (`assets/vendor/gsap.min.js`) — © GreenSock，标准 GSAP 许可
- 字体 **Inter / Caveat / LXGW WenKai TC** — SIL Open Font License
- 字体 **Virgil**（Excalidraw 手写体）— MIT
- 转录/渲染 CLI **@notedit/vtake**、**hyperframes** — 各自的 npm 包许可

> 注意：`ELEVEN_API_KEY` 等密钥只通过环境变量传入，**不要**写进任何配置或提交进 git。

## 致谢 Credits

本 skill 的灵感来自 Leo Xiang（[@leeoxiang](https://twitter.com/leeoxiang) · GitHub [@notedit](https://github.com/notedit)）的
**[vtake](https://github.com/notedit/vtake-skills)** —— 是他先跑通了「用 Claude Code 一键剪口播视频」这条路。
Interflow Video Cut 在底层也直接调用了他维护的 `@notedit/vtake` CLI 做转录与抽取。

在此基础上，本项目重做了卡片设计系统（10 种精选视觉风格 + 自动日夜配色匹配）、布局 / 画幅决策流程和俱乐部落款。感谢 Leo 的开源。

> *Inspired by and built on top of [vtake](https://github.com/notedit/vtake-skills) by [Leo Xiang (@notedit)](https://github.com/notedit).*

---

Made by **Interflow AI** · 口播 → 成片，你只管讲。
