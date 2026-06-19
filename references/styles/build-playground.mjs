import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

// Reads the style fragments sitting next to this script, so the gallery rebuilds
// wherever the repo is cloned. Usage: node build-playground.mjs [out.html]
const STYLES_DIR = dirname(fileURLToPath(import.meta.url))
const OUT = process.argv[2] || join(STYLES_DIR, 'style-playground.html')

// The tiny anim driver the Electron app injects into each preview iframe so the
// data-anim entrance attributes actually play. Mirrored from
// interflow-workbench/src/renderer/src/style-anim-driver.ts.
const STYLE_ANIM_DRIVER = `
(function () {
  try {
    var nodes = [].slice.call(document.querySelectorAll('[data-anim]'));
    if (!nodes.length) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var EASE = 'cubic-bezier(0.16,1,0.3,1)';
    function n(el, k, d) { var v = el.getAttribute('data-anim-' + k); return v == null ? d : parseFloat(v); }
    function s(el, k, d) { var v = el.getAttribute('data-anim-' + k); return v == null ? d : v; }
    function frames(el) {
      switch (el.getAttribute('data-anim')) {
        case 'fade-in': return [{ opacity: 0 }, { opacity: 1 }];
        case 'fade-out': return [{ opacity: 1 }, { opacity: 0 }];
        case 'scale-pop': return [{ opacity: 0, transform: 'scale(0.82)' }, { opacity: 1, transform: 'scale(1)' }];
        case 'blur-in': return [{ opacity: 0, filter: 'blur(12px)' }, { opacity: 1, filter: 'blur(0)' }];
        case 'slide-in': {
          var f = s(el, 'from', 'bottom'), d = n(el, 'distance', 60);
          var x = f === 'left' ? -d : f === 'right' ? d : 0, y = f === 'top' ? -d : f === 'bottom' ? d : 0;
          return [{ opacity: 0, transform: 'translate(' + x + 'px,' + y + 'px)' }, { opacity: 1, transform: 'none' }];
        }
        case 'parallax-in':
        case 'settle': {
          var ff = s(el, 'from', 'bottom'), dd = n(el, 'distance', 28);
          var xx = ff === 'left' ? -dd : ff === 'right' ? dd : 0, yy = ff === 'top' ? -dd : ff === 'bottom' ? dd : 0;
          return [{ opacity: 0, transform: 'translate(' + xx + 'px,' + yy + 'px)' }, { opacity: 1, transform: 'none' }];
        }
        case 'grow-x': return [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }];
        case 'grow-y': return [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }];
        case 'mask-reveal': {
          var dir = s(el, 'direction', 'left');
          var m = { left: 'inset(0 100% 0 0)', right: 'inset(0 0 0 100%)', top: 'inset(100% 0 0 0)', bottom: 'inset(0 0 100% 0)' }[dir] || 'inset(0 100% 0 0)';
          return [{ clipPath: m }, { clipPath: 'inset(0 0 0 0)' }];
        }
        default: return [{ opacity: 0 }, { opacity: 1 }];
      }
    }
    var handles = [];
    function playEntrances() {
      handles.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      handles = [];
      nodes.forEach(function (el) {
        var kind = el.getAttribute('data-anim');
        if (kind === 'drift') return;
        var at = n(el, 'at', 0) * 1000, du = Math.max(80, n(el, 'duration', 0.5) * 1000);
        var origin = kind === 'grow-x' ? 'left center' : kind === 'grow-y' ? 'bottom center' : '';
        if (origin) el.style.transformOrigin = origin;
        if (kind === 'grow-x' || kind === 'grow-y') du = Math.max(du, 320);
        if (kind === 'kinetic-chars' || kind === 'typewriter') {
          var chars = [].slice.call(el.querySelectorAll('.char'));
          var stag = n(el, 'stagger', kind === 'typewriter' ? 0.06 : 0.04) * 1000;
          (chars.length ? chars : [el]).forEach(function (c, i) {
            handles.push(c.animate([{ opacity: 0, transform: 'translateY(0.3em)' }, { opacity: 1, transform: 'none' }],
              { duration: du, delay: at + i * stag, easing: EASE, fill: 'both' }));
          });
          return;
        }
        handles.push(el.animate(frames(el), { duration: du, delay: at, easing: EASE, fill: 'both' }));
      });
    }
    nodes.forEach(function (el) {
      if (el.getAttribute('data-anim') !== 'drift') return;
      var axis = s(el, 'axis', 'y'), amp = n(el, 'amp', 8), period = Math.max(4000, n(el, 'period', 10) * 1000);
      var a = axis === 'rotate'
        ? [{ transform: 'rotate(-' + amp + 'deg)' }, { transform: 'rotate(' + amp + 'deg)' }]
        : axis === 'x'
          ? [{ transform: 'translateX(-' + amp + 'px)' }, { transform: 'translateX(' + amp + 'px)' }]
          : [{ transform: 'translateY(-' + amp + 'px)' }, { transform: 'translateY(' + amp + 'px)' }];
      el.animate(a, { duration: period, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    });
    var maxEnd = 0;
    nodes.forEach(function (el) { var e = n(el, 'at', 0) + Math.max(0.4, n(el, 'duration', 0.5)); if (e > maxEnd) maxEnd = e; });
    var LOOP = (maxEnd + 1.8) * 1000;
    playEntrances();
    setInterval(playEntrances, LOOP);
  } catch (e) {}
})();
`

// Mirrors STYLE_META in interflow-workbench/src/main/styles.ts, reordered so the
// 炸裂特效 family (the one Derek asked to see) leads.
const META = [
  { key: 'neon-grid-hud', cn: '霓虹网格', group: '炸裂特效', accent: '#22D3EE', when: '赛博真人霓虹窗口 + 透视网格 + 粒子 + HUD 巨字，特效永远在人后不糊脸（炸裂档默认）', tags: ['赛博', '霓虹', 'TRON', '发布会', '短视频高光'] },
  { key: 'liquid-aurora', cn: '流光极光', group: '炸裂特效', accent: '#34D399', when: '流动液态极光，品牌 / 情绪 / 治愈 / 高级', tags: ['极光', '流光', '液态', '治愈', '高级'] },
  { key: 'holo-iridescent', cn: '全息虹彩', group: '炸裂特效', accent: '#C77DFF', when: '全息箔色散，最前卫 / 产品揭晓 / 潮', tags: ['全息', '虹彩', '箔', '前卫', '潮'] },
  { key: 'cinematic-bloom', cn: '电影光影', group: '炸裂特效', accent: '#FFB06A', when: '宽银幕镜头光晕，大片质感 / 情绪 / 电影感', tags: ['电影', '光晕', '宽银幕', '情绪', '大片'] },
  { key: 'kinetic-megatype', cn: '动态巨字', group: '炸裂特效', accent: '#FF4A17', when: '瑞士粗野巨字运动，态度 / 宣言 / 金句（巨字主角 · 真人小窗）', tags: ['巨字', '动态', '宣言', '金句', '粗野'] },
  { key: 'depth-parallax', cn: '纵深视差', group: '炸裂特效', accent: '#E0894A', when: '多层 3D 景深视差，立体 / 沉浸 / 空间感', tags: ['视差', '3D', '景深', '沉浸', '空间'] },
  { key: 'nebula-glass', cn: '暗夜星河', group: '暗调电影感', accent: '#5B8CFF', when: '黑底+流动粒子+玻璃，最高级最有科技感（旗舰）', tags: ['星空', '粒子', '未来', 'AI', '发布会'] },
  { key: 'glass', cn: '玻璃拟态', group: '暗调电影感', accent: '#5B8CFF', when: '简单两色渐变 + 磨砂玻璃，半透明、干净、高级', tags: ['玻璃', '磨砂', '半透明', '简洁', '高级'] },
  { key: 'glass-hud', cn: '暖玻 HUD', group: '暗调电影感', accent: '#E0894A', when: '暖玻璃面板浮在真人口播上 + 顶部章节条 + 底部进度轴双语字幕，橙色 accent', tags: ['口播', '叠加', '章节条', '双语字幕', 'terracotta'] },
  { key: 'spatial', cn: '暖光太空', group: '暗调电影感', accent: '#FF8A4C', when: '黑底+暖橙光，温暖又有空间感（唯一的暖黑底）', tags: ['暖光', '深空', '温暖', '人物', '治愈'] },
  { key: 'geom', cn: '撞色大字', group: '暗调电影感', accent: '#D4FF3A', when: '黑底+亮色块+超大字，大胆有冲击力', tags: ['撞色', '大字', '态度', '宣言', '潮'] },
  { key: 'swiss', cn: '瑞士网格', group: '歸藏·Swiss', accent: '#002FA7', when: '暖白 + 12 列网格 + 越大越细 + 单 accent，数据/报告/权威（歸藏 Swiss 支柱）', tags: ['瑞士', '网格', '数据', 'IKB', '权威'] },
  { key: 'minimal', cn: '黑白极简', group: '歸藏·Swiss', accent: '#0A0A0A', when: '纯黑白巨字 + 极致留白，高级、克制（歸藏里唯一反向耦合的巨字）', tags: ['极简', '黑白', '留白', '金句', '高级'] },
  { key: 'terminal', cn: '代码终端', group: '歸藏·Swiss', accent: '#4ADE80', when: '黑底绿字代码风，技术、极客、工程感（mono-native 的 Swiss 成员）', tags: ['代码', '终端', '技术', '编程', '极客'] },
  { key: 'editorial-print', cn: '杂志印刷', group: '歸藏·Editorial', accent: '#0A0A0B', when: 'serif 承重 + 暖墨纸 + 硬投影，把素材排成杂志跨页（歸藏 Editorial 支柱）', tags: ['杂志', '印刷', '作品集', 'serif', '排版'] },
  { key: 'pastel-aura', cn: '柔光浅色', group: '歸藏·Editorial', accent: '#5E6AD2', when: '象牙底 + 冷 aurora + 现代 sans 标题，日常、白天（Editorial 的 sans 日间变体）', tags: ['浅色', '柔和', '清爽', '日常', '温柔'] }
]

const GROUP_ORDER = ['炸裂特效', '暗调电影感', '歸藏·Swiss', '歸藏·Editorial']
const GROUP_COLOR = {
  '炸裂特效': '#C77DFF',
  '暗调电影感': '#5B8CFF',
  '歸藏·Swiss': '#FF6B5E',
  '歸藏·Editorial': '#C5B299'
}

// Uniform preview box — every card gets the SAME slot; the fragment is
// contain-scaled (whole frame visible, letterboxed on black) so a 16:9
// landscape and a 9:16 portrait read as the same tidy card.
const BOX_W = 348
const BOX_H = 430

function parseStage(html) {
  const m = html.match(/\.stage\s*\{([^}]*)\}/)
  const block = m ? m[1] : ''
  const w = parseFloat((block.match(/width:\s*([\d.]+)px/) || [])[1] || '1920')
  const h = parseFloat((block.match(/height:\s*([\d.]+)px/) || [])[1] || '1080')
  const sc = parseFloat((block.match(/transform:\s*scale\(([\d.]+)\)/) || [])[1] || '1')
  return { nW: w * sc, nH: h * sc }
}

function withDriver(html) {
  const tag = `<script>${STYLE_ANIM_DRIVER}</script>`
  return html.includes('</body>') ? html.replace('</body>', `${tag}</body>`) : html + tag
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function card(meta, idx) {
  const raw = readFileSync(join(STYLES_DIR, `${meta.key}.html`), 'utf8')
  const { nW, nH } = parseStage(raw)
  // contain: whole fragment visible inside the uniform box, centered.
  const sf = Math.min(BOX_W / nW, BOX_H / nH)
  const dW = nW * sf
  const dH = nH * sf
  const left = (BOX_W - dW) / 2
  const top = (BOX_H - dH) / 2
  const srcdoc = esc(withDriver(raw))
  const tags = meta.tags.slice(0, 4).map((t) => `<span class="tag">${t}</span>`).join('')
  const gc = GROUP_COLOR[meta.group] || '#888'
  const hero = meta.group === '炸裂特效' ? ' is-hero' : ''
  return `
    <article class="card${hero}" style="--gc:${gc}">
      <div class="frame">
        <span class="idx">${String(idx + 1).padStart(2, '0')}</span>
        <span class="gtag">${meta.group}</span>
        <iframe loading="lazy" sandbox="allow-scripts" scrolling="no" tabindex="-1"
          style="left:${left.toFixed(1)}px;top:${top.toFixed(1)}px;width:${nW}px;height:${nH}px;transform:scale(${sf.toFixed(4)});transform-origin:top left;"
          srcdoc="${srcdoc}"></iframe>
      </div>
      <div class="meta">
        <div class="name"><span class="dot" style="background:${meta.accent}"></span>${meta.cn}<code>${meta.key}</code></div>
        <p class="when">${meta.when}</p>
        <div class="tags">${tags}</div>
      </div>
    </article>`
}

// One ordered grid (炸裂族 first), uniform cards.
const ordered = GROUP_ORDER.flatMap((g) => META.filter((m) => m.group === g))
const grid = `<div class="grid">${ordered.map(card).join('')}</div>`
const legend = GROUP_ORDER.map((g) => {
  const c = META.filter((m) => m.group === g).length
  return `<span class="leg"><span class="leg-dot" style="background:${GROUP_COLOR[g]}"></span>${g}<b>${c}</b></span>`
}).join('')

const total = META.length
const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Interflow Video Cut · 视觉风格 Playground</title>
<style>
  * { box-sizing: border-box; }
  :root {
    --bg: #0a0b10; --ink: #f4f5fa; --muted: #9aa0b4; --muted2: #6b7187;
    --line: rgba(255,255,255,.08); --surface: rgba(255,255,255,.025);
    --boxw: ${BOX_W}px; --boxh: ${BOX_H}px;
  }
  html, body { margin: 0; background: var(--bg); color: var(--ink);
    font-family: -apple-system, "PingFang SC", "Inter", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  body { background:
    radial-gradient(110% 60% at 0% 0%, rgba(60,90,200,.12), transparent 55%),
    radial-gradient(110% 60% at 100% 0%, rgba(200,60,160,.10), transparent 55%),
    var(--bg); }
  .wrap { max-width: 1560px; margin: 0 auto; padding: 64px 40px 90px; }

  /* Top — the creed leads. Everything else hangs off it. */
  .top { max-width: 1040px; padding-bottom: 30px; border-bottom: 1px solid var(--line); }
  .eyebrow { font-family: ui-monospace, "SF Mono", monospace; font-size: 11.5px; letter-spacing: 4px;
    text-transform: uppercase; color: var(--muted2); margin: 0 0 22px; }
  h1 { font-size: clamp(34px, 5.2vw, 60px); font-weight: 800; letter-spacing: -1.6px; margin: 0; line-height: 1.08;
    background: linear-gradient(100deg, #fff 30%, #e79ddc 92%); -webkit-background-clip: text;
    background-clip: text; color: transparent; }
  h1 .l2 { display: block; background: linear-gradient(100deg, #9fb4ff 10%, #c77dff 70%);
    -webkit-background-clip: text; background-clip: text; color: transparent; }
  .sub { color: var(--muted); font-size: 15.5px; line-height: 1.7; margin: 22px 0 0; max-width: 720px; }
  .sub b { color: var(--ink); font-weight: 600; }
  .sub code { background: rgba(255,255,255,.07); border-radius: 5px; padding: 1px 6px; font-size: 13px; color: #cdd3e6; }
  .note { font-size: 12px; line-height: 1.6; color: var(--muted2); border-left: 2px solid rgba(91,140,255,.5);
    padding: 3px 0 3px 14px; margin: 18px 0 0; max-width: 720px; }
  .note b { color: var(--muted); font-weight: 600; }

  .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; margin: 26px 0 30px; }
  .legend .lbl { font-size: 11.5px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted2);
    font-family: ui-monospace, monospace; }
  .leg { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: var(--muted); }
  .leg b { font-family: ui-monospace, monospace; font-size: 11px; font-weight: 500; color: var(--muted2);
    border: 1px solid var(--line); border-radius: 999px; padding: 1px 7px; }
  .leg-dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }

  /* Regular grid — fixed-width cards, auto-fill → 4×4 wide, 3×3 narrower. */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, var(--boxw));
    gap: 30px 26px; justify-content: center; }
  .card { display: flex; flex-direction: column; width: var(--boxw); }
  .frame { position: relative; width: var(--boxw); height: var(--boxh); overflow: hidden;
    border-radius: 14px; background: #000; border: 1px solid var(--line);
    box-shadow: 0 16px 40px -22px rgba(0,0,0,.85); }
  .frame iframe { position: absolute; border: 0; display: block; pointer-events: none; }
  .card.is-hero .frame { border-color: color-mix(in srgb, var(--gc) 55%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--gc) 30%, transparent),
                0 16px 46px -18px color-mix(in srgb, var(--gc) 45%, transparent); }
  .idx { position: absolute; left: 10px; top: 9px; z-index: 2; font-family: ui-monospace, monospace;
    font-size: 11px; font-weight: 600; color: rgba(255,255,255,.78); letter-spacing: .5px;
    background: rgba(0,0,0,.42); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
    border: 1px solid rgba(255,255,255,.14); border-radius: 7px; padding: 2px 7px; }
  .gtag { position: absolute; right: 10px; top: 9px; z-index: 2; font-size: 10.5px; font-weight: 600;
    color: #fff; background: color-mix(in srgb, var(--gc) 78%, #000); border-radius: 999px; padding: 3px 9px;
    box-shadow: 0 2px 10px rgba(0,0,0,.4); }

  .meta { padding: 13px 2px 0; }
  .name { display: flex; align-items: center; gap: 8px; font-size: 15.5px; font-weight: 650; letter-spacing: -.2px; }
  .name code { font-family: ui-monospace, monospace; font-size: 10.5px; font-weight: 500; color: var(--muted2);
    background: rgba(255,255,255,.05); border-radius: 5px; padding: 2px 7px; margin-left: auto; }
  .dot { width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 10px currentColor; flex: none; }
  .when { margin: 8px 0 10px; color: var(--muted); font-size: 12px; line-height: 1.5; height: 36px;
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .tags { display: flex; flex-wrap: nowrap; gap: 6px; overflow: hidden; height: 22px; }
  .tag { white-space: nowrap; font-size: 11px; color: var(--muted); background: rgba(255,255,255,.045);
    border: 1px solid var(--line); border-radius: 999px; padding: 3px 9px; }
  footer { margin-top: 64px; padding-top: 22px; border-top: 1px solid var(--line); color: var(--muted2); font-size: 12px; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <p class="eyebrow">Interflow · 内容为主 · 形式为辅</p>
      <h1>别让形式，耽误了别人看见你<span class="l2">让 AI 尽快成为你的外包。</span></h1>
      <p class="sub">下面这 ${total} 款，全是<b>“形式”</b>。挑顺眼的一个，剩下的成片交给 AI——你只要<b>出现，把话说清楚</b>。形式不该是门槛，它只是让别人更快看见你的那层壳。</p>
      <p class="note">这些是每款的「定帧样卡」（真排版/配色/辉光，内容动效已注入）；会动的炸裂背景配方在文件头注释里，出片时才进 HyperFrames 时间轴跑——别让它分心，<b>先看见“你”想说什么</b>。</p>
    </div>
    <div class="legend"><span class="lbl">挑一个壳</span>${legend}</div>
    ${grid}
    <footer>从 ~/.claude/skills/interflow-video-cut/references/styles/ 生成 · 单文件自包含，可直接拖到任意位置打开或分享</footer>
  </div>
</body>
</html>`

writeFileSync(OUT, page)
console.log(`wrote ${OUT} · ${total} styles`)
