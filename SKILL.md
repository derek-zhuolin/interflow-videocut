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
*exception*, taken only when the content genuinely needs a shape no reference
provides. The cards' *content* still emerges from what the transcript says — but
their *visual shell* is reused, not reinvented per card. This is the single
biggest lever on how long a video takes to produce: cloning 15 cards is minutes;
bespoke-designing 15 cards is half an hour.

Inspectable intermediate files in the work directory:

- `metadata.json` — duration / width / height / fps
- `audio.mp3` — extracted audio
- `transcript.json` — segments + words with timestamps
- `storyboard.json` — lightweight card outline (the agent's plan)
- `public/cards/card-XX.html` — one HTML fragment per card
- `public/index.html` — final assembled composition
- `output.mp4` — rendered video

## CLI Resolution

```bash
# interflow-video-cut uses the vtake CLI (notedit) under the hood — auto-downloaded from npm on first run
npx -y @notedit/vtake@latest --help

# hyperframes — for rendering the assembled HTML to MP4
npx hyperframes render --help
```

> Every `vtake …` command below is shorthand for `npx -y @notedit/vtake@latest …`.

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
speaker *pivots to a new idea*. Read the transcript and mark a boundary at any
of these signals — then a card spans the stretch between two boundaries:

- **Topic shift** — "OK, that's the problem. Now, here's what actually
  works…": a new card starts at "Now".
- **Argument unit** — a setup → proof → payoff that runs >~20s is 2–3 cards
  (one per move), not one crammed card.
- **Distinct claim / number / comparison** — each gets its own card. Avoid
  "data-dump" cards that pile 4+ facts into one (the viewer can't hold them).
- **Emphasis / repetition** — a repeated phrase, rhetorical question, or
  "this is the key point" is an anchor: make it its own beat.
- **Shot change** (if visible) — face-to-camera → screen-share → prop is a
  natural layout/card boundary too.

The duration+density math below sets *how many* cards; these signals set
*where they land*. If the two disagree (math says 8, the content has 5 clean
intents), trust the intents — never split one idea across two cards or fuse
two ideas to hit a number.

**How many takeaways? — auto-infer from duration + density.** No fixed
upper limit. Pick a **base pace** from the video duration, then adjust
by **information density**. Only **floor is fixed: minimum 5 cards** so
even short videos have rhythm.

**Step 1 — base pace by duration** (the natural sec/card for medium density):

| video duration | base pace (sec per card) | rationale |
|---|---|---|
| < 60s (short reel) | **6–8s** | viewers expect fast cuts in short-form |
| 60s – 3 min | **8–12s** | normal social pace |
| 3 – 10 min | **12–20s** | give breathing room; each card carries more |
| 10 – 30 min | **20–35s** | long-form lecture / interview rhythm |
| > 30 min | **30–60s** | episodic, near-chapter feel |

**Step 2 — density multiplier** (multiplies the base pace):

| signal in the transcript | multiplier | effect |
|---|---|---|
| **High density** — many numbers, distinct claims, staccato pacing, list-like enumeration, every 1–2 sentences is a new idea | **× 0.7** | cuts faster, more cards |
| **Medium density** — mixed flow with both data and narrative | **× 1.0** | base pace |
| **Low density** — one extended story, repeated reframing, slow reflective pacing, single argument unfolding | **× 1.5** | cuts slower, fewer cards |

**Step 3 — compute:**

```
secPerCard = basePace × densityMultiplier
cardCount  = max(5, round(videoDurationSec / secPerCard))
```

Examples (notice — **no upper clamp**; long videos naturally produce more cards):

- **30s reel, single punchline (low density)** → 7 × 1.5 = 10.5s/card → round(30/10.5)=3 → floor to **5** cards
- **60s reflective monologue (low density)** → 10 × 1.5 = 15s/card → **4** → floor to **5** cards
- **121s talking-head with rich data (high density)** → 10 × 0.7 = 7s/card → **17** cards
- **5 min interview, mixed density** → 16 × 1.0 = 16s/card → **19** cards
- **10 min deep-dive, high density** → 16 × 0.7 = 11s/card → **55** cards
- **30 min lecture, medium density** → 28 × 1.0 = 28s/card → **64** cards
- **1 hr podcast, low density** → 45 × 1.5 = 67.5s/card → **53** cards

When a card holds longer than ~15s, plan for a richer card (data block,
multi-step reveal, several sub-points unfolding with staggered
animations) — a static one-liner gets boring past 8s. For long pieces
where many cards exceed 30s, consider **chunking the timeline into
sub-compositions** (one .html per chapter, mounted with
`data-composition-src`) so the GSAP timeline per file stays manageable
— see the `timeline_track_too_dense` HyperFrames lint warning.

`content` can be a plain string ("标题：年化 5.69%\n说明：...") or any JSON
shape that captures the data. The agent decides the shape per card.

**Distill, don't transcribe — a card is information design, not a caption.**
The single biggest quality failure is pasting the spoken sentence onto a card.
A card headline is a *rewrite*: same meaning, a third of the words, the point
surfaced. Before writing any card's `content`, run it through this gate:

1. **One intent, one sentence.** If you can't state the card's point in one
   short line, it's holding two ideas — split it.
2. **Headline ≠ the quote.** The speaker said *"人民币升值的时候，美金保单就会
   贬值，这其实就是汇率对冲的基本道理"* → the card is **"美金 ⇄ 人民币：对冲的代价"**
   as the headline, with the explanation demoted to a small detail line — not
   the whole 30-character sentence set as the title.
3. **No two cards make the same point.** Scan the storyboard; if card 3
   ("增长很快") and card 8 ("为什么增长重要") overlap, merge or reframe one.
4. **Shape follows content.** A comparison → two-column / delta layout; a
   number → one big figure + label; a list → stacked rows; a quote → large
   centered text. Don't pour every card into the same `{kicker,title,detail}`
   mold — pick the structure the information wants.

Failure smell (reject and rewrite): a `title` longer than ~14 Chinese chars,
a `detail` that's a verbatim transcript clause, or a card that's just "the
next sentence" rather than "the next idea".

**Final card — append a customizable brand outro (`card-cta`).**

After all content cards, append one outro card to the `cards` array. It ships
with **neutral, swappable placeholders** — no fixed brand — so each creator
makes it their own:

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

Also extend `composition.durationSeconds` by 3.5 seconds: set it to the same
value as `card-cta.endSec`. The source video's track stops at its natural
end; the ~3.5-second tail is a pure-graphic sign-off moment with no video
visible behind the CTA card. The CTA card uses a calm ~2.7s entrance that
opens with a **recap / payoff line** (~at 0.55s, the content beat), then the
brand mark + wordmark, then a one-line **purpose statement**, then ~0.4s hold
+ ~0.35s fade-out.

> **Why 3.5s, a recap line AND a purpose line (baked-in lesson).** A bare
> wordmark + "XX 出品" tail reads as too thin / unanchored — the ending
> doesn't "安顿" (doesn't settle), and worse, it carries **no content** — it's
> a bolted-on logo flash. The default now runs ~3.5s and leads with a
> **`.recap` line — one sentence echoing what the video actually said / its
> payoff** (the agent rewrites this from the real transcript, e.g.
> `你只管讲，成片交给我们`). Under the wordmark sits the **`.purpose` line** —
> the brand's one human sentence (e.g. `让每个想法，都有更好的呈现`). Keep the
> recap; it's what makes the ending *earned* rather than decorative. If the
> recap already carries the brand message, you may drop `.purpose` to avoid
> two near-identical lines — don't stack redundant copy.

**The outro must follow the same visual language as the rest of the video.**
The shipped `card-cta` template (Step 8) is a *dark* "Editorial Cinema" card —
that only fits dark/cinematic compositions. For any other chosen style
(e.g. a light editorial look), **re-theme the outro to match**: reuse the
composition's palette (`--bg`, `--ink`, `--accent-0`, light vs dark) so the
ending reads as the same project, not a bolted-on card. Keep the entrance
choreography (corners → meta → mark/hero → divider → tagline); only swap
colors and the brand/wordmark/tagline content. A clashing fixed outro
(dark amber tail on a light video) is a defect, not a sign-off.

**The outro is the Interflow club sign-off — it's a sign-off, not a hard sell.**
The template ships **branded with Interflow by default** (wordmark `Interflow`
+ tagline `Interflow AI 出品`). Keep it as-is for club work. If a creator wants
their own ending, swap the wordmark / tagline / mark for theirs, or drop the
brand entirely for a clean ending. Guidelines:
- **Always carry a one-line purpose / 延伸 under the wordmark.** State in one
  human sentence what the brand/club IS or is FOR (e.g.
  `让每个想法，都有更好的呈现`). A bare wordmark + "XX 出品" reads as
  unfinished. This is the `.purpose` line in the template — keep it, swap only
  the wording.
- If the creator has a one-line thesis / catchphrase / IP line, lead with
  that instead of a feature pitch.
- A follow nudge ("关注我…" / "Follow for more") is fine **only if the
  creator wants it** — don't force a "试试这个 / 立即购买" CTA.
- **Strip AI-jargon.** Words like 公开孵化 / 赋能 / 闭环 / 持续进化 (or
  "leverage / synergy / unlock") read as machine copy — replace with plain,
  human phrasing the creator would actually say.
- When unsure of the exact wording, propose 2–3 options and let the user
  pick before rendering.

### 7. Decide Render Strategy

#### Confirm Visual Direction with User (DO THIS FIRST)

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
   `spatial`); `temp` (warm/cool) picks within that. Use
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
        { label: "全屏浮层 (overlay)",   description: "video 全屏播放，card 作为玻璃浮层落在画面上。情绪 / 电影感强烈。" }
      ]
    },
    {
      question: "选视觉风格：你的内容想要什么感觉？",
      header: "选风格",
      multiSelect: false,
      // 中文优先词库（中文名 + 大白话「什么时候用」），让中国创作者一眼会选。
      // 括号里的英文 key 不展示给非技术用户也行，但保留它，agent 用它映射到
      // frame auto-pick matrix 的列（cinematic / clinical / pastel-aura / editorial-print）。
      // 4 个分组成员与下方 frame 矩阵一一对应，顺序可调（已把暗调组放第一）。
      options: [
        { label: "暗调电影感（黑底·高级·有动态）", description: "黑底、高级、电影质感。含：暗夜星河(nebula-glass，黑底流动粒子+玻璃，最高级最科技) · 玻璃拟态(glass，简单两色渐变+磨砂玻璃，半透明干净高级) · 暖光太空(spatial，黑底暖橙光，温暖有空间感) · 撞色大字(geom，黑底亮色块超大字，大胆有冲击)。什么时候用：产品/科技发布、短视频高光、强情绪开场、想要高级感。" },
        { label: "干净专业（数据·报告·严肃）", description: "干净、克制、权威。含：瑞士网格(swiss，白底红点大字，专业权威) · 黑白极简(minimal，纯黑白大字+大留白，高级克制) · 代码终端(terminal，黑底绿字代码风，技术极客)。什么时候用：财报数据、调查报告、技术教程、严肃陈述。" },
        { label: "浅色清爽（日常·白天·轻松）", description: "浅色、柔和、不刺眼。含：柔光浅色(pastel-aura，浅色柔和，白天/日常感)。什么时候用：个人日常分享、品牌叙事、轻松内容、画面偏亮的视频。" },
        { label: "杂志素材（作品集·素材排版）", description: "把照片/视频排成杂志跨页，不是文字卡。含：杂志印刷(editorial-print)。什么时候用：作品集、大事记、公司/产品介绍、素材展示（走 references/editorial-print-montage.md）。" }
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

3) 视觉风格 — 你的内容想要什么感觉？(4 选 1)：
   A. 暗调电影感（黑底·高级·有动态）：暗夜星河 / 玻璃拟态 / 暖光太空 / 撞色大字
      → 产品科技发布、短视频高光、强情绪、想高级感
   B. 干净专业（数据·报告·严肃）：瑞士网格 / 黑白极简 / 代码终端
      → 财报数据、调查报告、技术教程、严肃陈述
   C. 浅色清爽（日常·白天·轻松）：柔光浅色
      → 个人日常分享、品牌叙事、轻松内容、画面偏亮
   D. 杂志素材（作品集·素材排版）：杂志印刷
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

   | layout | pastel-aura (light) | editorial-print (montage) | clinical styles (swiss / terminal / minimal) | cinematic styles (geom / glass / spatial / nebula-glass) |
   |---|---|---|---|---|
   | `split` | `clean` | `polaroid` | `hairline` | `clean` / `hairline` (spatial 取景框同源; nebula-glass 恒 `clean`) |
   | `stack` | `clean` | `polaroid` | `hairline` | `clean` / `hairline` |
   | `pip` | `clean` (white-ring pip pill) | `clean` (pip pill already has chrome) | `clean` | `clean` (spatial: 给 pip 加暖光取景框角标) |
   | `overlay` | `clean` (full-bleed forbids deco frames) | `clean` (full-bleed forbids deco frames) | `clean` | `clean` (nebula-glass: 全屏粒子场忌加边框) |

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
     states for rise-and-fall (see "Camera Rhythm (运镜)" under Step 7).
6. **Tell the user what you chose** in one sentence — ratio (+ canvas
   size), layout, specific style, frame, final cardCount, and rhythm —
   then proceed with the rest of Step 7 (per-card layouts, motion patterns).
7. Record the six values (ratio / layout / style / frame / cardCount /
   rhythm) in working memory (no schema field needed); you'll reference
   them while writing each card's HTML in Step 8 and while reading the
   matching `references/<dim>/<key>.html` for tokens and structure.

If the user picks an answer via "Other" with a free-text style name not
in the 15-style library, treat it as a hint to design a fresh card
visual yourself, but still anchor on the chosen layout's bounds.

#### Render Strategy Inputs

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
  → video-overlay), OR pick a different zone for one-off variants
  (fullscreen for hero / quote, whiteboard-area for dense data).
- **`accentIndex` per card**: each card pulls one of the 5 theme accent
  colors. Vary across cards for rhythm; reuse the same index when two
  cards belong to the same narrative beat.
- **Motion vocabulary**: pick 2–3 repeatable patterns from
  `data-anim` kinds (see the table later) and stick to them so the
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

`<SKILL_DIR>/references/styles/` ships 9 self-contained reference cards
(pastel-aura / glass / spatial / nebula-glass / minimal / geom / terminal /
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

#### Visual Design Library (<SKILL_DIR>/references/)

Beyond the composition-level `themeId`, the skill ships a richer **reference
library** at `<SKILL_DIR>/references/` covering three **orthogonal**
visual dimensions you can freely mix:

```
Style  ×  Layout  ×  VideoFrame
 (9)       (4)         (3)
```

| dimension | keys | what it decides |
|---|---|---|
| **style** | `minimal` `geom` `terminal` `swiss` `pastel-aura` `glass` `spatial` `nebula-glass` `editorial-print` | the card's visual language — fonts, colors, ornament, layout-within-card |
| **layout** | `split` `stack` `pip` `overlay` | how the source video and the card share the canvas |
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
| 高光时刻、产品揭晓、金句 | 暗夜星河 `nebula-glass` · 撞色大字 `geom` · 玻璃拟态 `glass` · 暖光太空 `spatial` | 大胆、有纵深、动态感 —— 撑得起强调（暗夜星河 = 黑底双星粒子场，科技/电影感最强）|
| 密集讲解、框架、步骤 | 瑞士网格 `swiss` · 代码终端 `terminal` · 黑白极简 `minimal` | 结构化、小字也清楚 |
| 随手的个人分享 | 柔光浅色 `pastel-aura` | 柔、亲和、像 feed 原生、不正式 |
| 素材本身就是主角（作品集、大事记、产品/公司 montage）| 杂志印刷 `editorial-print` | 把真实素材排成杂志跨页；整屏场景，不是文字压视频 —— 见 montage kit |

Keep **one** style family across a video for cohesion — don't strobe between
cold and cinematic every card. Shift style only when the *content* shifts
register (e.g. the one data card in an otherwise warm story). If you pick a
style against this grid (e.g. `glass` for a tax-law breakdown), do it
on purpose for contrast — not by default.

The 9 styles are skill-side design tokens, **not composition-level themes** —
they don't need to be declared in `storyboard.composition`; they live
inside each card's HTML. The `themeId` field can still pick a
composition-level palette (table above) that controls page-body background
and video border chrome.

#### Breathing Room (留白) — float the panels, don't fill the frame

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

#### Camera Rhythm (运镜) — fixed vs dynamic (user-chosen in Step 7.0)

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

#### Layout Compositions (Card + Video)

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

**4 composition layouts** (from `references/layouts/`) — each is a
recipe pairing a `zone` with a `#video-wrap` tween target:

| composition layout | recommended `card.zone` | GSAP target for `#video-wrap` (landscape 1920×1080) | GSAP target for `#video-wrap` (portrait 1080×1920) | when to use |
|---|---|---|---|---|
| `split` | `side-panel` | `{ left: 960, top: 0, width: 960, height: 1080 }` | `{ left: 0, top: 960, width: 1080, height: 960 }` (bottom half) | speaker + data side-by-side / 50:50 weight |
| `stack` | `lower-third` | `{ left: 14, top: 14, width: 1892, height: 548 }` (top 52%) | `{ left: 0, top: 0, width: 1080, height: 844 }` (top 44%) | speaker on top + summary card below |
| `pip` | `fullscreen` | `{ left: 1480, top: 760, width: 400, height: 300 }` + add `.framed` class | `{ left: 690, top: 28, width: 360, height: 203 }` + add `.framed` | content-heavy card + corner pip |
| `overlay` | `video-overlay` | `{ left: 0, top: 0, width: 1920, height: 1080 }` (full-bleed) | `{ left: 0, top: 0, width: 1080, height: 1920 }` | cinematic / dramatic / glass card on full video |

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

#### Storyboard Render Contract

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

### 8. Write Each Card's HTML

**Clone-first (the default — read before writing anything).** For each card:

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

#### Card HTML Contract

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

#### Overflow safety — NON-NEGOTIABLE (the #1 cause of broken cards)

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

#### Card Sizing — Mobile-First in Portrait

The 9 `references/styles/*.html` are sized for a **1920×1080 landscape**
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

#### Motion Philosophy — the default is *silky*, not slideshow

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

#### Available `data-anim` Kinds

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

#### card-cta: Brand Outro Card (dark default — RE-THEME to match the composition)

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
`references/composition-shell.html`. Edit only these slots:

1. **The 6 `{{...}}` tokens** at the top: `{{BG}}` `{{TEXT}}` `{{ACCENT_0..4}}`
   (from the chosen `themeId` palette), `{{DURATION}}` (= `composition.durationSeconds`),
   `{{FPS}}`, `{{WIDTH}}`, `{{HEIGHT}}`. The tokens appear in a few places each
   (e.g. `{{DURATION}}` on `#stage`, the `<video>`, and `compDurationSec`) — a
   `sed` pass replaces all at once, e.g.
   `sed -i '' -e 's/{{DURATION}}/121.2/g' -e 's/{{FPS}}/30/g' … "$WORK_DIR/public/index.html"`.
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
   class) alongside it when the reframe needs a different look than the default
   `video-wrapper framed` (e.g. pip-pill, or `video-wrapper` for a clean overlay).
   Cards without `videoBounds` keep the video where it was (the calm fixed-rhythm
   default). Run `build-timeline.py` AFTER Step 8 (cards must exist) and AFTER the
   `sed` token fill above. The script prints timing warnings to stderr (too-short
   cards, out-of-order starts, broken slip overlap) — read them; they mean the
   storyboard needs fixing, not the output.

   > `sed -i ''` is macOS/BSD syntax (the empty `''` is the in-place backup arg).
   > On Linux use `sed -i` with no `''`. Tip to fill all tokens in one pass:
   > write the 11 values into a small `vars.sed` and run `sed -i '' -f vars.sed`.

> **Hand-authoring the timeline is the exception.** Only edit the generated
> region directly for a genuinely one-off motion the cheat sheet can't express —
> and then stop re-running the script (it would overwrite your edit). For
> everything normal, declare motion as `data-anim-*` attributes on the card
> elements (Step 8) and let the generator compile them.

The reference below shows a *filled* shell (theme `classic`, 2 cards) so you can
see what the slots look like once populated — it is the SAME skeleton as the
shell file, NOT a separate thing to retype:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
@font-face { font-family: 'Caveat'; src: url('fonts/Caveat-400-latin.woff2') format('woff2'); font-weight: 400; font-display: block; }
@font-face { font-family: 'Caveat'; src: url('fonts/Caveat-700-latin.woff2') format('woff2'); font-weight: 700; font-display: block; }
@font-face { font-family: 'LXGW WenKai TC'; src: url('fonts/LXGWWenKaiTC-400-latin.woff2') format('woff2'); font-weight: 400; font-display: block; }
@font-face { font-family: 'Inter'; src: url('fonts/Inter-400-latin.woff2') format('woff2'); font-weight: 400; font-display: block; }
@font-face { font-family: 'Inter'; src: url('fonts/Inter-700-latin.woff2') format('woff2'); font-weight: 700; font-display: block; }
@font-face { font-family: 'Virgil'; src: url('fonts/Virgil.woff2') format('woff2'); font-display: block; }

:root {
  /* Pick from the themeId palette table in Step 7 — example: classic */
  --bg: #FFF9E3;
  --text: #1e1e1e;
  --accent-0: #1971c2;
  --accent-1: #e03131;
  --accent-2: #2f9e44;
  --accent-3: #e8590c;
  --accent-4: #9c36b5;
  --font-family: 'Caveat', 'LXGW WenKai TC', serif;
}
* { box-sizing: border-box; }
/* Body font-family MUST list concrete font names (not just var(--font-family)) —
   the HyperFrames renderer's static analyzer doesn't expand CSS variables when
   resolving fonts, so a var-only chain triggers `font_family_without_font_face`
   lint and falls back to a generic. Use the concrete chain here; cards that
   want the theme font can still reference var(--font-family) internally. */
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000;
             font-family: 'Inter', 'Caveat', 'LXGW WenKai TC', ui-sans-serif, system-ui, sans-serif; }
#stage { position: relative; width: 100%; height: 100%; overflow: hidden; }

/* video-wrapper holds the source video. Its position / size are animated
   over time by the master timeline (one tween per layout transition). */
.video-wrapper {
  position: absolute;
  left: 0; top: 0; width: 1920px; height: 1080px;
  overflow: hidden;
  border-radius: 0;
  box-shadow: none;
}
.video-wrapper video { width: 100%; height: 100%; object-fit: cover; }

.card-host { position: absolute; pointer-events: none; overflow: hidden; }
.card-host .card { position: relative; width: 100%; height: 100%; overflow: hidden; }
.card-host .char { display: inline-block; visibility: visible; }

/* Subtle drop shadow + rounded corners for non-fullscreen video framings */
.video-wrapper.framed {
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.35);
}
</style>
</head>
<body>
<div
  id="stage"
  data-composition-id="interflow"
  data-start="0"
  data-duration="121.2"
  data-fps="30"
  data-width="1920"
  data-height="1080"
>
  <!-- Layer 1: source video — initial position matches card-01's layout -->
  <div class="video-wrapper" id="video-wrap">
    <video id="bg-video"
           src="input-video.mp4"
           muted playsinline
           data-start="0"
           data-duration="121.2"
           data-track-index="1"></video>
  </div>

  <!-- Layer 2: each card-host sits at the bounds dictated by its layout. -->
  <!-- IMPORTANT: every card-host MUST carry BOTH "card-host" and "clip" classes. -->
  <!--   - "card-host"  → our positioning + pointer-events styles                 -->
  <!--   - "clip"       → HyperFrames runtime uses this to enforce visibility     -->
  <!--                    only during data-start … data-start+data-duration.      -->
  <!--                    Without "clip" the host stays visible the whole video   -->
  <!--                    (lint: timed_element_missing_clip_class).               -->
  <!-- Example: card-01 with zone="fullscreen" → card-host covers (0,0,1920,1080) -->
  <div class="card-host clip"
       data-card-id="card-01"
       data-start="1.0000"
       data-duration="6.5000"
       data-track-index="2"
       style="left:0;top:0;width:1920px;height:1080px;visibility:hidden;opacity:0;">
    <!-- paste the contents of public/cards/card-01.html here -->
  </div>

  <!-- Example: card-02 with zone="side-panel" (split composition layout) → card on left half.
       data-start = card-01.endSec − SLIP (7.5 − 0.55 = 6.95) so the slips OVERLAP.
       data-track-index INCREASES per card (3 > 2) so the incoming card covers the
       outgoing one during the overlap. -->
  <div class="card-host clip"
       data-card-id="card-02"
       data-start="6.9500"
       data-duration="13.0500"
       data-track-index="3"
       style="left:0;top:0;width:960px;height:1080px;visibility:hidden;opacity:0;">
    <!-- card-02 HTML -->
  </div>

  <!-- ...one "card-host clip" per card with inline bounds matching resolveZoneBounds(card.zone).
       Each card's data-start = previous card's endSec − SLIP, and data-track-index
       increases by 1 every card (2, 3, 4, …) so overlapping slips layer correctly. -->

  <script src="vendor/gsap.min.js"></script>
  <script>
  (function(){
    // count-up formatter helper
    window.__fmt = function(v, fmt) {
      if (typeof fmt === 'string' && /^\.[0-9]+f$/.test(fmt)) {
        return Number(v).toFixed(Number(fmt.slice(1, -1)));
      }
      if (fmt === ',d') return Math.round(v).toLocaleString();
      return String(Math.round(v));
    };

    const tl = window.gsap.timeline({ paused: true });

    // ── Card lifecycle: SLIP transition + ambient drift (the silky default) ──
    // NOT fade-in/freeze/fade-out. Each card slips in from below (blur→0,
    // sink→0), drifts gently its whole life, then slips up+out — and the NEXT
    // card's slip-in OVERLAPS this slip-out by ~0.55s so there is never a hard
    // cut. Incoming card sits on a higher data-track-index so it covers the
    // outgoing one during the overlap. See "Motion Philosophy" above.
    //
    // const SLIP = 0.55;  // overlap window (0.45–0.7); also the slip duration knob
    // Example: card-01 [1.0, 7.5], card-02 enters at 7.5 − SLIP = 6.95 (overlap).

    // card-01 ENTER — slip up into place (expo.out), at startSec
    tl.set('.card-host[data-card-id="card-01"]', { visibility: 'visible' }, 1.0000);
    tl.fromTo('.card-host[data-card-id="card-01"]',
              { opacity: 0, y: 120, filter: 'blur(16px)', scale: 0.94 },
              { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, duration: 0.7000, ease: 'expo.out' },
              1.0000);

    // card-01 AMBIENT DRIFT — starts at startSec, keeps the frame alive.
    // FINITE repeat sized to the composition (repeat:-1 is forbidden — see checklist).
    // legSec=11; with compDurationSec e.g. 33 → Math.ceil(33/11)=3 → covers the film.
    tl.to('.card[data-card-id="card-01"] .root',
          { y: '+=10', duration: 11, ease: 'sine.inOut', repeat: Math.ceil(compDurationSec / 11), yoyo: true }, 1.0000);

    // card-01 internal anims (compile each data-anim-* declaration here; expo.out default)
    tl.from('.card[data-card-id="card-01"] #card-01-title .char',
            { opacity: 0, y: 8, scale: 0.9, duration: 0.5000, ease: 'expo.out', stagger: 0.0400 },
            1.3000);
    tl.fromTo('.card[data-card-id="card-01"] #card-01-line',
              { width: 0 }, { width: 420, duration: 0.5000, ease: 'expo.out' }, 1.6500);

    // card-01 EXIT — slip UP + blur + fade, starting at the OVERLAP point (endSec − SLIP),
    // so it leaves while card-02 is already arriving. ease power2.in.
    tl.to('.card-host[data-card-id="card-01"]',
          { opacity: 0, y: -90, filter: 'blur(10px)', duration: 0.5000, ease: 'power2.in' }, 6.9500);
    tl.set('.card-host[data-card-id="card-01"]', { visibility: 'hidden' }, 7.5000);

    // ── Video framing: move IN PHASE with the card slip ──
    // If card-02's layout differs, reframe #video-wrap at the SAME T and a
    // matching ease (power3.inOut) as the slip, so camera + card move as one.
    tl.set('#video-wrap', { className: 'video-wrapper framed' }, 6.9500);
    tl.to('#video-wrap',
          { left: 960, top: 0, width: 960, height: 1080,
            duration: 0.7, ease: 'power3.inOut' }, 6.9500);

    // card-02 ENTER — overlaps card-01's exit (same SLIP, higher track-index)
    tl.set('.card-host[data-card-id="card-02"]', { visibility: 'visible' }, 6.9500);
    tl.fromTo('.card-host[data-card-id="card-02"]',
              { opacity: 0, y: 120, filter: 'blur(16px)', scale: 0.94 },
              { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1, duration: 0.7, ease: 'expo.out' },
              6.9500);
    tl.to('.card[data-card-id="card-02"] .root',
          { y: '+=10', duration: 11, ease: 'sine.inOut', repeat: Math.ceil(compDurationSec / 11), yoyo: true }, 6.9500);
    // ...card-02 internal anims...

    // ── repeat for each card; the next card always enters at (this.endSec − SLIP).
    //    if the next card's layout differs, the #video-wrap tween rides the SAME T. ──

    window.__timelines = window.__timelines || {};
    window.__timelines["interflow"] = tl;
  })();
  </script>
</div>
</body>
</html>
```

#### GSAP Statement Cheat Sheet

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

#### Validate card timing BEFORE compiling (overlap is now intentional)

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

#### Video Framing Reference (per `layout` value)

The selector for the video container is `#video-wrap`. Animate its
bounds between cards using `tl.to('#video-wrap', { ...bounds }, T)`.
Initial bounds should be set inline on the element to match card-01's
layout. Pick a transition duration of 0.5–0.7s with `ease: 'power2.inOut'`.

**Decorative frames** (`clean` / `hairline` / `polaroid`) sit as a
**sibling** of `#video-wrap` and follow it through layout transitions.
See
[`references/frames/`](references/frames/) for each frame's placement
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

#### HyperFrames Layout / Animation QA Rules

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

#### Hard-won gotchas (read before assembling — these cost real debugging time)

- **Paint order = DOM order for non-timed elements.** `data-track-index` is not the whole story: a non-timed wrapper like `#video-wrap` stacks by its position in the DOM. If you want the source video as the **background**, write it **first** in `#stage`; if you want it as a **PiP that floats on top of fullscreen cards**, write `#video-wrap` **after** all the card-hosts. Symptom of getting this wrong: fullscreen cards "disappear" (the video paints over them) or the PiP hides behind a card.
- **Never nest a timed `<video data-start>` inside a wrapper that also has `data-start`.** Lint `video_nested_in_timed_element` → the video FREEZES in the render. Pattern: the wrapper is a plain positioned container (no timing), and the inner `<video>` carries `data-start` / `data-duration` / a unique `id`. Control the wrapper's visibility with GSAP instead.
- **Source video has no audio by default.** The base `<video>` template ships `muted`. To keep the narration/口播 in the output, remove `muted` and add `data-has-audio="true"` + `data-volume="1"` on that `<video>`. B-roll / silent inserts stay `muted` with `data-volume="0"`.
- **Phone-shot A-roll is usually rotated portrait.** Many `.MOV` files report `1920×1080` from `ffprobe -show_entries stream=width,height` but carry `rotation=-90` (check `ffprobe ... stream_side_data=rotation`) and actually DISPLAY as `1080×1920` portrait. A landscape PiP box + `object-fit: cover` then crops the portrait to a center band (just the face). Fix: bake the rotation (`ffmpeg -i in -vf "format=yuv420p" out` auto-rotates and strips the flag) and size the PiP box to the TRUE (portrait) aspect so the full subject shows.
- **Cutting clips: use `trim`/`atrim` + `concat`, not the `select` filter.** `select='not(between(t,…)+…)'` silently keeps everything in practice; a `trim`/`atrim`+`concat` filtergraph reliably removes ranges.
- **Re-encode slowed/`setpts` B-roll with dense keyframes** (`-g 30 -keyint_min 30`) or the renderer's seek lands on a stale keyframe and the clip freezes (lint warns about sparse keyframes).
- **Talking-head A-roll: don't speed up or cut the source while the face is on screen** — lip-sync breaks. Keep original speed + audio for any segment where the speaker is visible (PiP or full); do pacing fixes in scripting/recording, not post.
- **A PiP that must stay visible INTO the 2s outro needs a frozen tail.** Once the source `<video>` passes its `data-duration`, the element renders **transparent/blank** (not a held last frame) — so the PiP becomes an empty pill that lets the outro + corner marks show through (looks like a layout bug). If the speaker should remain on screen through the outro (e.g. "始终露脸" personas), freeze-extend the source first: `ffmpeg -i in -vf "tpad=stop_mode=clone:stop_duration=2.2" -af "apad=pad_dur=2.2" out`, then set the video's `data-duration` past the outro end so the PiP holds a real (frozen) face frame. Also drop the outro corner mark that sits under the PiP so they don't clash.

#### card-cta: Fixed GSAP Animation Block

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
npx hyperframes snapshot public --at 5   # writes public/snapshots/frame-…png
```

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
npx hyperframes snapshot public --at 5 --out snapshot-5s.png
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
