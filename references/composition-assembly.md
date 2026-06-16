# Composition Assembly — Step 9 reference

Reference-grade detail for **Step 9 (Assemble the Composition HTML)**, moved out
of `SKILL.md` to keep the workflow skeleton light. The Step 9 procedure (stage
assets → copy `composition-shell.html` → fill the 6 tokens → run
`build-timeline.py`) lives in `SKILL.md`. This file holds what you consult while
filling the shell: the GSAP statement cheat sheet, timing validation, the video
framing reference, the HyperFrames QA rules, the hard-won gotchas, and the
fixed card-cta GSAP block.

## GSAP Statement Cheat Sheet

Compile each `data-anim` attribute into a GSAP statement. Times are
**absolute seconds** = card.startSec + data-anim-at, quantized to 1/fps.
Selector is `.card[data-card-id="X"] #elementId`.

| data-anim | GSAP statement template |
|---|---|
| `fade-in` | `tl.fromTo(SEL, { opacity: 0 }, { opacity: 1, duration: D, ease: 'expo.out' }, T);` |
| `fade-out` | `tl.to(SEL, { opacity: 0, duration: D, ease: 'power2.in' }, T);` |
| `settle` (from=bottom, dist=28) **← default entrance** | `tl.fromTo(SEL, { opacity: 0, y: 28, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: D, ease: 'expo.out' }, T);` |
| `slide-in` (from=left, dist=80) | `tl.fromTo(SEL, { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: D, ease: 'expo.out' }, T);` |
| `parallax-in` (from=bottom dist=40, axis=y amp=8 period=11) | `tl.fromTo(SEL, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: D, ease: 'expo.out' }, T); tl.to(SEL, { y: '+=8', duration: 11, ease: 'sine.inOut', repeat: Math.ceil(compDurationSec/11), yoyo: true }, T + D);` |
| `drift` (axis=y amp=10 period=11) **← ambient, no at/duration; FINITE repeat** | `tl.to(SEL, { y: '+=10', duration: 11, ease: 'sine.inOut', repeat: Math.ceil(compDurationSec/11), yoyo: true }, T_cardStart); // axis=x → x; axis=rotate → rotation:'+=0.6'. NEVER repeat:-1` |
| `kinetic-chars` (pop) | `tl.from(SEL + ' .char', { opacity: 0, y: 8, scale: 0.9, duration: D, ease: 'expo.out', stagger: S }, T);` |
| `count-up` | `(function(){const o={v:FROM};tl.to(o,{v:TO,duration:D,ease:'power2.out',onUpdate:function(){const el=document.querySelector(SEL);if(el)el.textContent=__fmt(o.v,'FMT');}},T);})();` |
| `draw-path` | `(function(){const el=document.querySelector(SEL);if(!el)return;const L=el.getTotalLength();tl.set(SEL,{strokeDasharray:L,strokeDashoffset:L},T);tl.to(SEL,{strokeDashoffset:0,duration:D,ease:'power2.inOut'},T);})();` |
| `grow-x` (target-w=W) | `tl.fromTo(SEL, { width: 0 }, { width: W, duration: D, ease: 'expo.out' }, T);` |
| `grow-y` (target-h=H) | `tl.fromTo(SEL, { height: 0 }, { height: H, duration: D, ease: 'expo.out' }, T);` |
| `scale-pop` (accent only) | `tl.fromTo(SEL, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: D, ease: 'back.out(1.6)' }, T);` |
| `mask-reveal` (direction=left) | `tl.fromTo(SEL, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)', duration: D, ease: 'power3.inOut' }, T);` |

`drift`/`parallax-in` loops start at the card's startSec (drift) or right
after the entrance lands (parallax-in) and **deliberately have no end** — they
run through the card's whole life including its exit slip. Keep `amp` tiny so
the loop never fights the speaker.

Quantize: `T = Math.round(absSec * fps) / fps`. At 30fps the smallest
step is `1/30 ≈ 0.0333s`; rounding to 4 decimals (`.toFixed(4)`) is fine
inside the JS literal.

## Validate card timing BEFORE compiling (overlap is now intentional)

The silky default makes adjacent cards **deliberately overlap** by a slip
window (`SLIP ≈ 0.55s`): card B slips in while card A slips out. This is the
opposite of the old "leave a gap" rule. The incoming card MUST sit on a higher
`data-track-index` so it covers the outgoing one during the slip. After you
quantize, walk the `cards` array in time order and assert all three, fixing the
storyboard (not clamping at compile time) if any fails:

- **Each card enters at the overlap point:** the timeline enter time for
  `card[i]` is `card[i-1].endSec − SLIP` (it starts before the previous card is
  fully gone). `data-track-index` strictly increases with card order so z-order
  is unambiguous during the slip.
- **Slip window in range:** keep `SLIP` within **0.45–0.7s**. Below 0.45 it
  reads as a cut; above 0.7 the two cards smear together — pick ~0.55.
- **Minimum on-screen time:** `card[i].endSec − card[i].startSec ≥ 0.6s` (and
  realistically ≥ ~1.5s so its key info can be read — see guardrails). Any
  shorter reads as a flash, not a card. Merge it into a neighbor instead.

When the source video keeps playing behind the cards (overlay/pip), the rising
`data-track-index` is what keeps the overlapping slips layered correctly
instead of flickering — don't add a gap to "fix" overlap; the overlap is the
effect.

## Video Framing Reference (per `layout` value)

The selector for the video container is `#video-wrap`. Animate its
bounds between cards using `tl.to('#video-wrap', { ...bounds }, T)`.
Initial bounds should be set inline on the element to match card-01's
layout. Pick a transition duration of 0.5–0.7s with `ease: 'power2.inOut'`.

**Decorative frames** (`clean` / `hairline` / `polaroid`) sit as a
**sibling** of `#video-wrap` and follow it through layout transitions.
See
[`references/frames/`](frames/) for each frame's placement
HTML, suggested CSS, and which layouts it pairs with. Quick rule:
`overlay` layout suppresses decorative frames (the full-bleed video
clashes with chrome); PiP layouts already have their own pill treatment
(border-radius + white ring + shadow), so add a decorative frame only on
top of `split` / `stack`.

**GSAP target lookup table** for `#video-wrap` per composition layout
(landscape 1920×1080 — for portrait & 4:5 see `references/layouts/*.html`
which list all three ratios):

| composition layout | typical card.zone | `#video-wrap` GSAP target | extra css class |
|---|---|---|---|
| `split` | `side-panel` | `{ left: 960, top: 0, width: 960, height: 1080 }` | — |
| `stack` | `lower-third` | `{ left: 14, top: 14, width: 1892, height: 548 }` (top 52%) | — |
| `pip` (bottom-right) | `fullscreen` | `{ left: 1480, top: 760, width: 400, height: 300 }` | `pip-pill` (border-radius + ring + shadow) |
| `pip` (top-left) | `fullscreen` | `{ left: 40, top: 40, width: 400, height: 300 }` | `pip-pill` |
| `overlay` (video full-bleed) | `video-overlay` | `{ left: 0, top: 0, width: 1920, height: 1080 }` (no change from default) | — |
| `deck` (3D card carousel) | `fullscreen` | showcase: `{ opacity: 0 }` · witness pip: `{ left: 1528, top: 40, width: 336, height: 189 }` | `pip-pill` only in witness mode |
| **hide video** (pure-graphic moment) | `fullscreen` | `{ opacity: 0 }` (or move off-canvas) | — |

To toggle the pip-pill chrome (border-radius + white ring + drop shadow)
when entering or leaving a pip moment:

```js
// Enter pip — add chrome
tl.set('#video-wrap', { className: 'video-wrapper pip-pill' }, T);
tl.to('#video-wrap', { left: 1480, top: 760, width: 400, height: 300,
                       duration: 0.6, ease: 'power2.inOut' }, T);

// Leave pip — back to clean full-bleed
tl.set('#video-wrap', { className: 'video-wrapper' }, T_NEXT);
tl.to('#video-wrap', { left: 0, top: 0, width: 1920, height: 1080,
                       duration: 0.6, ease: 'power2.inOut' }, T_NEXT);
```

**Card-host bounds match the zone**. Resolve the card's `zone` into
pixel bounds using the table at the top of Step 6, then write those
into the card-host's inline `style="left:Xpx;top:Ypx;width:Wpx;
height:Hpx;..."`. For `video-overlay` zone (overlay recipe), the
card-host fills the full canvas — your CSS inside `.card .root`
decides where the actual visible card sits.

## HyperFrames Layout / Animation QA Rules

- Build each card's static hero frame first: the moment where the card is fully visible and readable.
- Confirm video, cards, subtitles/captions, and diagrams do not unintentionally overlap.
- Confirm hidden video areas are clipped by the frame and not visible outside intended bounds.
- Register one paused master timeline as `window.__timelines["interflow"]`.
- Build timelines synchronously at page load; no `async`, `setTimeout`, Promises, or media `play()` calls.
- Do not use `Math.random()` or `Date.now()` in render paths.
- Do not use `repeat: -1`; calculate finite repeats from the video duration.
- Prefer GSAP transforms and opacity (`x`, `y`, `scale`, `rotation`, `opacity`) over layout properties (`top`, `left`, `width`, `height`) for motion.
- Animate wrappers such as `#video-wrap`, not the video element dimensions directly.
- Avoid animating the same property on the same element from multiple timelines at the same time.
- Use `data-track-index`, not `data-layer`; use `data-duration`, not `data-end`.
- Every timed element (`card-host`, sub-composition, etc.) MUST include `class="clip"` alongside its own classes — e.g. `class="card-host clip"`. The HyperFrames runtime uses `.clip` to gate visibility to the `data-start … data-start+data-duration` window. Without it the element is visible for the whole video (lint: `timed_element_missing_clip_class`).
- For body / global `font-family`, list **concrete font names** (`'Inter', 'Caveat', …`) — not a CSS variable like `var(--font-family)`. The HyperFrames font resolver doesn't expand CSS vars during static analysis (lint: `font_family_without_font_face`). Cards may still use `var(--font-family)` internally since their `@font-face` declarations are loaded.

## Hard-won gotchas (read before assembling — these cost real debugging time)

- **Paint order = DOM order for non-timed elements.** `data-track-index` is not the whole story: a non-timed wrapper like `#video-wrap` stacks by its position in the DOM. If you want the source video as the **background**, write it **first** in `#stage`; if you want it as a **PiP that floats on top of fullscreen cards**, write `#video-wrap` **after** all the card-hosts. Symptom of getting this wrong: fullscreen cards "disappear" (the video paints over them) or the PiP hides behind a card.
- **Never nest a timed `<video data-start>` inside a wrapper that also has `data-start`.** Lint `video_nested_in_timed_element` → the video FREEZES in the render. Pattern: the wrapper is a plain positioned container (no timing), and the inner `<video>` carries `data-start` / `data-duration` / a unique `id`. Control the wrapper's visibility with GSAP instead.
- **Source video has no audio by default.** The base `<video>` template ships `muted`. To keep the narration/口播 in the output, remove `muted` and add `data-has-audio="true"` + `data-volume="1"` on that `<video>`. B-roll / silent inserts stay `muted` with `data-volume="0"`.
- **Phone-shot A-roll is usually rotated portrait.** Many `.MOV` files report `1920×1080` from `ffprobe -show_entries stream=width,height` but carry `rotation=-90` (check `ffprobe ... stream_side_data=rotation`) and actually DISPLAY as `1080×1920` portrait. A landscape PiP box + `object-fit: cover` then crops the portrait to a center band (just the face). Fix: bake the rotation (`ffmpeg -i in -vf "format=yuv420p" out` auto-rotates and strips the flag) and size the PiP box to the TRUE (portrait) aspect so the full subject shows.
- **Cutting clips: use `trim`/`atrim` + `concat`, not the `select` filter.** `select='not(between(t,…)+…)'` silently keeps everything in practice; a `trim`/`atrim`+`concat` filtergraph reliably removes ranges.
- **Re-encode slowed/`setpts` B-roll with dense keyframes** (`-g 30 -keyint_min 30`) or the renderer's seek lands on a stale keyframe and the clip freezes (lint warns about sparse keyframes).
- **Talking-head A-roll: don't speed up or cut the source while the face is on screen** — lip-sync breaks. Keep original speed + audio for any segment where the speaker is visible (PiP or full); do pacing fixes in scripting/recording, not post.
- **A PiP that must stay visible INTO the 2s outro needs a frozen tail.** Once the source `<video>` passes its `data-duration`, the element renders **transparent/blank** (not a held last frame) — so the PiP becomes an empty pill that lets the outro + corner marks show through (looks like a layout bug). If the speaker should remain on screen through the outro (e.g. "始终露脸" personas), freeze-extend the source first: `ffmpeg -i in -vf "tpad=stop_mode=clone:stop_duration=2.2" -af "apad=pad_dur=2.2" out`, then set the video's `data-duration` past the outro end so the PiP holds a real (frozen) face frame. Also drop the outro corner mark that sits under the PiP so they don't clash.

## card-cta: Fixed GSAP Animation Block

At the end of the GSAP timeline block (just before the final `window.__timelines`
registration), append this fixed code block. Replace `CTA_START` with
`card-cta.startSec` and `CTA_END` with `card-cta.endSec`:

```js
// ── card-cta: Editorial Cinema brand outro (~3.5s total) ──
// Calm by design: ~6 grouped beats over ~2.7s (recap → mark → wordmark →
// purpose → sign-off) · ~0.4s hold (CSS ring spin only) · 0.35s fade-out.
// Far fewer tweens than a content card so the ending settles ("安顿").

const PREFIX = '.card[data-card-id="card-cta"]';

// Fade source video out, bring the card host in (slow, calm)
tl.to('#video-wrap', { opacity: 0, duration: 0.40, ease: 'power2.in' }, CTA_START);
tl.set('.card-host[data-card-id="card-cta"]', { visibility: 'visible' }, CTA_START);
tl.fromTo('.card-host[data-card-id="card-cta"]',
          { opacity: 0 }, { opacity: 1, duration: 0.40, ease: 'power2.out' }, CTA_START);

// Beat 1 — ambient chrome: all 4 corners + both meta strips fade in as ONE group
tl.fromTo([PREFIX + ' #cta-corner-tl', PREFIX + ' #cta-corner-tr',
           PREFIX + ' #cta-corner-bl', PREFIX + ' #cta-corner-br',
           PREFIX + ' #cta-top-meta',  PREFIX + ' #cta-bot-meta'],
          { opacity: 0 }, { opacity: 1, duration: 0.60, ease: 'power2.out' }, CTA_START + 0.20);

// Beat 2 — recap kicker + payoff line (the content beat)
tl.fromTo(PREFIX + ' #cta-recap-kicker',
          { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, CTA_START + 0.38);
tl.fromTo(PREFIX + ' #cta-recap',
          { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out' }, CTA_START + 0.50);

// Beat 3 — mark group (rings + ▶) reveals as ONE gentle pop (no edge-by-edge draw)
tl.fromTo(PREFIX + ' #cta-mark-wrap',
          { opacity: 0, scale: 0.82 },
          { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(1.4)' }, CTA_START + 1.05);

// Beat 4 — "Interflow" wordmark mask-reveal (left → right)
tl.fromTo(PREFIX + ' #cta-brand-name',
          { clipPath: 'inset(0 100% 0 0)' },
          { clipPath: 'inset(0 0% 0 0)', duration: 0.55, ease: 'power2.inOut' }, CTA_START + 1.42);

// Beat 5 — purpose / 延伸 line
tl.fromTo(PREFIX + ' #cta-purpose',
          { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, CTA_START + 1.80);

// Beat 6 — sign-off: divider segments + diamond + tagline together
tl.fromTo([PREFIX + ' #cta-seg-l', PREFIX + ' #cta-seg-r'],
          { width: 0 }, { width: 56, duration: 0.35, ease: 'power2.out' }, CTA_START + 2.15);
tl.fromTo(PREFIX + ' #cta-diamond',
          { rotate: 45, scale: 0 }, { rotate: 45, scale: 1, duration: 0.35, ease: 'back.out(1.6)' }, CTA_START + 2.25);
tl.fromTo(PREFIX + ' #cta-tagline',
          { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, CTA_START + 2.30);

// Card exit — fade-out in the last 0.35s of the window
tl.to('.card-host[data-card-id="card-cta"]',
      { opacity: 0, duration: 0.35, ease: 'power2.in' }, CTA_END - 0.35);
tl.set('.card-host[data-card-id="card-cta"]', { visibility: 'hidden' }, CTA_END);
```
