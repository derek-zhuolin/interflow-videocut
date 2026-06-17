/*
  curve-motion.js — 丝滑曲线动效组件 for interflow-video-cut
  ─────────────────────────────────────────────────────────────────────
  把曲线数学用作「元素怎么运动」的轨迹。两个克制的组件：
    · CurveMotion.curveIn(tl, sel, t0, dur, opts) —— 沿曲线一小段弧滑入并落位（入场）
    · CurveMotion.curveBob(tl, sel, opts)         —— 落定后沿曲线轻微漂移跳动（ambient）

  全部是 **时间的闭式函数 + 主时间轴驱动**（用 GSAP proxy 补间的 onUpdate 写
  transform），满足 HyperFrames 确定性 seek —— 不碰 requestAnimationFrame /
  Date.now() / Math.random()。复用 curve-atmosphere.js 里的同一套 point(u)。

  设计原则（呼应 card-contract.md 的 motion 守则）：克制、丝滑、非炫技。
  振幅小、缓动重（power3 / sine）、ambient 永远比说话人安静。

  依赖：先引 gsap 和 curve-atmosphere.js，再引本文件。
*/
(function (root) {
  'use strict';
  var CA = root.CurveAtmosphere;
  if (!CA) { console.warn('curve-motion: 需要先加载 curve-atmosphere.js'); }

  // 归一化曲线点 → 像素位移（振幅 amp，单位 px）
  function cp(key, u, amp) {
    var p = CA.CURVES[key].point(u, 1);
    return [p[0] * amp, p[1] * amp];
  }

  // ── 1) curveIn —— 沿曲线弧线滑入，落点 = 元素 CSS 原位 ─────────────
  //   tl   master timeline
  //   sel  选择器或元素（gsap 接受的任意 target）
  //   t0   绝对入场时间（秒）
  //   dur  入场时长（秒，默认 0.9）
  //   opts {
  //     curve   曲线 key（默认 'lissajous' —— 开放流畅，弧线最顺）
  //     seg     走曲线的一段长度 0–1（默认 0.22，越小弧越短越含蓄）
  //     from    起始参数 u0（默认 0.12，换它换入场方向）
  //     amp     弧的幅度 px（默认 64）
  //     ease    缓动（默认 'power3.out' —— 丝滑落定不回弹）
  //     fade    是否同时淡入（默认 true）
  //     rise    额外的纵向微起（px，默认 0；想要"托起来"的感觉给 18）
  //   }
  function curveIn(tl, sel, t0, dur, opts) {
    opts = opts || {}; dur = dur || 0.9;
    var key = opts.curve || 'lissajous',
        seg = opts.seg != null ? opts.seg : 0.22,
        u0  = opts.from != null ? opts.from : 0.12,
        amp = opts.amp || 64,
        ease = opts.ease || 'power3.out',
        rise = opts.rise || 0;
    var end = cp(key, u0 + seg, amp);           // 落位前最后一点 → 用它归零
    var pr = { p: 0 };
    if (opts.fade !== false) gsap.set(sel, { opacity: 0 });
    tl.to(pr, {
      p: 1, duration: dur, ease: ease,
      onUpdate: function () {
        var pt = cp(key, u0 + seg * pr.p, amp);
        gsap.set(sel, {
          x: pt[0] - end[0],
          y: pt[1] - end[1] + rise * (1 - pr.p)
        });
      }
    }, t0);
    if (opts.fade !== false)
      tl.to(sel, { opacity: 1, duration: Math.min(dur * 0.6, 0.5), ease: 'power2.out' }, t0);
    return tl;
  }

  // ── 2) curveBob —— 落定后沿曲线轻微漂移（ambient，永不抢戏）──────────
  //   opts {
  //     curve    曲线 key（默认 'lemniscate' —— 8 字漂移最自然）
  //     amp      漂移幅度 px（默认 9；务必 ≤12，墙纸不是演员）
  //     period   来回一程秒数（默认 9；越大越静）
  //     span     沿曲线漂多长一段 0–1（默认 1 = 整圈，小段更含蓄）
  //     from     起点参数（默认 0）
  //     at       何时开始（绝对秒，默认 0）
  //     compDur  composition 总时长（秒）—— 用于算 finite repeat（必填，禁 repeat:-1）
  //   }
  function curveBob(tl, sel, opts) {
    opts = opts || {};
    var key = opts.curve || 'lemniscate',
        amp = Math.min(opts.amp || 9, 12),
        period = opts.period || 9,
        span = opts.span != null ? opts.span : 1,
        base = opts.from || 0,
        at = opts.at || 0,
        compDur = opts.compDur || (tl.duration ? tl.duration() : 30);
    var home = cp(key, base, amp);
    var legs = Math.max(1, Math.ceil(compDur / period));   // finite repeat（确定性引擎要求）
    var pr = { p: 0 };
    tl.to(pr, {
      p: 1, duration: period, ease: 'sine.inOut', yoyo: true, repeat: legs,
      onUpdate: function () {
        var pt = cp(key, base + span * pr.p, amp);
        gsap.set(sel, { x: pt[0] - home[0], y: pt[1] - home[1] });
      }
    }, at);
    return tl;
  }

  root.CurveMotion = { curveIn: curveIn, curveBob: curveBob };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CurveMotion;
})(typeof window !== 'undefined' ? window : this);
