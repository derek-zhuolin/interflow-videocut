# Interflow Video Cut · 口播成片 Skill

**把一条对着镜头说话的视频，自动剪成带字卡的成片——你只管讲，AI 配字、排版、出片。**

抽音轨 → 转录 → AI 读你的文字稿、自己决定切几张卡、每张讲什么、配什么视觉 →
直接写成 HTML 卡片 → 拼装 → 渲染成可发布的竖屏 / 横屏 MP4。

> 仓库：<https://github.com/derek-zhuolin/interflow-video-cut> · **Interflow AI 出品**（俱乐部维护的开源 Agent Skill）

```
input.mp4
  → 抽音轨 (ffmpeg)            → 转录 (ElevenLabs，带词级时间戳)
  → 修订文字稿                 → AI 规划 storyboard（切几张卡 / 每张内容）
  → AI 逐张手写卡片 HTML       → 拼装一条 GSAP 主时间轴
  → 本地预览（热重载，秒级看）  → 满意后渲染 output.mp4
```

---

## 它好在哪

- **卡片从内容里长出来**，没有套路模板——AI 读你真实说了什么，再决定怎么排。
- **16 种精选视觉风格** × 多种布局 × 3 种边框，自由组合，每种都是自包含可复制的 HTML 卡。
- **自动配视觉**：读源视频的明暗 / 冷暖，自动选浅色（白天）或深色（黑夜）风格，可手动覆盖。
- **先预览再渲染**：预览是热重载网页、秒级看效果；满意了才渲染，不白等。
- **输出 9:16 / 16:9 / 4:5**，适配抖音 / 小红书 / YouTube / Instagram。
- **结尾自带俱乐部落款**，一键可换成你自己的品牌。

---

## 安装

```bash
# clone 进 Agent skills 目录，文件夹名必须是 interflow-video-cut（要和 SKILL.md 的 name 一致）
cd ~/.claude/skills    # 或 ~/.agents/skills
git clone https://github.com/derek-zhuolin/interflow-video-cut.git interflow-video-cut
```

装好依赖后，在对话里说「用 interflow-video-cut 剪这条视频 /path/to/video.mp4」即可。

**依赖**：`ffmpeg`/`ffprobe`（`brew install ffmpeg`）· `python3`（系统自带，做自动配色）·
Node.js + `npx`（跑 vtake / hyperframes，首次自动下载）。字体和 GSAP 已打包在 `assets/`，无需另装。

> 转录默认走 ElevenLabs **代理模式**：不用配 key、开箱即跑（限流：每 IP 每分钟 3 次）。
> 量大想绕限流就 `export ELEVEN_API_KEY=你的key` 直连。

---

## 怎么用

调用后 skill 先问你 5 个视觉决策（都有自动推荐，可直接「默认」）：

1. **画幅** — 16:9 / 9:16 / 4:5（自动匹配源视频比例）
2. **布局** — split 左右 / stack 上下 / pip 画中画 / overlay 全屏浮层 / deck 3D 轮播 / showcase 陈列墙
3. **风格** — 见下表（自动按视频明暗推浅 / 深色）
4. **卡片数量** — 按时长 + 密度自动推断，或自定义
5. **运镜** — 固定人像（稳）或起伏运镜（人像大 → 缩 PiP → 全屏 highlight → 切回，有张力）

然后它设计 storyboard、逐张写卡、拼装，**先开本地预览给你看**，满意了才渲染成片。

---

## 16 种视觉风格

先在**两大家族**里定方向：要「**排版讲清楚**」走歸藏家族，要「**视觉先抓人**」走视觉特效类。

| 家族 / 大类 | 风格（中文名 · key） |
|---|---|
| **视觉特效类 · 暗调电影感**<br>黑底·高级·有动态 | **暗夜星河** `nebula-glass`（旗舰：黑底双星粒子 + 玻璃）· **玻璃拟态** `glass`（两色渐变 + 磨砂玻璃）· **暖玻 HUD** `glass-hud`（暖玻面板浮在口播上 + 章节条 + 双语字幕，口播枚举专用）· **暖光太空** `spatial`（黑底暖橙光）· **撞色大字** `geom`（亮色块超大字） |
| **视觉特效类 · 炸裂族** ⚡<br>竖屏社媒·吸睛 | **霓虹网格** `neon-grid-hud`（炸裂档默认：真人霓虹窗口 + 网格 + 粒子，**特效在人后不糊脸**）· **流光极光** `liquid-aurora` · **全息虹彩** `holo-iridescent` · **电影光影** `cinematic-bloom` · **动态巨字** `kinetic-megatype` · **纵深视差** `depth-parallax` |
| **简洁排版类 · 歸藏家族 / Swiss 支柱**<br>讲解·数据·权威 | **瑞士网格** `swiss`（暖白 + 12 列网格 + 越大越细 + IKB 蓝）· **黑白极简** `minimal`（纯黑白巨字 + 大留白）· **代码终端** `terminal`（黑底绿字代码风） |
| **简洁排版类 · 歸藏家族 / Editorial 支柱**<br>叙事·编辑·有温度 | **杂志印刷** `editorial-print`（serif 承重 + 暖墨纸 + 硬投影，素材排成杂志跨页）· **柔光浅色** `pastel-aura`（象牙底 + 冷 aurora + 现代 sans，白天日常） |

> **歸藏家族**（共 5 款）由一套 DNA 纪律统管——字号字重耦合 + 预设调色板（禁自定义色）+ 组件库 + 模块化网格，规范见 [`references/styles/guizang-dna.md`](references/styles/guizang-dna.md)，交付前可跑 `node scripts/validate-clean-card.mjs` 自检。
>
> **横屏走简洁、竖屏走吸睛**：长内容 / 桌面播放优先歸藏家族（信息清楚、耐看）；抖音 / 小红书优先炸裂族（3 秒抓住划走的拇指）。

完整词库、布局 / 边框矩阵、组合建议见 [`references/DESIGN_INDEX.md`](references/DESIGN_INDEX.md)。每种风格都是自包含 HTML 参考卡，可直接复制改写；想加自己的风格，往 `references/styles/` 丢一个就多一种选择。

---

## 换成你自己的品牌落款

结尾卡默认是 Interflow 俱乐部落款（约 3.5 秒，节奏放慢让收尾「安顿」）。结构：**一句视频回扣** → wordmark → **一句延伸** → tagline。打开 SKILL.md 的 `card-cta` 模板（Step 8）改文案即可，动效不用动：

- **视频回扣**「你只管讲，成片交给我们」→ 改成这条视频的核心一句（让结尾是内容收束，不是干贴 logo）
- **wordmark**「Interflow」、**延伸句**「让每个想法，都有更好的呈现」、**tagline**「Interflow AI 出品」→ 换成你的
- 不想要任何品牌？删掉 wordmark 那段，结尾就是干净收尾。

---

## 用之前知道两件事

**token 全花在「设计卡片 + 写 HTML」这一步**，两头的抽音轨 / 转录 / 渲染是 CLI 工具、不花 token。所以卡切得越碎、视频越长，token 越多——想省就 storyboard 阶段一次想清楚、卡片数量克制。

**最耗时的是渲染，不是 AI。** 渲染由「时长 × 帧率」决定，macOS 开 `PRODUCER_BROWSER_GPU_MODE=hardware` 明显更快。所以第 10 步强制「先预览再渲染」，避免渲完才发现要改。

---

## 进阶玩法（社区可自行改造）

全程 CLI 驱动，意味着它能**无人值守 / 远程触发 / 批量跑**：

- **远程出片**：接飞书 / Lark CLI、Telegram bot——人在外面往群里丢一条视频 + 一句「剪成竖屏」，本机自动跑完回传成片。
- **换本地 Whisper**：转录是唯一的「外部引擎」插槽（Step 4）。换成 `whisper.cpp` / `faster-whisper`，只要输出同结构的 `transcript.json`（含词级时间戳），后面全不动——换来离线 / 省 API 额度 / 隐私不出本机。（注意：省的是 ElevenLabs 额度，不是 Claude token。）
- **批量矩阵**：配自有 key 跳过限流后写个脚本循环喂多条，一次出一批（适合账号矩阵）。

---

## 许可与致谢

**本仓库自带代码**（SKILL.md、参考卡、脚本、README）以 [MIT](LICENSE) 授权，可自由使用、修改、商用。

> ⚠️ **一处要特别注意（商用前必读）**：「**歸藏家族**」那套简洁排版的视觉 DNA（`references/styles/guizang-dna.md`、`guizang-clean.css` 里的字阶纪律 / 预设调色板 / 组件库）提炼自设计师 **歸藏** 的 **[guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill)**，该项目是 **AGPL-3.0** 协议。
>
> **AGPL-3.0 是「传染性」copyleft 协议**——个人 / 学习 / 非商用随便用；但**商用**（尤其做成对外的网络服务）时有义务：通常你的衍生部分也要以 AGPL-3.0 开源并公开源码。**打算商用前，请先读一遍 [guizang-ppt-skill 的 LICENSE](https://github.com/op7418/guizang-ppt-skill/blob/main/LICENSE) 并确认合规。**

打包的第三方资源各自遵循原始许可：**GSAP**（GreenSock 标准许可）· 字体 **Inter / Caveat / LXGW WenKai TC**（SIL OFL）· **Virgil**（MIT）· **@notedit/vtake**、**hyperframes**（各自 npm 许可）。密钥（如 `ELEVEN_API_KEY`）只走环境变量，别提交进 git。

**致谢**

- **[vtake](https://github.com/notedit/vtake-skills)** by Leo Xiang（[@notedit](https://github.com/notedit)）—— 先跑通「用 Claude Code 一键剪口播」这条路；本 skill 底层调用他的 `@notedit/vtake` 做转录与抽取。
- **歸藏（[@op7418](https://github.com/op7418)）** —— 「歸藏家族」简洁排版的视觉 DNA 来源（字阶 + 网格 + 预设配色 + 组件），取自 [guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill)（AGPL-3.0）；是他把这套克制、高信息密度又高级的排版美学在中文设计圈带火。

> *Built on [vtake](https://github.com/notedit/vtake-skills) by [Leo Xiang (@notedit)](https://github.com/notedit). The 歸藏 (clean-typography) design DNA is derived from [guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill) by [歸藏 (@op7418)](https://github.com/op7418) — licensed **AGPL-3.0**; review it before commercial use.*

---

## 联系作者 · 互通有无 AI 俱乐部

本 skill 由 **卓霖（Derek）原创开发**。要交流、合作，或一起把视频做得更好更快，欢迎加微信：

> 💬 **微信号：`zhuolin25`** —— 我们是**互通有无 AI 俱乐部**（上海），目标很简单：一起做出好视频、更高效地做视频。

> ⏳ 前期模型 / 渲染可能跑得慢，还在持续优化，欢迎耐心等等、随时来聊。

---

Made by **Interflow AI** · 口播 → 成片，你只管讲。
