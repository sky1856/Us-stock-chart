/* ============================================================
   APEX QUANT — 계좌(포트폴리오) 시뮬레이터 엔진 (pure JS, no DOM)
   ------------------------------------------------------------
   계좌 카드(ui.js)와 표본외 워크포워드 생성기(scripts/wf_build)가
   **같은 함수**를 쓴다 — 두 곳에서 따로 계산해 숫자가 갈리는 일을 막는다.

   run(rows, slot, opt)
     rows  : [{t, rank, sec, off, c:[종가], trades:[{eG,xG,eP,xP,hold,w}]}]
             eG/xG = opt.dates 기준 전역 인덱스, off = 종가 배열의 시작 인덱스
     slot  : {n, cap}
     opt   : {
       bars,            창 길이(거래일)
       G,               측정 끝(전역 인덱스, 기본 = dates.length)
       warm,            웜스타트 봉 수(기본 C.warm) — 창 앞에서부터 운용 후 창만 측정
       simStart,        운용 시작(기본 G-bars-warm)
       dates,           라벨용 날짜 배열(기본 없음)
       panic,           패닉일 불리언 배열(전역 인덱스)
       stress,          슬리피지 + 갭 충격
       fee, rate, panicPct, slip, gap,  상수 덮어쓰기
     }
   ============================================================ */
(function (root) {
  'use strict';

  /* 계좌 규칙 상수 — 화면 문구·문서와 check_invariants.py 가 대조한다 */
  var C = {
    fee: 0.0003,        /* 매수·매도 각 0.03% (왕복 0.06%) */
    panic: 0.70,        /* 패닉일 신규 투입 상한 = 계좌 70% */
    rate: 0.04 / 252,   /* 현금 연 4% (일 복리) */
    warm: 250,          /* 웜스타트 봉 수 */
    slip: 0.0015,       /* 스트레스 모드 편도 슬리피지 0.15% (왕복 0.3%) */
    gap: 0.10           /* 스트레스 모드 갭 충격 −10% */
  };

  function num(x, d) { return (x === null || x === undefined || !isFinite(x)) ? d : x; }

  function run(rows, slot, opt) {
    opt = opt || {};
    var N = slot.n, cap = slot.cap;
    var stress = !!opt.stress;
    var FEE = num(opt.fee, C.fee) + (stress ? num(opt.slip, C.slip) : 0);
    var RATE = num(opt.rate, C.rate);
    var PANIC = num(opt.panicPct, C.panic);
    var GAP = num(opt.gap, C.gap);
    var dates = opt.dates || null;
    var G = num(opt.G, dates ? dates.length : 0);
    var bars = num(opt.bars, G);
    var start = Math.max(0, G - bars);
    var warm = num(opt.warm, C.warm);
    warm = Math.min(warm, start);
    var simStart = (opt.simStart != null) ? opt.simStart : Math.max(0, start - warm);
    var panic = opt.panic || null;
    var evE = {}, evX = {}, i, k, q;

    for (i = 0; i < rows.length; i++) {
      var row = rows[i];
      for (k = 0; k < row.trades.length; k++) {
        var t = row.trades[k];
        if (t.eG >= simStart && t.eG < G) (evE[t.eG] || (evE[t.eG] = [])).push({ row: row, t: t });
        if (t.xG >= simStart && t.xG < G) (evX[t.xG] || (evX[t.xG] = [])).push({ row: row });
      }
    }
    var cash = 1, pos = [], curve = [], log = [], fills = [];
    /* 거래·승률·평균보유는 **측정 창(g >= start) 안에서 청산된 건만** 센다 (2026-11-28 수정).
       웜스타트 250봉은 창 시작 시점에 이미 굴러가는 계좌를 만들기 위한 준비 구간이라,
       그 구간 청산까지 세면 카드의 '웜스타트 250봉 후 이 기간만 측정' 문구와 숫자가 어긋났다
       (6M 거래 77건 = 창 내부 33건 + 웜 44건). 수익·MDD 는 처음부터 창 기준이었으므로
       이제 카드의 모든 숫자가 같은 구간을 가리킨다. */
    var wins = 0, closed = 0, entries = 0, holdSum = 0, dayHold = 0, secHold = {};
    var warmClosed = 0;               /* 웜 구간 청산 건수 — 참고값(화면 표시에는 쓰지 않는다) */
    var baseEq = null, shockIdx = -1, shockExp = 0;
    function pxAt(r2, g) { var ix = g - (r2.off || 0); return (ix >= 0 && ix < r2.c.length) ? r2.c[ix] : null; }
    function equityAt(g) {
      var v = cash;
      for (var j2 = 0; j2 < pos.length; j2++) {
        var p = pxAt(pos[j2].row, g);
        v += (p != null ? p * pos[j2].shares : pos[j2].cost);
      }
      return v;
    }
    for (var g = simStart; g < G; g++) {   /* simStart = 창 앞 웜스타트부터, 측정은 g >= start */
      /* 1) 시가 청산 먼저 */
      var xs = evX[g];
      if (xs) for (k = 0; k < xs.length; k++) {
        var pi = -1;
        for (q = 0; q < pos.length; q++) if (pos[q].row === xs[k].row) { pi = q; break; }
        if (pi < 0) continue;
        var pp = pos.splice(pi, 1)[0];
        var trade = null;
        for (q = 0; q < pp.trades.length; q++) if (pp.trades[q].eG === pp.eG) { trade = pp.trades[q]; break; }
        var out = pp.shares * (trade ? trade.xP : pp.entry) * (1 - FEE);
        cash += out;
        log.push({ t: pp.row.t, eG: pp.eG, xG: g, ret: out / pp.cost - 1, w: pp.shares * pp.entry * (1 + FEE) });
        fills.push({ side: '매도', g: g, t: pp.row.t, px: trade ? trade.xP : pp.entry, ret: out / pp.cost - 1, w: pp.posW });
        if (g >= start) {                       /* 창 안에서 청산된 건만 거래·승률로 */
          closed++; holdSum += (trade ? trade.hold : 0);
          if (out - pp.cost > 0) wins++;
        } else warmClosed++;                    /* 웜스타트 구간 청산 — 측정 제외 */
        secHold[pp.sec] = Math.max(0, (secHold[pp.sec] || 0) - 1);
      }
      /* 2) 시가 신규 매수 — 빈 슬롯 · 섹터 캡 · 패닉 바스켓 */
      var es = evE[g];
      if (es && pos.length < N) {
        es.sort(function (p1, p2) { return (p1.row.rank - p2.row.rank); });
        var eq = equityAt(g > simStart ? g - 1 : g);
        var target = eq / N, left = (panic && panic[g]) ? eq * PANIC : Infinity;
        for (k = 0; k < es.length && pos.length < N; k++) {
          var er = es[k], busy = false;
          for (q = 0; q < pos.length; q++) if (pos[q].row === er.row) { busy = true; break; }
          if (busy) continue;
          if (cap > 0 && (secHold[er.row.sec] || 0) >= cap) continue;
          var tw = (er.t.w == null ? 1 : Math.max(0, Math.min(1, er.t.w)));
          var notional = Math.min(target * tw, left, cash / (1 + FEE));   /* 현금을 넘겨 살 수 없다 */
          if (!(notional > eq * 1e-6) || !(er.t.eP > 0)) continue;
          cash -= notional * (1 + FEE);
          if (cash < 0) cash = 0;                       /* 현금 음수 금지 */
          pos.push({ row: er.row, trades: er.row.trades, eG: er.t.eG, shares: notional / er.t.eP,
            cost: notional * (1 + FEE), entry: er.t.eP, sec: er.row.sec, posW: tw });
          fills.push({ side: '매수', g: g, t: er.row.t, px: er.t.eP, w: tw });
          secHold[er.row.sec] = (secHold[er.row.sec] || 0) + 1;
          left -= notional;
          if (g >= start) entries++;              /* 창 안 신규 진입만 */
        }
      }
      /* 3) 종가 평가 → 현금 이자 */
      var eqC = equityAt(g);
      if (cash > 0) cash *= (1 + RATE);                /* 이자는 예수금에만 */
      if (g >= start) {
        if (g === start) baseEq = eqC;                 /* 창 시작일 종가 = 기준점 */
        curve.push(eqC);
        if (baseEq > 0) {
          var exp0 = Math.max(0, 1 - cash / eqC);
          if (exp0 > shockExp) { shockExp = exp0; shockIdx = curve.length - 1; }
        }
        dayHold += pos.length;
      }
    }
    var days = Math.max(1, G - start);
    /* 스트레스 — 최대 노출일에 보유 전종목 −10% 갭(손절 미작동)을 1회 넣고 곡선을 다시 잰다 */
    if (stress && shockIdx >= 0 && curve.length) {
      var f = 1 - GAP * shockExp;
      for (i = shockIdx; i < curve.length; i++) curve[i] *= f;
    }
    var base = baseEq || (curve.length ? curve[0] : 1);
    var eqEnd = curve.length ? curve[curve.length - 1] : base;
    var total = base > 0 ? eqEnd / base - 1 : 0;
    var pk = base, mdd = 0;
    for (i = 0; i < curve.length; i++) {
      if (curve[i] > pk) pk = curve[i];
      var dd = (curve[i] - pk) / pk;
      if (dd < mdd) mdd = dd;
    }
    var open = 0, openRet = 0, endSec = {};
    for (q = 0; q < pos.length; q++) {
      endSec[pos[q].sec] = (endSec[pos[q].sec] || 0) + 1;
      var last = pxAt(pos[q].row, G - 1);
      if (last == null) continue;
      open++; openRet += pos[q].shares * last - pos[q].cost;
    }
    var holds = pos.map(function (p) {
      var lx = pxAt(p.row, G - 1), val = lx != null ? p.shares * lx : p.cost;
      return { t: p.row.t, sec: p.sec, w: p.posW, g: p.eG, date: dates ? (dates[p.eG] || '') : '',
        entry: p.entry, last: lx, cost: p.cost, value: val,
        weight: eqEnd > 0 ? val / eqEnd : 0,
        pnl: p.cost > 0 ? (val - p.cost) / p.cost : 0, hold: (G - 1) - p.eG };
    }).sort(function (h1, h2) { return h2.weight - h1.weight; });
    var cashW = eqEnd > 0 ? Math.max(0, cash) / eqEnd : 0;
    return {
      slots: N, bars: bars, ret: total, mdd: mdd,
      win: closed ? wins / closed : null, closed: closed, entries: entries,
      avgHold: closed ? holdSum / closed : null,
      avgPos: dayHold / days, exposure: N ? (dayHold / days) / N : 0,
      cagr: Math.pow(Math.max(1 + total, 1e-6), 252 / days) - 1,
      open: open, openPnl: openRet, endSec: endSec, log: log,
      holds: holds, cashW: cashW, fills: fills.slice(-16),
      stress: stress, warm: warm, base: base, start: start, G: G,
      warmClosed: warmClosed,
      shockExp: shockExp, shockIdx: shockIdx,
      rowN: rows.length,
      curve: curve
    };
  }

  /* 단순 보유(벤치) — 창 첫날 시가(없으면 전날 종가) 기준, 마지막 날 종가 평가 */
  function bench(close, open, start, G) {
    if (!close || close.length < 2) return null;
    var i0 = Math.max(0, Math.min(start, close.length - 1));
    var first = (open && open[i0] > 0) ? open[i0] : (close[i0 - 1] > 0 ? close[i0 - 1] : (close[i0] > 0 ? close[i0] : null));
    if (first == null) return null;
    var peak = first, mdd = 0, ret = 0;
    for (var i = i0; i < Math.min(G, close.length); i++) {
      var v = close[i];
      if (!(v > 0)) continue;
      if (v > peak) peak = v;
      var dd = (v - peak) / peak;
      if (dd < mdd) mdd = dd;
      ret = v / first - 1;
    }
    return { ret: ret, mdd: mdd, base: first };
  }

  var api = { C: C, run: run, bench: bench };
  root.QE_ACCT = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
