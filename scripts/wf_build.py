#!/usr/bin/env python3
"""표본외(2017~2021)·연도별 성적표 생성 — scripts/wf_src.js → scripts/wfdata.js

엔진(engine.js)과 계좌 엔진(acct.js)을 **헤드리스 Chromium 안에서 그대로 실행**해 만든다.
(따라서 화면의 계좌 카드와 같은 함수·같은 규칙으로 계산된다. 임의 추정 없음)

    python3 scripts/wf_extract.py     # 10년 raw → wf_src.js
    python3 scripts/wf_build.py       # wf_src.js → wfdata.js

창(Window) = ① 각 해(2017~2026) ② 블록(2017~2021 표본외 · 2022 폭락장 · 2022~2026 최근 5년)
각 창은 그 해 첫 거래일부터, 앞 250봉(acct.js C.warm)으로 계좌를 미리 굴린 뒤 그 구간만 측정한다.
벤치(QQQ·SPY)는 계좌와 같은 진입 시점(창 첫날 시가)에서 출발한다.
"""
import asyncio
import json
import os
import re
import sys

os.environ.setdefault('LD_LIBRARY_PATH', '/workspace/.libs/chromium')
from playwright.async_api import async_playwright  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'wfdata.js')


def market_meta():
    """data.js 의 tickers(티커·이름·시총순위·섹터)만 뽑는다 — 유니버스 정의를 화면과 같게."""
    s = open(os.path.join(HERE, 'data.js'), encoding='utf-8').read()
    m = re.search(r'"tickers":(\[.*?\])\s*,\s*"(?:macro|fearGreed|series)', s, re.S)
    if not m:
        m = re.search(r'"tickers":(\[.*?\])', s, re.S)
    arr = json.loads(m.group(1))
    return [{'t': x['t'], 'n': x.get('n', ''), 'r': x.get('r'), 'sk': x.get('sk') or x.get('nk') or '기타'} for x in arr]


HARNESS = r"""
window.__wfCompute = function () {
  window.__wfErr = window.__wfErr || [];
  var D = window.WFRAW.dates, S = window.WFRAW.series, META = window.WF_META;
  var C = window.QE_ACCT.C;
  var Q = S['QQQ'], Y = S['SPY'];
  function smaArr(c, p) { return QE.sma(c, p); }
  /* 패닉일 — 추세 100일선 · 스윙 200일선 (화면과 같은 정의) */
  function panicMap(maP) {
    var off = Q.off, c = Q.c, ma = QE.sma(c, maP), r2 = QE.rsi(c, 2);
    var m = new Array(D.length).fill(false);
    for (var i = 0; i < c.length; i++) {
      if (ma[i] == null || r2[i] == null) continue;
      m[off + i] = (c[i] < ma[i] && r2[i] < 5);
    }
    return m;
  }
  var PANIC = { trend: panicMap(100), swing: panicMap(200) };
  var UNIV = { trend: META.filter(function (x) { return x.r == null || x.r <= 100; }),
               swing: META.filter(function (x) { return x.r == null || x.r <= 150; }) };
  var SLOTS = { conc1: { n: 1, cap: 0 }, div3: { n: 3, cap: 1 }, div10: { n: 10, cap: 3 } };
  var PROFILES = ['safe', 'aggr'], MODES = ['trend', 'swing'];

  function yearRange(y) {
    var i0 = -1, i1 = -1;
    for (var i = 0; i < D.length; i++) {
      if (D[i].slice(0, 4) === String(y)) { if (i0 < 0) i0 = i; i1 = i; }
    }
    return i0 < 0 ? null : [i0, i1];
  }
  function windowDef(i0, i1) {
    var bars = i1 - i0 + 1, warm = Math.min(C.warm, i0), rot = {};
    PROFILES.forEach(function (pf) {
      MODES.forEach(function (md) {
        var opts = QE.riskOpts(pf) || {};
        var rows = [];
        UNIV[md].forEach(function (x) {
          var s0 = S[x.t]; if (!s0) return;
          /* ⚠️ 시리즈는 off(상장 전 결측)에서 시작한다 — 창 끝을 **off 기준 인덱스**로 잘라야
             창 밖 미래 봉이 들어오지 않는다(2026-11-28 수정: i1+1 그대로 쓰면 off>0 종목에서
             거래 인덱스가 off 만큼 밀려 계좌 체결이 어긋났다 — 2015년 달력을 쓰면서 드러남). */
          var end = i1 + 1 - (s0.off || 0);
          var co = s0.o.slice(0, end), ch = s0.h.slice(0, end),
              cl = s0.l.slice(0, end), cc = s0.c.slice(0, end);
          var cv = new Array(cc.length); for (var z = 0; z < cv.length; z++) cv[z] = 0;
          var ser = { d: D.slice(s0.off || 0, i1 + 1), o: co, h: ch, l: cl, c: cc, v: cv };
          var ind, sc, ws;
          try { ind = QE.computeIndicators(ser); sc = QE.scoreSeries(ser, ind); ws = QE.wBottom(ser); }
          catch (e) { window.__wfErr.push('IND ' + x.t + ':' + e.message); return; }
          var rr = null;
          try { rr = QE.strategyWindow(ser, ind, sc, ws, bars + warm > (i1 + 1 - s0.off) ? (i1 + 1 - s0.off) : bars + warm, opts); }
          catch (e) { window.__wfErr.push('SW ' + x.t + ':' + e.message); rr = null; }
          if (!rr || !rr[md]) return;
          var tr = [], src = rr[md].trades || [];
          for (var k = 0; k < src.length; k++) {
            var t = src[k];
            if (t.entryIdx == null || !(t.entry > 0)) continue;
            tr.push({ eG: s0.off + t.entryIdx, xG: (t.exitIdx == null) ? -1 : s0.off + t.exitIdx,
                      eP: t.entry, xP: t.exit, hold: t.hold || 0,
                      w: (t.w == null ? 1 : Math.max(0, Math.min(1, t.w))) });
          }
          if (!tr.length) return;
          rows.push({ t: x.t, rank: x.r == null ? 1e9 : x.r, sec: x.sk, off: s0.off, c: s0.c, trades: tr });
        });
        if (!window.__wfCnt) window.__wfCnt = {};
        window.__wfCnt[pf + '|' + md] = (window.__wfCnt[pf + '|' + md] || 0) + rows.length;
        Object.keys(SLOTS).forEach(function (sk) {
          var r = null;
          try {
            r = window.QE_ACCT.run(rows, SLOTS[sk], { bars: bars, G: i1 + 1, warm: warm, dates: D,
              panic: PANIC[md], stress: false });
          } catch (e) { r = null; }
          rot[pf + '|' + md + '|' + sk] = r ? { ret: r.ret, mdd: r.mdd, closed: r.closed, win: r.win,
            open: r.open, exposure: r.exposure } : null;
        });
      });
    });
    var bq = window.QE_ACCT.bench(Q.c, Q.o, i0, i1 + 1);
    var bs = window.QE_ACCT.bench(Y.c, Y.o, i0, i1 + 1);
    return { i0: i0, i1: i1, bars: bars, warm: warm, from: D[i0], to: D[i1],
      bench: { qqq: bq ? { ret: bq.ret, mdd: bq.mdd } : null,
               spy: bs ? { ret: bs.ret, mdd: bs.mdd } : null },
      r: rot };
  }

  var out = { years: [], blocks: [] };
  for (var y = 2017; y <= 2026; y++) {
    var r = yearRange(y); if (!r) continue;
    var w = windowDef(r[0], r[1]); w.y = String(y);
    out.years.push(w);
  }
  var a = yearRange(2017), b = yearRange(2021), c = yearRange(2022), d = yearRange(2026);
  if (a && b) { var o1 = windowDef(a[0], b[1]); o1.k = 'oos'; out.blocks.push(o1); }
  if (c) { var o2 = windowDef(c[0], c[0] === c[1] ? c[0] : c[1]); o2.k = 'crash'; out.blocks.push(o2); }
  if (c && d) { var o3 = windowDef(c[0], d[1]); o3.k = 'recent'; out.blocks.push(o3); }
  out.meta = { rows: window.__wfCnt || {}, errs: (window.__wfErr || []).slice(0, 8), asOf: D[D.length - 1], from: D[0], to: D[D.length - 1], warm: C.warm,
    universe: { trend: UNIV.trend.length, swing: UNIV.swing.length } };
  return out;
};
"""


async def main():
    meta = market_meta()
    engine = open(os.path.join(HERE, 'engine.js'), encoding='utf-8').read()
    acctjs = open(os.path.join(HERE, 'acct.js'), encoding='utf-8').read()
    src = open(os.path.join(HERE, 'wf_src.js'), encoding='utf-8').read()
    html = ('<!doctype html><meta charset="utf-8"><body><script>%s</script><script>%s</script>'
            '<script>%s</script><script>window.WF_META=%s;</script><script>%s</script></body>'
            % (engine, acctjs, src, json.dumps(meta, ensure_ascii=False), HARNESS))
    hp = os.path.join(HERE, 'wf_harness.html')
    open(hp, 'w', encoding='utf-8').write(html)

    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await (await b.new_context()).new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://' + hp, wait_until='load')
        await pg.wait_for_function('() => !!window.__wfCompute && !!window.WFRAW', timeout=120000)
        res = await pg.evaluate('() => window.__wfCompute()')
        await b.close()
    if errs:
        print('PAGE ERRORS:', errs[:5])
    os.remove(hp)

    def rnd(o):
        if isinstance(o, float):
            return round(o, 4)
        if isinstance(o, dict):
            return {k: rnd(v) for k, v in o.items()}
        if isinstance(o, list):
            return [rnd(v) for v in o]
        return o

    res = rnd(res)
    body = json.dumps(res, ensure_ascii=False, separators=(',', ':'))
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('window.WF=' + body + ';\n')
    print('windows: years %d · blocks %s' % (len(res['years']), [x['k'] for x in res['blocks']]))
    print('universe', res['meta']['universe'], '· size %.1f KB' % (os.path.getsize(OUT) / 1024))
    print('rows', res['meta'].get('rows'), 'errs', res['meta'].get('errs'))
    for w in res['years'] + res['blocks']:
        k = w.get('y') or w.get('k')
        print(' ', k, w['from'], '~', w['to'], w['bars'], '봉',
              'qqq', None if not w['bench']['qqq'] else round(w['bench']['qqq']['ret'] * 100, 1),
              'spy', None if not w['bench']['spy'] else round(w['bench']['spy']['ret'] * 100, 1),
              'safe|trend|div10', None if not w['r'].get('safe|trend|div10') else round(w['r']['safe|trend|div10']['ret'] * 100, 1),
              'safe|swing|div10', None if not w['r'].get('safe|swing|div10') else round(w['r']['safe|swing|div10']['ret'] * 100, 1))
    return 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main()))
