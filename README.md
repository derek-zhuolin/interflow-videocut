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
- **16 种精选视觉风格**（11 款核心 + **炸裂族** 6 款竖屏吸睛）× 多种布局 × 3 种视频边框，自由组合；旗舰 **暗夜星河** `nebula-glass` 是黑底双星粒子场 + 磨砂玻璃 + 歸藏排版
- **横屏与竖屏走两条审美**：横屏分享走**简洁克制的歸藏排版风**（暗夜星河 / 玻璃拟态这类冷调玻璃 + 强字阶 + 大留白），信息清楚、高级、耐看；竖屏社媒尽量**吸睛炸裂**，优先**炸裂族**（霓虹巨字、液态极光、电影光晕，3 秒抓人）
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

## 用之前先了解：它怎么跑、花多少 token、要多久

**它的本质是一条 CLI 管线，夹着一段 Agent 创作。** 两头（抽音轨 / 转录 / 渲染）是确定性的命令行工具，不花 LLM token；只有中间"设计卡片、写 HTML"那几步是 Agent 在思考——**token 全花在这，时间大头在渲染**。用之前把这两件事搞清楚，就不会有意外。

### Token 花在哪

| 步骤 | 谁在干 | 花 LLM token？ |
|---|---|---|
| 抽音轨 / 转录 / 修稿 | ffmpeg + vtake（外部 CLI） | ❌ 不花 |
| **storyboard / 写卡片 / 拼装** | **Agent 思考 + 写 HTML** | ✅ **token 全在这** |
| 预览 / 渲染 MP4 | hyperframes（外部 CLI） | ❌ 不花 |

- **token 主要随"卡片数量 + 文字稿长度"涨**：写卡片 HTML 是大头（输出 token），读文字稿是其次（输入，读一次）。所以同样内容，卡切得越碎、视频越长，token 越多。
- **换转录引擎（ElevenLabs ↔ 本地 Whisper）不影响 token**：喂给 Agent 的文字稿一样大。Whisper 省的是 API 额度，不是 token。
- 想省 token：卡片数量克制、storyboard 阶段一次想清楚少返工，比什么都管用。

### 耗时花在哪（按量级，从快到慢）

> ⚠️ 实际时长因机器、视频长度、帧率、是否开 GPU 而异——下面是**量级感受，不是承诺值**。

| 阶段 | 量级 | 说明 |
|---|---|---|
| 抽音轨 | 秒级 | ffmpeg，最快 |
| 转录 | 几十秒 ~ 一两分钟 | 看音频长度；代理模式注意每分钟 3 次限流 |
| 设计 + 写卡片 | 几分钟 | Agent 在干活，卡越多越久 |
| **渲染 MP4** | **通常最久** | hyperframes 逐帧渲染，由"时长 × 帧率"决定；macOS 开 `PRODUCER_BROWSER_GPU_MODE=hardware` 明显更快 |

**最耗时的是渲染，不是 AI。** 所以第 10 步强制「先预览再渲染」——预览是热重载网页，秒级看效果，满意了才花时间渲成片，避免渲染完才发现要改、白等一轮。

> 想远程 / 无人值守 / 批量跑它？因为全程 CLI 驱动，这些都做得到——见文末[「进阶玩法」](#进阶玩法社区可自行改造)。

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

> 📝 **想改成本地 Whisper？可以——这是个干净的改造点。** 转录是整条管线里唯一的"外部引擎"插槽（SKILL.md 第 4 步）。把 `vtake transcribe --asr elevenlabs` 换成本地 `whisper.cpp` / `faster-whisper`，只要输出同样结构的 `transcript.json`（含词级时间戳），后面所有步骤都不用动。改完你得到：**零 API 成本、完全离线、隐私不出本机、不受任何限流**。
>
> 但有个常见误解要澄清：**它省的不是 Claude token。** 转录用哪个引擎，喂给 Agent 的文字稿大小一样大；LLM token 只花在"设计卡片 / 写 HTML"那几步。本地 Whisper 省的是 ElevenLabs 的调用额度和网络依赖，不是上下文 token。

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

## 16 种视觉风格（中文名一眼挑对）

选风格时按「内容想要什么感觉」挑，分 5 大类：

| 大类 | 风格（中文名 · key） |
|---|---|
| **暗调电影感**（黑底·高级·有动态） | **暗夜星河** `nebula-glass`（旗舰：黑底双星粒子场 + 玻璃 + 歸藏排版，最高级最科技）· **玻璃拟态** `glass`（简单两色 + 磨砂玻璃，半透明干净）· **暖玻 HUD** `glass-hud`（暖玻璃面板浮在真人口播上 + 章节条 + 双语字幕，橙色 accent，口播枚举/护城河清单专用）· **暖光太空** `spatial`（黑底暖橙光，温暖有空间感）· **撞色大字** `geom`（黑底亮色块超大字，大胆有冲击） |
| **炸裂族**（竖屏社媒·吸睛·夸张视觉）⚡ | **霓虹网格** `neon-grid-hud`（炸裂档默认：赛博真人霓虹窗口 + 透视网格 + 粒子，**特效永远在人后不糊脸**）· **流光极光** `liquid-aurora`（流动液态极光，品牌/情绪/治愈）· **全息虹彩** `holo-iridescent`（全息箔色散，最前卫/产品揭晓）· **电影光影** `cinematic-bloom`（宽银幕镜头光晕，大片质感）· **动态巨字** `kinetic-megatype`（瑞士粗野巨字运动，态度/宣言/金句）· **纵深视差** `depth-parallax`（多层 3D 景深，立体/沉浸） |
| **干净专业**（数据·报告·严肃） | **瑞士网格** `swiss`（白底红点大字，专业权威）· **黑白极简** `minimal`（纯黑白大字 + 大留白）· **代码终端** `terminal`（黑底绿字代码风，技术极客） |
| **浅色清爽**（日常·白天·轻松） | **柔光浅色** `pastel-aura`（浅色柔和，白天/日常感） |
| **杂志素材**（作品集·素材排版） | **杂志印刷** `editorial-print`（把照片/素材排成杂志跨页，不是文字卡） |

> **横屏分享 vs 竖屏社媒，风格取向不一样：**
> - **横屏**（YouTube / B站 / 桌面播放 / 长内容）—— 走**简洁克制的歸藏排版风**：**暗夜星河** `nebula-glass`、**玻璃拟态** `glass` 这条冷调玻璃 + 强字阶 + 大留白的路线，信息清楚、高级、耐看，横屏大画面里最稳。
> - **竖屏**（抖音 / 小红书 / Reels / 短视频高光）—— **尽量吸睛炸裂**，优先**炸裂族**：满屏特效、霓虹巨字、电影光晕、液态极光，3 秒抓住划走的拇指。炸裂族全部走 **window-scene 架构**（真人在窗口里、特效在窗口后），所以再炸也不糊脸。

完整中文词库、布局/边框矩阵、组合建议、自动日夜匹配规则见 [`references/DESIGN_INDEX.md`](references/DESIGN_INDEX.md)。
每种风格都是一个自包含的 HTML 参考卡，可直接复制改写。几个特别说明：

- **炸裂族 6 款**（`neon-grid-hud` / `liquid-aurora` / `holo-iridescent` / `cinematic-bloom` / `kinetic-megatype` / `depth-parallax`）全部走 **window-scene 架构**——真人在一个窗口里、全屏特效铺在窗口**后面**，所以再夸张也不糊脸。都已渲染加固成确定性版本（逐帧可复现），可直接在选风格题里挑；调性矩阵和加固清单见 [`references/DESIGN_INDEX.md`](references/DESIGN_INDEX.md) 的「炸裂族」段与 [`references/styles/playground-gallery/`](references/styles/)。
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

## 进阶玩法（社区可自行改造）

这个 skill 全程 **CLI 驱动**（ffmpeg + vtake + hyperframes），中间只有"设计卡片"这步需要 Agent 思考——意味着它**可以无人值守、可以远程触发、可以批量**。几个值得试的方向：

- **远程出片**：因为它能被任何"调得起本机 Agent / Claude Code 的通道"触发，你可以接飞书 / Lark CLI、Telegram bot 之类——人在外面，往群里丢一条口播视频 + 一句「剪成竖屏」，本机 skill 自动跑完再把成片回传。视频生产从"坐在电脑前"变成"发条消息"。
- **本地 Whisper 改造**：见上面[「关于转录引擎」](#关于转录引擎为什么只用-elevenlabs不下本地-whisper)一节——离线 / 省 API 额度 / 隐私场景适用，转录第 4 步换引擎即可，后续不动。
- **批量矩阵出片**：配自有 `ELEVEN_API_KEY` 跳过限流后，写个脚本循环喂多条视频，一次出一批（适合做员工 / 账号矩阵这种每天多条的场景）。
- **自定义风格库**：`references/styles/` 下每个 HTML 都是自包含的风格模板，加一个你自己的就多一种选择——团队可以在这里沉淀统一视觉语言。

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

在此基础上，本项目重做了卡片设计系统（16 种精选视觉风格 + 自动日夜配色匹配）、布局 / 画幅决策流程和俱乐部落款。感谢 Leo 的开源。

> *Inspired by and built on top of [vtake](https://github.com/notedit/vtake-skills) by [Leo Xiang (@notedit)](https://github.com/notedit).*

**致敬歸藏（[@op7418](https://github.com/op7418)）。** 本 skill 多处视觉灵感都建立在歸藏的视觉 DNA 之上——尤其**瑞士网格** `swiss`，以及仓库里统称「**歸藏排版**」的旗舰暗调风格（**暗夜星河** `nebula-glass`、**暖光太空** `spatial`）：那套「强字阶 + 超大空心序号 + 发丝线 + letter-spaced 英文 meta + 取景框 chrome」的瑞士／杂志式排版语言，DNA 直接取自歸藏的
**[guizang-social-card-skill](https://github.com/op7418/guizang-social-card-skill)**（Editorial × Swiss 视觉系统）——是他把这种克制、网格化、高信息密度又高级的排版美学在中文设计圈带火。我们在它之上叠了粒子场、玻璃面板和动效，但骨子里的字阶与留白是他的审美。横屏分享尤其推荐这条简洁歸藏风。

> *Swiss / editorial type & layout DNA — `swiss`, `nebula-glass`, `spatial` — inspired by [guizang-social-card-skill](https://github.com/op7418/guizang-social-card-skill) by [歸藏 (@op7418)](https://github.com/op7418).*

## 联系作者 · 互通有无 AI 俱乐部

这个 skill 由 **卓霖（Derek）原创开发**。要交流、合作，或想用它一起把视频做得更好、更快，欢迎加我微信：

> 💬 **微信号：`zhuolin25`**

我们是 **互通有无 AI 俱乐部**，坐标 **上海**。欢迎同频的人互联——目标很简单：让大家**一起做出好视频，或者说更高效地做视频**。

> ⏳ **性能说明**：前期模型 / 渲染如果跑得慢，可以**耐心等一等**——目前还在持续优化中。欢迎持续关注，有任何问题随时加我微信 `zhuolin25` 沟通。

---

Made by **Interflow AI** · 口播 → 成片，你只管讲。
