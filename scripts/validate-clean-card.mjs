#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   validate-clean-card.mjs — 歸藏家族 clean 卡片合规校验（zero-dep）
   ────────────────────────────────────────────────────────────────────────
   以 guizang-dna.md / guizang-clean.css 为准，检查一个 clean-family card
   fragment（或默认全部 5 个）是否守纪律。沿用 guizang-ppt-skill 的
   validate-swiss-deck.mjs 血统，正则实现、无依赖。

   用法：
     node scripts/validate-clean-card.mjs                       # 校验全部 5 个 clean fragment
     node scripts/validate-clean-card.mjs path/to/card.html ... # 校验指定文件

   退出码：任一 HARD FAIL → 1；否则 0（WARN 不影响退出码）。
   ════════════════════════════════════════════════════════════════════════ */
import { readFileSync, existsSync } from 'fs'
import { dirname, join, basename } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const STYLES = join(HERE, '..', 'references', 'styles')
const CLEAN = ['swiss', 'minimal', 'terminal', 'editorial-print', 'pastel-aura']

// 预设 accent allowlist（小写无 #）—— 镜像 guizang-dna.md 调色板表
const PRESET_ACCENTS = new Set([
  '002fa7', 'ffd500', 'c5e803', 'ff6b35', 'e8190f', // Swiss accents
  '0a0a0a', '0a0a0b', '0a1f3d', '1a2e1f', '2a1e13', '1f1a14', // Editorial inks / minimal
  '5e6ad2', '4ade80' // pastel periwinkle · terminal phosphor
])
// 真彩色 emoji 块（不含 ✓ ● ▶ 这类排版字形——它们是合法 chrome，不是 emoji）
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]\u{FE0F}/u

function check(file) {
  if (!existsSync(file)) return { file, fails: [`file not found: ${file}`], warns: [] }
  const raw = readFileSync(file, 'utf8')
  // 注释（HTML + CSS）不算渲染内容——剥掉再查，免得作者注释里的 emoji/示例误报
  const src = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const fails = []
  const warns = []

  // ── HARD: pillar declared ──
  const pillar = /class="[^"]*\bpillar-(swiss|editorial)\b/.exec(src)
  if (!pillar) fails.push('缺少支柱声明：root 必须带 class="...pillar-swiss" 或 "pillar-editorial"')

  // ── HARD: --accent token present ──
  const accentDecl = /--accent\s*:\s*([^;]+);/.exec(src)
  if (!accentDecl) fails.push('缺少 --accent token（配色必须经 token，不能直接写死）')

  // ── HARD: no canvas / script (clean family = 纯 CSS，无特效层) ──
  if (/<canvas[\s>]/i.test(src)) fails.push('clean 家族禁止 <canvas>（那是视觉特效类）')
  if (/<script[\s>]/i.test(src)) fails.push('card fragment 禁止 <script>（动效用 data-anim 声明）')

  // ── WARN: accent in preset palette ──
  if (accentDecl) {
    const hex = (/#([0-9a-fA-F]{6})/.exec(accentDecl[1]) || [])[1]
    if (hex && !PRESET_ACCENTS.has(hex.toLowerCase())) {
      warns.push(`--accent #${hex} 不在预设表（确认是不是自定义色；预设见 guizang-dna.md）`)
    }
  }

  // ── WARN: overflow guards (card-contract NON-NEGOTIABLE) ──
  if (!/overflow:\s*hidden/.test(src)) warns.push('root 建议 overflow:hidden（防溢出）')
  if (!/box-sizing:\s*border-box/.test(src)) warns.push('建议 box-sizing:border-box')

  // ── WARN: emoji-free ──
  if (EMOJI.test(src)) warns.push('检测到 emoji——改用线性 SVG/Lucide')

  // ── WARN: weight–size coupling (Swiss 专属规则；minimal 与数字豁免，
  //         Editorial 支柱用重 serif/sans 承重，不适用「越大越细」)──
  const isSwiss = pillar && pillar[1] === 'swiss'
  const isMinimal = /data-card-id="ref-minimal"/.test(src)
  if (isSwiss && !isMinimal) {
    const re = /font:\s*(\d{3})\s+(?:clamp\([^)]*?(\d{2,4})px\s*\)|(\d{2,4})px)/g
    let m
    while ((m = re.exec(src))) {
      const w = +m[1], size = +(m[2] || m[3])
      const ctx = src.slice(Math.max(0, m.index - 80), m.index)
      const isNumber = /stat-nb|big-num|kpi|\.num|stat-card/.test(ctx)
      if (size >= 88 && w >= 700 && !isNumber) {
        warns.push(`巨标题 ${size}px 用了 weight ${w}（越大越细：Swiss 应 ≤300）`)
      }
    }
  }

  return { file, fails, warns }
}

const targets = process.argv.slice(2)
const files = targets.length ? targets : CLEAN.map((k) => join(STYLES, `${k}.html`))

let hardFails = 0
console.log('\n歸藏 clean 卡片校验 · validate-clean-card\n' + '─'.repeat(48))
for (const f of files) {
  const { fails, warns } = check(f)
  const name = basename(f)
  if (fails.length) {
    hardFails += fails.length
    console.log(`\n✗ FAIL  ${name}`)
    fails.forEach((x) => console.log(`    ✗ ${x}`))
    warns.forEach((x) => console.log(`    ⚠ ${x}`))
  } else if (warns.length) {
    console.log(`\n⚠ PASS  ${name}  (${warns.length} warn)`)
    warns.forEach((x) => console.log(`    ⚠ ${x}`))
  } else {
    console.log(`\n✓ PASS  ${name}`)
  }
}
console.log('\n' + '─'.repeat(48))
console.log(hardFails ? `✗ ${hardFails} hard failure(s)` : '✓ all clean fragments conform')
process.exit(hardFails ? 1 : 0)
