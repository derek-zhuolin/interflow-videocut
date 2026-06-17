#!/usr/bin/env python3
"""
Regression tests for build-timeline.py. stdlib only.

Run:  python3 scripts/test-build-timeline.py
Locks the hard-won invariants + the four review fixes (A drift, B timing
validation, C single-quote attrs, D custom videoClass).
"""

import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stderr

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(HERE)
SHELL = os.path.join(SKILL_DIR, "references", "composition-shell.html")

# load the hyphenated module by path
_spec = importlib.util.spec_from_file_location("bt", os.path.join(HERE, "build-timeline.py"))
bt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bt)


def make_work(cards, fragments):
    d = tempfile.mkdtemp()
    work = os.path.join(d, "work")
    os.makedirs(os.path.join(work, "public", "cards"))
    with open(SHELL) as f:
        shell = f.read()
    with open(os.path.join(work, "public", "index.html"), "w") as f:
        f.write(shell)
    sb = {
        "schemaVersion": 3,
        "composition": {"fps": 30, "width": 1080, "height": 1920,
                        "durationSeconds": 30.0, "layout": "portrait", "themeId": "noir"},
        "cards": cards,
    }
    with open(os.path.join(work, "storyboard.json"), "w") as f:
        json.dump(sb, f)
    for cid, html in fragments.items():
        with open(os.path.join(work, "public", "cards", f"{cid}.html"), "w") as f:
            f.write(html)
    return work


def out_of(work):
    with open(os.path.join(work, "public", "index.html")) as f:
        return f.read()


class TestUnits(unittest.TestCase):
    def test_zone_bounds_portrait_lower_third(self):
        self.assertEqual(bt.zone_bounds("lower-third", 1080, 1920), (0, 1344, 1080, 576))

    def test_zone_bounds_fullscreen(self):
        self.assertEqual(bt.zone_bounds("fullscreen", 1080, 1920), (0, 0, 1080, 1920))

    def test_quantize(self):
        self.assertEqual(bt.q(7.45, 30), 7.4667)  # snaps to frame grid

    def test_single_quote_attrs_extracted(self):  # Fix C
        html = "<h1 id='t' data-anim='kinetic-chars' data-anim-at='0.3'>x</h1>"
        anims = bt.extract_anims(html)
        self.assertEqual(len(anims), 1)
        self.assertEqual(anims[0]["data-anim"], "kinetic-chars")
        self.assertEqual(anims[0]["id"], "t")

    def test_anim_without_id_skipped(self):
        html = '<div data-anim="settle"></div>'
        self.assertEqual(bt.extract_anims(html), [])

    def test_drift_compiles_to_loop_not_settle(self):  # Fix A
        a = {"id": "blob", "data-anim": "drift", "data-anim-amp": "12"}
        stmt = bt.compile_anim("card-01", a, 30, 30.0)
        self.assertIn("y: '+=12'", stmt)
        self.assertIn("yoyo: true", stmt)
        self.assertNotIn("blur(6px)", stmt)  # i.e. NOT the settle fallback

    def test_drift_rotate_axis(self):
        a = {"id": "blob", "data-anim": "drift", "data-anim-axis": "rotate"}
        self.assertIn("rotation: '+=0.6'", bt.compile_anim("c", a, 30, 30.0))

    def test_unknown_kind_falls_back_to_settle(self):
        a = {"id": "x", "data-anim": "totally-made-up"}
        self.assertIn("blur(6px)", bt.compile_anim("c", a, 30, 30.0))


class TestGen(unittest.TestCase):
    def setUp(self):
        self.cards = [
            {"id": "card-01", "startSec": 1.0, "endSec": 8.0, "accentIndex": 0, "zone": "fullscreen"},
            {"id": "card-02", "startSec": 7.45, "endSec": 17.0, "accentIndex": 1, "zone": "lower-third",
             "videoBounds": {"left": 0, "top": 0, "width": 1080, "height": 844},
             "videoClass": "video-wrapper pip"},  # Fix D
        ]
        self.frags = {
            "card-01": '<div class="card" data-card-id="card-01"><div class="root">'
                       '<h1 id="card-01-title" data-anim="kinetic-chars" data-anim-at="0.3"><span class="char">x</span></h1>'
                       '<div id="card-01-blob" data-anim="drift" data-anim-amp="8"></div></div></div>',
            "card-02": "<div class=\"card\" data-card-id=\"card-02\"><div class=\"root\">"
                       "<p id='card-02-body' data-anim='settle' data-anim-at='0.4'></p></div></div>",
        }

    def run_gen(self):
        work = make_work(self.cards, self.frags)
        with redirect_stderr(io.StringIO()):
            bt.gen(work, 0.55)
        return work, out_of(work)

    def test_track_index_increases(self):
        _, html = self.run_gen()
        self.assertIn('data-track-index="2"', html)
        self.assertIn('data-track-index="3"', html)

    def test_no_infinite_repeats(self):
        _, html = self.run_gen()
        self.assertNotIn("repeat: -1", html)
        self.assertNotIn("repeat:-1", html)

    def test_drift_in_output(self):  # Fix A end-to-end
        _, html = self.run_gen()
        self.assertIn("y: '+=8'", html)

    def test_single_quote_card_compiled(self):  # Fix C end-to-end
        _, html = self.run_gen()
        self.assertIn('#card-02-body', html)

    def test_custom_video_class(self):  # Fix D end-to-end
        _, html = self.run_gen()
        self.assertIn("className: 'video-wrapper pip'", html)

    def test_slip_overlap_quantized(self):
        _, html = self.run_gen()
        # card-02 enters at 7.45 → quantized 7.4667
        self.assertIn("7.4667", html)

    def test_idempotent(self):
        work = make_work(self.cards, self.frags)
        with redirect_stderr(io.StringIO()):
            bt.gen(work, 0.55)
            first = out_of(work)
            bt.gen(work, 0.55)
            second = out_of(work)
        self.assertEqual(first, second)


class TestMotionVariety(unittest.TestCase):
    """Seeded per-card motion: varied between cards, reproducible per seed."""

    frags = {f"card-0{i}": f'<div class="card" data-card-id="card-0{i}">'
                           f'<div class="root"><h1>{i}</h1></div></div>' for i in range(1, 4)}
    cards = [
        {"id": "card-01", "startSec": 1.0, "endSec": 11.0, "zone": "fullscreen"},
        {"id": "card-02", "startSec": 10.45, "endSec": 20.0, "zone": "fullscreen"},
        {"id": "card-03", "startSec": 19.45, "endSec": 29.0, "zone": "fullscreen"},
    ]

    def _gen(self, seed):
        work = make_work(self.cards, self.frags)
        sbp = os.path.join(work, "storyboard.json")
        with open(sbp) as f:
            sb = json.load(f)
        sb["composition"]["seed"] = seed
        with open(sbp, "w") as f:
            json.dump(sb, f)
        with redirect_stderr(io.StringIO()):
            bt.gen(work, 0.55)
        return out_of(work)

    def test_adjacent_cards_enter_differently(self):
        html = self._gen(0)
        # card-01 → gesture[0] (y:120), card-02 → gesture[1] (y:-110): not identical
        self.assertIn('data-card-id="card-01"]\', { opacity: 0, y: 120', html)
        self.assertIn('data-card-id="card-02"]\', { opacity: 0, y: -110', html)

    def test_same_seed_is_byte_identical(self):
        self.assertEqual(self._gen(7), self._gen(7))

    def test_different_seed_reshuffles(self):
        # seed 1 shifts every card's gesture by one → card-01 now uses gesture[1]
        self.assertIn('data-card-id="card-01"]\', { opacity: 0, y: -110', self._gen(1))

    def test_all_gestures_land_on_clean_rest_state(self):
        html = self._gen(2)
        # every enter must reset x AND y so a sideways gesture lands square
        for line in html.splitlines():
            if "tl.fromTo('.card-host" in line and "opacity: 1" in line:
                self.assertIn("x: 0, y: 0", line)


class TestValidation(unittest.TestCase):
    def test_short_card_warns(self):  # Fix B
        cards = [
            {"id": "card-01", "startSec": 1.0, "endSec": 1.3, "zone": "fullscreen"},  # 0.3s < 0.6
            {"id": "card-02", "startSec": 0.75, "endSec": 5.0, "zone": "fullscreen"},
        ]
        buf = io.StringIO()
        with redirect_stderr(buf):
            bt._validate_timing(cards, 0.55)
        err = buf.getvalue()
        self.assertIn("card-01", err)
        self.assertIn("flash", err)

    def test_clean_timing_no_warn(self):
        cards = [
            {"id": "card-01", "startSec": 1.0, "endSec": 8.0, "zone": "fullscreen"},
            {"id": "card-02", "startSec": 7.45, "endSec": 17.0, "zone": "fullscreen"},
        ]
        buf = io.StringIO()
        with redirect_stderr(buf):
            bt._validate_timing(cards, 0.55)
        self.assertEqual(buf.getvalue(), "")


if __name__ == "__main__":
    unittest.main(verbosity=2)
