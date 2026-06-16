# Card Contract — Step 8 reference

This is the full body of **Step 8 (Write Each Card's HTML)**, moved out of
`SKILL.md` to keep the workflow skeleton light. Read it when you reach Step 8.
It covers: the clone-first default, the card HTML contract + hard rules,
NON-NEGOTIABLE overflow safety, portrait sizing, the silky motion philosophy,
the `data-anim` kinds table, and the `card-cta` brand-outro template.

## Clone-first (the default — read before writing anything)

For each card:

1. `cp "$SKILL_DIR/references/styles/<chosenStyle>.html" "$WORK_DIR/public/cards/<card-id>.html"`
2. Rename the fragment's `data-card-id="ref-<key>"` to this card's `<card-id>`
   (update the scoped `<style>` selectors + element ids to match).
3. Swap the placeholder copy for this card's real `contentHints` text, and set
   the accent to the card's `accentIndex`.
4. Stop there. Do **not** redesign the layout, re-pick fonts, or re-author the
   ornament — the reference already encodes the curated look. Touch structure
   only for the rare card whose content (e.g. a 4-way comparison) genuinely
   doesn't fit the reference's shape.

Writing a fragment from a blank file is the **exception**, not the routine. The
contract below documents what a valid fragment looks like (so you can validate a
clone and author the rare bespoke card) — it is **not** an instruction to build
every card from scratch.

Each file contains a single rooted HTML fragment that follows this contract:

## Card HTML Contract

```html
<div class="card" data-card-id="{cardId}">
  <style>
    /* MUST: every rule starts with .card[data-card-id="{cardId}"] */
    .card[data-card-id="card-01"] .root {
      width: 100%; height: 100%;
      display: flex; ...;
      font-family: 'Caveat', 'LXGW WenKai TC', serif;
      color: var(--text);
      background: var(--bg);
    }
    .card[data-card-id="card-01"] .title { font-size: 84px; ... }
  </style>

  <div class="root">
    <h1 id="card-01-title"
        data-anim="kinetic-chars"
        data-anim-at="0.3"
        data-anim-duration="0.5"
        data-anim-stagger="0.04"
        data-anim-pattern="pop">
      <span class="char">字</span>
      <span class="char">幕</span>
    </h1>
    <div id="card-01-line"
         data-anim="grow-x"
         data-anim-at="0.65"
         data-anim-duration="0.5"
         data-anim-target-w="420"
         style="width:0;height:8px;background:var(--accent-0);border-radius:4px;"></div>
  </div>
</div>
```

**Hard rules** (`hyperframes` lint will reject violations):

- Single root `<div class="card" data-card-id="{cardId}">`
- Inline `<style>` rules MUST be prefixed with the scope selector above
- **No `<script>` tags**
- **No external URLs** in `src=` / `href=` (no CDN, no remote fonts)
- **No inline event handlers** (`onclick=` etc.)
- All assets via relative paths into the same `public/` directory
- Colors via `var(--accent-N)` etc. for portability across themes

> **These hard rules govern CARD fragments.** The composition `index.html` itself
> legitimately carries `<script>` (the GSAP block) — and MAY also drive a
> background `<canvas>` atmosphere layer (e.g. `nebula-glass`'s flow-field particle
> field) **under one strict condition: the canvas draw must be a closed-form
> function of the timeline time `draw(t)` and be driven by the master timeline's
> `onUpdate` (a proxy tween whose value === time), NOT by `requestAnimationFrame`
> or accumulated per-frame state.** No `Math.random()` / `Date.now()` inside
> `draw` (seed particle init once with a PRNG like mulberry32 instead). This keeps
> the canvas deterministic under HyperFrames' seek-based capture — verified: two
> snapshots at the same `t` are byte-identical. The full copy-paste recipe lives in
> `references/styles/nebula-glass.html`'s header. Cards stay script-free; only the
> composition shell hosts the canvas.

## Overflow safety — NON-NEGOTIABLE (the #1 cause of broken cards)

Text that overruns its card is the most common defect — a long headline
silently clips or pushes the layout off-canvas, and you won't see it until
render. **Build every card overflow-proof by construction**, not by eyeballing:

- The `.root` MUST set `overflow: hidden` and `box-sizing: border-box`.
- Every text block gets an explicit `line-height` (never rely on the default),
  a `max-width` (≤ its zone width, see the zone table), and
  `overflow-wrap: anywhere` so a long word can't shove past the edge.
- Size hero text with `clamp(min, Ncqi, max)` (container-query units) so it
  shrinks on narrow frames instead of overflowing — **not** a fixed `px`.
- Add `text-wrap: balance` to multi-line headlines for even line lengths.
- NEVER use `white-space: nowrap` on content text. If you must (a kicker/chip),
  cap it with `max-width` + `text-overflow: ellipsis`.
- If a card holds a lot of copy, that's a signal to **split it into two cards**,
  not to shrink the font until it fits.

```css
/* paste into every card's .root and text rules — adjust the clamp ceilings */
.card[data-card-id="card-01"] .root  { overflow: hidden; box-sizing: border-box; }
.card[data-card-id="card-01"] .title { font-size: clamp(48px, 8cqi, 120px);
  line-height: 1.15; max-width: 92%; overflow-wrap: anywhere; text-wrap: balance; }
.card[data-card-id="card-01"] .body  { font-size: clamp(20px, 3cqi, 40px);
  line-height: 1.5; max-width: 90%; overflow-wrap: anywhere; }
```

Per-zone `max-width` ceiling (portrait 1080-wide reference):

| zone | usable width | text `max-width` |
|---|---|---|
| `fullscreen` | full − margins | ~92% (≈ 940px) |
| `lower-third` | full − margins | ~94% (≈ 1000px) |
| `side-panel` (split) | half − gap | ~46cqi (≈ 480px) |

**Animations are declared, not coded.** Use `data-anim-*` attributes
only; never write `<script>` to animate. You compile every `data-anim-*`
declaration into the single master GSAP timeline in Step 9.

## Card Sizing — Mobile-First in Portrait

The 11 `references/styles/*.html` are sized for a **1920×1080 landscape**
preview. When `storyboard.layout = "portrait"` (1080×1920, the dominant
case for social / mobile), **scale every visual size up** — phones hold
the screen close, and the same pixel count reads smaller than on a
landscape TV-style canvas.

| token | landscape baseline | **portrait target** | scale |
|---|---|---|---|
| title (h1/h2 hero) | 64–96px | **88–132px** | ×1.35 |
| detail / body | 24–30px | **30–40px** | ×1.30 |
| kicker / chip label | 14–16px | **18–22px** | ×1.30 |
| timecode / meta | 12–14px | **16–18px** | ×1.30 |
| data block primary number | 48–60px | **64–88px** | ×1.40 |
| line-height multiplier | 1.05–1.5 | same | (don't scale) |

**Rule of thumb:** `portraitPx = round(landscapePx × 1.3)`, then floor
to a nearby 4px multiple for visual rhythm. Hero headlines may go up to
×1.4; small meta text stays at ×1.2 to avoid crowding.

Padding **shrinks slightly** in portrait — the card is narrower so big
landscape padding (40–64px) eats too much width. Use 24–36px horizontal
padding in portrait.

If you're producing a single card that must work in **both** layouts,
prefer a `@container` query on the card root over hard-coding sizes:

```css
.card[data-card-id="X"] .root { container-type: inline-size; }
.card[data-card-id="X"] .title { font-size: clamp(64px, 8.5cqi, 132px); }
.card[data-card-id="X"] .detail { font-size: clamp(24px, 3.2cqi, 40px); }
```

But for most cards, a single layout choice is fine — just pick the size
table column that matches the storyboard's `layout` field.

## Motion Philosophy — the default is *silky*, not slideshow

**Read this before authoring any animation. It overrides the old "fade in →
freeze → fade out" instinct.** The film should feel like one continuous
camera move with cards flowing through it, *not* a deck of slides that pop
on and off. Four defaults make this happen:

1. **Overlapping transitions, never a hard cut.** Adjacent cards overlap
   ~0.5–0.6s. The outgoing card slides up + blurs + fades while the incoming
   card sinks in from below — one continuous "slip", not card-A-gone-then-card-B.
   (This is why Step 9's timing rule now *wants* overlap, see below.)
2. **Nothing freezes after it lands.** Every card carries a slow ambient
   `drift` so the frame is always subtly alive. Amplitude is tiny (≤12px or
   ≤0.6°) and the period is long (8–14s) — you should *feel* it, not *watch* it.
3. **Continuous easing.** Default entrances to `expo.out` / `power3.out` (was
   `power2.out`); transitions and `#video-wrap` framing to `power3.inOut`.
   Damped, weighty motion reads as "silk"; linear/snappy reads as "PowerPoint".
4. **One persistent anchor.** `#video-wrap` (the talking-head) is the single
   element that never cuts across the whole film. When it reframes, its move
   shares the *same start time and same ease* as the card transition, so the
   camera and the card slide as one gesture.

**恰到好处 guardrails — restraint is the point (tasteful > busy):**
- **One primary transition gesture per cut.** Don't stack a slide + a spin + a
  zoom; pick the slip and let it breathe.
- **≤2 persistent motions on screen at once** (e.g. one `drift` + the aurora
  backdrop). More than that and the eye has nowhere to rest.
- **Ambient motion must never out-move the speaker.** The drift is wallpaper,
  not a performer — if it competes with the talking-head, halve it.
- **Key info holds still ≥1.5s.** Once a number, headline, or takeaway has
  landed, it stays readable and static long enough to actually read.

These are *defaults for every style*. The per-style recipes in
`references/styles/*.html` and `references/DESIGN_INDEX.md` (see its **Motion**
section) layer texture on top, but the slip-transition + ambient-drift +
shared-camera spine is universal.

## Available `data-anim` Kinds

| kind | use for | key params |
|---|---|---|
| `fade-in` | enter | `at`, `duration`, `ease?` |
| `fade-out` | exit | `at`, `duration`, `ease?` |
| `slide-in` | slide enter | `at`, `duration`, `from=left\|right\|top\|bottom`, `distance` |
| `kinetic-chars` | per-char pop | `at`, `duration`, `stagger`, `pattern=pop\|fade` — element needs `<span class="char">` children |
| `typewriter` | per-char fade | same as kinetic-chars but slower default stagger |
| `count-up` | animate number | `at`, `duration`, `from`, `to`, `format=.0f\|.1f\|.2f\|,d` |
| `draw-path` | SVG path reveal | `at`, `duration` — element should be a `<path>` |
| `grow-y` | bar height | `at`, `duration`, `target-h` (px) — element starts `height:0` |
| `grow-x` | bar width | `at`, `duration`, `target-w` (px) — element starts `width:0` |
| `scale-pop` | pop entrance | `at`, `duration` |
| `blur-in` | unfocused → focused | `at`, `duration` |
| `mask-reveal` | clip reveal | `at`, `duration`, `direction=left\|right\|top\|bottom` |
| `morph-to` | tween any CSS | `at`, `duration`, `props='{...JSON...}'` |
| `settle` | **default entrance** — damped landing, no overshoot | `at`, `duration`, `from=bottom\|left\|right\|top` (default bottom), `distance` (default 28) |
| `parallax-in` | entrance that keeps a slow drift after landing (depth feel) | `at`, `duration`, `from`, `distance`, `axis=x\|y`, `amp`, `period` |
| `drift` | **ambient — runs forever, no end** — keeps the frame alive | `axis=x\|y\|rotate`, `amp` (≤12px / ≤0.6°), `period` (8–14s) |

**Entrance default:** prefer `settle` over `slide-in`/`scale-pop` for body
content (`expo.out`, no bounce — reads as silk). Reserve `scale-pop`'s bounce
for a single deliberate accent, not every element.

**`drift` is not an entrance** — it has no `at`/`duration`; it's an ambient
yoyo loop (`yoyo:true, sine.inOut`) you attach to the card root (or a hero
element) so nothing freezes after landing. **Use a FINITE repeat** sized to the
composition — `repeat: Math.ceil(compDurationSec / legSec)` — never `repeat:-1`
(the deterministic capture engine forbids infinite repeats; see the Step-9
checklist rule). Max one or two per card (see 恰到好处 guardrails above).

`data-anim-at` is **seconds relative to the card's startSec** — when you
compile each declaration into the GSAP timeline in Step 9, add the
card's `startSec` to get the absolute time and quantize to 1/fps. Default
eases are now **`expo.out` (entrance), `power2.in` (exit), `power3.inOut`
(transition / `#video-wrap`)** — see the cheat sheet.

## card-cta: Brand Outro Card (dark default — RE-THEME to match the composition)

> Use this template **as-is only for dark/cinematic compositions.** For a
> light or otherwise-styled video, re-theme it per the "outro must follow
> the same visual language" note in Step 6: keep the structure + entrance
> choreography, swap the palette to the composition's `--bg` / `--ink` /
> `--accent-0`, and swap the mark / wordmark / tagline (or drop the brand
> entirely if the user asked). "Do not modify" below means *don't break the
> animation rig* — colors and copy are meant to be adapted.

Save this template as `$WORK_DIR/public/cards/card-cta.html`
. Design language: **"Editorial Cinema"** — viewfinder corner
marks, top/bottom film-credit meta strips, a dual rotating ring around a
neutral play-mark, a diamond-flanked divider, an italic tagline, a **recap /
payoff line** that opens the card, and a one-line **purpose / 延伸** statement
under the wordmark. The whole card is **flex-centered inside a safe area** and
spaced with `gap`+`clamp` (not fixed margins), so the content column never
collides with the pinned corners / meta strips in 9:16, 4:5 *or* 16:9 — and
every text block carries `max-width` + `overflow-wrap` guards. The entrance is
**calm and slow on purpose** (~2.7s, ~6 grouped beats — far fewer than a
content card) so the ending settles instead of competing for the eye: recap
(0.55s) → mark (1.05s) → wordmark (1.42s) → purpose (1.80s) → sign-off
(2.15s); ~0.4s hold (ring rotation only) + ~0.35s fade-out, total ~3.5s.
It ships **branded with the Interflow club sign-off** (`你只管讲，成片交给我们`
recap + `Interflow` wordmark + `让每个想法，都有更好的呈现` purpose +
`Interflow AI 出品` tagline + neutral play-mark). **Rewrite the `.recap` line
from what the video actually said** — that's the content beat. Keep as-is
otherwise for club work; to re-brand for an outside creator, swap the wordmark
/ tagline / mark (or delete the wordmark for a clean ending). Keep the
animation rig intact.

```html
<!-- public/cards/card-cta.html — Interflow club outro; re-brand only if used outside the club; keep the anim rig -->
<div class="card" data-card-id="card-cta">
  <style>
    .card[data-card-id="card-cta"] .root {
      width: 100%; height: 100%;
      box-sizing: border-box;
      background:
        radial-gradient(ellipse 62% 78% at 50% 44%, rgba(232,144,52,0.13) 0%, transparent 56%),
        radial-gradient(ellipse 120% 40% at 50% 100%, rgba(201,169,97,0.09) 0%, transparent 60%),
        #0D0B08;
      position: relative; overflow: hidden;
      container-type: inline-size;
      font-family: 'Inter', ui-sans-serif, sans-serif;
      color: #F5EFE1;
      /* Flex-center the stage inside a safe area so the content column never
         collides with the pinned corners / meta strips. Spacing below is
         gap+clamp (never fixed margins) — portrait, 4:5 AND landscape safe. */
      display: flex; align-items: center; justify-content: center;
      padding: clamp(70px, 14cqi, 160px) clamp(40px, 8cqi, 112px);
    }
    /* fractal noise overlay — kills the "plastic" look */
    .card[data-card-id="card-cta"] .root::after {
      content: '';
      position: absolute; inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      mix-blend-mode: overlay;
      opacity: 0.5;
      pointer-events: none;
    }
    /* viewfinder corner marks — ambient chrome (1.5px hairline) */
    .card[data-card-id="card-cta"] .corner {
      position: absolute;
      width: 3.4cqi; height: 3.4cqi;
      border-color: rgba(245,239,225,0.16);
      pointer-events: none;
      opacity: 0;
    }
    .card[data-card-id="card-cta"] .corner.tl { top: 3.4cqi; left: 3.4cqi; border-top: 1.5px solid; border-left: 1.5px solid; }
    .card[data-card-id="card-cta"] .corner.tr { top: 3.4cqi; right: 3.4cqi; border-top: 1.5px solid; border-right: 1.5px solid; }
    .card[data-card-id="card-cta"] .corner.bl { bottom: 3.4cqi; left: 3.4cqi; border-bottom: 1.5px solid; border-left: 1.5px solid; }
    .card[data-card-id="card-cta"] .corner.br { bottom: 3.4cqi; right: 3.4cqi; border-bottom: 1.5px solid; border-right: 1.5px solid; }
    /* top film-credit strip — ambient chrome */
    .card[data-card-id="card-cta"] .top-meta {
      position: absolute; top: 4.6cqi; left: 0; right: 0;
      display: flex; justify-content: center;
      gap: clamp(14px, 2cqi, 36px);
      font-size: clamp(9px, 0.85cqi, 16px);
      font-weight: 500;
      letter-spacing: 0.36em;
      text-transform: uppercase;
      color: rgba(245,239,225,0.16);
      opacity: 0;
    }
    .card[data-card-id="card-cta"] .top-meta .sep { color: #E89034; opacity: 0.7; }
    /* bottom film-credit strip — ambient chrome */
    .card[data-card-id="card-cta"] .bot-meta {
      position: absolute; bottom: 4.8cqi; left: 0; right: 0;
      display: flex; justify-content: space-between;
      padding: 0 7cqi;
      font-size: clamp(9px, 0.8cqi, 15px);
      font-weight: 500;
      letter-spacing: 0.32em;
      text-transform: uppercase;
      color: rgba(245,239,225,0.16);
      opacity: 0;
    }
    .card[data-card-id="card-cta"] .bot-meta .right { color: #E89034; opacity: 0.85; }
    /* center stage — flex column, gap-based spacing (no fragile margins) */
    .card[data-card-id="card-cta"] .stage {
      position: relative;
      display: flex; flex-direction: column; align-items: center;
      gap: clamp(15px, 1.9cqi, 32px);
      width: 100%; max-width: 90cqi;
      text-align: center;
      z-index: 2;
    }
    /* recap kicker — tiny label above the payoff line */
    .card[data-card-id="card-cta"] .recap-kicker {
      font-size: clamp(10px, 0.95cqi, 18px);
      font-weight: 600;
      letter-spacing: 0.46em;
      text-transform: uppercase;
      color: rgba(245,239,225,0.38);
      opacity: 0;
    }
    /* recap — the video's payoff, echoed. THE content beat (agent fills it). */
    .card[data-card-id="card-cta"] .recap {
      font-size: clamp(26px, 3.6cqi, 54px);
      font-weight: 700;
      line-height: 1.32;
      letter-spacing: 0.005em;
      text-wrap: balance;
      overflow-wrap: anywhere;
      color: #F5EFE1;
      max-width: 88cqi;
      opacity: 0;
    }
    .card[data-card-id="card-cta"] .recap .hl { color: #E89034; }
    /* play-mark wrapper + dual rings — whole group reveals together (calm + reliable) */
    .card[data-card-id="card-cta"] .mark-wrap {
      position: relative;
      width: clamp(104px, 11.5cqi, 176px);
      height: clamp(104px, 11.5cqi, 176px);
      display: flex; align-items: center; justify-content: center;
      margin-top: clamp(4px, 0.8cqi, 14px);
      opacity: 0;
    }
    .card[data-card-id="card-cta"] .mark-ring {
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 1.5px dashed rgba(232,144,52,0.22);
      animation: ctaRingSpin 36s linear infinite;
    }
    .card[data-card-id="card-cta"] .mark-ring.inner {
      inset: 9%;
      border: 1px solid rgba(245,239,225,0.10);
      animation: ctaRingSpin 36s linear infinite reverse;
    }
    .card[data-card-id="card-cta"] .cta-mark {
      width: 56%; height: auto;
      color: #F5EFE1;
      position: relative; z-index: 1;
      overflow: visible;
    }
    /* brand wordmark */
    .card[data-card-id="card-cta"] .brand-name {
      font-size: clamp(46px, 5.6cqi, 104px);
      font-weight: 900;
      letter-spacing: -0.05em;
      line-height: 1;
      overflow: hidden;
      clip-path: inset(0 100% 0 0);
      margin-top: clamp(4px, 0.8cqi, 14px);
    }
    .card[data-card-id="card-cta"] .name-accent { color: #E89034; }
    /* purpose / 延伸 line — brand one-liner (drop if .recap already says it) */
    .card[data-card-id="card-cta"] .purpose {
      font-size: clamp(20px, 2.5cqi, 34px);
      font-weight: 600;
      letter-spacing: 0.02em;
      line-height: 1.45;
      color: rgba(245,239,225,0.84);
      max-width: 80cqi;
      text-wrap: balance;
      opacity: 0;
    }
    .card[data-card-id="card-cta"] .purpose .hl { color: #E89034; }
    /* decorative divider: ── ◆ ── */
    .card[data-card-id="card-cta"] .divider {
      display: flex; align-items: center;
      gap: clamp(6px, 0.7cqi, 14px);
    }
    .card[data-card-id="card-cta"] .divider .seg {
      width: 0; height: 1px;
      background: rgba(232,144,52,0.5);
    }
    .card[data-card-id="card-cta"] .divider .diamond {
      width: clamp(4px, 0.45cqi, 8px);
      height: clamp(4px, 0.45cqi, 8px);
      background: #E89034;
      transform: rotate(45deg) scale(0);
    }
    /* tagline below divider */
    .card[data-card-id="card-cta"] .tagline {
      font-size: clamp(10px, 0.9cqi, 17px);
      font-weight: 500;
      letter-spacing: 0.56em;
      text-transform: uppercase;
      color: rgba(245,239,225,0.40);
      padding-left: 0.5em;
      opacity: 0;
    }
    @keyframes ctaRingSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  </style>
  <div class="root">
    <!-- Ambient chrome — corners + meta strips fade in together as one quiet group -->
    <span class="corner tl" id="cta-corner-tl"></span>
    <span class="corner tr" id="cta-corner-tr"></span>
    <span class="corner bl" id="cta-corner-bl"></span>
    <span class="corner br" id="cta-corner-br"></span>
    <div class="top-meta" id="cta-top-meta">
      <span>INTERFLOW</span>
      <span class="sep">&diams;</span>
      <span>AI CLUB</span>
      <span class="sep">&diams;</span>
      <span>Est. 2026</span>
    </div>
    <div class="bot-meta" id="cta-bot-meta">
      <span>&copy; 2026 Interflow</span>
      <span class="right">Interflow AI</span>
    </div>

    <div class="stage">
      <!-- Recap kicker + payoff: the video's last word, echoed. THE content beat —
           rewrite .recap from what the video actually said. -->
      <div class="recap-kicker" id="cta-recap-kicker">写在最后</div>
      <div class="recap" id="cta-recap">你只管讲，<span class="hl">成片交给我们</span></div>

      <!-- Neutral play-mark inside dual rings — reveals as one group; swap for your own logo SVG -->
      <div class="mark-wrap" id="cta-mark-wrap">
        <span class="mark-ring"></span>
        <span class="mark-ring inner"></span>
        <svg class="cta-mark" viewBox="0 0 200 130" fill="none"
             aria-label="brand mark" role="img">
          <g stroke="currentColor" stroke-width="13"
             stroke-linecap="round" stroke-linejoin="round">
            <!-- play triangle (▶) — replace with your own mark -->
            <path d="M80 34 L80 96"/>
            <path d="M80 34 L134 65"/>
            <path d="M80 96 L134 65"/>
          </g>
          <circle cx="108" cy="116" r="6.5" fill="#E89034"/>
        </svg>
      </div>

      <!-- Brand wordmark reveals left → right (Interflow club sign-off) -->
      <div id="cta-brand-name" class="brand-name">
        <span class="name-accent">Inter</span>flow
      </div>

      <!-- Purpose / 延伸 line — brand one-liner (swap the wording; drop if recap covers it) -->
      <div class="purpose" id="cta-purpose">让每个想法，都有<span class="hl">更好的呈现</span></div>

      <!-- Decorative divider: ── ◆ ── -->
      <div class="divider">
        <span class="seg" id="cta-seg-l"></span>
        <span class="diamond" id="cta-diamond"></span>
        <span class="seg" id="cta-seg-r"></span>
      </div>

      <!-- Tagline — Interflow club sign-off -->
      <div class="tagline" id="cta-tagline">Interflow AI 出品</div>
    </div>
  </div>
</div>
```

**Animation timeline (~2.7s calm entrance, ~6 grouped beats; all times are
relative to `card-cta.startSec`):**

| At | Element | Animation | Dur |
|---|---|---|---|
| 0.00 | source video | fade-out | 0.40 |
| 0.00 | card host | fade-in | 0.40 |
| 0.20 | chrome group (corners ×4 + both meta strips) | fade-in together | 0.60 |
| 0.38 | recap kicker | fade + rise | 0.45 |
| 0.50 | recap / payoff line | fade + rise | 0.65 |
| 1.05 | mark group (rings + ▶) | scale-pop together | 0.55 |
| 1.42 | "Interflow" wordmark | mask-reveal | 0.55 |
| 1.80 | purpose / 延伸 line | fade + rise | 0.55 |
| 2.15 | divider segments | grow-x (→56px) | 0.35 |
| 2.25 | divider diamond | scale-pop | 0.35 |
| 2.30 | tagline | fade + rise | 0.45 |
| ~2.75 → CTA_END-0.35 | ambient hold | ring spin only | — |
| CTA_END-0.35 | card host | fade-out | 0.35 |
