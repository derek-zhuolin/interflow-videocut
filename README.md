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
- 13 种可选视觉风格 × 4 种布局 × 3 种视频边框，自由组合
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

1. 把整个 `interflow-video-cut/` 文件夹放进你的 Agent skills 目录
   （Claude Code / Codex 等：`~/.claude/skills/`、`~/.agents/skills/` 等）。
2. 确保系统已装依赖（见下）。
3. 在对话里说「用 interflow-video-cut 剪这条视频 /path/to/video.mp4」即可。

### 依赖

| 依赖 | 用途 | 安装 |
|---|---|---|
| `ffmpeg` / `ffprobe` | 抽音轨、读元数据、烘焙旋转 | `brew install ffmpeg` |
| Node.js + `npx` | 跑 vtake / hyperframes CLI | nodejs.org |
| `@notedit/vtake` (CLI) | extract / transcribe 引擎 | 首次自动 `npx` 下载 |
| `hyperframes` (CLI) | HTML → MP4 渲染引擎 | 首次自动 `npx` 下载 |

> **转录只走 ElevenLabs，永不下载本地语音模型。** 默认就是代理模式——不需要 API Key、零模型下载、开箱即跑（限流：每 IP 每分钟 3 次）。想绕过限流再设 `ELEVEN_API_KEY` 直连 ElevenLabs 即可。

字体（Inter / Caveat / LXGW WenKai TC / Virgil）和 GSAP 已打包在 `assets/`，无需额外安装。

## 使用

调用后，skill 会先问你 5 个视觉决策（自动推荐匹配源视频的画幅）：

1. **画幅** — 16:9 / 9:16 / 4:5
2. **布局** — split 左右 / stack 上下 / pip 画中画 / overlay 全屏浮层
3. **风格** — 4 大类，见下
4. **卡片数量** — 按时长+密度自动推断，或自定义
5. **运镜节奏** — 固定人像（人脸始终在画面，稳）或起伏运镜（人像大→缩 PiP→消失做全屏 highlight→切回，有张力）

然后它设计 storyboard、逐张写卡、拼装，**先开本地预览让你看**，你满意了才渲染成片。

## 13 种视觉风格

| 大类 | 风格 |
|---|---|
| 柔和极光 | `pastel-aura`（象牙白 + 极光渐变 + 衬线 + 白浮卡） |
| 温暖纸感 | `academic` `editorial` `whiteboard` `xhs` |
| 冷峻临床 | `audit` `swiss` `terminal` `minimal` |
| 实验电影感 | `geom` `spotlight` `aurora-glass` `spatial`（暗场太空舱：深空暖光 + 伪 3D 悬浮面板 + 取景框仪表盘字 + 颗粒） |

完整目录、布局/边框矩阵、组合建议见 [`references/DESIGN_INDEX.md`](references/DESIGN_INDEX.md)。
每种风格都是一个自包含的 HTML 参考卡，可直接复制改写。

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

在此基础上，本项目重做了卡片设计系统（13 种视觉风格）、布局 / 画幅决策流程和俱乐部落款。感谢 Leo 的开源。

> *Inspired by and built on top of [vtake](https://github.com/notedit/vtake-skills) by [Leo Xiang (@notedit)](https://github.com/notedit).*

---

Made by **Interflow AI** · 口播 → 成片，你只管讲。
