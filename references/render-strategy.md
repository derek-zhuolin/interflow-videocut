# Render Strategy — Step 7 reference

This is the full body of **Step 7 (Decide Render Strategy)**, moved out of
`SKILL.md` to keep the workflow skeleton light. Read it when you reach Step 7.
It covers: confirming the visual direction with the user (the 5-question call),
resolving canvas / frame / bounds from the answers, theme palettes, the visual
design library, breathing room, and camera rhythm.

## Confirm Visual Direction with User (DO THIS FIRST)

Before you start designing cards or deciding bounds, **ask the user to
pick the output ratio, the layout, the style, and the card-density
preset**. Frames are auto-selected from the chosen layout × style
combination (see "Auto-pick frame" table below). Before sending the
question, **precompute three things**:

1. **`recommendedRatio`** from the source video's aspect ratio
   (`metadata.json` width / height):
   - `sourceAspect = width / height`
   - `sourceAspect ≥ 1.5` (≥ ~3:2 wide) → recommend **`16:9`**
   - `sourceAspect ≤ 0.7` (≤ ~9:13 tall) → recommend **`9:16`**
   - `0.7 < sourceAspect < 1.5` (near-square) → recommend **`4:5`**

   Mark the recommended option's label with " (推荐 · 匹配源视频 X:Y)"
   so the user sees why it's recommended.

2. **`autoCount`** from Step 6 (`max(5, round(videoSec / (basePace ×
   densityMultiplier)))`) so the "自动" option's label can show the
   concrete number.

3. **`recommendedStyle`** — **auto-match the style from the source video's
   own colors (明暗 + 冷暖)**. Run the bundled analyzer (samples frames,
   reads each frame's average color via `ffmpeg scale=1:1`, classifies
   light/dark × warm/cool):

   ```bash
   python3 "<SKILL_DIR>/scripts/auto-style.py" "$VIDEO_PATH" --json
   # → {"mode":"dark","temp":"cool","recommend":["nebula-glass",...],"note":"..."}
   ```

   Map → **day/night auto-switch**: a bright video (`mode=light`) lands a
   light style (`swiss` / `pastel-aura` / `minimal`); a dark video
   (`mode=dark`) lands a dark style (`nebula-glass` / `glass` /
   `glass-hud` / `spatial`); `temp` (warm/cool) picks within that
   (warm/neutral 口播 → `glass-hud`). Use
   `recommend[0]` as **`recommendedStyle`**, and in the style question
   below **reorder so the group containing `recommendedStyle` is FIRST**
   and append " (推荐 · 匹配视频 <mode>/<temp>)" to that group's label.
   If the user pre-approved defaults ("auto/无需询问"), **skip the style
   question and use `recommendedStyle` directly** — this IS the
   day/night auto-match. Always overridable: the user's explicit pick
   wins over the auto-recommendation.

**Environment compatibility — pick the best available question channel.**
Not every runtime exposes the same structured-question tool. Apply this
order:

1. **`AskUserQuestion`** (Claude Code, Anthropic Console) — use the
   structured 4-question call below.
2. **Other native clarification tool** (e.g. `ask_question`,
   `request_user_input`, IDE-specific prompt) — use that tool with the
   same 4 question texts and option lists. Preserve the recommendation
   markers and the precomputed values.
3. **No native tool** (Codex CLI, plain text-only runtimes) — **ask
   directly in normal conversation**. Use the plain-text template at the
   end of this section. Keep it to **one message, 4 numbered questions**
   (the global cap is 2–5 questions per round; we stay inside it).

Rules that apply to every channel:

- Ask **at most 2–5 questions per round**. Our 4 here fits.
- Even if missing info doesn't block rendering, **ask once to confirm
  the parameters that materially affect the final output** (ratio,
  layout, style, cardCount).
- If the user has already pre-approved defaults ("just use defaults",
  "无需询问", "auto-pick everything") or asked you not to ask — **skip
  the question entirely** and use: `recommendedRatio`, `layout="stack"`
  (safest cross-ratio default), `style = recommendedStyle` (the
  auto-matched day/night style from `auto-style.py` above), `autoCount`, `rhythm="fixed"`
  (calm default unless the content is short-form / high-energy, where
  `dynamic` fits better). Tell the user what you picked in one sentence
  and continue.

**Channel A — native `AskUserQuestion`:**

```
// Precompute before the call:
//   recommendedRatio = "16:9" | "9:16" | "4:5"
//   autoCount        = integer (from Step 6)

AskUserQuestion({
  questions: [
    {
      question: "输出视频比例 (画幅)：",
      header: "画幅",
      multiSelect: false,
      // Reorder so the recommended option appears FIRST (per AskUserQuestion convention).
      // Append " (推荐 · 匹配源视频 W×H)" to the recommended option's label.
      options: [
        { label: "16:9 (1920×1080) 横屏", description: "TV / YouTube / 电脑播放。源视频已经是横屏时最自然，画幅最宽。" },
        { label: "9:16 (1080×1920) 竖屏", description: "抖音 / 小红书 / TikTok / Reels。源视频竖屏时最自然；移动端原生体验。" },
        { label: "4:5 (1080×1350) 方屏偏竖", description: "Instagram feed / 微信朋友圈。近方形源视频或想兼顾两种平台时最稳。" }
      ]
    },
    {
      question: "选择整体布局：视频和卡片在画面里如何共存？",
      header: "布局",
      multiSelect: false,
      options: [
        { label: "左右分屏 (split)",     description: "video 和 card 各占画面一半。访谈 / 数据并列时最稳，画面分隔清晰。" },
        { label: "上下分屏 (stack)",     description: "video 在上方 (~52%)，card 在下方。说话人头像 + 总结句的经典组合，竖屏也好用。" },
        { label: "画中画 (pip)",         description: "card 满屏，video 缩成圆角小窗在右上角。内容为主、speaker 为辅时用。" },
        { label: "全屏浮层 (overlay)",   description: "video 全屏播放，card 作为玻璃浮层落在画面上。情绪 / 电影感强烈。" },
        { label: "3D 卡片轮播 (deck)",   description: "卡片本身就是主角：一张正对镜头，左右两张退到 3D 扇形里，像 cover-flow 一样轮转。video 藏掉或缩成右上角小窗。适合评价墙 / 卖点轮播 / 多条金句。配 pastel-aura / glass 风格做天空底最好看。" },
        { label: "陈列墙 (showcase)",     description: "下方口播常驻 + 上方一面不断累积重排的「案例证据墙」(竖屏 B-roll 卡 + 红标签 + 观看数 chip + 网格纸底)，焦点会从底部小窗突然放大全屏再缩回、上方一直滚动播放。⚠️素材驱动：每张墙卡是你喂进来的竖屏片段。适合案例墙 / hook 拆解 / 作品集巡览。配方见 references/layouts/showcase.html + editorial-print-montage.md（多视频源机制）。" }
      ]
    },
    {
      question: "选视觉风格 — 对照桌面风格总览图，直接报具体风格（中文名或 key）",
      header: "选风格",
      multiSelect: false,
      // 【确定性原则 · 不要破坏】用户报哪一款，就锁哪一款；agent 绝不在风格间
      //   自行替换、也不再"选组后组内挑"。这是「确保每次生成都是对的」的关键 ——
      //   风格选择必须落到具体 key（下面 10 款之一），而不是一个模糊的"组"。
      // 完整 10 款的真实视觉见桌面总览图：~/Desktop/interflow-style-gallery/index.html。
      //   选风格时先引导用户翻这页看真实样子，再报中文名 / key。
      // key 用于映射 frame auto-pick 矩阵的列（cinematic / clinical / pastel-aura / editorial-print）。
      // 环境限制：若 AskUserQuestion 单题选项数受限（如最多 4 个），放最相关的几款 +
      //   让用户用 "Other" 直接输入 key；不受限则全部列出。
      // 回"默认 / auto"→ 用 recommendedStyle（auto-style 按明暗冷暖算出的具体 key）。
      options: [
        { label: "霓虹网格 (neon-grid-hud) · 炸裂档默认", description: "赛博朋克：真人霓虹窗口 + 透视网格地面 + 上升粒子 + HUD 数据读出 + 巨字辉光。**特效永远在人后不糊脸**。科技/发布会预告/短视频高光/强情绪开场——想要『夸张视觉』就选这款。选它后会再问 A/B/C 复杂度档。" },
        { label: "暗夜星河 (nebula-glass) · 旗舰", description: "黑底 + 流动粒子 + 玻璃，最高级最有科技感。产品/科技发布、强情绪开场、想要高级感。" },
        { label: "玻璃拟态 (glass)", description: "两色渐变 + 磨砂玻璃，半透明、干净、高级。品牌叙事 / 金句 / 故事。" },
        { label: "暖玻 HUD (glass-hud)", description: "暖玻璃面板浮在真人口播上 + 顶部章节条 + 底部双语字幕，橙色 accent。口播枚举 / 护城河清单专用（恒 overlay）。" },
        { label: "暖光太空 (spatial)", description: "黑底 + 暖橙光，温暖又有空间感（唯一的暖黑底）。人物 / 治愈。" },
        { label: "撞色大字 (geom)", description: "黑底 + 亮色块 + 超大字，大胆有冲击力。态度 / 宣言 / 高光。" },
        { label: "瑞士网格 (swiss)", description: "白底 + 红点 + 大字，干净、专业、权威。财报 / 调查报告 / 数据。" },
        { label: "黑白极简 (minimal)", description: "纯黑白大字 + 极致留白，高级、克制。金句 / 严肃陈述。" },
        { label: "代码终端 (terminal)", description: "黑底绿字代码风，技术、极客、工程感。技术教程。" },
        { label: "柔光浅色 (pastel-aura)", description: "浅色柔和不刺眼，日常、白天、轻松。个人分享 / 画面偏亮的视频。" },
        { label: "杂志印刷 (editorial-print)", description: "把照片/视频排成杂志跨页（不是文字卡）。作品集 / 大事记 / 素材展示（走 references/editorial-print-montage.md）。" }
      ]
    },
    {
      question: "卡片数量 (takeaway 节奏)：要切多少张？",
      header: "卡片数量",
      multiSelect: false,
      options: [
        { label: "自动 (推荐) · 约 N 张", description: "按视频时长和信息密度自动推断 (见 Step 6 规则)。本次推断约 N 张。带 N 进 label —— N 是你刚算出的 autoCount。" },
        { label: "少量 · 约 round(N × 0.6) 张", description: "切得稀疏一点，每张卡停留更久，适合 reflective / 慢节奏。" },
        { label: "更多 · 约 round(N × 1.5) 张", description: "切得更紧凑，节奏更快，适合 staccato / 数据密集 / 短视频高光。" }
      ]
    },
    {
      question: "运镜节奏：人脸要一直固定，还是做起伏运镜？",
      header: "运镜",
      multiSelect: false,
      options: [
        { label: "固定人像 (稳)", description: "人脸始终固定在画面同一位置（按所选 layout 一致呈现），稳、专业、信息聚焦。适合教程 / 严肃陈述 / 想让观众专注内容。" },
        { label: "起伏运镜 (有张力)", description: "人像大 → 缩成 PiP → 完全消失做全屏 B-roll highlight 重点 → 切回人像。有节奏起伏，秀出口播的多种形态。适合短视频高光 / 产品发布 / 想要电影感节奏。" }
      ]
    }
  ]
})
```

**关于"Other"** — `AskUserQuestion` 会自动给"卡片数量"题加 "Other" 选项，
用户可以直接输入数字（如 "8"、"20"）作为 cardCount 目标值。把输入解析为整数：
若解析成功 → 直接用该值（最少 5 张兜底）；解析失败 → 退回 "自动"。

**Channel B — plain-text fallback** (Codex CLI, runtimes without a
native question tool). Post this as one normal message, then wait for
the reply. Bullet-style 1/2/3/4 keeps the reply parseable:

```
我需要先和你确认五个视觉决策再开始切卡片：

1) 输出比例 (画幅)：
   A. 16:9 横屏 (1920×1080) — TV / YouTube / 电脑播放
   B. 9:16 竖屏 (1080×1920) — 抖音 / 小红书 / TikTok
   C. 4:5 方屏偏竖 (1080×1350) — Instagram feed / 兼顾两端
   ▸ 我的推荐:  <recommendedRatio>  (匹配源视频 W×H = <sourceW>×<sourceH>)

2) 整体布局 (video & card 怎么共存)：
   A. split   左右分屏 (50/50)
   B. stack   上下分屏 (video 顶, card 底)
   C. pip     画中画 (card 满屏, video 圆角小窗)
   D. overlay 全屏浮层 (video 全屏, card 玻璃浮层)
   E. deck    3D 卡片轮播 (卡片主角, 左右扇形轮转, video 藏掉/缩角)
   F. showcase 陈列墙 (下方口播常驻 + 上方案例墙累积重排 + 焦点全屏 pop; 素材驱动)

3) 视觉风格 — 对照桌面总览图 (~/Desktop/interflow-style-gallery/) 报具体风格 (中文名或 key)：
   你报哪一款就锁哪一款，我不会再替你在风格间挑。回"默认"则按源视频明暗冷暖自动匹配。
   ── 暗调（黑底·高级·有动态）──
   0. 霓虹网格 neon-grid-hud — 赛博真人霓虹窗口+透视网格+粒子+HUD巨字，特效在人后不糊脸（炸裂档默认；选它再问 A/B/C 复杂度）
   1. 暗夜星河 nebula-glass — 黑底粒子+玻璃，最高级最科技（旗舰）
   2. 玻璃拟态 glass       — 两色渐变+磨砂玻璃，干净高级
   3. 暖玻 HUD glass-hud   — 暖玻面板浮口播上+章节条+双语字幕，口播枚举专用
   4. 暖光太空 spatial     — 黑底暖橙光，温暖有空间感
   5. 撞色大字 geom        — 黑底亮色块超大字，大胆冲击
   ── 干净专业（数据·报告·严肃）──
   6. 瑞士网格 swiss       — 白底红点大字，专业权威
   7. 黑白极简 minimal     — 纯黑白大字+大留白，克制高级
   8. 代码终端 terminal    — 黑底绿字代码风，技术极客
   ── 浅色 / 杂志 ──
   9. 柔光浅色 pastel-aura — 浅色柔和，白天日常
   10. 杂志印刷 editorial-print — 照片排成杂志跨页（非文字卡）
   E. 杂志素材（作品集·素材排版）：杂志印刷
      → 作品集、大事记、公司/产品介绍、素材展示（非文字卡）

4) 卡片数量 (takeaway 节奏)：
   A. 自动 (推荐) — 约 <autoCount> 张
   B. 少量 — 约 round(<autoCount> × 0.6) 张
   C. 更多 — 约 round(<autoCount> × 1.5) 张
   D. 直接给我一个数字 (如 "8"、"20")

5) 运镜节奏 (人脸固定 or 起伏运镜)：
   A. 固定人像 — 人脸始终固定在画面同一位置，稳、专注内容
   B. 起伏运镜 — 人像大 → 缩成 PiP → 消失做全屏 highlight → 切回，有节奏起伏

回复格式: "1A 2C 3B 4A 5A" 或自然语言均可。
若你想全部用推荐默认值，回复 "默认" / "auto" / "都用推荐" 即可。
```

Parsing the plain-text reply:
- Accept loose formats: `"1A 2C 3B 4A"`, `"A C B A"`, `"16:9 / pip /
  数据 / 自动"`, full sentences, or `默认`.
- If any answer is ambiguous → re-ask only the ambiguous ones (still
  inside the 2–5 cap).
- If the user says "默认 / auto / 都用推荐" → skip without re-asking.

After the user answers (any channel):

1. **Resolve the output canvas** from the ratio answer — these are the
   exact `storyboard.composition.width / height` values to write:

   | user choice | composition.width × height | storyboard.layout field |
   |---|---|---|
   | `16:9` | **1920 × 1080** | `"landscape"` |
   | `9:16` | **1080 × 1920** | `"portrait"` |
   | `4:5`  | **1080 × 1350** | `"portrait"` (schema treats 4:5 as portrait — height > width) |

   For **4:5 bounds inside `references/layouts/*.html`** — those files
   only document landscape (1920×1080) and portrait (1080×1920). For
   4:5 (1080×1350) derive bounds by **proportional scaling from
   portrait**: keep horizontal values, scale vertical values by
   `1350/1920 ≈ 0.703`. Example: `overlay` portrait card =
   `{ x: 24, y: 1280, w: 1032, h: 564 }` → 4:5 card =
   `{ x: 24, y: round(1280 × 0.703), w: 1032, h: round(564 × 0.703) }`
   = `{ x: 24, y: 900, w: 1032, h: 397 }`.

2. **Map the style group to a specific style** by looking at the
   transcript tone — pick the one that best fits, but stay inside the
   user's chosen group. If you're unsure between two specific styles
   inside the group, send a second `AskUserQuestion` with those 2–4
   specific style options — **用中文名提问**（暗夜星河 / 玻璃拟态 / 暖光太空…），
   每个带一句「什么时候用」。中文名 ↔ key 的权威对照见
   `references/DESIGN_INDEX.md` 的「中文风格词库」表；`recommendedStyle`
   也优先用 `auto-style.py` 输出的 `recommend_cn`（中文名）呈现给用户。

   **2·风格家族 — 主风格锁定，重点卡可配姊妹风格（治「整片一个模子」）.**
   用户报的那一款是**主风格（primary）**，照旧锁定、绝不替换——这条不变。但「锁主
   风格」不等于「全片每张卡都长一个样」。你可以给少数**重点卡**（开场 hero / 大数字
   数据卡 / 收尾 outro）挂一个**同家族的姊妹风格**：在该卡的 storyboard 里写
   `"styleKey": "<sibling-key>"`，Step 8 就 `cp` 那一款而不是主风格。
   - **颜色天然一致**：所有 fragment 都用 `var(--accent-N)` 上色，姊妹风格会自动继承
     当前 theme 调色板，不会撞色——这是这一步安全的根本原因。
   - **只在同一家族内挑姊妹**（沿用 skill 已有的家族划分：**炸裂族**
     neon-grid-hud / liquid-aurora / holo-iridescent / cinematic-bloom /
     kinetic-megatype / depth-parallax；**cinematic** geom / glass / glass-hud /
     spatial / nebula-glass；**clinical** swiss / minimal / terminal；外加
     pastel-aura、editorial-print 各自成系，详见 `DESIGN_INDEX.md` 与 frame 矩阵）。
     跨家族混（极简卡接霓虹卡）即使同色也会结构打架——别这么干。
   - **克制**：全片最多 2–3 款，主风格仍占大多数卡。姊妹是「重音」，不是「换台」。
     拿不准就别加——`styleKey` 缺省 = 主风格，这是安全默认。
   - 这不违反上面的「确定性原则」：主风格仍由用户锁定，姊妹只是显式写进 storyboard 的
     有界扩展（同 seed 仍逐字节可复现）。若用户明确说了「就一款别花」，全片只用主风格。

   **2a. 复杂度档位（炸裂档专属第二轮问题）** — 当用户选了 `neon-grid-hud`（或任何
   「炸裂」族风格）时，**紧接着再发一轮 `AskUserQuestion` 问 A/B/C 复杂度档**（这是
   Derek 要的「问细一点」）。把组件清单写进 description，让用户看清每档叠什么：

   ```
   AskUserQuestion({ questions: [{
     question: "复杂度档位？（叠多少特效组件）", header: "复杂度", multiSelect: false,
     options: [
       { label: "B 标准 (推荐)", description: "窗口 + 透视网格 + 顶部 HUD 条 + 上升粒子 + 数据 chip×3 + 巨字辉光标题 + 起伏运镜(窗口↔PiP↔全屏)。有信息有节奏，主力款。" },
       { label: "C 满配炸裂", description: "B 全部 + 扫描线 + 下扫 sweep + 底部跑马 ticker + 音波 EQ + 标题 flicker 闪烁 + 全屏 highlight 拍。镜场、发布、最炸。" },
       { label: "A 克制", description: "只要窗口 + 透视网格 + 顶部 HUD 条，干净不吵。最接近克制感但换成霓虹调。" }
     ]
   }] })
   ```

   解析：默认 B。A → scene canvas 里 `PN=0`（去粒子）+ 删 `.nb-chips`；C → 在 `#stage`
   末尾加 `.scanlines`/`.sweep`/`.ticker`（配方见 playground neon-grid-hud.html）+ 给
   `.nb-h1` 加 `class="flick"`。把选中的档位记进工作记忆，Step 8/9 据此增删组件。

   **2b. neon-grid-hud 强制 layout + frame + 画幅**：选了 neon-grid-hud 就**忽略用户的 layout 选项**，
   锁定它专属的 **window-scene 布局**（真人竖向霓虹窗口浮在全屏 `#scene` canvas 上，特效在窗口
   后方/两侧；起伏运镜 = 窗口→PiP→全屏，见风格 fragment 头注释的 videoBounds 表），frame 恒
   `clean`（霓虹边框已是 chrome）。**画幅默认推 9:16 (1080×1920)**——这套 HUD 是竖向堆栈（窗口 +
   chip + 巨字），矮画幅（4:5）塞不下两行巨字会被画布底裁字；9:16 垂直预算最足、且源多为竖屏最自然。
   两条踩过的铁律**务必读风格 fragment 头注释**「满脸窗口铁律」+「垂直预算铁律」段：
   - **满脸**：窗口必须竖向且比例 ≥ 源比例，否则 cover 只塞进一条横切面只剩上半脸。
   - **不溢出**：标题用 `clamp()` + `container-type:inline-size` 自动缩；内容 host `overflow:hidden`
     且底部留 ≥100px 安全边距；排不下就缩窗口/去 chips/降档/上 9:16。**绝不让字贴边或出血。**

   **2c. 整组「炸裂族」可选**：neon-grid-hud 只是炸裂族的旗舰。用户想要「夸张视觉」但 neon
   不完全对味时，选风格题里可以把整组炸裂族端上来——`cinematic-bloom`（电影光影）/
   `liquid-aurora`（流光极光）/ `holo-iridescent`（全息虹彩）/ `kinetic-megatype`（动态巨字）/
   `depth-parallax`（纵深视差）。**它们都走 window-scene 架构**；除 neon 外目前是 playground DNA，
   **首次被选到时按 `references/styles/playground-gallery/README.md` 的 render-harden checklist
   加固成确定性版本**（neon-grid-hud 是范本）再渲染。整组定位/原稿/加固清单见该 README +
   DESIGN_INDEX「炸裂族」表。

   **关于「炸裂档默认」**：当用户预批默认（"auto / 无需询问"）**且**内容是科技/发布/
   短视频高光/强情绪/个人 IP 预告这类适合炸裂的题材时，`recommendedStyle` 直接取
   `neon-grid-hud` + B 档（不必等 auto-style.py 的冷暖判定）。auto-style 的冷暖仍可作
   兜底；但 neon-grid-hud 是 Derek 钦定的炸裂默认。题材明显是数据/报告/严肃时，仍回退
   到 swiss/minimal 等冷静风格——别硬套霓虹。

3. **Resolve final cardCount** from the density answer:

   | user choice | final cardCount |
   |---|---|
   | 自动 (推荐) | the `autoCount` you already computed |
   | 少量 | `max(5, round(autoCount × 0.6))` |
   | 更多 | `round(autoCount × 1.5)` (no upper clamp) |
   | Other = "<n>" (integer) | `max(5, parseInt(n))` |
   | Other = anything else | fall back to `autoCount` |

4. **Auto-pick the video frame** from this table (frames don't ask the
   user — they follow from layout × style):

   | layout | pastel-aura (light) | editorial-print (montage) | clinical styles (swiss / terminal / minimal) | cinematic styles (geom / glass / glass-hud / spatial / nebula-glass) |
   |---|---|---|---|---|
   | `split` | `clean` | `polaroid` | `hairline` | `clean` / `hairline` (spatial 取景框同源; nebula-glass 恒 `clean`) |
   | `stack` | `clean` | `polaroid` | `hairline` | `clean` / `hairline` |
   | `pip` | `clean` (white-ring pip pill) | `clean` (pip pill already has chrome) | `clean` | `clean` (spatial: 给 pip 加暖光取景框角标) |
   | `overlay` | `clean` (full-bleed forbids deco frames) | `clean` (full-bleed forbids deco frames) | `clean` | `clean` (nebula-glass: 全屏粒子场忌加边框; glass-hud: 章节条/进度轴已是 chrome，恒 `clean`) |
   | `deck` | `clean` | n/a (montage is fullscreen) | `clean` | `clean` (3D 扇形忌加边框) |

   > **`deck` is exempt from this matrix — frame is always `clean`.**
   > `deck`'s 3D fan forbids any chrome around the cards.

   > **`editorial-print` is exempt from this matrix.** Its cards are fullscreen
   > asset *scenes* with no video↔card split, and every asset panel carries its
   > own 3px ink border — so the frame is **always `clean`** (a `polaroid`/
   > `hairline` deco would double-border and cheapen it). Layout for these cards
   > is effectively `fullscreen`; `#video-wrap` is hidden (woven mode) or absent
   > (standalone mode). See `references/editorial-print-montage.md`.

5. **Resolve the camera rhythm** from the 运镜 answer:
   - **固定人像 → `rhythm = "fixed"`** — the source video stays in ONE
     position the whole time (the chosen layout's bounds); cards swap but
     `#video-wrap` never moves. Calm, professional, content-focused.
   - **起伏运镜 → `rhythm = "dynamic"`** — sequence the video through
     states for rise-and-fall (see "Camera Rhythm (运镜)" below).
6. **Tell the user what you chose** in one sentence — ratio (+ canvas
   size), layout, specific style, frame, final cardCount, and rhythm —
   then proceed with the rest of Step 7 (per-card layouts, motion patterns).
7. Record the six values (ratio / layout / style / frame / cardCount /
   rhythm) in working memory (no schema field needed); you'll reference
   them while writing each card's HTML in Step 8 and while reading the
   matching `references/<dim>/<key>.html` for tokens and structure.

If the user picks an answer via "Other" with a free-text style name not
in the 10-style library, treat it as a hint to design a fresh card
visual yourself, but still anchor on the chosen layout's bounds.

## Render Strategy Inputs

With ratio / layout / style / cardCount / frame locked from Step 7.0,
the remaining per-card decisions are:

- **Source-video fit inside the GSAP target**: video element has
  `object-fit: cover` and is clipped to `#video-wrap`'s tween bounds.
  If you want NO cropping (e.g. portrait source on landscape canvas
  shouldn't get its top/bottom chopped), aim the tween at a rect that
  matches the source's aspect ratio and let surrounding canvas show
  through (or fill with the card / a backdrop).
- **`card.zone` per card**: derive from your chosen composition layout
  (split → side-panel, stack → lower-third, pip → fullscreen, overlay
  → video-overlay, deck → fullscreen), OR pick a different zone for one-off variants
  (fullscreen for hero / quote, whiteboard-area for dense data).
- **`accentIndex` per card**: each card pulls one of the 5 theme accent
  colors. Vary across cards for rhythm; reuse the same index when two
  cards belong to the same narrative beat.
- **Motion vocabulary**: pick 2–3 repeatable patterns from
  `data-anim` kinds (see the table in Step 8 / card-contract.md) and stick to them so the
  composition feels coherent.

Pick from these `themeId` palettes (use them as `--accent-N` /
`--bg` / `--text` CSS variables in your composition `<style>` block):

| themeId | accent palette (5 colors) | board bg | text |
|---|---|---|---|
| classic | `#1971c2 #e03131 #2f9e44 #e8590c #9c36b5` | `#FFF9E3` (paper) | `#1e1e1e` |
| noir | `#4cc9f0 #f72585 #4ade80 #fb923c #a78bfa` | `#1a1a1a` | `#f1f1f1` |
| mint | `#0077b6 #d62828 #2d6a4f #e76f51 #7209b7` | `#e8faf0` | `#1b4332` |
| craft | `#bf5700 #d62728 #6c757d #e9b54a #3d5a80` | `#f6efe1` | `#2d2d2d` |
| slate | `#0ea5e9 #ef4444 #22c55e #f97316 #a855f7` | `#1e293b` | `#f1f5f9` |
| mono | `#000 #555 #888 #aaa #ccc` | `#fff` | `#000` |

Available fonts (woff2 in `<SKILL_DIR>/assets/fonts/`, staged to work dir in Step 9): `Caveat` (handwriting),
`LXGW WenKai TC` (Chinese hand-script), `Inter` (modern sans), `Virgil`
(geometric hand). Reference via `@font-face` or `font-family` directly.

`<SKILL_DIR>/references/styles/` ships 10 self-contained reference cards
(pastel-aura / glass / glass-hud / spatial / nebula-glass / minimal / geom / terminal /
swiss / editorial-print). **These are not "inspiration" — they are your card
templates. The default is to clone the chosen style's fragment for every card
and swap only the text + accent index.** Departing from the reference (a custom
shape, a one-off layout) is a deliberate exception you take only when a specific
card's content can't fit any reference — not the per-card default. Cloning is
what keeps a 15-card video at minutes, not half an hour, AND holds every card to
the curated quality bar. `editorial-print` is the odd one out — an **asset-driven montage** (user
images/clips arranged like a printed spread, no talking-head spine); it has its
own multi-asset kit in `references/editorial-print-montage.md` — read that when
you reach for it.

## Visual Design Library (<SKILL_DIR>/references/)

Beyond the composition-level `themeId`, the skill ships a richer **reference
library** at `<SKILL_DIR>/references/` covering three **orthogonal**
visual dimensions you can freely mix:

```
Style  ×  Layout  ×  VideoFrame
 (11)      (5)         (3)
```

| dimension | keys | what it decides |
|---|---|---|
| **style** | `minimal` `geom` `terminal` `swiss` `pastel-aura` `glass` `glass-hud` `spatial` `nebula-glass` `editorial-print` | the card's visual language — fonts, colors, ornament, layout-within-card |
| **layout** | `split` `stack` `pip` `overlay` `deck` | how the source video and the card share the canvas |
| **frame** | `clean` `hairline` `polaroid` | the decorative chrome around the video element |

Read `<SKILL_DIR>/references/DESIGN_INDEX.md`
for the full matrix and a loose decision guide (访谈 / 产品发布 / 数据分析 /
社交剪辑 / 技术教程 / 情绪故事 …). When you decide to use a specific
style / layout / frame, Read the corresponding file:

- `references/styles/<key>.html` — self-contained card fragment with that
  style's CSS tokens (colors, fonts, padding, ornament) and a placeholder
  takeaway. Copy the `.card[data-card-id="ref-<key>"]` style block, rename
  the data-card-id to your card's id, swap the placeholder content for the
  real takeaway, and you're done.
- `references/layouts/<key>.html` — exact `videoBounds` + `cardBounds` for
  both landscape and portrait, with a copy-paste JSON snippet for
  `storyboard.json`'s per-card `layout` field.
- `references/frames/<key>.html` — decorative HTML to add as a sibling of
  `#video-wrap`, plus placement instructions for the composition CSS.
- `references/editorial-print-montage.md` — the **multi-asset montage kit** for
  the `editorial-print` style: 5 layout primitives (poster / photo-grid /
  collage / logo-strip / print-stack), 3 signature transitions (whip-pan /
  blinds-wipe / paper-flash), how to stage user images/clips into
  `public/assets/`, image↔video slot rules, and two usage modes (woven B-roll
  vs standalone no-speaker montage). Read it whenever the content is an asset
  showcase rather than a text takeaway over a talking-head.

Pick `style × layout × frame` **per card** — you can change all three
between cards as long as the transitions read smoothly. A common rhythm:
open `glass × overlay × clean`, switch to `swiss × split × hairline`
for the data card, close on `nebula-glass × overlay × clean`.

**Content → style, a starting heuristic (overridable, but start here).**
Don't pick a style because it "looks nice" — match it to what the card is
*saying*. The tone of the visual should agree with the tone of the content:

| 内容是关于… | 选这些（中文名 / key） | 为什么 |
|---|---|---|
| 数字、对比、财报、证据 | 瑞士网格 `swiss` · 代码终端 `terminal` · 黑白极简 `minimal` | 冷、网格、零色彩噪音 —— 数据就该像数据 |
| 故事、情绪、品牌一句话 | 柔光浅色 `pastel-aura` · 玻璃拟态 `glass` · 暗夜星河 `nebula-glass` | 有纵深也克制；靠光和排版，不靠暖纸小装饰 |
| 口播枚举、方法论拆解、N 个坑/原则、护城河清单 | 暖玻 HUD `glass-hud`（恒 overlay） | 玻璃面板浮在真人上 + 章节条 + 编号列表 + 底部双语字幕，人脸全程在画面里 |
| 高光时刻、产品揭晓、金句 | 暗夜星河 `nebula-glass` · 撞色大字 `geom` · 玻璃拟态 `glass` · 暖光太空 `spatial` | 大胆、有纵深、动态感 —— 撑得起强调（暗夜星河 = 黑底双星粒子场，科技/电影感最强）|
| 密集讲解、框架、步骤 | 瑞士网格 `swiss` · 代码终端 `terminal` · 黑白极简 `minimal` | 结构化、小字也清楚 |
| 随手的个人分享 | 柔光浅色 `pastel-aura` | 柔、亲和、像 feed 原生、不正式 |
| 素材本身就是主角（作品集、大事记、产品/公司 montage）| 杂志印刷 `editorial-print` | 把真实素材排成杂志跨页；整屏场景，不是文字压视频 —— 见 montage kit |

Keep **one** style family across a video for cohesion — don't strobe between
cold and cinematic every card. Shift style only when the *content* shifts
register (e.g. the one data card in an otherwise warm story). If you pick a
style against this grid (e.g. `glass` for a tax-law breakdown), do it
on purpose for contrast — not by default.

The 11 styles are skill-side design tokens, **not composition-level themes** —
they don't need to be declared in `storyboard.composition`; they live
inside each card's HTML. The `themeId` field can still pick a
composition-level palette (table above) that controls page-body background
and video border chrome.

## Breathing Room (留白) — float the panels, don't fill the frame

**Default to a "floating panel" composition, NOT full-bleed.** This is a
baked-in lesson: stretching the video edge-to-edge AND giving the card a
full-width band reads as cramped ("太满") and kills the spatial depth the
cinematic/spatial styles depend on. Instead, the source video and each card
should sit as **rounded, inset panels** on the theme background, with a clear
margin (≈6–10% of canvas) on every side and a visible gap between them.

Concrete defaults — **portrait 1080×1920, `stack` layout** (the dominant
social case):

- **Theme atmosphere fills the whole canvas** behind everything: put the
  deep-space gradient + grain + vignette on ONE non-timed `.atmo` layer (first
  child of `#stage`), not inside each card. Cards then have transparent roots
  and only paint their own panel.
- **Video = a floating rounded window**, e.g.
  `#video-wrap { left:160; top:150; width:760; height:1130 }` (≈150px side
  margins), `border-radius:26px`, soft drop shadow + faint warm glow, with
  **viewfinder bracket ticks just OUTSIDE its corners** (a sibling
  `.frame-deco`). Use `object-position` to keep a talking head's face framed
  inside the narrower window.
- **Card = its own floating rounded panel** (~`880×460`, `border-radius:30px`,
  dark panel bg + 1px edge + drop shadow + warm rim, plus its own corner
  ticks), centered inside a slightly larger card-host
  (`left:40; top:1290; width:1000; height:600`) so the panel's shadow/rim have
  room to breathe. **NOT** the full bottom band.
- Keep a clear gap (≈60–80px) between the video window's bottom and the card
  panel's top, and a top meta strip (`INTERFLOW [01]` / `[SPATIAL]`) + centered
  `● REC` above the video — the gauge chrome reinforces the "floating in space"
  feel.

For 4:5 / landscape, scale these insets proportionally (keep the ≈6–10% margin
rule). **Exceptions that may bleed:** the `overlay` layout (full-bleed video is
the whole point) and a true hero "big number / mantra" fullscreen card. Every
other card floats.

## Camera Rhythm (运镜) — fixed vs dynamic (user-chosen in Step 7.0)

The 运镜 answer decides whether the speaker stays put or the composition
moves through states for rise-and-fall. **Always honor the user's pick.**

**`rhythm = "fixed"` (固定人像)** — `#video-wrap` stays at ONE position the
entire video (the chosen layout's bounds). Cards swap below/around it; the
video never moves or hides until the outro. Calm, professional, keeps the
viewer on the content. This is the safe default. Author it by setting the
video bounds inline once and writing NO `#video-wrap` tweens.

**`rhythm = "dynamic"` (起伏运镜)** — sequence the source video through a
small state machine so the speaker grows, shrinks, disappears for a
full-screen B-roll highlight, then cuts back. This showcases that 口播 has
many forms and gives the piece a rise & fall. Recommended beat shape (adapt
to the actual card count — the point is large → small → gone → back):

| beat | video state | card |
|---|---|---|
| open / hook | **WINDOW** (floating window, person prominent) | bottom panel |
| build | **PIP** (shrinks to a top-corner pill, amber ring chrome) | larger showcase panel |
| peak / key line | **HIDDEN** (person gone) | **FULLSCREEN** B-roll card, key word marker-highlighted |
| resolve | **WINDOW** (cut back to person, quick pop-in) | bottom panel |
| close | WINDOW | bottom panel |
| outro | HIDDEN | fullscreen `card-cta` |

Concrete state bounds (portrait 1080×1920) and the GSAP that drives them:

```js
// states
// WINDOW: {left:160, top:150, width:760, height:1130}  (class 'video-wrapper')
// PIP:    {left:610, top:120, width:400, height:540}   (class 'video-wrapper pip' → border-radius + amber ring)
// HIDDEN: opacity 0  (a fullscreen opaque card covers where it was)

// WINDOW → PIP (shrink) — run during the previous card's exit gap
tl.to('#video-wrap', { left:610, top:120, width:400, height:540, duration:0.75, ease:'power3.inOut' }, T1);
tl.set('#video-wrap', { className:'video-wrapper pip' }, T1);
tl.to('#frame-deco', { opacity:0, duration:0.35 }, T1);   // window bracket off; pip has its own ring
tl.to('#rec-badge',  { opacity:0, duration:0.35 }, T1);

// PIP → HIDDEN (person disappears for the fullscreen highlight)
tl.to('#video-wrap', { opacity:0, duration:0.40, ease:'power2.in' }, T2);
tl.to('#meta-tl', { opacity:0, duration:0.35 }, T2);      // hide composition gauge so the highlight is clean
tl.to('#meta-tr', { opacity:0, duration:0.35 }, T2);

// HIDDEN → WINDOW (cut back to person)
tl.set('#video-wrap', { className:'video-wrapper', left:160, top:150, width:760, height:1130 }, T3);
tl.fromTo('#video-wrap', { opacity:0, scale:0.92 },
          { opacity:1, scale:1, duration:0.55, ease:'power3.out', immediateRender:false }, T3+0.05);
tl.to('#meta-tl', { opacity:1, duration:0.40 }, T3+0.15);
tl.to('#meta-tr', { opacity:1, duration:0.40 }, T3+0.15);
tl.to('#frame-deco', { opacity:1, duration:0.40 }, T3+0.25);
tl.to('#rec-badge',  { opacity:1, duration:0.40 }, T3+0.30);
```

**Two gotchas this recipe must avoid (cost real debugging once):**

- **`immediateRender:false` on any `fromTo` that re-shows `#video-wrap`.**
  GSAP `fromTo`/`from` default to `immediateRender:true`, which applies the
  `{opacity:0}` "from" at t=0 — so the video stays invisible for the WHOLE
  first half until the tween runs. Add `immediateRender:false` so the hide
  only happens when that tween actually plays.
- **Fade the composition gauge (`#meta-tl`/`#meta-tr`) during a fullscreen
  card.** They carry `z-index:5`, which beats the card-host's auto z-index,
  so they paint *over* a fullscreen B-roll card and clash with its own meta.
  Fade them out when the video hides and back when it returns (above).

For PIP-only chrome, give `.video-wrapper.pip` its own `border-radius` +
`0 0 0 3px` amber ring + shadow so the shrunk window reads as a deliberate
picture-in-picture, and keep the source's face framed with `object-position`.

## Layout Compositions (Card + Video)

Two coordinated decisions per card define how it shares the canvas with
the source video:

- **`card.zone`** (declared in `storyboard.json`) — one of the 5 schema
  values; resolve it into pixel bounds (per the table in Step 6) when
  you write the card-host wrapper's inline `style` in Step 9.
- **`#video-wrap` bounds at this card's time window** (declared
  imperatively in the composition's GSAP timeline) — the agent tweens
  `#video-wrap` to a target rect for each layout transition.

Schema does NOT store per-card video bounds. `videoTrack.bounds` is
**one-time** at composition level (defaults to full canvas). Video
"moving" between cards is purely a GSAP animation authored in
`index.html`. There is no `card.layout` field — earlier versions of this
doc invented one; the real schema only has `card.zone`.

**5 composition layouts** (from `references/layouts/`) — each is a
recipe pairing a `zone` with a `#video-wrap` tween target:

| composition layout | recommended `card.zone` | GSAP target for `#video-wrap` (landscape 1920×1080) | GSAP target for `#video-wrap` (portrait 1080×1920) | when to use |
|---|---|---|---|---|
| `split` | `side-panel` | `{ left: 960, top: 0, width: 960, height: 1080 }` | `{ left: 0, top: 960, width: 1080, height: 960 }` (bottom half) | speaker + data side-by-side / 50:50 weight |
| `stack` | `lower-third` | `{ left: 14, top: 14, width: 1892, height: 548 }` (top 52%) | `{ left: 0, top: 0, width: 1080, height: 844 }` (top 44%) | speaker on top + summary card below |
| `pip` | `fullscreen` | `{ left: 1480, top: 760, width: 400, height: 300 }` + add `.framed` class | `{ left: 690, top: 28, width: 360, height: 203 }` + add `.framed` | content-heavy card + corner pip |
| `overlay` | `video-overlay` | `{ left: 0, top: 0, width: 1920, height: 1080 }` (full-bleed) | `{ left: 0, top: 0, width: 1080, height: 1920 }` | cinematic / dramatic / glass card on full video |
| `deck` | `fullscreen` | showcase: `{ opacity: 0 }` (hide speaker) · witness pip: `{ left: 1528, top: 40, width: 336, height: 189 }` | showcase: `{ opacity: 0 }` · witness pip: `{ left: 706, top: 32, width: 344, height: 194 }` | cards ARE the show — 3D cover-flow carousel (testimonials / 卖点 / 金句); see `layouts/deck.html` for the fan transforms + advance tween |

For 4:5 (1080×1350), scale portrait y/h values by `1350/1920 ≈ 0.703`
(see Step 7.0 Channel A / Channel B `recommendedRatio` resolution
table).

**Other zone values for one-off variants** (still uses `card.zone`; no
fake "layout" field):

| `zone` | resolved bounds | common use |
|---|---|---|
| `fullscreen` | covers whole canvas | hero card, video tweens to hidden/pip |
| `whiteboard-area` | inset 40px margin (landscape) or bottom 45% (portrait) | dense data card, free margins |
| `lower-third` | bottom 30% band | talking-head annotation |
| `side-panel` | right 42% (landscape) or bottom 40% (portrait) | sidebar / "split" recipe |
| `video-overlay` | full canvas; expect transparent card root | glass overlay on full-bleed video |

You can mix recipes per card — choose `card.zone` based on what suits
the moment, then write the GSAP tween for `#video-wrap` between cards.

## Storyboard Render Contract

`storyboard.json` is an agent-internal planning artifact — no vtake CLI
command parses it. It exists to keep your timing and content decisions
explicit before you write each card's HTML. Stick to the v3-style
shape below so the same outline drives the composition you assemble in
Step 9.

Required structure (see Step 6 for the full example):

- `schemaVersion: 3`
- `composition: { fps, width, height, durationSeconds, layout, themeId, seed }` — note `durationSeconds`/`fps`/`themeId`/`layout` live **inside** `composition`, NOT at top level
- `videoTrack: { sourcePath, startSec, endSec, bounds? }` — video bounds default to full canvas
- `subtitles: { enabled, ... }`
- `cards[]` — each card has the 6 required fields: `id`, `intent`, `startSec`, `endSec`, `accentIndex`, `zone`, `contentHints`

Rules:

- Card times stay inside `composition.durationSeconds`. Adjacent cards **intentionally overlap** by the slip window (`SLIP ≈ 0.55s`) for the silky default transition — `data-track-index` increases per card to control z-order during the overlap (see Step 9's timing rules).
- Visual details live in card HTML fragments (Step 8), NOT in `contentHints`. `contentHints` is your own structured prompt for designing the card; the rendered look is the HTML.
- Keep the storyboard shape stable — even though nothing parses it, you read it back while authoring Step 8/9, and consistency keeps card IDs and timing in sync.
- Agent-side decisions like "I picked overlay × geom × clean" do NOT belong in `storyboard.json` — keep them in working memory and use them when authoring card HTML + GSAP tweens.

**Transparent card backgrounds for cards that share canvas with video.**
When the GSAP tween leaves video visible behind/beside the card (overlay
recipe, pip recipe, or any `card.zone = 'lower-third' | 'video-overlay'`
moment), the card's `.root` MUST NOT paint a full opaque background —
otherwise it occludes the video. Two patterns:

```css
/* Pattern A: transparent root, page body provides the cream backdrop */
html, body { background: var(--bg); }
.card[data-card-id="card-X"] .root { background: transparent; }

/* Pattern B: explicit per-card background ONLY for fullscreen cards */
.card[data-card-id="card-hero"] .root { background: var(--bg); }
.card[data-card-id="card-overlay"] .root { background: transparent; }
```

For `side-panel`-zone cards (split recipe), the card-host is already
only half the canvas, so an opaque card bg is fine — it only covers its
half.
