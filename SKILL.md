---
name: interflow-video-cut
description: Turn a local talking-head / 口播 video into metadata, transcript, and an AI-composed card-based video where the agent composes cards by cloning styled templates and filling them (designing bespoke only when content needs it), then renders to MP4. Ships with the Interflow AI club sign-off ("Interflow AI 出品"). Use when the user asks for interflow-video-cut, 口播成片, talking-head repurposing, video takeaways, transcript cleanup, or turning a spoken video into a captioned card video.
---

# Interflow Video Cut — 口播成片 Workflow

Interflow Video Cut converts a local input video into a card-based composition. The agent
designs the cards (timing + content), then assembles a single composition HTML and renders
it to MP4 via `hyperframes`.

**Default authoring mode: clone-and-fill, not free-design.** For each card,
**start from a shipped reference fragment** (`references/styles/<key>.html`) and
**swap only the text + accent** — this is the fast path and it keeps every card
at the curated quality floor. Hand-authoring a card from scratch is the
**exception**, reserved for content that genuinely doesn't fit any reference.

## CLI Resolution

```bash
# interflow-video-cut uses the vtake CLI (notedit) under the hood — auto-downloaded from npm on first run
VTAKE="npx -y @interflow/notedit@latest"  # or set VTAKE to a local checkout's bin
# hyperframes — for rendering the assembled HTML to MP4
HYPERFRAMES="npx -y hyperframes@latest"
```

`SKILL_DIR` is the absolute path to this skill's directory (the host injects it
as "Base directory for this skill: …"). All `references/...` and `scripts/...`
paths below are relative to it.

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
| `references/styles/*.html` | 11 self-contained style fragments — **clone these** | Step 8 |
| `references/layouts/*.html` | 6 layout skeletons (videoBounds + cardBounds for landscape/portrait) | Step 7 / 9 |
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

- `ELEVEN_API_KEY` — when set, `vtake transcribe` connects to ElevenLabs
  directly and bypasses the rate-limited proxy. When **not** set, it falls
  back to `https://vtake.app/api/transcribe`, which enforces **3 requests
  per minute per IP**. Override the proxy URL with
  `VTAKE_TRANSCRIBE_ENDPOINT` (e.g. for local Wrangler dev).

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

**Five `zone` values:**

| zone | resolved bounds | when to use |
|---|---|---|
| `fullscreen` | covers whole canvas | hero moments, big numbers, mantras |
| `whiteboard-area` | inset 40px margin (or 45% of portrait height) | dense data / annotated content |
| `lower-third` | bottom 30% band | annotation over visible video |
| `side-panel` | right 42% (landscape) or bottom 40% (portrait) | data side, video other side |
| `video-overlay` | full canvas, expects mostly-transparent card | annotation overlays on full-bleed video |

When you assemble the composition in Step 9, resolve each card's `zone`
into pixel bounds on the card-host wrapper following the table above.
Video bounds are set **once** at composition level (`videoTrack.bounds`);
to make video appear to "move between cards", author GSAP tweens against
`#video-wrap` in the composition's `<script>` (see Step 9).

**No prescribed card roles, no prescribed narrative arc.** Cards emerge
from what the video actually says — could be all quotes or all data,
could open with a number or with a story. Let the transcript drive the
rhythm.

**Where do card boundaries fall? — one intent per card.** "Let the
transcript drive" is not "cut anywhere". A card boundary belongs where the
speaker *pivots to a new idea*. Mark a boundary at any of these signals —
then a card spans the stretch between two boundaries:

- **Topic shift** — "OK, that's the problem. Now, here's what actually works…": a new card starts at "Now".
- **Argument unit** — a setup → proof → payoff that runs >~20s is 2–3 cards (one per move), not one crammed card.
- **Distinct claim / number / comparison** — each gets its own card. Avoid "data-dump" cards that pile 4+ facts into one.
- **Emphasis / repetition** — a repeated phrase, rhetorical question, or "this is the key point" is an anchor: make it its own beat.
- **Shot change** (if visible) — face-to-camera → screen-share → prop is a natural boundary too.

The duration+density math below sets *how many* cards; these signals set
*where they land*. If the two disagree, trust the intents — never split one
idea across two cards or fuse two ideas to hit a number.

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

**Speaker presence — keep the talking head on screen.** Unless the user wants a
faceless explainer, the source video (the speaker) is on screen for most of the
film — cards annotate and amplify, they don't replace. Practical default:
full-bleed or large-PIP speaker on the opening and closing cards, at least a
small PIP or side-panel on cards where the speaker makes a personal point.
Data-heavy cards can go full-card briefly.

**Distill, don't transcribe — a card is information design.** The single biggest
quality failure is pasting a spoken sentence onto a card. A card headline is a
*rewrite*: same meaning, a third of the words, the point surfaced. Run every
card's `content` through this gate:

1. **One intent, one sentence.** Can't state the point in one short line → it's two ideas, split it.
2. **Headline ≠ the quote.** Rewrite the spoken sentence into a ~14-char title; demote the explanation to a small detail line.
3. **No two cards make the same point.** Scan the storyboard; if two overlap, merge or reframe one.
4. **Shape follows content.** Comparison → two-column / delta; number → one big figure + label; list → stacked rows; quote → large centered text.

Failure smell (reject and rewrite): a `title` longer than ~14 Chinese chars, a
`detail` that's a verbatim transcript clause, or a card that's just "the next
sentence" rather than "the next idea".

**Final card — append a customizable brand outro (`card-cta`).** After all
content cards, append one outro card to the `cards` array, and extend
`composition.durationSeconds` by ~3.5s to match its `endSec` (the tail is a
pure-graphic sign-off with no video behind it):

```json
{
  "id": "card-cta",
  "intent": "Customizable brand / sign-off outro",
  "startSec": <last content card's endSec>,
  "endSec":   <last content card's endSec + 3.5>,
  "accentIndex": 3,
  "zone": "fullscreen",
  "contentHints": {
    "recap":   "<one line echoing the video's core takeaway / payoff — the content beat>",
    "purpose": "<one human line: what the brand/club is and what it's for>"
  }
}
```

Outro rules (the full template + entrance choreography are in
`references/card-contract.md`):

- **Lead with a recap / payoff line** rewritten from what the video actually said — that's the content beat that makes the ending *earned*, not a bolted-on logo flash.
- **Carry a one-line purpose / 延伸 under the wordmark** (e.g. `让每个想法，都有更好的呈现`). Drop `.purpose` only if the recap already says it — don't stack redundant copy.
- **Follow the same visual language as the rest of the video.** The shipped `card-cta` is a *dark* "Editorial Cinema" card; for any other style, re-theme it (reuse the composition's `--bg`/`--ink`/`--accent-0`, swap mark/wordmark/tagline) — keep the entrance choreography, only swap colors + content. A clashing fixed outro is a defect.
- **It's the Interflow club sign-off, not a hard sell.** Ships branded `Interflow` + `Interflow AI 出品`. For an outside creator, swap or drop the brand. A follow nudge is fine only if the creator wants it — don't force a "立即购买" CTA. **Strip AI-jargon** (公开孵化 / 赋能 / 闭环 / leverage / synergy) — use plain human phrasing. When unsure of wording, propose 2–3 options before rendering.

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

**Then fill the shell — do not regenerate it.** `index.html` is now the copied
`references/composition-shell.html` (which already contains the `#stage` /
`#video-wrap` / card-host structure, the `@font-face` blocks, and the GSAP
runtime). Edit only these slots:

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

   It is **idempotent** — re-run it after editing any card HTML or the
   storyboard, and it re-injects between its own `BEGIN/END` sentinels. What it
   leaves to you: **video `#video-wrap` reframes** for multi-layout / dynamic
   (起伏运镜) rhythm — opt in per card by adding
   `"videoBounds": { "left":…, "top":…, "width":…, "height":… }` to that card in
   `storyboard.json` before running the script, and it emits the reframe tween at
   that card's slip point. Add `"videoClass": "video-wrapper pip"` (or any chrome
   class) alongside it when the reframe needs a different look. Cards without
   `videoBounds` keep the video where it was (the calm fixed-rhythm default). Run
   `build-timeline.py` AFTER Step 8 (cards must exist) and AFTER the `sed` token
   fill. Read its stderr timing warnings — they mean the storyboard needs fixing.

> **Hand-authoring the timeline is the exception.** Only edit the generated
> region directly for a genuinely one-off motion the cheat sheet can't express —
> and then stop re-running the script (it would overwrite your edit). For
> everything normal, declare motion as `data-anim-*` attributes (Step 8) and let
> the generator compile them.

**→ The Step 9 reference detail — the GSAP statement cheat sheet, card-timing
validation (overlap is intentional), the video framing reference per layout, the
HyperFrames layout/animation QA rules, the hard-won gotchas (read before
assembling), and the fixed card-cta GSAP block — is in
[`references/composition-assembly.md`](references/composition-assembly.md).**

### 10. Preview & Iterate FIRST — do NOT render to review

**Rendering is for the final export, never for review.** A full render
takes ~1–2 min; using it as the feedback loop wastes minutes per change.
Instead, after assembling `index.html`, start the live studio and let the
user review there — it opens instantly, plays in real time, scrubs the
timeline, and **hot-reloads on every edit**.

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

> `--describe` is hyperframes' built-in Gemini vision QA — it runs **by
> default** and prints `GEMINI_API_KEY not set, skipping` on every frame
> when no key is set. Pass `--describe false` to silence it (this project
> doesn't use Gemini). To read the frames back, glob the **real** output
> path `public/snapshots/frame-*.png` — never `snap-*.png`. Under zsh an
> unmatched glob is a hard error (`nomatch` → exit 1), so a wrong pattern
> kills the whole command; if a snapshot loop might match nothing, guard
> with `setopt +o nomatch` or test the path first.

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

Tell the user:

- Work directory path
- `storyboard.json` (the card outline you designed)
- `public/cards/*.html` (one HTML per card)
- `public/index.html` (the assembled composition)
- `output.mp4` (the final video)
- ASR provider used
- Card count + how you chose them (in 1 sentence)
- Any missing keys or quality caveats

Do not delete the work directory unless the user asks.
