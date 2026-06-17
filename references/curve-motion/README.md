# Curve Motion — 数学曲线视觉增强（可选）

把数学曲线（玫瑰/李萨茹/双纽线/内旋轮线/心脏线/心形/傅里叶/蝴蝶）用作 composition
的视觉母题。移植自 `math-curve-loaders`，全部重写成**时间的闭式函数**，由 GSAP 主
时间轴 `onUpdate` 驱动 —— 满足 HyperFrames 确定性 seek 捕获（已实测同一 seek 两次
截图 md5 一致）。与 `nebula-glass` 的粒子场同机制（见 `card-contract.md` 的
canvas-atmosphere 例外段）。

**何时用**：想给暗底风格（`nebula-glass` / `glass` / `spatial` / `geom`）加一层高级
动态质感时。**不要**叠在 `glass-hud`（恒 overlay、章节条已是 chrome）或 `swiss` /
`minimal`（白底冷静）上 —— 会变吵。一支视频锁一条曲线，别每张卡换。

三种能力，按需取用：

| 文件 / API | 能力 | 落地 |
|---|---|---|
| `curve-atmosphere.js` → `makeCurveAtmosphere` | 背景**氛围底**：会呼吸慢旋的发光曲线 + 彗星拖尾 | composition 级 canvas |
| `curve-atmosphere.js` → `curvePath` / `sampleCurve` | **排版/图片**：textPath 排字 · clip-path 裁图剪影 · 元素落在采样点 | 纯 SVG/CSS，卡片内可用 ✅ |
| `curve-motion.js` → `curveIn` / `curveBob` | **丝滑动效**：沿曲线弧滑入落位 · 落定后轻微漂移 | composition GSAP 块 |

---

## 1) 背景氛围底

```html
<!-- #stage 第一个子元素 -->
<canvas id="curve-atmo" width="1080" height="1920"></canvas>
```
```css
#curve-atmo { position:absolute; inset:0; width:100%; height:100%; z-index:0; pointer-events:none; }
```
stage 文件 + 主时间轴驱动 `draw(t)`：
```bash
cp "$SKILL_DIR/references/curve-motion/curve-atmosphere.js" "$WORK_DIR/public/vendor/"
```
```html
<script src="vendor/curve-atmosphere.js"></script>
```
```js
// 紧跟 const tl = gsap.timeline({...}) 之后
(function () {
  var cv = document.getElementById('curve-atmo'); if (!cv) return;
  var atmo = CurveAtmosphere.makeCurveAtmosphere(cv, {
    curve:'rose', accent:'#5B8CFF', opacity:0.5,   // accent 对齐 --accent-0；opacity 0.4–0.6 克制
    drawPeriod:9, rotPeriod:48, pulsePeriod:7
  });
  var clock = { t:0 };
  tl.to(clock, { t:DURATION, duration:DURATION, ease:'none',
    onUpdate:function(){ atmo.draw(clock.t); } }, 0);
  atmo.draw(0);
})();
```

## 2) 排版 / 图片（纯 SVG/CSS，卡片内可用）

`curvePath(key,{steps,size,pad,s,rot,closed})` → SVG path 字符串；
`sampleCurve(key,{n,size,pad,s,rot})` → 像素点数组。用法：
- **文字沿曲线**：把 path 放进 `<defs>`，`<textPath href="#id">` 排字（开放曲线最顺）。
- **图片裁剪影**：path（`closed:true`）放进 `<clipPath>`，裁住图片（心形/蝴蝶/玫瑰最出效果）。
- **元素布点**：`sampleCurve` 取 N 点，把头像/数字/缩略图摆上去，曲线当隐形排版骨架。

静态部分零脚本、与卡片 contract 兼容；要让它们动（字流动/剪影呼吸）仍须走 `draw(t)`。

## 3) 丝滑动效组件

```bash
cp "$SKILL_DIR/references/curve-motion/curve-motion.js" "$WORK_DIR/public/vendor/"
```
```html
<script src="vendor/curve-atmosphere.js"></script>
<script src="vendor/curve-motion.js"></script>
```
卡片元素只给 id（卡片仍**禁 `<script>`**），调用写在 composition GSAP 块：
```js
// 沿曲线弧滑入落位（t0 = 卡片 startSec + 偏移）
CurveMotion.curveIn(tl, '#card-03-title', 12.3, 0.9, { curve:'lissajous', amp:70, rise:18 });
// 落定后轻微漂移（compDur 必填 = composition.durationSeconds，禁 repeat:-1）
CurveMotion.curveBob(tl, '#card-03-title', { curve:'lemniscate', amp:9, period:9, at:13.4, compDur:DURATION });
```
参数：
`curveIn(tl, sel, t0, dur, {curve, seg=0.22, from=0.12, amp=64, ease='power3.out', fade=true, rise=0})`
`curveBob(tl, sel, {curve='lemniscate', amp=9(≤12), period=9, span=1, from=0, at=0, compDur})`

> **铁律**：丝滑动效组件别和同元素的 `data-anim="drift"` 叠（都写 transform 会打架）——二选一。
> 全部走 `draw(t)` / `tl` 驱动，绝不写 `requestAnimationFrame`。

---

可视化 playground（浏览器预览全部曲线 + 排版/图片/动效 demo）在
`~/.claude/assets/interflow-curve-atmosphere/`（`preview.html` / `applications.html` /
`motion-demo.html`）。
