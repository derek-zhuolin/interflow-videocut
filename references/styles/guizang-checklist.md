# 歸藏家族 · 交付质检门

> clean 家族（Swiss + Editorial）卡片交付前过这道门。改写自
> guizang-ppt-skill 的 P0–P3 checklist，翻译成视频卡片口径。
> P0 必过；P1 强烈建议；P2/P3 加分。机器可查的部分跑
> `node scripts/validate-clean-card.mjs <fragment>`，其余人工过。

## P0 — 必过（不过不交）

- [ ] **一根支柱**：root 带 `pillar-swiss` 或 `pillar-editorial`，全片不混支柱。
- [ ] **一个 accent / 一套墨调**：`--accent`（或墨/纸对）取自 guizang-dna.md 预设表，**无自定义 hex**；同片不混色。
- [ ] **对比度对**：黄(`lemon`)/绿(`lime`) 底用**黑字**；IKB/橙(`safety`)/红底用白字。
- [ ] **无 canvas / 无 WebGL**：clean 家族纯 CSS 装饰，fragment 里没有 `<canvas>`/`<script>`。
- [ ] **字重耦合**：巨标题细（Swiss 200/300；Editorial serif 700–800 承重）、小字/meta 重（≥600）；数字一律重（800）。`minimal` 巨字 900 是唯一合法例外。
- [ ] **不溢出**：root 有 `overflow:hidden` + `box-sizing:border-box`；文字块有 `line-height`+`max-width`+`overflow-wrap`；hero 用 `clamp()` 不用死 px。
- [ ] **中文标题 ≤12 字/行**，不尴尬换行。
- [ ] **无 emoji**（要图标用线性 SVG / Lucide）。

## P1 — 强烈建议

- [ ] 组件类来自 `guizang-clean.css`（stat-card / callout / pipeline / timeline / bar-chart / kicker / meta / mark / accent-block），没发明同义新类。
- [ ] 间距走 `--sp-*`（8px 基线）/ 栅格原语，没手搓魔数 padding。
- [ ] mono 标签（kicker/meta）大写 + 字距（.18em–.3em）。
- [ ] 竖屏(9:16)按 card-contract 缩放：标题 ×1.35、数字 ×1.40、meta ×1.25。
- [ ] 相邻卡结构不雷同（compose, don't just fill）。

## P2 — 加分

- [ ] 数据用 `.stat-card`、流程用 `.pipeline`、引语用 `.callout`、对比用 `.bar-chart`——组件语义对上内容。
- [ ] 装饰克制：≤2 个常驻动态（一个 drift + 一条 grow 线），发丝线/点阵不喧宾。
- [ ] 关键信息落定后静止 ≥1.5s 可读。

## P3 — 打磨

- [ ] 动效走 `settle`（默认入场，无弹跳）；`scale-pop` 只留给单一焦点。
- [ ] Editorial 图为主角：图占比足、serif 标题承重、留白即呼吸。
- [ ] Swiss 网格对齐到列，accent 块边缘干净（`opacity:1`，无渐变/阴影糊边）。
