/*
  curve-atmosphere.js — 数学曲线氛围底 for interflow-video-cut
  ─────────────────────────────────────────────────────────────────────
  把 math-curve-loaders (github.com/paidax01/math-curve-loaders) 的曲线
  忠实移植成 **时间的闭式函数 draw(t)**，可直接塞进 interflow 的 composition
  index.html，由 GSAP 主时间轴 onUpdate 驱动 —— 满足 HyperFrames 的确定性
  seek 捕获（不做逐帧累积、不碰 Date.now()/Math.random()/rAF 内部状态）。

  原项目用 requestAnimationFrame 实时循环 + 逐帧累积粒子轨迹，那套在
  interflow 的 seek 渲染里会静止/错乱。这里全部重写成 pos = f(param, t)。

  用法（两种 driver，draw(t) 完全相同）：
    · 浏览器预览：requestAnimationFrame 喂 t = elapsedSeconds（见 preview.html）
    · interflow 出片：GSAP 时间轴 onUpdate 喂 t = timeline.time()（见 RECIPE.md）

  曲线（curve key）：
    rose / lissajous / lemniscate / hypotrochoid / cardioid / heart /
    fourier / butterfly
*/

(function (root) {
  'use strict';

  var TAU = Math.PI * 2;

  // ── 曲线参数方程（归一化到约 [-1,1]，中心在原点）──────────────────
  // 每个 curve: { name, period, point(u, s) → [x,y] }
  //   u ∈ [0,1] 沿曲线的参数；s = 呼吸缩放 (0.5–1)，调制振幅/细节
  //   period = 画一整条曲线需要的 u 圈数（butterfly 这种要多圈）
  var CURVES = {
    rose: {
      name: '玫瑰曲线 Rose',
      k: 5,                       // 花瓣数（奇数 k 瓣，偶数 2k 瓣）
      point: function (u, s) {
        var t = u * TAU;
        var r = Math.cos(this.k * t) * (0.55 + 0.45 * s);
        return [Math.cos(t) * r, Math.sin(t) * r];
      }
    },

    lissajous: {
      name: '李萨茹 Lissajous',
      a: 3, b: 2, delta: Math.PI / 2,
      point: function (u, s) {
        var t = u * TAU;
        var amp = 0.62 + 0.30 * s;
        return [Math.sin(this.a * t + this.delta) * amp,
                Math.sin(this.b * t) * amp * 0.92];
      }
    },

    lemniscate: {                 // 伯努利双纽线（呼吸的无穷符号）
      name: '双纽线 Lemniscate',
      point: function (u, s) {
        var t = u * TAU;
        var a = 0.95 * (0.6 + 0.4 * s);
        var d = 1 + Math.sin(t) * Math.sin(t);
        return [a * Math.cos(t) / d, a * Math.sin(t) * Math.cos(t) / d];
      }
    },

    hypotrochoid: {               // 内旋轮线（spirograph）
      name: '内旋轮线 Hypotrochoid',
      R: 5, r: 3, d: 5,
      point: function (u, s) {
        var t = u * TAU;          // r=3,R=5 → 周期 = lcm/r 圈，取 3 圈闭合
        var R = this.R, r = this.r, d = this.d * (0.7 + 0.3 * s);
        var k = (R - r) / r;
        var x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
        var y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
        return [x / 7, y / 7];
      }
    },

    cardioid: {                   // 心脏线（极坐标）
      name: '心脏线 Cardioid',
      point: function (u, s) {
        var t = u * TAU;
        var r = (1 - Math.cos(t)) * 0.5 * (0.7 + 0.3 * s);
        return [Math.cos(t) * r, Math.sin(t) * r + 0.25];
      }
    },

    heart: {                      // 经典心形参数方程（更"像心"）
      name: '心形线 Heart',
      point: function (u, s) {
        var t = u * TAU;
        var amp = 0.6 + 0.4 * s;
        var x = 16 * Math.pow(Math.sin(t), 3);
        var y = 13 * Math.cos(t) - 5 * Math.cos(2 * t)
                - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        return [(x / 17) * amp, -(y / 17) * amp];
      }
    },

    fourier: {                    // 谐波叠加（持续变形的有机曲线）
      name: '傅里叶流 Fourier',
      point: function (u, s) {
        var t = u * TAU, m = s * 1.4;
        var x = 0.62 * Math.cos(t) + 0.20 * Math.cos(3 * t + m)
                + 0.12 * Math.sin(5 * t - m * 0.7);
        var y = 0.62 * Math.sin(t) + 0.16 * Math.sin(2 * t + m)
                - 0.10 * Math.cos(4 * t - m);
        return [x, y];
      }
    },

    butterfly: {                  // 蝴蝶曲线（Fay 1989）
      name: '蝴蝶曲线 Butterfly',
      turns: 12,                  // 需 t ∈ [0, 12π] 才完整
      point: function (u, s) {
        var t = u * this.turns * Math.PI;
        var e = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t)
                - Math.pow(Math.sin(t / 12), 5);
        var amp = (0.62 + 0.38 * s) / 3.6;
        return [Math.sin(t) * e * amp, -Math.cos(t) * e * amp];
      }
    }
  };

  // ── 确定性氛围渲染器 ─────────────────────────────────────────────
  // makeCurveAtmosphere(canvas, opts) → { draw(t), curveKeys }
  //   opts:
  //     curve      曲线 key（默认 'rose'）
  //     accent     发光主色 '#rrggbb' 或 [r,g,b]（默认电光蓝）
  //     bg         背景填充（默认 'transparent' = 不铺底，叠在 #stage 上）
  //     opacity    整体不透明度（默认 0.5 —— 氛围底要克制，别抢人脸）
  //     scale      曲线占画面比例（默认 0.34 × min(W,H)）
  //     drawPeriod 彗星跑完一圈的秒数（默认 9）
  //     rotPeriod  整条曲线慢旋一圈的秒数（默认 48，0 = 不旋转）
  //     pulsePeriod呼吸周期秒数（默认 7）
  //     trailFrac  彗星拖尾占整条曲线的比例（默认 0.4）
  //     particles  拖尾粒子数（默认 90）
  //     ghost      底层静态曲线描边的透明度（默认 0.1，0 = 不画底线）
  //     lineWidth  彗星线宽 px（默认 4）
  function makeCurveAtmosphere(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var curve = CURVES[opts.curve || 'rose'];
    var rgb = toRGB(opts.accent || '#5B8CFF');
    var bg = opts.bg || 'transparent';
    var alpha = opts.opacity != null ? opts.opacity : 0.5;
    var scale = (opts.scale != null ? opts.scale : 0.34) * Math.min(W, H);
    var drawPeriod = opts.drawPeriod || 9;
    var rotPeriod = opts.rotPeriod != null ? opts.rotPeriod : 48;
    var pulsePeriod = opts.pulsePeriod || 7;
    var trailFrac = opts.trailFrac != null ? opts.trailFrac : 0.4;
    var particles = opts.particles || 90;
    var ghost = opts.ghost != null ? opts.ghost : 0.1;
    var lineWidth = opts.lineWidth || 4;
    var cx = W / 2, cy = H / 2;

    // 闭式呼吸 s(t) ∈ [0.52,1]（对应原项目的 detailScale）
    function breath(t) {
      var p = (t % pulsePeriod) / pulsePeriod;
      return 0.52 + 0.48 * (Math.sin(p * TAU + 0.55) + 1) / 2;
    }
    function rot(t) {
      return rotPeriod ? -((t % rotPeriod) / rotPeriod) * TAU : 0;
    }
    // 归一化坐标 → 画布坐标（含旋转）
    function map(pt, ca, sa) {
      var x = pt[0] * scale, y = pt[1] * scale;
      return [cx + x * ca - y * sa, cy + x * sa + y * ca];
    }

    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      if (bg !== 'transparent') { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); }

      var s = breath(t), ang = rot(t), ca = Math.cos(ang), sa = Math.sin(ang);
      ctx.globalCompositeOperation = 'lighter';   // 发光叠加
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      // 1) 底层静态曲线描边（faint ghost）—— 让形状始终隐约可见
      if (ghost > 0) {
        ctx.globalAlpha = ghost * alpha;
        ctx.strokeStyle = rgbaStr(rgb, 1);
        ctx.lineWidth = lineWidth * 0.5;
        ctx.beginPath();
        var STEPS = 360;
        for (var i = 0; i <= STEPS; i++) {
          var p = map(curve.point(i / STEPS, s), ca, sa);
          if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }

      // 2) 彗星拖尾 —— head 在 progress，沿曲线往回 trailFrac 衰减
      var progress = (t % drawPeriod) / drawPeriod;
      for (var j = 0; j < particles; j++) {
        var tail = j / particles;                  // 0 = head, 1 = tail end
        var u = progress - tail * trailFrac;
        u = u - Math.floor(u);                      // wrap to [0,1)
        var pos = map(curve.point(u, s), ca, sa);
        var fade = Math.pow(1 - tail, 0.56);        // 幂律衰减（原项目同款）
        ctx.globalAlpha = fade * alpha;
        ctx.fillStyle = rgbaStr(rgb, 1);
        var rad = (lineWidth * 0.6) * (0.4 + 0.6 * fade);
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], rad, 0, TAU);
        ctx.fill();
      }

      // 3) 彗星头部光晕
      var headPos = map(curve.point(progress, s), ca, sa);
      var grad = ctx.createRadialGradient(headPos[0], headPos[1], 0,
                                          headPos[0], headPos[1], lineWidth * 6);
      grad.addColorStop(0, rgbaStr(rgb, 0.9 * alpha));
      grad.addColorStop(1, rgbaStr(rgb, 0));
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(headPos[0], headPos[1], lineWidth * 6, 0, TAU);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    return { draw: draw, curve: curve.name };
  }

  // ── helpers ──────────────────────────────────────────────────────
  function toRGB(c) {
    if (Array.isArray(c)) return c;
    var h = c.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16),
            parseInt(h.slice(4, 6), 16)];
  }
  function rgbaStr(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  }

  // ── 复用同一套曲线数学的 helper（给排版 / 图片 demo 用）───────────
  // 把归一化曲线点映射进一个 [0,size] 的方框（pad = 边距）
  function mapBox(pt, size, pad, ca, sa) {
    var R = (size / 2) - pad, cx = size / 2, cy = size / 2;
    var x = pt[0] * R, y = pt[1] * R;
    return [cx + x * ca - y * sa, cy + x * sa + y * ca];
  }

  // 采样曲线为像素点数组（用于「元素落在采样点上」的排版骨架）
  //   opts: { n=200, size=100, pad=6, s=1, rot=0 }
  function sampleCurve(key, opts) {
    opts = opts || {};
    var c = CURVES[key]; if (!c) return [];
    var n = opts.n || 200, size = opts.size || 100, pad = opts.pad || 6;
    var s = opts.s != null ? opts.s : 1, rot = opts.rot || 0;
    var ca = Math.cos(rot), sa = Math.sin(rot), out = [];
    for (var i = 0; i < n; i++) out.push(mapBox(c.point(i / n, s), size, pad, ca, sa));
    return out;
  }

  // 生成 SVG path 字符串（用于 textPath 排字 / clip-path 剪影 / 下划线）
  //   opts: { steps=240, size=100, pad=6, s=1, rot=0, closed=false }
  function curvePath(key, opts) {
    opts = opts || {};
    var c = CURVES[key]; if (!c) return '';
    var steps = opts.steps || 240, size = opts.size || 100, pad = opts.pad || 6;
    var s = opts.s != null ? opts.s : 1, rot = opts.rot || 0;
    var ca = Math.cos(rot), sa = Math.sin(rot), d = '';
    for (var i = 0; i <= steps; i++) {
      var p = mapBox(c.point(i / steps, s), size, pad, ca, sa);
      d += (i === 0 ? 'M' : 'L') + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + ' ';
    }
    return d + (opts.closed ? 'Z' : '');
  }

  var api = { CURVES: CURVES, makeCurveAtmosphere: makeCurveAtmosphere,
              sampleCurve: sampleCurve, curvePath: curvePath,
              curveKeys: Object.keys(CURVES) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CurveAtmosphere = api;
})(typeof window !== 'undefined' ? window : this);
