# 歸藏 DNA — 简洁排版家族宪法

> 「简洁排版类 · 歸藏家族」的纪律层。从 [op7418/guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill)
> 的视觉 DNA 提炼、翻译成**视频卡片**用法。这个文件讲「为什么 / 何时选」；
> 配套 [`guizang-clean.css`](guizang-clean.css) 是组件的权威定义（「长什么样」），
> [`guizang-checklist.md`](guizang-checklist.md) 是交付前质检门。
>
> **何时读**：Step 7 选风格落到 clean 家族任一款时；Step 8 写卡片前。

---

## 一句话

歸藏值钱的不是「又一种 Swiss 风格」，而是一整套**纪律**：字号字重强耦合、配色只能从预设挑、栅格强制对齐、间距模块化、一套可复用组件库。视频里照搬这套纪律，商业/讲解卡片就有了统一的「高级克制」质感。

---

## 两根支柱（永不混用，一片一根）

| | **Swiss 支柱**（国际主义） | **Editorial 支柱**（电子杂志） |
|---|---|---|
| 成员 | `swiss` · `minimal` · `terminal` | `editorial-print` · `pastel-aura` |
| 气质 | 讲解 / 数据 / 权威 / 工程 | 叙事 / 编辑 / 有温度 / 图为主角 |
| 字体 | 无衬线（Inter/Helvetica），mono 标签 | serif 承重（标题），sans 正文，mono 标签 |
| 配色 | 暖白 + 灰阶 + **单 accent** | **暖墨五色**（墨/纸成对） |
| 网格 | 12 列模块化，严格对齐 | 非对称 7:5 / 8:4 栏，图文跨页 |
| 何时选 | 财报、方法论拆解、枚举清单、技术、金句陈述 | 作品集、人物故事、品牌叙事、大事记、明亮素材 |
| host class | `.pillar-swiss` | `.pillar-editorial` |

> **指定即锁定仍然成立**：用户锁哪个具体风格就用哪个；pillar 只决定套 DNA 的哪一半。同片内不要又 Swiss 又 Editorial。

---

## 铁律 A — 字号字重耦合（核心质感来源）

**Swiss：越大越细。** 越大的字越细，越小的字越粗。

| 角色 | px（横屏基准） | 字重 | 类 |
|---|---|---|---|
| Hero 巨标题 | 120–160 | **200**（ExtraLight） | `.h-hero` |
| 大标题 | 80–110 | 250–300 | `.h-xl` |
| 段标题 | 44–72 | 300–400 | `.h-md` |
| 副标 | 30–40 | 400 | `.h-sub` |
| 引导句 | 28–32 | 400 | `.lead` |
| 正文 | 22–28 | 450 | `.body` |
| 小字 / meta | <20 | **600–700**（绝不 <500，太细读不清） | `.kicker` `.meta` |

**两个例外**：
1. **数字 / KPI 永远重**（700–800），不论多大——`.stat-nb` `.bar-value` `.big-num`。数字要质量感，不走「越大越细」。
2. **`minimal` 故意反向**：巨字用 900，是它的身份（「weight & size do the work」）。它是 Swiss 支柱里唯一倒置耦合的——但它的 meta/正文仍守耦合。

**Editorial：serif 承重。** 大标题用 serif 的 700–800 拿层级，正文用 sans 400 拿密度。serif=视觉重量，sans=信息密度，mono=节奏装饰。

> **字体可用性**：本地只 bundle 了 Inter 400/700。Swiss 的 200/300 极细体在 Derek 的 Mac 上靠 `Helvetica Neue UltraLight` 回退（stack 已含），serif/mono 靠系统（与 terminal/editorial 既有做法一致）。**要 guizang 级极细保真**（跨机一致），可选 bundle 进 `assets/fonts/`：Inter `200/300/800`、一款 serif（Source Serif 4 / Noto Serif SC）、一款 mono（JetBrains Mono），并在 `composition-shell.html` 加对应 `@font-face`。这是可选升级，不做也能正确渲染（只是极细体在非 Mac 上退到 400）。

---

## 铁律 B — 配色只能从预设挑（禁自定义 hex）

一卡一 accent / 一卡一墨调，**永不混**。对比度规则写死在下面。

### Swiss 支柱（共享灰阶 + 4 选 1 accent）
共享：`--paper:#fafaf8`（暖白，永不纯 #fff）`--ink:#0a0a0a` `--grey-1:#f0f0ee` `--grey-2:#d4d4d2` `--grey-3:#737373`

| accent key | hex | 文字色 | 性格 |
|---|---|---|---|
| `ikb`（默认） | `#002FA7` | **白** | 国际克莱因蓝，权威经典 |
| `lemon` | `#FFD500` | **黑** | 镉黄，活力（黄底必须黑字） |
| `lime` | `#C5E803` | **黑** | 荧光绿，未来 / Z 世代 |
| `safety` | `#FF6B35` | 白（weight ≥600） | 工业橙，警示 / 能量 |
| `swiss-red` | `#e8190f` | 白 | 信号红（旧 swiss 身份，保留） |

### Editorial 支柱（5 套暖墨，墨/纸成对）

| ink key | 墨 ink | 纸 paper | 气质 |
|---|---|---|---|
| `ink`（默认） | `#0a0a0b` | `#f1efea` | Monocle 暖灰，万能 |
| `indigo` | `#0a1f3d` | `#f1f3f5` | 学术 / 技术 / 研究 |
| `forest` | `#1a2e1f` | `#f5f1e8` | 自然 / 可持续 |
| `kraft` | `#2a1e13` | `#eedfc7` | 怀旧 / 手作 / 信封 |
| `dune` | `#1f1a14` | `#f0e6d2` | 艺术 / 画廊 / 极简 |

> `pastel-aura` 是 Editorial 支柱的「sans 日间变体」：象牙底 + 冷 aurora 渐变 + periwinkle accent，Derek 已去暖色/去衬线，保留它现有身份，不强塞 serif 墨调。

这些值会进 `render-strategy.md` 的 themeId 矩阵；Step 9 sed 填进 `composition-shell.html` 的 `--accent-*`。

---

## 铁律 C — 栅格 + 模块化间距

用 `guizang-clean.css` 的 `--sp-3…--sp-13`（8px 基线）和栅格原语（`.grid-12/.span-*`、`.grid-2-7-5` 等），**不手搓魔数 padding/gap**。对齐靠网格，不靠肉眼。

---

## 铁律 D — 装饰克制，无 canvas

clean 家族刻意**不配 WebGL 背景 / curve-motion**（那是视觉特效类的事）。氛围只用纯 CSS：发丝线 `.rule`、点阵 `.dots`、取景角、硬投影。多了就吵，丢了「简洁」。

---

## 组件目录（细节见 guizang-clean.css）

| 组件 | 类 | 用途 / 何时用 |
|---|---|---|
| kicker / meta | `.kicker` `.meta` | mono 大写小标签，节奏装饰、出处、时间码 |
| 数据卡 | `.stat-card`（`.stat-label/.stat-nb/.stat-unit/.stat-note`） | 大数字 + 单位 + 注，**枚举数据**首选 |
| 引语 | `.callout`（`.q-big/.cite`） | 金句 / 拉框引用，左 accent 边 |
| 流程 | `.pipeline/.step`（`.step-nb/.step-title/.step-desc`） | **方法论拆解 / N 步流程** |
| 时间轴 | `.timeline-v/.tl-node` | 大事记 / 演进 / 里程碑 |
| 条形图 | `.bar-chart/.bar-row` | 对比数据，accent 填充 |
| 高亮 | `.mark` `.underline-accent` | 行内强调 |
| 实色块 | `.accent-block` `.ink-block` `.grey-block` | 高对比呼喊 / 锚点 |
| 栅格 | `.grid-12/.span-*` `.grid-2-7-5/6-6/8-4` `.grid-3` | 布局对齐 |
| 装饰 | `.rule` `.tag` `.dots` | 发丝线 / 标签 / 点阵氛围 |

**用法**：clone fragment 后，从这些类里挑组件填内容，不发明新类（校验脚本会拦）。Step 8 的「compose, don't just fill」依然适用——可重组结构服务这张卡的点，但组件词汇、字阶、配色、间距锁定。

---

## PPT → Video 翻译备忘（哪些丢了）

歸藏原版是静态多页 PPT，搬进视频时：
- **丢**：WebGL 色散/网格背景、多页导航 / nav-safe-bottom / 页码 chrome、Motion One、print/low-power 模式。
- **映射**：动画 recipe（cascade/line/directional）→ 现有 `data-anim` 原语（`settle`/`kinetic-chars`/`drift`，见 card-contract.md）；nav 安全区 → 现有 layout 的 card-host bounds；16:9 固定 → 竖屏 ×1.3 缩放系统。
- **保**：字阶耦合、预设调色板、8px 间距、栅格、整个组件库。

---

## 一分钟自检（完整版见 guizang-checklist.md）

- [ ] 选了**一根**支柱、**一个** accent/墨调，没混。
- [ ] 字重符合耦合带（大标题细、小字重；数字重；minimal 例外）。
- [ ] 配色取自上面预设表，没内联自定义 hex；accent 对比度对（黄/绿黑字）。
- [ ] 只用了 `guizang-clean.css` 里存在的组件类。
- [ ] 没加 canvas / WebGL；装饰是纯 CSS。
- [ ] 中文标题 ≤12 字/行；clamp + max-width + overflow-wrap 防溢出。
