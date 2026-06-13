#!/usr/bin/env python3
"""
auto-style.py — 读源视频的「明暗 + 冷暖」，自动推荐匹配的卡片视觉风格。

机制（零重依赖，只用 ffmpeg + 标准库）：
  对视频均匀抽样 N 帧，每帧用 `ffmpeg -vf scale=1:1` 直接降到 1×1 像素 ——
  那个像素就是该帧的平均色。汇总求均值，得到整片的 (R,G,B)。
  亮度 luminance = 0.2126R + 0.7152G + 0.0722B  (0–255)
  冷暖 warmth    = R − B                          (>0 暖 / <0 冷)
  饱和 saturation= (max−min)/max
  → 分类 mode(light|dark) × temp(warm|cool|neutral) → 推荐风格。

用法：
  python3 auto-style.py <video_or_image> [--frames 9] [--json]
输出（默认人类可读；--json 输出机器可解析）：
  { luminance, warmth, saturation, mode, temp, recommend:[styles], note }

接进 SKILL.md Step 7.0：把 recommend[0] 作为默认 style（仍可被用户覆盖）。
"""
import json, subprocess, sys, struct

# 风格分桶（与现存 11 个风格一致；按明暗×冷暖给主选 + 备选）
# dark 组: nebula-glass(冷·粒子) / glass(冷·玻璃拟态) / glass-hud(暖·口播玻璃叠加) / spatial(暖) / geom(撞色) / terminal(绿·技术)
# light 组: swiss(纯白·最干净) / minimal(黑白) / pastel-aura(冷柔浅色) / editorial-print(暖纸·montage)
RECO = {
    ("dark",  "cool"):    ["nebula-glass", "glass", "geom"],
    ("dark",  "warm"):    ["spatial", "glass-hud", "nebula-glass"],
    ("dark",  "neutral"): ["glass-hud", "nebula-glass", "glass"],
    ("light", "cool"):    ["swiss", "pastel-aura", "minimal"],
    ("light", "warm"):    ["pastel-aura", "editorial-print", "swiss"],
    ("light", "neutral"): ["swiss", "minimal", "pastel-aura"],
}

# 中文风格词库（与 DESIGN_INDEX.md「中文风格词库」一致）—— 让推荐也是中文
CN_NAME = {
    "nebula-glass": "暗夜星河", "glass": "玻璃拟态", "glass-hud": "暖玻 HUD", "spatial": "暖光太空",
    "geom": "撞色大字", "swiss": "瑞士网格",
    "minimal": "黑白极简", "terminal": "代码终端", "pastel-aura": "柔光浅色",
    "editorial-print": "杂志印刷",
}

def ffprobe_duration(path):
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", path],
            capture_output=True, text=True, timeout=30)
        return float(out.stdout.strip())
    except Exception:
        return 0.0

def avg_rgb_at(path, t):
    """单帧平均色：scale=1:1 → 1 像素 rgb24。"""
    cmd = ["ffmpeg", "-v", "error"]
    if t is not None:
        cmd += ["-ss", f"{t:.3f}"]
    cmd += ["-i", path, "-frames:v", "1", "-vf", "scale=1:1",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    try:
        out = subprocess.run(cmd, capture_output=True, timeout=60).stdout
        if len(out) >= 3:
            return (out[0], out[1], out[2])
    except Exception:
        pass
    return None

def analyze(path, frames=9):
    dur = ffprobe_duration(path)
    samples = []
    if dur and dur > 0.2:
        # 避开首尾黑场，取 [5%, 95%] 区间均匀抽样
        for i in range(frames):
            t = dur * (0.05 + 0.90 * (i / max(1, frames - 1)))
            px = avg_rgb_at(path, t)
            if px:
                samples.append(px)
    else:
        px = avg_rgb_at(path, None)        # 图片或拿不到时长 → 单帧
        if px:
            samples.append(px)
    if not samples:
        raise SystemExit("auto-style: 无法从输入读取像素（ffmpeg 失败？）")

    n = len(samples)
    R = sum(s[0] for s in samples) / n
    G = sum(s[1] for s in samples) / n
    B = sum(s[2] for s in samples) / n
    lum = 0.2126 * R + 0.7152 * G + 0.0722 * B
    warmth = R - B
    mx, mn = max(R, G, B), min(R, G, B)
    sat = 0.0 if mx == 0 else (mx - mn) / mx

    # 明暗：双阈值，中间地带按更近的一侧归类
    mode = "dark" if lum < 110 else "light"
    # 冷暖：低饱和直接判 neutral，避免灰场误判
    if sat < 0.12:
        temp = "neutral"
    elif warmth > 10:
        temp = "warm"
    elif warmth < -10:
        temp = "cool"
    else:
        temp = "neutral"

    reco = RECO[(mode, temp)]
    reco_cn = [CN_NAME.get(k, k) for k in reco]
    mode_cn = "亮（白天）" if mode == "light" else "暗（黑夜）"
    temp_cn = {"warm": "暖", "cool": "冷", "neutral": "中性"}[temp]
    note = (f"采样 {n} 帧 · 平均 RGB=({R:.0f},{G:.0f},{B:.0f}) · "
            f"亮度 {lum:.0f}/255 → {mode_cn} · 冷暖 {warmth:+.0f}(sat {sat:.2f}) → {temp_cn}")
    return {
        "luminance": round(lum, 1),
        "warmth": round(warmth, 1),
        "saturation": round(sat, 3),
        "rgb": [round(R), round(G), round(B)],
        "mode": mode,
        "temp": temp,
        "recommend": reco,
        "recommend_cn": reco_cn,
        "note": note,
    }

def main():
    args = sys.argv[1:]
    if not args:
        raise SystemExit("用法: python3 auto-style.py <video_or_image> [--frames 9] [--json]")
    as_json = "--json" in args
    args = [a for a in args if a != "--json"]
    frames = 9
    if "--frames" in args:
        i = args.index("--frames"); frames = int(args[i + 1]); del args[i:i + 2]
    path = args[0]
    res = analyze(path, frames)
    if as_json:
        print(json.dumps(res, ensure_ascii=False))
    else:
        print(res["note"])
        cn, en = res["recommend_cn"], res["recommend"]
        print(f"→ 推荐风格: {cn[0]}（{en[0]}）  "
              f"备选: {cn[1]}（{en[1]}）、{cn[2]}（{en[2]}）")

if __name__ == "__main__":
    main()
