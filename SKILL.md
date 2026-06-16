---
name: interflow-video-cut
description: Turn a local talking-head / 口播 video into metadata, transcript, and an AI-composed card-based video where the agent composes cards by cloning styled templates and filling them (designing bespoke only when content needs it), then renders to MP4. Ships with the Interflow AI club sign-off ("Interflow AI 出品"). Use when the user asks for interflow-video-cut, 口播成片, talking-head repurposing, video takeaways, transcript cleanup, or turning a spoken video into a captioned card video.
---

# Interflow Video Cut — 口播成片 Workflow

Interflow Video Cut converts a local video into a card-based composition: the
agent designs the cards (timing + content), assembles one composition HTML, and
renders it to MP4 via `hyperframes`.

**Default authoring mode: clone-and-fill, not free-design.** Per card, start from
a shipped fragment (`references/styles/<key>.html`) and **swap only text +
accent** — the fast path that holds every card at the curated quality floor.
Hand-authoring from scratch is the **exception**, only when content fits no reference.

## CLI Resolution

`vtake` CLI (`npx -y @notedit/vtake@latest`) handles extract/transcribe;
`hyperframes` (`npx -y hyperframes@latest`) renders. Both auto-download from npm.
`SKILL_DIR` = this skill's dir (host injects it as "Base directory for this
skill: …"); all `references/…` + `scripts/…` paths are relative to it.

## Reference Map — read the right file at the right step

The workflow skeleton is below; the heavy detail lives in `references/`. Clone
from the library, don't reinvent.

| file | what's inside | read at |
|---|---|---|
| `references/DESIGN_INDEX.md` | full style × layout × frame matrix + a decision guide + the 中文风格词库 (中文名 ↔ key) | Step 6 / 7 |
| `references/render-strategy.md` | **Step 7 in full** — the 5-question call (Channel A `AskUserQuestion` + Channel B plain-text), precompute rules, day/night auto-match, canvas/frame/bounds resolution tables, theme palettes, 留白, camera rhythm (运镜), layout compositions, storyboard render contract | Step 7 |
| `references/card-contract.md` | **Step 8 in full** — clone-first steps, the card HTML contract + hard rules, NON-NEGOTIABLE overflow safety, portrait sizing, motion philosophy, the `data-anim` kinds table, and the `card-cta` brand-outro template | Step 8 |
| `references/composition-assembly.md` | **Step 9 reference detail** — GSAP statement cheat sheet, timing validation, video framing reference, HyperFrames QA rules, hard-won gotchas, the fixed card-cta GSAP block | Step 9 |
| `references/composition-shell.html` | the STATIC composition scaffold you `cp` and fill (do NOT retype it) | Step 9 |
| `references/editorial-print-montage.md` | the multi-asset montage kit for the `editorial-print` style (5 layout primitives, 3 transitions, asset staging, woven vs standalone modes) | when style = editorial-print |
| `references/styles/*.html` | self-contained style fragments — **clone these**; includes the 炸裂族 (neon-grid-hud / liquid-aurora / holo-iridescent + playground-gallery DNA) | Step 7 / 8 |
| `references/layouts/*.html` | layout skeletons (videoBounds + cardBounds, landscape/portrait); neon-grid-hud carries its own window-scene | Step 7 / 9 |
| `references/frames/*.html` | 3 frame chrome fragments (clean / hairline / polaroid) | Step 9 |

## Workflow

### 1. Check Environment

```bash
npx -y @notedit/vtake@latest doctor
# confirm bundled assets:
ls "<SKILL_DIR>/assets/fonts" "<SKILL_DIR>/assets/vendor/gsap.min.js"
```

Required:

- `ffmpeg` / `ffprobe` (system)
- `python3` (stdlib only) — for `scripts/auto-style.py`, the auto style-match by video color in Step 7.0
- `<SKILL_DIR>/assets/fonts/*.woff2`, `<SKILL_DIR>/assets/vendor/gsap.min.js` (bundled inside this skill, staged to work dir in Step 9)

Optional:

- `ELEVEN_API_KEY` — set → `vtake transcribe` hits ElevenLabs directly (no rate
  limit). Unset → proxy `https://vtake.app/api/transcribe` (**3 req/min/IP**;
  override via `VTAKE_TRANSCRIBE_ENDPOINT`).

Strongly recommended on macOS for `hyperframes render`:

```bash
export PRODUCER_BROWSER_GPU_MODE=hardware
```

### 2. Create a Work Directory

```bash
VIDEO_PATH="/absolute/path/input.mp4"
WORK_DIR=".interflow-video-work/$(basename "$VIDEO_PATH" | sed 's/\.[^.]*$//')"
mkdir -p "$WORK_DIR"
```

### 3. Extract Audio and Metadata

```bash
npx -y @notedit/vtake@latest extract "$VIDEO_PATH" --out-dir "$WORK_DIR"
```

Outputs: `metadata.json` (duration, width, height, fps) + `audio.mp3`.

### 4. Transcribe

```bash
npx -y @notedit/vtake@latest transcribe "$WORK_DIR/audio.mp3" --out-dir "$WORK_DIR" --asr elevenlabs
```

Output: `transcript.json` with `{ segments, words, raw }`.

**Transcription is ElevenLabs-only — never a local model.** The `vtake transcribe`
CLI only supports `--asr elevenlabs`; there is no local/whisper path to fall into.
With no `ELEVEN_API_KEY` set it runs in proxy mode (zero model download, no key
needed, runs out of the box) and only hits the rate limit below.

**Rate limiting (proxy mode only — no `ELEVEN_API_KEY`):** the server allows
3 requests per minute per IP. If you see an error starting with
`rate_limited:` or `service_busy:`, do **not** auto-retry — stop and tell
the user how many seconds to wait (the message includes the retry hint),
then resume from this step when they ask again.

### 5. Correct Transcript

Read `transcript.json` and fix obvious ASR errors:

- Homophones, product names, technical terms, punctuation
- Preserve all `start` / `end` timestamps
- Prefer editing `segments[].text` only
- Edit individual `words[].word` only for clear one-to-one replacements

### 6. Draft a Lightweight Storyboard (in chat)

**No CLI involved.** Read `transcript.json` + `metadata.json` and design
cards directly. `storyboard.json` is an agent-internal planning artifact
— no vtake CLI command consumes it; it exists so you can think clearly
about timing and content before writing each card's HTML. Keep the
shape consistent with the example below so the same outline can drive
the composition you author in Step 9:

```json
{
  "schemaVersion": 3,
  "composition": {
    "fps": 30,
    "width": 1080,
    "height": 1920,
    "durationSeconds": 121.2,
    "layout": "portrait",
    "themeId": "noir",
    "seed": 42
  },
  "videoTrack": {
    "sourcePath": "input-video.mp4",
    "startSec": 0,
    "endSec": 121.2,
    "bounds": { "x": 0, "y": 0, "width": 1080, "height": 1920 }
  },
  "subtitles": { "enabled": false },
  "cards": [
    {
      "id": "card-01",
      "intent": "Hook with the speaker's anxious midnight question",
      "startSec": 0.5,
      "endSec": 13.0,
      "accentIndex": 0,
      "zone": "fullscreen",
      "contentHints": {
        "kicker": "AN HONEST QUESTION",
        "title": "晚上 11 点的灵魂提问",
        "detail": "客户六十秒语音：「人民币会升值，我的美金保单是不是亏惨了？」"
      }
    }
  ]
}
```

**Required Card fields:**

| field | type | purpose |
|---|---|---|
| `id` | string | stable id used in card HTML & GSAP selectors |
| `intent` | string | natural-language description; fed to card synthesis |
| `startSec` / `endSec` | number | times in seconds (endSec > startSec) |
| `accentIndex` | 0 \| 1 \| 2 \| 3 \| 4 | which of the 5 theme accent colors this card pulls |
| `zone` | enum (see below) | where on the canvas the card lives |
| `contentHints` | object | free-form bag; agent puts kicker/title/detail/data/quote here |
| `archetype` (optional) | string | free-form label you may attach to remember a card's pattern; absent = free-form, which is the default |
| `transition` (optional) | enum: `cut` \| `fade` \| `slide` \| `wipe` | declarative card-to-card transition |

**Five `zone` values** (resolve to card-host pixel bounds in Step 9; full bounds
table in `references/composition-assembly.md`): `fullscreen` (whole canvas —
hero / big numbers) · `whiteboard-area` (40px inset or portrait bottom-45% —
dense data) · `lower-third` (bottom 30% — annotate over video) · `side-panel`
(landscape right-42% / portrait bottom-40% — data beside video) · `video-overlay`
(full canvas, mostly-transparent card — overlay on full-bleed video). Video
bounds are set **once** (`videoTrack.bounds`); "moving" video between cards =
GSAP tweens on `#video-wrap` (Step 9).

**No prescribed roles or arc** — cards emerge from what the video says (all
quotes, all data, open on a number or a story; let the transcript drive).

**Card boundaries — one intent per card** ("let the transcript drive" ≠ "cut
anywhere"). A boundary belongs where the speaker *pivots to a new idea*; a card
spans the stretch between two boundaries. Signals: **topic shift** ("…now here's
what works" = new card) · **argument unit** (a setup→proof→payoff >~20s = 2–3
cards, one per move) · **distinct claim/number/comparison** (each its own card,
no 4-facts data-dump) · **emphasis/repetition** (repeated phrase / "the key
point" = its own beat) · **shot change** (face→screen-share→prop). The math
below sets *how many*; these set *where*. Disagree → trust the intents; never
split one idea or fuse two to hit a number.

**How many takeaways? — auto-infer from duration + density.** No fixed
upper limit. Floor is fixed: **minimum 5 cards**.

**Step 1 — base pace by duration** (natural sec/card for medium density):

| video duration | base pace (sec per card) |
|---|---|
| < 60s (short reel) | **6–8s** |
| 60s – 3 min | **8–12s** |
| 3 – 10 min | **12–20s** |
| 10 – 30 min | **20–35s** |
| > 30 min | **30–60s** |

**Step 2 — density multiplier:** High density (many numbers / distinct claims / staccato) **× 0.7** · Medium (mixed data + narrative) **× 1.0** · Low (slow narrative, one idea over many sentences) **× 1.4**.

**Step 3 — compute:**

```
cardCount = max(5, round(videoSec / (basePace × densityMultiplier)))
```

Always sanity-check against content: the math gives a starting count, but the
actual intents decide the final count.

**Speaker presence — keep the talking head on screen** (unless the user wants a
faceless explainer): cards annotate, they don't replace. Default = full-bleed/
large-PIP speaker on opening + closing cards, ≥ small PIP/side-panel where the
speaker makes a personal point; data-heavy cards can go full-card briefly.

**Distill, don't transcribe — a card is information design.** The #1 failure is
pasting a spoken sentence onto a card; a headline is a *rewrite* (same meaning,
⅓ the words, point surfaced). Gate every card: (1) **one intent, one sentence**
— can't → split; (2) **headline ≠ quote** — ~14-char title, demote the
explanation to a small detail line; (3) **no two cards make the same point** —
merge/reframe overlaps; (4) **shape follows content** — comparison→two-column,
number→big figure+label, list→stacked rows, quote→large centered. Reject &
rewrite if: `title` > ~14 中文字, `detail` is a verbatim clause, or the card is
"the next sentence" not "the next idea".

**Final card — append a customizable brand outro (`card-cta`).** After all
content cards, append one `fullscreen` outro card (`contentHints`: `recap` +
`purpose`) and extend `composition.durationSeconds` by ~3.5s to match its
`endSec`. Lead with a **recap / payoff line rewritten from what the video said**
(the earned content beat, not a logo flash) + a one-line **purpose / 延伸** under
the wordmark. **Re-theme it to the composition's style** (reuse `--bg`/`--ink`/
`--accent-0`, swap mark/wordmark/tagline; keep the entrance choreography) — a
clashing fixed outro is a defect. Ships the Interflow club sign-off (`Interflow`
+ `Interflow AI 出品`); for an outside creator swap/drop the brand, no hard-sell
CTA, **strip AI-jargon** (赋能/闭环/leverage…). Full template + JSON + entrance
choreography: `references/card-contract.md`.

### 7. Decide Render Strategy

This is where you pick the **visual system** — output ratio, layout, style,
card density, and camera rhythm — then resolve canvas size, frame, and bounds
from the answers. **Confirm the visual direction with the user FIRST.**

Precompute before asking: `recommendedRatio` (from source aspect), `autoCount`
(Step 6 math), and `recommendedStyle` via the bundled color analyzer:

```bash
python3 "<SKILL_DIR>/scripts/auto-style.py" "$VIDEO_PATH" --json
# → {"mode":"dark","temp":"cool","recommend":["nebula-glass",...],"note":"..."}
```

Then ask the user 5 things (ratio / layout / style / card density / 运镜),
using the best available question channel, and resolve everything from their
answers. If the user pre-approved defaults ("auto / 无需询问"), skip the
question and use the recommendations.

**→ The complete Step 7 — the 5-question `AskUserQuestion` call (Channel A) and
plain-text fallback (Channel B), the day/night auto-match mapping, the
canvas / frame / bounds resolution tables, theme palettes, the visual design
library guide, 留白 (breathing room), camera rhythm (运镜 fixed vs dynamic), and
the storyboard render contract — is in
[`references/render-strategy.md`](references/render-strategy.md). Read it now.**

After resolving, state back what you chose in one sentence (ratio + canvas size,
layout, specific style, frame, final cardCount, rhythm), then proceed.

### 8. Write Each Card's HTML

**Clone-first (the default).** For each card:

1. `cp "$SKILL_DIR/references/styles/<chosenStyle>.html" "$WORK_DIR/public/cards/<card-id>.html"`
2. Rename the fragment's `data-card-id="ref-<key>"` to this card's `<card-id>` (update the scoped `<style>` selectors + element ids).
3. Swap the placeholder copy for this card's real `contentHints`, set the accent to the card's `accentIndex`.
4. Stop there. Don't redesign the layout, re-pick fonts, or re-author the ornament — the reference encodes the curated look. Touch structure only for the rare card whose content genuinely doesn't fit.

Authoring a fragment from a blank file is the **exception**. Animations are
**declared, not coded** — use `data-anim-*` attributes only; never write
`<script>` in a card. The composition `index.html` is the only place a
`<script>` (the GSAP block) lives.

**→ The complete Step 8 — the card HTML contract + hard rules (lint), the
canvas-atmosphere exception, NON-NEGOTIABLE overflow safety, portrait
mobile-first sizing, the silky motion philosophy, the full `data-anim` kinds
table, and the `card-cta` brand-outro template — is in
[`references/card-contract.md`](references/card-contract.md). Read it before
writing any card.**

### 9. Assemble the Composition HTML

Stage the assets and write `$WORK_DIR/public/index.html`:

```bash
# SKILL_DIR is injected by the host ("Base directory for this skill: …")
SKILL_DIR="<SKILL_DIR>"

mkdir -p "$WORK_DIR/public/fonts" "$WORK_DIR/public/vendor" "$WORK_DIR/public/cards"
cp -n "$SKILL_DIR/assets/fonts/"*            "$WORK_DIR/public/fonts/"
cp -n "$SKILL_DIR/assets/vendor/gsap.min.js" "$WORK_DIR/public/vendor/"
# copy the STATIC composition shell — do NOT retype it
cp "$SKILL_DIR/references/composition-shell.html" "$WORK_DIR/public/index.html"
# stage the input video so the composition can reference it by relative path
ln -f "$VIDEO_PATH" "$WORK_DIR/public/input-video.mp4" 2>/dev/null \
  || cp "$VIDEO_PATH" "$WORK_DIR/public/input-video.mp4"
```

**Then fill the shell — do not regenerate it.** `index.html` is the copied
`composition-shell.html` (already has `#stage` / `#video-wrap` / card-host
structure + `@font-face` + GSAP runtime). Edit only these slots:

1. **The 6 `{{...}}` tokens** at the top: `{{BG}}` `{{TEXT}}` `{{ACCENT_0..4}}`
   (from the chosen `themeId` palette), `{{DURATION}}` (= `composition.durationSeconds`),
   `{{FPS}}`, `{{WIDTH}}`, `{{HEIGHT}}`. The tokens appear in a few places each —
   a `sed` pass replaces all at once, e.g.
   `sed -i '' -e 's/{{DURATION}}/121.2/g' -e 's/{{FPS}}/30/g' … "$WORK_DIR/public/index.html"`.
   (`sed -i ''` is macOS/BSD; on Linux use `sed -i` with no `''`.)
2. **`.video-wrapper` initial `left/top/width/height`** — set to card-01's layout bounds.
3. **The two `INJECT-*` markers** — **do NOT hand-author these.** Run the
   generator; it reads `storyboard.json` + `public/cards/*.html` and fills both
   the card-host divs and the full GSAP timeline (enter / drift / exit, with
   `data-anim` attributes compiled via the cheat sheet, times quantized,
   `data-track-index` increasing, drift repeats finite):

   ```bash
   python3 "$SKILL_DIR/scripts/build-timeline.py" --work "$WORK_DIR"   # add --slip 0.55 to tune
   ```

   **Idempotent** — re-run after editing any card / the storyboard; it re-injects
   between its `BEGIN/END` sentinels. Run it AFTER Step 8 (cards exist) and AFTER
   the `sed` fill; read its stderr timing warnings. What it leaves to you:
   **`#video-wrap` reframes** for dynamic (起伏运镜) rhythm — add
   `"videoBounds": {left,top,width,height}` (+ optional `"videoClass": "video-wrapper pip"`)
   to a card in `storyboard.json` and it emits the reframe tween at that card's
   slip; cards without `videoBounds` keep the video put (calm default).

> **Hand-authoring the timeline is the exception** — only for a one-off motion the
> cheat sheet can't express (then stop re-running the script, it overwrites). Else
> declare motion as `data-anim-*` (Step 8) and let the generator compile it.

**→ The Step 9 reference detail — the GSAP statement cheat sheet, card-timing
validation (overlap is intentional), the video framing reference per layout, the
HyperFrames layout/animation QA rules, the hard-won gotchas (read before
assembling), and the fixed card-cta GSAP block — is in
[`references/composition-assembly.md`](references/composition-assembly.md).**

### 10. Preview & Iterate FIRST — do NOT render to review

**Rendering is for the final export, never for review** (a full render is
~1–2 min). After assembling `index.html`, start the live studio for review — it
opens instantly, plays/scrubs in real time, and **hot-reloads on every edit**.

```bash
cd "$WORK_DIR"
npx hyperframes preview public --no-open
# prints e.g. "Studio  http://localhost:3002" (auto-picks the next free
# port if taken). Share that URL with the user.
```

Loop:

1. Assemble / edit the composition (Step 9).
2. Run `hyperframes preview` (once — it stays up and hot-reloads).
   Give the user the `localhost` URL.
3. User reviews in the browser → requests changes → you edit the HTML →
   user just refreshes / re-scrubs. No render in this loop.
4. **Only when the user explicitly approves** do you move to Step 11
   (render). Do not render proactively just to "check" — snapshots
   (`hyperframes snapshot`) cover your own static QA without a full render.

For YOUR OWN spot-checks during building, use single-frame snapshots
(cheap), not renders:

```bash
npx hyperframes snapshot public --at 5 --describe false   # writes public/snapshots/frame-…png
```

> Pass `--describe false` to silence the built-in Gemini QA (prints
> `GEMINI_API_KEY not set, skipping` otherwise). Frames write to the **real**
> path `public/snapshots/frame-*.png` (not `snap-*.png`). Under zsh an unmatched
> glob hard-errors (`nomatch` → exit 1) — guard loops with `setopt +o nomatch`.

Manage preview servers: `hyperframes preview --list` /
`hyperframes preview --kill-all`.

> Headless / cron runs (no desktop): skip the interactive preview and go
> straight to Step 11, using snapshots for QA.

### 11. Render to MP4 (only after the user approves the preview)

```bash
cd "$WORK_DIR"
PRODUCER_BROWSER_GPU_MODE=hardware npx hyperframes render public \
  -o output.mp4 \
  --fps 30
```

`hyperframes render <dir>` reads `<dir>/index.html` and produces the MP4.
The flag `PRODUCER_BROWSER_GPU_MODE=hardware` (or `--browser-gpu`) is
strongly recommended on macOS — software-only Chrome rendering times out
on most laptops.

For a sanity check before the full render, capture a single frame at a
specific timestamp:

```bash
npx hyperframes snapshot public --at 5 --out snapshot-5s.png --describe false
```

### 12. Report Results

Tell the user: work dir path · key artifacts (`storyboard.json`,
`public/cards/*.html`, `public/index.html`, `output.mp4`) · ASR provider · card
count + how you chose them (1 sentence) · any missing keys / quality caveats.
Don't delete the work directory unless asked.
