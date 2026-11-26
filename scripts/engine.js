/* ============================================================
   APEX QUANT — Technical Analysis Engine (pure JS, no DOM)
   Indicators, multi-factor scoring, backtest. Runs in browser & node.
   ============================================================ */
(function (root) {
  'use strict';

  function nz(x, d) { return (x === null || x === undefined || Number.isNaN(x)) ? (d === undefined ? 0 : d) : x; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function sma(arr, p) {
    var out = new Array(arr.length), s = 0, n = 0;
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (v != null) { s += v; n++; }
      if (i >= p) { var o = arr[i - p]; if (o != null) { s -= o; n--; } }
      out[i] = (i >= p - 1 && n === p) ? s / p : null;
    }
    return out;
  }

  function ema(arr, p) {
    var out = new Array(arr.length), k = 2 / (p + 1), prev = null;
    for (var i = 0; i < arr.length; i++) {
      var v = arr[i];
      if (v == null) { out[i] = prev; continue; }
      if (prev == null) { prev = v; }
      else { prev = v * k + prev * (1 - k); }
      out[i] = prev;
    }
    return out;
  }

  function rsi(closes, p) {
    p = p || 14;
    var out = new Array(closes.length), avgU = 0, avgD = 0;
    for (var i = 0; i < closes.length; i++) {
      if (i === 0) { out[i] = null; continue; }
      var ch = closes[i] - closes[i - 1];
      var u = ch > 0 ? ch : 0, d = ch < 0 ? -ch : 0;
      if (i <= p) {
        avgU += u / p; avgD += d / p;
        out[i] = i === p ? (avgD === 0 ? 100 : 100 - 100 / (1 + avgU / avgD)) : null;
      } else {
        avgU = (avgU * (p - 1) + u) / p;
        avgD = (avgD * (p - 1) + d) / p;
        out[i] = avgD === 0 ? 100 : 100 - 100 / (1 + avgU / avgD);
      }
    }
    return out;
  }

  function emaSeries(src, p) {
    var out = new Array(src.length), k = 2 / (p + 1), prev = null;
    for (var i = 0; i < src.length; i++) {
      var v = src[i];
      if (v == null) { out[i] = prev; continue; }
      prev = prev == null ? v : v * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }

  function macd(closes, f, s, sig) {
    f = f || 12; s = s || 26; sig = sig || 9;
    var ef = emaSeries(closes, f), es = emaSeries(closes, s);
    var line = closes.map(function (_, i) { return (ef[i] != null && es[i] != null) ? ef[i] - es[i] : null; });
    var signal = emaSeries(line, sig);
    var hist = line.map(function (v, i) { return (v != null && signal[i] != null) ? v - signal[i] : null; });
    return { line: line, signal: signal, hist: hist };
  }

  function atr(h, l, c, p) {
    p = p || 14;
    var tr = new Array(c.length);
    for (var i = 0; i < c.length; i++) {
      if (i === 0) { tr[i] = h[i] - l[i]; continue; }
      tr[i] = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]));
    }
    var out = new Array(tr.length), prev = null;
    for (var j = 0; j < tr.length; j++) {
      if (j < p) { out[j] = null; continue; }
      if (prev == null) {
        var s = 0; for (var k = 1; k <= p; k++) s += tr[k];
        prev = s / p;
      } else { prev = (prev * (p - 1) + tr[j]) / p; }
      out[j] = prev;
    }
    return out;
  }

  function stdev(arr, p) {
    var out = new Array(arr.length);
    for (var i = 0; i < arr.length; i++) {
      if (i < p - 1) { out[i] = null; continue; }
      var s = 0, s2 = 0;
      for (var j = i - p + 1; j <= i; j++) { s += arr[j]; s2 += arr[j] * arr[j]; }
      var m = s / p, v = s2 / p - m * m;
      out[i] = Math.sqrt(Math.max(v, 0));
    }
    return out;
  }

  function bollinger(closes, p, k) {
    p = p || 20; k = k || 2;
    var mid = sma(closes, p), sd = stdev(closes, p);
    var up = [], lo = [];
    for (var i = 0; i < closes.length; i++) {
      up[i] = (mid[i] != null && sd[i] != null) ? mid[i] + k * sd[i] : null;
      lo[i] = (mid[i] != null && sd[i] != null) ? mid[i] - k * sd[i] : null;
    }
    return { mid: mid, up: up, lo: lo, sd: sd };
  }

  function obv(c, v) {
    var out = new Array(c.length); out[0] = 0;
    for (var i = 1; i < c.length; i++) {
      out[i] = out[i - 1] + (c[i] > c[i - 1] ? v[i] : (c[i] < c[i - 1] ? -v[i] : 0));
    }
    return out;
  }

  /* ---------- rolling extremes ---------- */
  function midHL(h, l, p) {
    var out = new Array(h.length);
    for (var i = 0; i < h.length; i++) {
      if (i < p - 1) { out[i] = null; continue; }
      var hi = -Infinity, lo = Infinity;
      for (var j = i - p + 1; j <= i; j++) { if (h[j] > hi) hi = h[j]; if (l[j] < lo) lo = l[j]; }
      out[i] = (hi + lo) / 2;
    }
    return out;
  }
  function rollMax(arr, p) {
    var out = new Array(arr.length);
    for (var i = 0; i < arr.length; i++) {
      if (i < p) { out[i] = null; continue; }
      var m = -Infinity; for (var j = i - p + 1; j <= i; j++) if (arr[j] > m) m = arr[j];
      out[i] = m;
    }
    return out;
  }
  function rollMin(arr, p) {
    var out = new Array(arr.length);
    for (var i = 0; i < arr.length; i++) {
      if (i < p) { out[i] = null; continue; }
      var m = Infinity; for (var j = i - p + 1; j <= i; j++) if (arr[j] < m) m = arr[j];
      out[i] = m;
    }
    return out;
  }

  /* ============================================================
     Multi-factor score engine
     Groups: trend(-30..30) momentum(-25..25) reversal(-15..15)
             volume(-15..15) structure(-15..15)
     score = 50 + raw/2  ->  0..100
     ============================================================ */
  function computeIndicators(series) {
    var c = series.c, h = series.h, l = series.l, v = series.v, o = series.o;
    var n = c.length;
    var ind = {};
    ind.ema20 = ema(c, 20);
    ind.ema50 = ema(c, 50);
    ind.ema200 = ema(c, 200);
    /* 이동평균선 (단순, 한국 HTS 표준 주기) — 240일선은 240봉부터 값이 생긴다 */
    ind.ma5 = sma(c, 5);
    ind.ma20 = sma(c, 20);
    ind.ma60 = sma(c, 60);
    ind.ma120 = sma(c, 120);
    ind.ma240 = sma(c, 240);
    /* 일목균형표 (9·26·52) — 선행스팬과 구름대만 표시
       전환선(9)과 기준선(26)은 선행스팬A 계산과 점수 산출에만 쓰고 차트에는 그리지 않으며, 후행스팬도 사용하지 않음 */
    /* 선행스팬은 26봉 앞으로 이동 */
    ind.tenkan = midHL(h, l, 9);
    ind.kijun = midHL(h, l, 26);
    var spanBraw = midHL(h, l, 52);
    ind.spanA = new Array(n);
    ind.spanB = new Array(n);
    for (var q = 0; q < n; q++) {
      var s = q - 26;
      ind.spanA[q] = (s >= 0 && ind.tenkan[s] != null && ind.kijun[s] != null) ? (ind.tenkan[s] + ind.kijun[s]) / 2 : null;
      ind.spanB[q] = (s >= 0 && spanBraw[s] != null) ? spanBraw[s] : null;
    }
    ind.bb = bollinger(c, 20, 2);
    ind.rsi = rsi(c, 14);
    ind.macd = macd(c, 12, 26, 9);
    ind.atr = atr(h, l, c, 14);
    ind.volSma = sma(v, 20);
    ind.obv = obv(c, v);
    ind.obvSma = sma(ind.obv, 20);
    ind.h20 = rollMax(h, 20);
    ind.l20 = rollMin(l, 20);
    ind.h50 = rollMax(h, 50);
    ind.l50 = rollMin(l, 50);
    ind.n = n;
    return ind;
  }

  function scoreSeries(series, ind) {
    var c = series.c, h = series.h, l = series.l, v = series.v, o = series.o;
    var n = c.length;
    var S = new Array(n), G = new Array(n);
    for (var i = 0; i < n; i++) {
      var g = { trend: 0, momentum: 0, reversal: 0, volume: 0, structure: 0 };
      var m5 = ind.ma5[i], m20 = ind.ma20[i], m60 = ind.ma60[i], m120 = ind.ma120[i], m240 = ind.ma240[i];
      var r = ind.rsi[i], bb = ind.bb, m = ind.macd;

      /* ---- TREND (차트에 보이는 이동평균 5·20·60·120·240일 기준) ---- */
      if (m20 != null) g.trend += clamp((c[i] / m20 - 1) * 100 * 1.2, -6, 6);
      if (m5 != null && m20 != null) g.trend += clamp((m5 / m20 - 1) * 100 * 2.0, -6, 6);
      if (m20 != null && m60 != null) g.trend += clamp((m20 / m60 - 1) * 100 * 2.5, -7, 7);
      if (m60 != null && m120 != null) g.trend += clamp((m60 / m120 - 1) * 100 * 2.0, -4, 4);
      if (m240 != null && i >= 20 && ind.ma240[i - 20] != null)
        g.trend += clamp((m240 / ind.ma240[i - 20] - 1) * 100 * 3.0, -4, 4);
      if (m240 != null) g.trend += clamp((c[i] / m240 - 1) * 100 * 1.2, -3, 3);

      /* ---- MOMENTUM ---- */
      if (m.hist[i] != null) g.momentum += clamp(m.hist[i] / c[i] * 100 * 120, -6, 6);
      if (i >= 3 && m.hist[i] != null && m.hist[i - 3] != null)
        g.momentum += (m.hist[i] > m.hist[i - 3]) ? 5 : -5;
      if (m.line[i] != null) g.momentum += (m.line[i] > 0) ? 6 : -6;
      if (r != null) g.momentum += clamp((r - 50) / 20 * 8, -8, 8);

      /* ---- REVERSAL (contrarian) ---- */
      if (r != null) {
        if (r < 30) g.reversal += clamp((30 - r) / 30 * 9, 0, 9);
        else if (r > 70) g.reversal -= clamp((r - 70) / 30 * 9, 0, 9);
      }
      if (bb.lo[i] != null && bb.up[i] != null) {
        var bw = Math.max(bb.up[i] - bb.lo[i], 1e-9);
        if (c[i] < bb.lo[i]) g.reversal += clamp((bb.lo[i] - c[i]) / bw * 30, 0, 6);
        else if (c[i] > bb.up[i]) g.reversal -= clamp((c[i] - bb.up[i]) / bw * 30, 0, 6);
      }

      /* ---- VOLUME ---- */
      var vs = ind.volSma[i];
      if (vs != null && vs > 0) {
        var ratio = v[i] / vs;
        var up = c[i] >= (o ? o[i] : c[i]);
        if (ratio > 1.15) {
          var mag = clamp((ratio - 1) * 7, 0, 8);
          g.volume += up ? mag : -mag;
        }
      }
      if (i >= 20 && ind.obv[i] != null && ind.obv[i - 20] != null && vs != null && vs > 0)
        g.volume += clamp((ind.obv[i] - ind.obv[i - 20]) / (vs * 20 || 1) * 7, -7, 7);

      /* ---- STRUCTURE ---- */
      if (ind.h20[i] != null && ind.l20[i] != null) {
        var rg = Math.max(ind.h20[i] - ind.l20[i], 1e-9);
        var pos = (c[i] - ind.l20[i]) / rg;
        if (c[i] >= ind.h20[i] - 1e-9) g.structure += 7;
        else if (c[i] <= ind.l20[i] + 1e-9) g.structure -= 7;
        else g.structure += clamp((pos - 0.5) * 10, -5, 5);
      }
      if (ind.h50[i] != null && ind.l50[i] != null) {
        var rg2 = Math.max(ind.h50[i] - ind.l50[i], 1e-9);
        g.structure += clamp(((c[i] - ind.l50[i]) / rg2 - 0.5) * 8, -4, 4);
      }

      var raw = g.trend + g.momentum + g.reversal + g.volume + g.structure;
      S[i] = clamp(50 + raw / 2, 1, 99);
      G[i] = g;
    }
    return { score: S, groups: G };
  }

  /* ---------- labels ---------- */
  var LABELS = {
    4: { key: 'strongbuy', ko: '강력매수', en: 'STRONG BUY', color: '#10B981' },
    3: { key: 'buy', ko: '매수', en: 'BUY', color: '#34D399' },
    2: { key: 'watch', ko: '관망', en: 'NEUTRAL', color: '#F59E0B' },
    1: { key: 'sell', ko: '매도', en: 'SELL', color: '#FB7185' },
    0: { key: 'strongsell', ko: '강력매도', en: 'STRONG SELL', color: '#F43F5E' }
  };
  function labelOf(score) {
    if (score >= 75) return LABELS[4];
    if (score >= 58) return LABELS[3];
    if (score >= 45) return LABELS[2];
    if (score >= 35) return LABELS[1];
    return LABELS[0];
  }

  /* ============================================================
     Human-readable explanation of the score at bar i
     -> [{key,name,w,v,tone:'bull'|'neu'|'bear',text}]
     ============================================================ */
  function px(v) { return v == null ? '—' : (v >= 1000 ? v.toFixed(0) : v.toFixed(2)); }
  function rsiZone(r) {
    if (r == null) return '—';
    if (r < 30) return '과매도';
    if (r < 45) return '약세';
    if (r <= 55) return '중립';
    if (r <= 70) return '강세';
    return '과열';
  }

  function explain(series, ind, groups, i) {
    var c = series.c, v = series.v, o = series.o;
    var ma5 = ind.ma5[i], ma20 = ind.ma20[i], ma60 = ind.ma60[i], ma120 = ind.ma120[i], ma240 = ind.ma240[i];
    var g = groups || { trend: 0, momentum: 0, reversal: 0, volume: 0, structure: 0 };
    var out = [];

    /* ---- 추세 ---- */
    var t = [];
    if (ma20 != null) t.push('현재가 ' + (c[i] >= ma20 ? '20일선 위' : '20일선 아래'));
    if (ma5 != null && ma20 != null) t.push('5일선이 20일선 ' + (ma5 >= ma20 ? '위' : '아래'));
    if (ma20 != null && ma60 != null && ma120 != null) {
      t.push('20·60·120일 ' + (ma20 > ma60 && ma60 > ma120 ? '정배열' : (ma20 < ma60 && ma60 < ma120 ? '역배열' : '혼조')));
    } else if (ma60 != null) {
      t.push('20·60일 ' + (ma20 >= ma60 ? '정배열' : '역배열'));
    }
    var e200 = ind.ema200[i], e200p = i >= 20 ? ind.ema200[i - 20] : null;
    if (ma240 != null && i >= 20 && ind.ma240[i - 20] != null)
      t.push('240일선 ' + (ma240 >= ind.ma240[i - 20] ? '상승' : '하락'));
    else if (e200 != null && e200p != null) t.push('200일선 ' + (e200 >= e200p ? '상승' : '하락'));
    out.push({ key: 'trend', name: '추세', w: 30, v: g.trend, text: t.join(' · ') });

    /* ---- 모멘텀 ---- */
    var mm = ind.macd, r = ind.rsi[i], s2 = [];
    if (mm.hist[i] != null) s2.push('MACD 히스토그램 ' + (mm.hist[i] >= 0 ? '양전' : '음전') + '(' + mm.hist[i].toFixed(2) + ')');
    if (mm.line[i] != null && mm.signal[i] != null) s2.push('시그널선 ' + (mm.line[i] >= mm.signal[i] ? '상회' : '하회'));
    if (r != null) s2.push('RSI ' + r.toFixed(1) + '(' + rsiZone(r) + ')');
    out.push({ key: 'momentum', name: '모멘텀', w: 25, v: g.momentum, text: s2.join(' · ') });

    /* ---- 반전 ---- */
    var s3 = [];
    if (r != null) s3.push('RSI ' + r.toFixed(1) + ' ' + (r < 30 ? '과매도 반등 가점' : (r > 70 ? '과열 부담' : '과매수·과매도 아님')));
    if (ind.bb.lo[i] != null && ind.bb.up[i] != null) {
      var blo = ind.bb.lo[i], bup = ind.bb.up[i], bwd = Math.max(bup - blo, 1e-9);
      if (c[i] < blo) s3.push('볼린저 하단 이탈(반등 가점)');
      else if (c[i] > bup) s3.push('볼린저 상단 돌파(과열 부담)');
      else s3.push('밴드 내부(하단 ' + ((c[i] - blo) / bwd * 100).toFixed(0) + '% 지점)');
    }
    out.push({ key: 'reversal', name: '반전', w: 15, v: g.reversal, text: s3.join(' · ') });

    /* ---- 거래량 ---- */
    var s4 = [], vs = ind.volSma[i];
    if (vs != null && vs > 0) s4.push('거래량 20일 평균의 ' + (v[i] / vs).toFixed(2) + '배' + (c[i] >= (o ? o[i] : c[i]) ? ' (상승일)' : ' (하락일)'));
    if (i >= 20 && ind.obv[i] != null && ind.obv[i - 20] != null) s4.push('OBV 20일 ' + (ind.obv[i] - ind.obv[i - 20] >= 0 ? '매집 우위' : '분산 우위'));
    out.push({ key: 'volume', name: '거래량', w: 15, v: g.volume, text: s4.join(' · ') });

    /* ---- 가격구조 ---- */
    var s5 = [], h20 = ind.h20[i], l20 = ind.l20[i];
    if (h20 != null && l20 != null) {
      var rg = Math.max(h20 - l20, 1e-9);
      var tag = c[i] >= h20 - 1e-9 ? '20일 신고가' : (c[i] <= l20 + 1e-9 ? '20일 신저가' : '20일 범위 ' + ((c[i] - l20) / rg * 100).toFixed(0) + '% 지점');
      s5.push(tag + '(' + px(l20) + '~' + px(h20) + ')');
    }
    if (ind.h50[i] != null && ind.l50[i] != null)
      s5.push('50일 범위 ' + ((c[i] - ind.l50[i]) / Math.max(ind.h50[i] - ind.l50[i], 1e-9) * 100).toFixed(0) + '%');
    out.push({ key: 'structure', name: '가격구조', w: 15, v: g.structure, text: s5.join(' · ') });

    out.forEach(function (x) {
      var edge = x.w * 0.12;
      x.tone = x.v > edge ? 'bull' : (x.v < -edge ? 'bear' : 'neu');
    });
    return out;
  }

  /* ============================================================
     Backtest (v3 — 2026-11 bt_opt 최종 후보 best_combined.js 이식)
     · 시장 레짐 3단계 노출목표 (QQQ, 당일 종가 판단)
         - QQQ < 100일선 & 100일선 20일 하락 → 0%  (전량 청산)
         - QQQ < 100일선 & 100일선 20일 상승 → 50% (보유·신규 진입 50%)
         - 50% 구간에서 QQQ가 20일선을 잃으면  → 0%
         - 0% 구간에서 QQQ가 50일선 회복       → 100%,
           또는 20일선 2일 연속 상회           → 50%
     · 진입: 종합점수 ENTRY(50) 이상이면 다음 거래일 시가, 비중은 노출목표 비례
     · 청산: ① 손절(평단가 - 6×ATR)
             ② 샹들리에 트레일(고가 고점 - 10×ATR, +6×ATR 이익 이후 작동)
             ③ 시장 단계 0%(전량 청산)
     · 미래참조 없음: 모든 판단은 당일 종가, 체결은 다음 거래일 시가
     · 매수·매도 각 FEE(0.03%)
     ============================================================ */
  var _regCache = null;
  function marketRegimeMap() {
    var MKT = (root && root.MARKET) || null;
    if (!MKT || !MKT.series || !MKT.series.QQQ) return null;
    var key = MKT.asOf || 'na';
    if (_regCache && _regCache.key === key) return _regCache.map;
    var c = MKT.series.QQQ.c, dts = MKT.dates, n = c.length;
    var ma100 = sma(c, 100), ma50 = sma(c, 50), ma20 = sma(c, 20);
    var map = {}, tw = 1, streak = 0;
    for (var j = 0; j < n; j++) {
      var sl = (j >= 20 && ma100[j] != null && ma100[j - 20] != null) ? ma100[j] - ma100[j - 20] : null;
      var above20 = (ma20[j] != null && c[j] > ma20[j]);
      var below20 = (ma20[j] != null && c[j] < ma20[j]);
      var below100 = (ma100[j] != null && c[j] < ma100[j]);
      var above100 = (ma100[j] != null && c[j] > ma100[j]);
      var ma50ok = (ma50[j] != null && c[j] > ma50[j]);
      streak = above20 ? streak + 1 : 0;          /* 20일선 위 연속 종가 일수 */
      if (tw >= 1) {
        if (below100) tw = (sl != null && sl < 0) ? 0 : 0.5;
      } else if (tw === 0.5) {
        if (ma50ok || above100) tw = 1;
        else if (below20) tw = 0;
        else if (sl != null && sl < 0) tw = 0;
      } else {
        if (ma50ok) tw = 1;
        else if (streak >= 2) tw = 0.5;
      }
      map[dts[j]] = { tw: tw, st: tw === 0 ? 'risk' : (tw < 1 ? 'caution' : 'normal') };
    }
    _regCache = { key: key, map: map };
    return map;
  }

  function backtestRun(series, ind, sc, opts) {
    opts = opts || {};
    var ENTRY = opts.entry !== undefined ? opts.entry : 50;
    var STOP_ATR = opts.stopAtr !== undefined ? opts.stopAtr : 6;
    var TRAIL_ATR = opts.trailAtr !== undefined ? opts.trailAtr : 10;
    var TRAIL_START = opts.trailStartAtr !== undefined ? opts.trailStartAtr : 6;
    var FEE = opts.fee !== undefined ? opts.fee : 0.0003;
    var WARM = opts.warmup !== undefined ? opts.warmup : 210;
    var USE_REGIME = opts.marketFilter !== undefined ? opts.marketFilter : true;

    var c = series.c, o = series.o, h = series.h, l = series.l, d = series.d;
    var n = c.length;
    var S = sc.score, A = ind.atr;
    var RM = USE_REGIME ? (opts.regime || marketRegimeMap()) : null;

    var first = Math.min(Math.max(WARM, 60), n - 2);
    var equity = new Array(n).fill(null), trades = [];
    var cash = 1, pos = null, i;
    var pendEntry = false, pendExit = null, pendW = 1, targetW = 1, bars = 0, inMarket = 0;

    function eqAt(px) { return cash + (pos ? pos.shares * px : 0); }
    function openPos(px, w, idx) {
      var e0 = eqAt(px), notional = e0 * Math.min(w, 1);
      if (!(notional > 0) || !(px > 0)) return;
      var atr0 = A[idx - 1] > 0 ? A[idx - 1] : A[idx];
      if (!(atr0 > 0)) return;
      var sh = notional / px;
      cash -= notional + notional * FEE;
      pos = { entry: px, entryIdx: idx, entryDate: d[idx], atr0: atr0, shares: sh, initShares: sh,
        realized: 0, peakH: Math.max(h[idx], px), w: Math.min(w, 1), trailStop: null,
        stop: px - (STOP_ATR > 0 ? STOP_ATR * atr0 : 1e9) };
    }
    function sell(sh, px) {
      sh = Math.min(sh, pos.shares); if (!(sh > 0)) return;
      cash += sh * px * (1 - FEE);
      pos.shares -= sh;
      pos.realized += (sh / pos.initShares) * (px / pos.entry - 1);
    }
    function closePos(px, idx, reason) {
      if (pos.shares > 1e-12) sell(pos.shares, px);
      trades.push({ entryDate: pos.entryDate, entry: pos.entry, exitDate: d[idx], exit: px,
        ret: pos.realized, hold: idx - pos.entryIdx, reason: reason, w: pos.w, open: false });
      pos = null;
    }
    /* 레짐 노출목표로 비중 축소·확대 (시가 체결, 2% 이내 차이는 손대지 않음) */
    function scaleTo(w, px) {
      var e = eqAt(px), target = w * e, val = pos.shares * px;
      if (val <= 0) return;
      if (target < val * 0.98) sell(pos.shares * (1 - target / val), px);
      else if (target > val * 1.02) {
        var delta = Math.min(target - val, cash);
        if (delta > 0) { var sh = delta / px; cash -= delta * (1 + FEE); pos.shares += sh; pos.initShares += sh; }
      }
    }

    for (i = first; i < n; i++) {
      /* 1) 시가 집행 — 비중·청산은 직전 종가에 결정된 값 (미래참조 없음) */
      if (pos && pendExit) closePos(o[i], i, pendExit);
      pendExit = null;
      if (pos) scaleTo(targetW, o[i]);
      if (!pos && pendEntry) { openPos(o[i], pendW, i); pendEntry = false; }

      /* 2) 장중 손절·트레일 */
      if (pos) {
        var atrNow = A[i] > 0 ? A[i] : pos.atr0;
        if (pos.peakH > pos.entry + TRAIL_START * pos.atr0) {
          var tr = pos.peakH - TRAIL_ATR * atrNow;
          if (pos.trailStop == null || tr > pos.trailStop) pos.trailStop = tr;
        }
        var lvl = Math.max(pos.stop, pos.trailStop == null ? -Infinity : pos.trailStop);
        if (l[i] <= lvl) {
          var fill = Math.min(o[i], lvl);
          closePos(fill, i, pos.trailStop != null && pos.trailStop >= pos.stop ? '트레일'
            : (fill >= pos.entry ? '이익보전' : '손절'));
        } else if (h[i] > pos.peakH) pos.peakH = h[i];
        if (pos && pos.shares > 1e-6) inMarket++;
      }

      /* 3) 종가 판단 */
      var rg = (RM && RM[d[i]]) || { tw: 1, st: 'normal' };
      if (pos) {
        if (rg.tw === 0) pendExit = '시장약세';
        else targetW = rg.tw;
      } else {
        if (S[i] != null && S[i] >= ENTRY && nz(A[i], 0) > 0 && rg.tw > 0) { pendEntry = true; pendW = rg.tw; }
      }
      equity[i] = eqAt(c[i]);
      bars++;
    }
    if (pos) closePos(c[n - 1], n - 1, '보유중');
    equity[n - 1] = cash;

    /* ---- stats (기존과 동일 필드) ---- */
    var bh = c[n - 1] / c[first] - 1;
    var total = cash - 1;
    var wins = trades.filter(function (t) { return t.ret > 0; });
    var losses = trades.filter(function (t) { return t.ret <= 0; });
    var gp = wins.reduce(function (a, t) { return a + t.ret; }, 0);
    var gl = Math.abs(losses.reduce(function (a, t) { return a + t.ret; }, 0));
    var pf = gl > 0 ? gp / gl : (gp > 0 ? 99 : 0);
    var mdd = 0, peak = 0;
    for (i = first; i < n; i++) {
      if (equity[i] == null) continue;
      if (equity[i] > peak) peak = equity[i];
      var dd = (equity[i] - peak) / peak;
      if (dd < mdd) mdd = dd;
    }
    var bhmdd = 0, bpeak = 0;
    for (i = first; i < n; i++) {
      if (c[i] > bpeak) bpeak = c[i];
      var dd2 = (c[i] - bpeak) / bpeak;
      if (dd2 < bhmdd) bhmdd = dd2;
    }
    var days = n - 1 - first;
    var years = days / 252;
    var cagr = years > 0 ? Math.pow(Math.max(cash, 1e-6), 1 / years) - 1 : 0;
    var rets = [];
    for (i = first + 1; i < n; i++) {
      if (equity[i] != null && equity[i - 1] != null && equity[i - 1] > 0)
        rets.push(equity[i] / equity[i - 1] - 1);
    }
    var mean = rets.reduce(function (a, b) { return a + b; }, 0) / Math.max(rets.length, 1);
    var varr = rets.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / Math.max(rets.length - 1, 1);
    var sh = Math.sqrt(varr) > 0 ? mean / Math.sqrt(varr) * Math.sqrt(252) : 0;
    var holdAvg = trades.length ? trades.reduce(function (a, t) { return a + t.hold; }, 0) / trades.length : 0;

    return {
      trades: trades, equity: equity, startIdx: first,
      stats: {
        totalReturn: total, bhReturn: bh, alpha: total - bh,
        winRate: trades.length ? wins.length / trades.length : 0,
        profitFactor: pf, mdd: mdd, bhMdd: bhmdd, trades: trades.length,
        avgHold: holdAvg, cagr: cagr, sharpe: sh,
        avgWin: wins.length ? gp / wins.length : 0,
        avgLoss: losses.length ? -gl / losses.length : 0,
        exposure: bars ? inMarket / bars : 0
      }
    };
  }

  /* ============================================================
     Elliott Wave — 다중 차수 · 조정 패턴 · 채널 · 모멘텀 · 클러스터
       ZigZag 스윙 피벗 → 대파동(1-2-3-4-5 / A-B-C) → 그 내부의 소파동((i)-(v)/(a)-(c))
       3대 절대 규칙 + 가이드라인(교대 법칙 · 3파 모멘텀 · 5파 다이버전스)
       조정 패턴(지그재그 / 플랫 / 삼각수렴) · 엘리어트 채널 · 피보나치 클러스터
       기본 카운트 1위 + 구조가 다른 대안 카운트 2위
     ============================================================ */
  var EW_PMULT = [2.8, 3.4, 4.0, 4.8, 5.8, 7.0, 8.5];   /* 일중 변동폭 대비 스윙 임계 배수 */
  var EW_SUB = {
    imp: ['', '(i)', '(ii)', '(iii)', '(iv)', '(v)'],
    cor: ['', '(a)', '(b)', '(c)', '(d)', '(e)']
  };
  var EW_RULE_NAMES = {
    r1: '2파는 1파 시작점을 넘지 않음',
    r2: '3파는 1·3·5파 중 가장 짧지 않음',
    r3: '4파의 종점은 1파 가격 영역과 겹치지 않음'
  };

  /* ZigZag: 종가가 아니라 고가·저가 스윙을 thr(비율) 이상 되돌릴 때 확정 피벗 */
  function zzPivots(h, l, thr) {
    var n = h.length, piv = [];
    if (n < 5) return piv;
    var mode = 0, hiI = 0, hiP = h[0], loI = 0, loP = l[0];
    for (var i = 1; i < n; i++) {
      if (mode === 0) {
        if (h[i] >= hiP) { hiI = i; hiP = h[i]; }
        if (l[i] <= loP) { loI = i; loP = l[i]; }
        if (hiI > loI && h[i] >= loP * (1 + thr)) {
          piv.push({ i: loI, p: loP, t: 'L' }); mode = 1; hiI = i; hiP = h[i];
        } else if (loI > hiI && l[i] <= hiP * (1 - thr)) {
          piv.push({ i: hiI, p: hiP, t: 'H' }); mode = -1; loI = i; loP = l[i];
        }
      } else if (mode === 1) {
        if (h[i] > hiP) { hiI = i; hiP = h[i]; }
        else if (l[i] <= hiP * (1 - thr)) {
          piv.push({ i: hiI, p: hiP, t: 'H' }); mode = -1; loI = i; loP = l[i];
        }
      } else {
        if (l[i] < loP) { loI = i; loP = l[i]; }
        else if (h[i] >= loP * (1 + thr)) {
          piv.push({ i: loI, p: loP, t: 'L' }); mode = 1; hiI = i; hiP = h[i];
        }
      }
    }
    return piv;
  }

  /* 최근 250봉 일중 변동폭의 중위값 — 종목 변동성에 맞춰 스윙 임계값을 정규화 */
  function ewMedVol(h, l, c) {
    var n = h.length, rng = [];
    for (var i = Math.max(0, n - 250); i < n; i++) rng.push((h[i] - l[i]) / Math.max(c[i], 1e-9));
    rng.sort(function (a, b) { return a - b; });
    return rng[Math.floor(rng.length / 2)] || 0.02;
  }

  function zigzagSet(h, l, c) {
    var vol = ewMedVol(h, l, c), out = [];
    for (var m = 0; m < EW_PMULT.length; m++) {
      var thr = clamp(vol * EW_PMULT[m], 0.02, 0.32);
      var pv = zzPivots(h, l, thr);
      if (pv.length >= 5) out.push({ thr: thr, piv: pv, lvl: m });
    }
    return out;
  }

  /* 구간 한정 피벗 (소파동용) — 인덱스를 원래 시계열 기준으로 되돌린다 */
  function zzWindow(h, l, i0, i1, thr) {
    if (i1 - i0 < 3) return [];
    var pv = zzPivots(h.slice(i0, i1 + 1), l.slice(i0, i1 + 1), thr);
    return pv.map(function (p) { return { i: p.i + i0, p: p.p, t: p.t }; });
  }

  /* 끝 피벗 e에서 k파까지 거슬러 올라가 카운트를 만든다 (dir=+1 상승 / -1 하락) */
  function ewCount(pv, e, k, dir) {
    if (k < 1 || e - k < 0) return null;
    var pts = [], w;
    for (w = 0; w <= k; w++) pts.push(pv[e - k + w]);
    for (w = 0; w <= k; w++) {
      var want = (w % 2 === 0) ? (dir > 0 ? 'L' : 'H') : (dir > 0 ? 'H' : 'L');
      if (pts[w].t !== want) return null;
    }
    var mv = function (a, b) { return dir > 0 ? (b - a) : (a - b); };
    var L = { w1: mv(pts[0].p, pts[1].p) };
    if (!(L.w1 > 0)) return null;
    var gl = 0, valid = true, r1 = null, r2 = null, r3 = null;
    if (k >= 2) {
      L.w2 = mv(pts[2].p, pts[1].p);
      r1 = (mv(pts[0].p, pts[2].p) > 0) && L.w2 > 0;
      if (!r1) valid = false;
      else {
        var f2 = L.w2 / L.w1;
        if (f2 <= 0.236) gl += 0.8;
        else if (f2 <= 0.382) gl += 1.8;
        else if (f2 <= 0.786) gl += 2.6;
        else if (f2 <= 0.9) gl += 1.2;
        else { gl += 0.2; if (f2 > 0.98) gl -= 1.8; }
      }
    }
    if (k >= 3) {
      L.w3 = mv(pts[2].p, pts[3].p);
      if (!(L.w3 > 0)) valid = false;
      else {
        var f3 = L.w3 / L.w1;
        if (f3 >= 1.618 && f3 <= 2.618) gl += 3;
        else if (f3 >= 1.0 && f3 < 1.618) gl += 2;
        else if (f3 > 2.618) gl += 1.4;
      }
    }
    if (k >= 4) {
      L.w4 = mv(pts[4].p, pts[3].p);
      if (!(L.w4 > 0)) valid = false;
      r3 = (mv(pts[1].p, pts[4].p) > 0);
      if (!r3) valid = false;
      var f4 = L.w4 / (L.w3 || 1);
      if (f4 >= 0.236 && f4 <= 0.5) gl += 2;
      else if (f4 <= 0.618) gl += 1.2;
      else if (f4 <= 0.786) gl += 0.4;
    }
    if (k >= 5) {
      L.w5 = mv(pts[4].p, pts[5].p);
      if (!(L.w5 > 0)) valid = false;
      r2 = !(L.w3 < L.w1 && L.w3 < L.w5);
      if (!r2) valid = false;
      var f5 = L.w5 / L.w1;
      if (f5 >= 0.618 && f5 <= 1.0) gl += 2.2;
      else if (f5 > 1.0 && f5 <= 1.618) gl += 1.6;
      else if (f5 >= 0.382 && f5 < 0.618) gl += 0.8;
      if (Math.abs(L.w5 - L.w3) / Math.max(L.w3, 1e-9) < 0.12) gl += 1;   /* 5파≈3파 등가 */
    }
    /* k=3에서 A-B-C(지그재그)로 읽는 편이 자연스러운지 */
    var form = 'imp';
    if (k === 3) {
      var fb = L.w2 / L.w1, fc = L.w3 / L.w1;
      if (fb <= 0.9 && fc >= 0.62 && fc <= 1.618) form = 'abc';
    }
    return {
      kind: form === 'abc' ? 'corrective' : 'impulse', form: form, dir: dir, k: k,
      end: e, pts: pts, L: L, r1: r1, r2: r2, r3: r3, valid: valid, gl: gl, score: 0, post: []
    };
  }

  /* 카운트의 변곡점 라벨 */
  function ewLabels(cd) {
    if (cd.form === 'abc') return ['', 'A', 'B', 'C'];
    return ['', '1', '2', '3', '4', '5'];
  }

  /* 조정 구간의 고점·저점이 수렴(contract)인지 확대(expand)인지 */
  function ewTriShape(post) {
    var highs = [], lows = [];
    for (var i = 0; i < post.length; i++) (post[i].t === 'H' ? highs : lows).push(post[i].p);
    if (highs.length < 2 || lows.length < 2) return { ok: false };
    var hDown = highs[highs.length - 1] < highs[0], hUp = highs[highs.length - 1] > highs[0];
    var lUp = lows[lows.length - 1] > lows[0], lDown = lows[lows.length - 1] < lows[0];
    if (hDown && lUp) return { ok: true, kind: 'contract' };
    if (hUp && lDown) return { ok: true, kind: 'expand' };
    return { ok: false };
  }

  /* 조정 구간(임펄스 뒤 A-B-C(-D-E))이 파동 구조로 성립하는지 */
  function ewPostOk(cd) {
    var dir = cd.dir, post = cd.post;
    if (!post.length) return true;
    if (cd.k !== 5) return false;          /* 조정은 완성된 임펄스 뒤에만 붙인다 */
    if (post.length > 5) return false;
    var impSpan = cd.pts[5].i - cd.pts[0].i;
    var postSpan = post[post.length - 1].i - cd.pts[5].i;
    if (impSpan > 10 && postSpan > impSpan * 1.45 + 25) return false;   /* 지나치게 긴 조정은 별개 추세 */
    for (var q = 0; q < post.length; q++) {
      var want = (q % 2 === 0) ? (dir > 0 ? 'L' : 'H') : (dir > 0 ? 'H' : 'L');
      if (post[q].t !== want) return false;
    }
    if (post.length === 1) return true;
    var o = cd.pts[5].p, A = post[0], B = post[1];
    var aLen = Math.abs(A.p - o) || 1e-9;
    if (aLen > Math.abs(cd.pts[0].p - o) * 0.95) return false;    /* A파가 임펄스 전체를 되돌리면 조정이 아니다 */
    var bOver = dir > 0 ? (B.p - o) / aLen : (o - B.p) / aLen;    /* B가 A 시작을 넘어선 정도 */
    if (bOver > 1.35) return false;                               /* 확장 플랫까지만 인정 */
    if (post.length === 2) return true;
    var C = post[2];
    if (dir > 0 ? C.p >= B.p : C.p <= B.p) return false;          /* C는 B를 넘어서야 한다 */
    if (Math.abs(C.p - B.p) < aLen * 0.45) return false;          /* C가 A의 절반도 못 가면 조정이 아니다 */
    /* 조정이 임펄스 시작점을 크게 넘어서면 임펄스 자체가 무효 */
    var lastP = post[post.length - 1].p, org = cd.pts[0].p;
    var retr = dir > 0 ? (org - lastP) : (lastP - org);
    if (retr > Math.abs(org - cd.pts[5].p) * 0.08) return false;
    if (post.length === 3) return true;
    return ewTriShape(post).ok;                                   /* A-B-C-D(-E)는 삼각수렴/확대만 */
  }

  /* 진행 중인 파동이 무효화 가격을 이미 이탈했는지 */
  function ewLiveOk(cd, price) {
    var dir = cd.dir, pts = cd.pts, P = cd.post.length;
    if (P) {
      if (P === 1) return dir * (price - cd.pts[5].p) < 0;        /* A 진행: 5파 극단 유지 */
      if (P === 2) return true;                                   /* B 진행 */
      var C = cd.post[2];
      return dir * (price - C.p) > 0;                             /* C 이후: 되돌림 국면 */
    }
    if (cd.k === 1) return dir * (price - pts[0].p) > 0;
    if (cd.k === 2) return dir * (price - pts[2].p) > 0;
    if (cd.k === 3) return dir * (price - pts[1].p) > 0;          /* 4파가 1파 영역에 들어오면 무효 */
    if (cd.k === 4) return dir * (price - pts[4].p) > 0;
    if (cd.k === 5) return dir * (price - pts[5].p) < 0;
    return true;
  }

  /* 3대 절대 규칙 체크리스트 */
  function ewRules(cd) {
    var pts = cd.pts, dir = cd.dir, up = dir > 0, out = [];
    var abc = cd.form === 'abc';
    var n1 = abc ? 'B파는 A파 시작점을 넘지 않음' : EW_RULE_NAMES.r1;
    if (cd.r1 === null) out.push({ key: 'r1', name: n1, state: 'pending', text: '2파 미형성 · 판정 대기' });
    else out.push({
      key: 'r1', name: n1, state: cd.r1 ? 'pass' : 'fail',
      text: cd.r1
        ? (abc ? 'B파 ' : '2파 ') + (up ? '고점 ' : '저점 ') + px(pts[2].p) + ' — ' + (abc ? 'A파' : '1파') +
          ' 시작 ' + px(pts[0].p) + (up ? ' 미돌파' : ' 미이탈')
        : (abc ? 'B파' : '2파') + '가 ' + (abc ? 'A파' : '1파') + ' 시작점(' + px(pts[0].p) + ')을 ' +
          (up ? '돌파' : '이탈') + ' — 규칙 위반'
    });
    if (abc) {
      out.push({ key: 'r2', name: EW_RULE_NAMES.r2, state: 'na', text: 'A-B-C 조정에는 적용하지 않음 (임펄스 3파 규칙)' });
      out.push({ key: 'r3', name: EW_RULE_NAMES.r3, state: 'na', text: 'A-B-C 조정에는 적용하지 않음 (임펄스 4파 규칙)' });
      return out;
    }
    if (cd.r2 === null) out.push({ key: 'r2', name: EW_RULE_NAMES.r2, state: 'pending', text: '5파 미형성 · 판정 대기' });
    else out.push({
      key: 'r2', name: EW_RULE_NAMES.r2, state: cd.r2 ? 'pass' : 'fail',
      text: cd.r2
        ? '3파 = 1파의 ' + (cd.L.w3 / cd.L.w1).toFixed(2) + '배 · 5파의 ' + (cd.L.w3 / cd.L.w5).toFixed(2) + '배 — 최단 아님'
        : '3파 = 1파의 ' + (cd.L.w3 / cd.L.w1).toFixed(2) + '배 · 5파의 ' + (cd.L.w3 / cd.L.w5).toFixed(2) + '배 — 1·5파보다 짧음'
    });
    if (cd.r3 === null) out.push({ key: 'r3', name: EW_RULE_NAMES.r3, state: 'pending', text: '4파 미형성 · 판정 대기' });
    else out.push({
      key: 'r3', name: EW_RULE_NAMES.r3, state: cd.r3 ? 'pass' : (cd.diag ? 'warn' : 'fail'),
      text: cd.r3
        ? '4파 ' + (up ? '저점 ' : '고점 ') + px(pts[4].p) + ' vs 1파 ' + (up ? '고점 ' : '저점 ') + px(pts[1].p) + ' — 겹침 없음'
        : (cd.diag
          ? '4파 ' + (up ? '저점 ' : '고점 ') + px(pts[4].p) + '이 1파 영역과 ' + (dir * (pts[1].p - pts[4].p) / cd.L.w1 * 100).toFixed(0) + '% 겹침 — 대각(Diagonal) 형태로 해석'
          : '4파가 1파 영역(' + px(pts[1].p) + ')과 겹침 — 규칙 위반')
    });
    return out;
  }

  /* 조정 패턴 정밀 판별: 지그재그 / 정상·확장·러닝 플랫 / 삼각수렴 */
  function ewCorrType(origin, post, dir) {
    var up = dir > 0;
    if (!post || !post.length) return { type: 'pending', name: '조정 미형성', detail: '', ratioB: null, ratioC: null };
    var o = origin.p, A = post[0];
    var aLen = Math.abs(A.p - o) || 1e-9;
    var out = { type: 'pending', name: '', detail: '', ratioB: null, ratioC: null, shape: null };
    var pctOf = function (v, base) { return ((v / base - 1) * 100).toFixed(1) + '%'; };
    if (post.length === 1) {
      out.type = 'progress'; out.name = 'A파 완료 · B파 진행';
      out.detail = 'A파 ' + (up ? '하락' : '반등') + ' ' + px(A.p) + ' · 임펄스 종결 ' + px(o) + ' 대비 ' + pctOf(A.p, o);
      return out;
    }
    var B = post[1];
    var rB = up ? (B.p - A.p) / Math.abs(o - A.p) : (A.p - B.p) / Math.abs(A.p - o);   /* B가 A를 되돌린 비율 (A 시작을 넘으면 >1) */
    out.ratioB = rB;
    if (post.length >= 3) {
      var C = post[2];
      out.ratioC = Math.abs(C.p - B.p) / aLen;
      if (post.length >= 4) {
        var tri = ewTriShape(post);
        if (tri.ok) {
          out.type = 'triangle';
          out.shape = tri.kind;
          out.name = tri.kind === 'contract' ? '삼각수렴 (A-B-C-D-E, 수축형)' : '삼각수렴 (A-B-C-D-E, 확대형)';
          out.detail = 'B파 되돌림 ' + (rB * 100).toFixed(0) + '% · 고점·저점이 ' +
            (tri.kind === 'contract' ? '좁아지는' : '넓어지는') + ' 구간에서 ' + post.length + '개 파동 진행';
          out.conf = 62;
          return out;
        }
      }
      if (rB < 0.618) {
        out.type = 'zigzag';
        out.name = '지그재그 (ZigZag)';
        out.detail = 'B파 되돌림 ' + (rB * 100).toFixed(0) + '% (<61.8%) · C파 = A파의 ' + (out.ratioC * 100).toFixed(0) + '%';
        out.conf = out.ratioC >= 0.8 && out.ratioC <= 1.4 ? 78 : 64;
        return out;
      }
      if (rB >= 0.9) {
        if (rB > 1.05 && out.ratioC > 1.0) {
          out.type = 'expanded';
          out.name = '확장 플랫 (Expanded Flat)';
          out.detail = 'B파가 A 시작을 ' + ((rB - 1) * 100).toFixed(0) + '% 초과 · C파 = A파의 ' + (out.ratioC * 100).toFixed(0) + '%';
        } else if (rB > 1.05) {
          out.type = 'running';
          out.name = '러닝 플랫 (Running Flat)';
          out.detail = 'B파가 A 시작을 ' + ((rB - 1) * 100).toFixed(0) + '% 초과 · C파가 A를 넘지 못함 (' + (out.ratioC * 100).toFixed(0) + '%)';
        } else {
          out.type = 'flat';
          out.name = '정상 플랫 (Regular Flat)';
          out.detail = 'B파 되돌림 ' + (rB * 100).toFixed(0) + '% (≥90%) · C파 = A파의 ' + (out.ratioC * 100).toFixed(0) + '%';
        }
        out.conf = 72;
        return out;
      }
      out.type = 'complex';
      out.name = '복합 조정 (W-X-Y 추정)';
      out.detail = 'B파 되돌림 ' + (rB * 100).toFixed(0) + '% · C파 = A파의 ' + (out.ratioC * 100).toFixed(0) + '%';
      return out;
    }
    /* A-B까지 */
    out.type = 'progress2';
    out.name = (rB >= 0.9 ? (rB > 1.05 ? '확장·러닝 플랫' : '플랫') : (rB >= 0.618 ? '복합 조정' : '지그재그')) + ' 진행 · C파 미형성';
    out.detail = 'B파 되돌림 ' + (rB * 100).toFixed(0) + '% (' + px(B.p) + ') · C파 진행 중';
    return out;
  }

  /* 한 레그의 내부 형태(단순/지그재그/플랫/삼각) — 교대 법칙 비교용 */
  function ewLegForm(series, i0, i1, dir) {
    if (i1 - i0 < 6) return '?';
    var h = series.h, l = series.l, c = series.c;
    var pv = zzWindow(h, l, i0, i1, clamp(ewMedVol(h, l, c) * 1.6, 0.01, 0.1));
    if (pv.length < 2) return 'simple';
    if (pv.length >= 5) {
      var tri = ewTriShape(pv.slice(-4));
      if (tri.ok) return tri.kind === 'contract' ? 'triangle' : 'complex';
      return 'complex';
    }
    if (pv.length >= 3) {
      var A = pv[0], B = pv[1], C = pv[2];
      var aLen = Math.abs(B.p - A.p) || 1e-9;
      return Math.abs(C.p - B.p) / aLen >= 0.85 ? 'flat' : 'zigzag';
    }
    return 'simple';
  }

  /* 카운트 점수: 구조 크기 · 규칙 준수 · 최근성 · 지배적 스윙 설명력 */
  function ewScoreOf(cd, ctx) {
    var span = cd.pts[cd.k].i - cd.pts[0].i;
    var s = 6 + cd.k * 3.4 + (cd.gl || 0) * 1.6;
    s += Math.min(9, Math.log(Math.max(span, 1)) * 1.9);
    s -= (cd.viol || 0) * 8.5;
    if (!cd.live) s -= 6;
    var back = ctx.j - cd.end;
    s += back <= 0 ? 4 : back === 1 ? 3 : back === 2 ? 1.6 : 0;
    if (span < 20) s -= 10; else if (span < 35) s -= 4;
    if (cd.post.length) s += 2.2;
    var rg = Math.max(ctx.hi - ctx.lo, 1e-9);
    if (cd.dir > 0) {
      if (cd.pts[0].p <= ctx.lo + rg * 0.10) s += 3.2;
      if (cd.pts[cd.k].p >= ctx.hi - rg * 0.10) s += 3.2;
    } else {
      if (cd.pts[0].p >= ctx.hi - rg * 0.10) s += 3.2;
      if (cd.pts[cd.k].p <= ctx.lo + rg * 0.10) s += 3.2;
    }
    return s;
  }

  /* 현재 진행 중인 파동(레그) */
  function ewCurrentLeg(cd, price) {
    var k = cd.k, post = cd.post, dir = cd.dir;
    var start, name, expect, dirExp;
    if (cd.form === 'abc') {
      start = cd.pts[k];
      name = '신규 1파'; expect = 'imp'; dirExp = -dir;
    } else if (!post.length) {
      start = cd.pts[k];
      name = ['', '2파', '3파', '4파', '5파', 'A파'][k] || 'A파';
      expect = (k === 1 || k === 3) ? 'cor' : 'imp';
      dirExp = (k === 1 || k === 3) ? -dir : dir;
    } else if (post.length >= 3) {
      start = post[post.length - 1];
      name = post.length === 3 ? '신규 1파' : (['D파', 'E파'][post.length - 3] || 'E파');
      expect = post.length === 3 ? 'imp' : 'cor';
      dirExp = post.length === 3 ? dir : -dir;
    } else {
      start = post[post.length - 1];
      name = post.length === 1 ? 'B파' : 'C파';
      expect = post.length === 1 ? 'cor' : 'imp';
      dirExp = post.length === 1 ? dir : -dir;
    }
    var dd = price > start.p ? 1 : (price < start.p ? -1 : 0);
    return {
      name: name, dir: dd || dirExp, expect: expect, start: start,
      glyph: name.replace('파', ''), dirWord: (dd || dirExp) > 0 ? '상승' : '하락'
    };
  }

  /* 직전 완료 파동(레그) */
  function ewPrevLeg(cd, series, price) {
    var k = cd.k, pts = cd.pts, dir = cd.dir, post = cd.post;
    if (post.length) {
      var i1 = post[post.length - 1].i;
      var i0 = post.length >= 2 ? post[post.length - 2].i : pts[5].i;
      var nm = ['A파', 'B파', 'C파', 'D파', 'E파'][post.length - 1];
      var isImp = post.length === 1 || post.length === 3;
      return { i0: i0, i1: i1, dir: isImp ? -dir : dir, expect: isImp ? 'imp' : 'cor', name: nm };
    }
    if (k >= 2) {
      var isI = k % 2 === 1;
      return {
        i0: pts[k - 1].i, i1: pts[k].i, dir: isI ? dir : -dir,
        expect: isI ? 'imp' : 'cor', name: ewLabels(cd)[k] + '파'
      };
    }
    return null;
  }

  /* 소파동 탐색: 한 레그 구간을 더 민감한 임계값으로 쪼갠다 */
  function ewSubSearch(series, leg, ctx) {
    var h = series.h, l = series.l, c = series.c, price = c[c.length - 1];
    var i0 = leg.start.i, i1 = c.length - 1;
    if (i1 - i0 < 7) return { ok: false };
    var vol = ewMedVol(h, l, c);
    var mults = [0.9, 1.2, 1.6, 2.1, 2.7];
    var best = null;
    for (var m = 0; m < mults.length; m++) {
      var thr = clamp(vol * mults[m], 0.008, 0.13);
      var pv = zzWindow(h, l, i0, i1, thr);
      if (pv.length < 2) continue;
      var origin = { i: i0, p: leg.start.p, t: leg.dir > 0 ? 'L' : 'H' };
      if (origin.p == null) continue;
      var seq = [origin], want = leg.dir > 0 ? 'H' : 'L';
      for (var q = 0; q < pv.length; q++) {
        var p = pv[q];
        if (p.i <= i0) continue;
        if (p.t !== want) continue;
        seq.push(p); want = want === 'H' ? 'L' : 'H';
      }
      if (seq.length < 3) continue;
      for (var e = 2; e < seq.length; e++) {
        for (var k = 2; k <= 5; k++) {
          if (e - k < 0) continue;
          var cd = ewCount(seq, e, k, leg.dir);
          if (!cd) continue;
          for (var q2 = e + 1; q2 < seq.length; q2++) cd.post.push(seq[q2]);
          if (cd.post.length > 3) continue;
          cd.live = cd.k === 1 ? true : (leg.dir * (price - cd.pts[cd.k].p) < 0 || cd.post.length > 0);
          cd.viol = (cd.r1 === false ? 1 : 0) + (cd.r2 === false ? 1 : 0) + (cd.r3 === false ? 1 : 0);
          var cover = (cd.pts[cd.k].i - i0) / Math.max(i1 - i0, 1);
          var s = 6 + cd.k * 3 + (cd.gl || 0) * 1.1 + cover * 5;
          s -= cd.viol * 6;
          s += (cd.form === leg.expect) ? 3.4 : (leg.expect === 'imp' && k >= 4 ? 1 : 0);
          if (cd.post.length) s += 0.8;
          if (e === seq.length - 1) s += 1.6; else if (e === seq.length - 2) s += 1;
          if (cd.pts[cd.k].i - i0 < 6) s -= 5;
          cd.score = s; cd.thr = thr;
          if (!best || cd.score > best.score) best = cd;
        }
      }
    }
    if (!best) return { ok: false };
    /* 표시용 정리 */
    var glyphs = EW_SUB[best.form === 'abc' ? 'cor' : 'imp'];
    var path = [], legs = [];
    for (var w = 0; w <= best.k; w++) path.push({ i: best.pts[w].i, p: best.pts[w].p, lab: glyphs[w], seg: best.form === 'abc' ? 'subcor' : 'subimp' });
    for (var q3 = 0; q3 < best.post.length; q3++) {
      path.push({ i: best.post[q3].i, p: best.post[q3].p, lab: EW_SUB.cor[q3 + 1] || '', seg: 'subcor' });
    }
    for (var w2 = 1; w2 <= best.k; w2++) {
      legs.push({
        lab: glyphs[w2], from: best.pts[w2 - 1].p, to: best.pts[w2].p,
        i0: best.pts[w2 - 1].i, i1: best.pts[w2].i,
        pct: best.pts[w2 - 1].p ? best.pts[w2].p / best.pts[w2 - 1].p - 1 : 0,
        dt: series.d[best.pts[w2].i]
      });
    }
    if (path.length && path[path.length - 1].i < i1) path.push({ i: i1, p: price, lab: '', seg: 'subrun' });
    return {
      ok: true, dir: leg.dir, k: best.k, form: best.form, pts: best.pts, post: best.post,
      thr: best.thr, path: path, legs: legs, gl: best.gl, viol: best.viol,
      lastLab: glyphs[best.k], nextLab: glyphs[Math.min(best.k + 1, 5)]
    };
  }

  /* 레그 시작 가격 (피벗 목록에서 찾고, 없으면 고가/저가로 대체) */
  function dir0(series, leg, cd) {
    var i = leg.i0;
    if (cd && cd.piv) {
      for (var q = 0; q < cd.piv.length; q++) if (cd.piv[q].i === i) return cd.piv[q].p;
    }
    return leg.dir > 0 ? series.l[i] : series.h[i];
  }

  /* 대파동 + 소파동 결합 */
  function ewSubOf(cd, series, ind, ctx, degreeKo) {
    var price = series.c[series.c.length - 1];
    var leg = ewCurrentLeg(cd, price);
    var sub = ewSubSearch(series, leg, ctx);
    var legName = leg.name;
    var pre = degreeKo || '대파동';
    if (!sub.ok) {
      var prev = ewPrevLeg(cd, series, price);
      if (prev) {
        var s2 = ewSubSearch(series, { start: { i: prev.i0, p: dir0(series, prev, cd), t: prev.dir > 0 ? 'L' : 'H' }, dir: prev.dir, expect: prev.expect, name: prev.name }, ctx);
        if (s2.ok) { s2.fallback = true; legName = prev.name + '(직전 완료)'; sub = s2; }
      }
      if (!sub.ok && cd.k >= 2) {              /* 임펄스 마지막 파동으로 한 번 더 */
        var pl = { i0: cd.pts[cd.k - 1].i, i1: cd.pts[cd.k].i, dir: cd.k % 2 === 1 ? cd.dir : -cd.dir,
          expect: cd.k % 2 === 1 ? 'imp' : 'cor', name: ewLabels(cd)[cd.k] + '파' };
        var s3 = ewSubSearch(series, { start: cd.pts[cd.k - 1], dir: pl.dir, expect: pl.expect, name: pl.name }, ctx);
        if (s3.ok) { s3.fallback = true; legName = pl.name + '(직전 완료)'; sub = s3; }
      }
    }
    if (!sub.ok) {
      return { ok: false, legName: legName, head: pre + ' ' + legName + ' 내부 소파동 미형성', detail: '민감도 임계값에서 내부 스윙이 3개 미만입니다' };
    }
    var imp = sub.form !== 'abc';
    var st = imp ? '소파동' : 'ABC';
    var head;
    if (sub.fallback) {
      head = pre + ' ' + legName.replace('(직전 완료)', '') + ' 내부 ' + st + ' ' + sub.lastLab + '파 완료 · ' + leg.name + ' 초입';
    } else {
      head = pre + ' ' + legName + ' 내부' + (imp ? '의 ' : ' ') + st + ' ' + sub.lastLab + '파 ' + (sub.post.length ? '완료' : '진행 중');
    }
    var detail = (sub.form === 'abc' ? 'A-B-C' : '(i)-(v)') + ' ' + sub.k + '개 파동 · 스윙 임계 ' +
      (sub.thr * 100).toFixed(1) + '% · ' + (sub.fallback ? '직전 완료 파동 내부' : '현재 진행 레그 내부');
    return {
      ok: true, legName: legName, leg: leg, head: head, detail: detail,
      k: sub.k, form: sub.form, path: sub.path, legs: sub.legs, thr: sub.thr,
      lastLab: sub.lastLab, nextLab: sub.nextLab, fallback: !!sub.fallback
    };
  }

  function ewMaxIn(arr, a, b) {
    var m = null;
    for (var i = Math.max(0, a); i <= b && i < arr.length; i++) { var v = arr[i]; if (v != null && (m === null || v > m)) m = v; }
    return m;
  }
  function ewMinIn(arr, a, b) {
    var m = null;
    for (var i = Math.max(0, a); i <= b && i < arr.length; i++) { var v = arr[i]; if (v != null && (m === null || v < m)) m = v; }
    return m;
  }

  /* 모멘텀 검증: 3파 최고 모멘텀 + 5파 다이버전스 */
  function ewMomentum(cd, series, ind) {
    var up = cd.dir > 0, pts = cd.pts, k = cd.k;
    var rsi = ind.rsi, mh = ind.macd.hist;
    var pickR = up ? ewMaxIn : ewMinIn, pickM = up ? ewMaxIn : ewMinIn;
    var out = [];
    if (k < 3) {
      out.push({ key: 'mom3', name: '3파 최고 모멘텀', state: 'pending', text: '3파 미형성 · 판정 대기' });
      out.push({ key: 'div5', name: '5파 다이버전스', state: 'pending', text: '5파 미형성 · 판정 대기' });
      return { items: out, div: null, wave3: null, wave5: null };
    }
    var r1 = pickR(rsi, pts[0].i, pts[1].i), r3 = pickR(rsi, pts[2].i, pts[3].i);
    var m1 = pickM(mh, pts[0].i, pts[1].i), m3 = pickM(mh, pts[2].i, pts[3].i);
    var degTxt = function (v) { return v == null ? '—' : v.toFixed(1); };
    if (r1 == null || r3 == null) {
      out.push({ key: 'mom3', name: '3파 최고 모멘텀', state: 'pending', text: 'RSI 표본 부족' });
    } else {
      var strong = up ? (r3 >= r1) : (r3 <= r1);
      var macdOk = (m1 == null || m3 == null) ? null : (up ? m3 >= m1 : m3 <= m1);
      out.push({
        key: 'mom3', name: '3파 최고 모멘텀', state: strong ? 'pass' : (macdOk ? 'warn' : 'fail'),
        text: 'RSI ' + degTxt(r3) + '(3파) vs ' + degTxt(r1) + '(1파) · MACD ' + (m3 == null ? '—' : m3.toFixed(2)) +
          ' vs ' + (m1 == null ? '—' : m1.toFixed(2)) +
          (strong ? ' — 3파가 가장 강한 구간' : (macdOk ? ' — RSI는 1파보다 낮고 MACD만 우위 (엇갈림)' : ' — 3파 모멘텀 열위'))
      });
    }
    /* 5파 극값 vs 모멘텀 */
    var div = null;
    if (k >= 5) {
      var ext3 = up ? ewMaxIn(series.h, pts[2].i, pts[3].i) : ewMinIn(series.l, pts[2].i, pts[3].i);
      var ext5 = up ? ewMaxIn(series.h, pts[4].i, pts[5].i) : ewMinIn(series.l, pts[4].i, pts[5].i);
      var r5 = pickR(rsi, pts[4].i, pts[5].i), m5 = pickM(mh, pts[4].i, pts[5].i);
      var newExt = up ? pts[5].p > pts[3].p : pts[5].p < pts[3].p;
      var rsiWeak = (r5 != null && r3 != null) ? (up ? r5 < r3 - 1.5 : r5 > r3 + 1.5) : false;
      var macdWeak = (m5 != null && m3 != null) ? (up ? m5 < m3 : m5 > m3) : false;
      if (newExt && (rsiWeak || (macdWeak && m5 != null && m3 != null))) {
        var which = (rsiWeak && macdWeak) ? 'RSI·MACD 모두' : (rsiWeak ? 'RSI' : 'MACD만');
        div = {
          type: up ? 'bear' : 'bull',
          text: (up ? '5파 약세 다이버전스 — 가격 ' : '5파 강세 다이버전스 — 가격 ') + px(pts[5].p) +
            (up ? ' > 3파 ' : ' < 3파 ') + px(pts[3].p) + (up ? ' 신고가인데 ' : ' 신저가인데 ') +
            which + ' 모멘텀 약화 (RSI ' + degTxt(r5) + ' vs ' + degTxt(r3) + ' · MACD ' +
            (m5 == null ? '—' : m5.toFixed(2)) + ' vs ' + (m3 == null ? '—' : m3.toFixed(2)) + ')'
        };
        out.push({ key: 'div5', name: '5파 다이버전스', state: 'warn', text: div.text + ' — ' + (up ? '조정' : '반등') + ' 신호' });
      } else if (!newExt) {
        out.push({
          key: 'div5', name: '5파 다이버전스', state: 'warn',
          text: '5파가 3파 극값을 넘지 못함 (실패 5파) — 추세 전환 경계'
        });
      } else {
        out.push({
          key: 'div5', name: '5파 다이버전스', state: 'pass',
          text: (up ? '신고가' : '신저가') + '와 함께 모멘텀도 ' + (up ? 'RSI ' + degTxt(r5) + ' ≥ ' + degTxt(r3) : 'RSI ' + degTxt(r5) + ' ≤ ' + degTxt(r3)) +
            ' — 다이버전스 없음 (추세 지속형)'
        });
      }
      return { items: out, div: div, wave3: { rsi: r3 }, wave5: { rsi: r5 } };
    }
    /* 5파 진행 중(k=4) — 현재 레그의 모멘텀으로 예비 판정 */
    if (k === 4) {
      var rNow = pickR(rsi, pts[4].i, series.c.length - 1);
      var newExt2 = up ? series.c[series.c.length - 1] > pts[3].p : series.c[series.c.length - 1] < pts[3].p;
      if (newExt2 && rNow != null && r3 != null && (up ? rNow < r3 - 1.5 : rNow > r3 + 1.5)) {
        out.push({
          key: 'div5', name: '5파 다이버전스', state: 'warn',
          text: '5파 진행 중 ' + (up ? '약세' : '강세') + ' 다이버전스 형성 — RSI ' + rNow.toFixed(1) + ' vs 3파 ' + r3.toFixed(1)
        });
      } else {
        out.push({ key: 'div5', name: '5파 다이버전스', state: 'pending', text: '5파 진행 중 · 다이버전스 판정 대기' });
      }
      return { items: out, div: null };
    }
    out.push({ key: 'div5', name: '5파 다이버전스', state: 'pending', text: '5파 미형성 · 판정 대기' });
    return { items: out, div: null };
  }

  /* 교대 법칙: 2파와 4파의 깊이·기간·형태가 교대하는지 */
  function ewAlternation(cd, series) {
    if (cd.k < 4 || cd.form === 'abc') {
      return { key: 'alt', name: '교대 법칙', state: 'pending', text: '2파·4파 비교 표본 부족 · 판정 대기' };
    }
    var pts = cd.pts, dir = cd.dir;
    var f2 = cd.L.w2 / cd.L.w1, f4 = cd.L.w4 / cd.L.w3;
    var d2 = pts[2].i - pts[1].i, d4 = pts[4].i - pts[3].i;
    var fm2 = ewLegForm(series, pts[1].i, pts[2].i, -dir);
    var fm4 = ewLegForm(series, pts[3].i, pts[4].i, -dir);
    var diffDepth = Math.abs(f2 - f4) >= 0.15;
    var diffTime = Math.max(d2, d4) >= Math.min(d2, d4) * 1.6 + 2;
    var diffForm = (fm2 !== '?' && fm4 !== '?') ? fm2 !== fm4 : false;
    var hits = (diffDepth ? 1 : 0) + (diffTime ? 1 : 0) + (diffForm ? 1 : 0);
    var fname = { zigzag: '지그재그', flat: '플랫', triangle: '삼각', complex: '복합', simple: '단순', '?': '—' };
    return {
      key: 'alt', name: '교대 법칙', state: hits >= 2 ? 'pass' : (hits === 1 ? 'warn' : 'fail'),
      text: '2파 되돌림 ' + (f2 * 100).toFixed(0) + '%·' + d2 + '일·' + (fname[fm2] || fm2) +
        ' vs 4파 ' + (f4 * 100).toFixed(0) + '%·' + d4 + '일·' + (fname[fm4] || fm4) +
        (hits >= 2 ? ' — 깊이·기간·형태가 교대' : hits === 1 ? ' — 한 항목만 교대 (신뢰도 보통)' : ' — 교대 미흡')
    };
  }

  /* 엘리어트 채널: 0-2 연결선과 1(또는 3)을 지나는 평행선 */
  function ewLine(a, b, i1) {
    var slope = (b.p - a.p) / Math.max(b.i - a.i, 1);
    return { slope: slope, at: function (i) { return a.p + slope * (i - a.i); } };
  }
  function ewChannel(cd, n, price) {
    var pts = cd.pts, k = cd.k, post = cd.post;
    if (k < 2) return null;
    var span = pts[k].i - pts[0].i;
    var i1 = Math.min(n - 1, pts[2].i + Math.round(span * 0.45));
    if (i1 - pts[2].i < 6) return null;
    var mk = function (kind, A, B, C) {
      var slope = (B.p - A.p) / Math.max(B.i - A.i, 1);
      var at = function (i) { return A.p + slope * (i - A.i); };
      var off = C.p - at(C.i);
      return {
        kind: kind, i0: A.i, i1: i1, slope: slope,
        baseFrom: { i: A.i, p: A.p }, baseTo: { i: B.i, p: B.p },
        paraFrom: { i: C.i, p: C.p }, paraTo: { i: i1, p: C.p + slope * (i1 - C.i) },
        endBase: at(i1), endPara: C.p + slope * (i1 - C.i),
        slopePct: slope / Math.max(A.p, 1e-9) * 100
      };
    };
    var cands = [mk('0-2', pts[0], pts[2], pts[1])];
    if (k >= 4) cands.push(mk('2-4', pts[2], pts[4], pts[3]));
    if (post.length >= 3) cands.push(mk('ABC', post[0], post[2], post[1]));
    var best = null, bestD = 1e9;
    for (var q = 0; q < cands.length; q++) {
      var c = cands[q];
      var lo = Math.min(c.endBase, c.endPara), hi = Math.max(c.endBase, c.endPara);
      var d = price < lo ? (lo - price) : (price > hi ? (price - hi) : 0);
      var rel = d / Math.max(price, 1e-9);
      if (rel < bestD) { bestD = rel; best = c; }
    }
    if (!best) return null;
    best.upper = Math.max(best.endBase, best.endPara);
    best.lower = Math.min(best.endBase, best.endPara);
    best.far = bestD > 0.12;                      /* 현재가가 채널을 크게 벗어남 */
    best.dist = bestD;
    return best;
  }

  /* 피보나치 클러스터: 여러 되돌림·확장이 겹치는 전환 구간 */
  function ewConfluence(cd, series, ind) {
    var pts = cd.pts, dir = cd.dir, P = function (w) { return pts[w].p; };
    var k = cd.k, post = cd.post;
    var price = series.c[series.c.length - 1];
    var w1 = cd.L.w1, w3 = cd.L.w3 || w1;
    var hi = Math.max.apply(null, series.h), lo = Math.min.apply(null, series.l);
    var rg = Math.max(hi - lo, 1e-9);
    var L = [];
    var add = function (name, p) { if (isFinite(p)) L.push({ name: name, p: p }); };
    if (k >= 2) {
      add('2파 0.618 되돌림', P(1) - dir * w1 * 0.618);
      add('2파 0.5 되돌림', P(1) - dir * w1 * 0.5);
      add('1파 1.618 확장', P(2) + dir * w1 * 1.618);
      add('1파 2.618 확장', P(2) + dir * w1 * 2.618);
    }
    if (k >= 3) {
      add('3파 0.382 되돌림', P(3) - dir * w3 * 0.382);
      add('3파 0.5 되돌림', P(3) - dir * w3 * 0.5);
      add('1파 = 3파', P(2) + dir * w3);
    }
    if (k >= 4) {
      add('5파 = 1파', P(4) + dir * w1);
      add('5파 = 3파×0.618', P(4) + dir * w3 * 0.618);
      add('4파 0.382 되돌림', P(4) - dir * w1 * 0.382);
    }
    if (k >= 5) {
      var R = Math.abs(P(5) - P(0));
      add('임펄스 0.382 되돌림', P(5) - dir * R * 0.382);
      add('임펄스 0.5 되돌림', P(5) - dir * R * 0.5);
      add('임펄스 0.618 되돌림', P(5) - dir * R * 0.618);
      if (post.length >= 3) {
        var aLen = Math.abs(post[0].p - P(5));
        add('C = A 등가', post[0].p - dir * aLen);
        add('C = A×1.618', post[0].p - dir * aLen * 1.618);
      }
      if (post.length >= 2) {
        var aLen2 = Math.abs(post[0].p - P(5));
        var e = post[post.length - 1].p;
        add('삼각 스러스트 0.618', e - dir * aLen2 * 0.618);
      }
    }
    L = L.filter(function (x) { return Math.abs(x.p - price) <= rg * 0.8; });
    if (!L.length) return [];
    L.sort(function (a, b) { return a.p - b.p; });
    var atr = nz(ind.atr[series.c.length - 1], price * 0.02) || price * 0.02;
    var tol = Math.max(atr * 0.55, price * 0.006);
    var clusters = [], cur = null;
    L.forEach(function (x) {
      if (!cur || x.p - cur.hi > tol) { cur = { lo: x.p, hi: x.p, src: [x] }; clusters.push(cur); }
      else { cur.hi = x.p; cur.src.push(x); }
    });
    var out = clusters.filter(function (z) { return z.src.length >= 2; }).map(function (z) {
      var mid = z.src.reduce(function (a, b) { return a + b.p; }, 0) / z.src.length;
      return {
        lo: z.lo, hi: z.hi, price: mid, count: z.src.length,
        names: z.src.map(function (s) { return s.name; }),
        side: mid > price ? '저항' : '지지', dist: Math.abs(mid / price - 1)
      };
    });
    out.sort(function (a, b) { return (b.count - a.count) || (a.dist - b.dist); });
    return out.slice(0, 3);
  }

  /* 피보나치 목표·지지·무효화 (현재 파동 단계별) */
  function ewPlan(cd, series, ind) {
    var dir = cd.dir, pts = cd.pts, k = cd.k, post = cd.post || [];
    var price = series.c[series.c.length - 1];
    var P = function (w) { return pts[w].p; };
    var plan = { targets: [], supports: [], inv: null, comment: '', bias: 'neu', dir: dir };
    var w1 = cd.L.w1, w3 = cd.L.w3 || w1;
    var up = dir > 0;
    var zone = function (name, a, b) { return { name: name, lo: Math.min(a, b), hi: Math.max(a, b) }; };
    var ztxt = function (z) { return px(z.lo) + '~' + px(z.hi); };
    var rtxt = function (a, b) { return px(Math.min(a, b)) + '~' + px(Math.max(a, b)); };
    var hiSide = up ? '고점' : '저점';
    var loSide = up ? '저점' : '고점';

    if (cd.form === 'abc') {
      var aLen = Math.abs(P(1) - P(0)), cLen = Math.abs(P(3) - P(2));
      var t1 = zone('신규 1파 목표 · 조정 0.5~0.618 회복', P(3) - dir * aLen * 0.5, P(3) - dir * cLen * 0.618);
      plan.targets.push(t1);
      plan.supports.push({ name: 'C파 ' + loSide + ' (조정 완료)', price: P(3) });
      plan.inv = { price: P(3), name: 'C파 ' + loSide };
      plan.comment = 'A-B-C 조정이 ' + (cd.L.w3 / cd.L.w1).toFixed(2) + '배(A 대비 C) 비율로 마무리된 자리입니다. ' +
        '조정 폭의 0.5~0.618 회복 ' + ztxt(t1) + '이 1차 목표이며, C파 ' + loSide + ' ' + px(P(3)) +
        ' 이탈 시 조정 연장(더블 지그재그)으로 봅니다.';
      plan.bias = up ? 'bear' : 'bull';
      return plan;
    }

    if (k < 5) {
      if (k === 1) {
        var r382 = P(1) - dir * w1 * 0.382, r500 = P(1) - dir * w1 * 0.5, r618 = P(1) - dir * w1 * 0.618;
        plan.supports.push({ name: '0.382 되돌림', price: r382 });
        plan.supports.push({ name: '0.5 되돌림', price: r500 });
        plan.supports.push({ name: '0.618 되돌림', price: r618 });
        plan.targets.push(zone('3파 예상 목표 (2파 0.618 조정 가정)', r618 + dir * w1 * 1.382, r618 + dir * w1 * 1.618));
        plan.inv = { price: P(0), name: '1파 시작점' };
        plan.comment = '1파 ' + px(P(0)) + '→' + px(P(1)) + ' 완료 후 2파 조정 국면으로 봅니다. 0.5~0.618 되돌림 ' +
          rtxt(r500, r618) + '이 분할 매수 참고 구간이며, 1파 시작점 ' + px(P(0)) + ' 이탈 시 카운트가 무효입니다.';
      } else if (k === 2) {
        var t2 = zone('1차 목표 · 1파의 1.382~1.618배', P(2) + dir * w1 * 1.382, P(2) + dir * w1 * 1.618);
        plan.targets.push(t2);
        plan.targets.push(zone('2차 목표 · 1파의 2.618배', P(2) + dir * w1 * 2.5, P(2) + dir * w1 * 2.618));
        plan.supports.push({ name: '2파 ' + loSide, price: P(2) });
        plan.inv = { price: P(2), name: '2파 ' + loSide };
        plan.comment = '3파 진행 구간으로 파동 이론상 가장 힘 있는 자리입니다. 1차 목표 ' + ztxt(t2) +
          ', 2차 목표는 1파의 2.618배 확장 구간입니다. 2파 ' + loSide + ' ' + px(P(2)) + ' 이탈 시 카운트가 무효화됩니다.';
      } else if (k === 3) {
        var s4a = P(3) - dir * w3 * 0.382, s4b = P(3) - dir * w3 * 0.5;
        plan.supports.push({ name: '0.382 되돌림', price: s4a });
        plan.supports.push({ name: '0.5 되돌림', price: s4b });
        plan.targets.push(zone('5파 예상 목표 (4파 0.382 조정 가정)',
          s4a + dir * Math.min(w3 * 0.618, w1), s4a + dir * Math.max(w3 * 0.618, w1)));
        plan.inv = { price: P(1), name: '1파 ' + hiSide };
        plan.comment = '3파 완료 후 4파 조정 중입니다. 0.382~0.5 되돌림 ' + rtxt(s4b, s4a) + '이 1차 지지 후보이고, ' +
          '4파가 1파 ' + hiSide + ' ' + px(P(1)) + '과 겹치면 절대 규칙 위반으로 카운트를 다시 봐야 합니다.' +
          (plan.targets.length ? ' 조정 후 5파 목표는 ' + ztxt(plan.targets[0]) + ' 구간입니다.' : '');
      } else if (k === 4) {
        var t5 = zone('5파 목표 · 1파의 1.0배 ~ 3파의 0.618배',
          P(4) + dir * Math.min(w1, w3 * 0.618), P(4) + dir * Math.max(w1, w3 * 0.618));
        plan.targets.push(t5);
        plan.supports.push({ name: '4파 ' + loSide, price: P(4) });
        plan.inv = { price: P(4), name: '4파 ' + loSide };
        plan.comment = '5파 진행 구간입니다. 목표 ' + ztxt(t5) + ' 부근에서 임펄스가 마무리될 수 있어 분할 익절이 유리하고, ' +
          '4파 ' + loSide + ' ' + px(P(4)) + ' 이탈 시 5파 카운트가 무효입니다.';
      }
    } else {
      var R = Math.abs(P(5) - P(0));
      if (!post.length) {
        var c1 = zone('ABC 1차 조정 목표 · 0.382 되돌림', P(5) - dir * R * 0.382, P(5) - dir * R * 0.324);
        plan.targets.push(c1);
        plan.targets.push(zone('ABC 2차 조정 목표 · 0.5~0.618 되돌림', P(5) - dir * R * 0.618, P(5) - dir * R * 0.5));
        plan.inv = { price: P(5), name: '5파 ' + hiSide };
        plan.comment = '5파 완료 후 조정 국면입니다. 임펄스의 0.382~0.618 되돌림 ' + rtxt(P(5) - dir * R * 0.382, P(5) - dir * R * 0.618) +
          '까지 ABC 조정이 나올 수 있어, 신규 진입은 조정 완료 신호를 확인한 뒤가 안전합니다. 5파 ' + hiSide + ' ' + px(P(5)) +
          (up ? ' 돌파는 5파 연장' : ' 이탈은 하락 연장') + '으로 봅니다.';
      } else if (post.length === 1) {
        var A0 = post[0].p, aLen0 = Math.abs(A0 - P(5));
        var bz = zone('B파 목표 · A파의 0.382~0.618 되돌림', A0 + dir * aLen0 * 0.382, A0 + dir * aLen0 * 0.618);
        var cMid = A0 + dir * aLen0 * 0.5 - dir * aLen0;
        plan.targets.push(bz);
        plan.supports.push({ name: 'A파 ' + loSide, price: A0 });
        plan.inv = { price: P(5), name: '5파 ' + hiSide };
        plan.comment = 'A파가 ' + px(P(5)) + '→' + px(A0) + ' (' + (aLen0 / Math.abs(P(5) - P(0)) * 100).toFixed(0) +
          '% 되돌림)에서 완료되고 B파 되돌림이 진행 중입니다. B파 목표는 A파의 0.382~0.618 되돌림 ' + ztxt(bz) +
          '이고, B파가 끝나면 C파가 A파와 등가(약 ' + px(cMid) + ')까지 열립니다. ' +
          (up ? '5파 고점 ' : '5파 저점 ') + px(P(5)) + (up ? '을 다시 넘으면' : '을 다시 이탈하면') + ' 조정 카운트가 무효입니다.';
      } else if (post.length === 2) {
        var A2 = post[0].p, B2 = post[1].p, aLen3 = Math.abs(A2 - P(5));
        var cz = zone('C파 목표 · A파의 1.0~1.618배', A2 - dir * aLen3 * 1.618, A2 - dir * aLen3 * 1.0);
        plan.targets.push(cz);
        plan.supports.push({ name: 'A파 ' + loSide, price: A2 });
        plan.inv = { price: B2, name: 'B파 ' + hiSide };
        plan.comment = 'B파 반등 후 C파를 준비하는 자리입니다. C파 목표 ' + ztxt(cz) + '까지 열려 있고, ' +
          'B파 ' + hiSide + ' ' + px(B2) + ' 돌파 시 조정이 끝난 것으로 봅니다.';
      } else if (post.length === 3) {
        var A3 = post[0].p, C3 = post[2].p, cw = Math.abs(A3 - P(5));
        var nz1 = zone('신규 ' + (up ? '상승' : '하락') + ' 1파 목표 · 조정 0.5~0.618 회복', C3 + dir * cw * 0.5, C3 + dir * cw * 0.618);
        plan.targets.push(nz1);
        plan.supports.push({ name: 'C파 ' + loSide + ' (조정 완료)', price: C3 });
        plan.inv = { price: C3, name: 'C파 ' + loSide };
        plan.comment = 'ABC 조정이 마무리되고 신규 임펄스 1파가 시작되는 자리로 봅니다. 1차 목표는 조정 폭의 0.5~0.618 회복 ' +
          ztxt(nz1) + '이고, C파 ' + loSide + ' ' + px(C3) + ' 이탈 시 조정 연장입니다.';
      } else {
        var eP = post[post.length - 1].p, wide = Math.abs(post[1].p - post[0].p);
        var thrust = eP + dir * wide * 0.618;
        plan.targets.push(zone('삼각 스러스트 목표 · 0.618배', thrust - Math.abs(wide) * 0.12, thrust + Math.abs(wide) * 0.12));
        plan.inv = { price: eP, name: (post.length === 4 ? 'D파' : 'E파') + ' ' + (up ? '저점' : '고점') };
        plan.comment = 'A-B-C-D(-E) 삼각수렴이 진행 중입니다. 수렴 완료 후 삼각 최대 폭의 0.618배 스러스트 ' + px(thrust) +
          '를 목표로 추세가 재개되는 패턴이고, 마지막 변곡점 ' + px(eP) + ' 이탈 시 무효입니다.';
      }
    }
    plan.bias = (k < 5) ? (up ? 'bull' : 'bear') : 'neu';
    if (plan.inv) plan.inv.side = plan.inv.price > price ? '돌파' : '이탈';
    return plan;
  }

  /* 기본/대안 시나리오 한 줄 요약 */
  function ewScenarioText(cd, plan, leg) {
    var k = cd.k, post = cd.post || [], up = cd.dir > 0;
    var w = up ? '상승' : '하락';
    var a, b;
    if (cd.form === 'abc') {
      a = 'A-B-C 조정 완료 → 신규 ' + (up ? '하락' : '상승') + ' 1파 전개';
      b = 'C파 ' + (up ? '저점' : '고점') + ' 이탈 시 조정 연장(더블 지그재그)';
      return { main: a, alt: b };
    }
    if (!post.length) {
      if (k === 1) { a = '2파 조정 마무리 후 3파 ' + w + ' 전개'; b = '1파 시작점 이탈 시 임펄스 무효 · 조정 연장'; }
      else if (k === 2) { a = '3파 연장 → 목표 구간 도달 후 4파 조정'; b = '2파 레벨 이탈 시 3파 실패 · 카운트 재검토'; }
      else if (k === 3) { a = '4파 조정 완료 → 5파 ' + w + ' 재개'; b = '1파 고점과 겹치면 절대 규칙 위반 · 카운트 폐기'; }
      else if (k === 4) { a = '5파 목표 도달 후 임펄스 종료 → ABC 조정'; b = '4파 이탈 시 5파 실패 · 추세 전환 신호'; }
      else { a = 'ABC 조정 진행 → 0.382~0.618 되돌림 후 신규 임펄스'; b = '5파 극단 ' + (up ? '돌파' : '이탈') + ' 시 파동 연장(확장 임펄스)'; }
    } else if (post.length === 1) {
      a = 'A파 완료 → B파 반등 후 C파 재개'; b = '5파 극단 회복 시 조정 종료 · 기존 추세 재개';
    } else if (post.length === 2) {
      a = 'B파 완료 → C파 목표까지 ' + (up ? '하락' : '상승'); b = 'B파 극단 ' + (up ? '돌파' : '이탈') + ' 시 조정 종료 · 신규 추세';
    } else if (post.length === 3) {
      a = 'C파 완료 → 신규 ' + w + ' 1파 전개'; b = 'C파 극단 이탈 시 조정 연장(더블 지그재그)';
    } else {
      a = '삼각수렴 완료 → 스러스트 ' + w + ' 재개'; b = '마지막 변곡점 이탈 시 수렴 실패 · 추세 전환';
    }
    return { main: a, alt: b };
  }

  /* 한 카운트를 카드·차트가 바로 쓸 수 있는 시나리오로 확장 */
  function ewBuild(cd, series, ind, ctx) {
    var n = series.c.length, price = series.c[n - 1];
    var dir = cd.dir, k = cd.k, post = cd.post, pts = cd.pts;
    var dirWord = dir > 0 ? '상승' : '하락';
    var span = pts[k].i - pts[0].i;
    var degree = span >= ctx.n * 0.5 ? 'Primary' : span >= ctx.n * 0.25 ? 'Intermediate' : 'Minor';
    var degreeKo = { Primary: '대파동', Intermediate: '대파동', Minor: '소파동' }[degree];
    var degreeEn = { Primary: 'Primary', Intermediate: 'Intermediate', Minor: 'Minor' }[degree];
    var labs = ewLabels(cd);
    var leg = ewCurrentLeg(cd, price);
    var sub = ewSubOf(cd, series, ind, ctx, degree === 'Minor' ? '주 카운트' : '대파동');
    var plan = ewPlan(cd, series, ind);
    var corr = (cd.form === 'abc')
      ? ewCorrType(pts[0], [pts[1], pts[2], pts[3]], dir)
      : ewCorrType(pts[k], post, dir);
    var chan = ewChannel(cd, n, price);
    var mom = ewMomentum(cd, series, ind);
    var alt = ewAlternation(cd, series);
    var conf = ewConfluence(cd, series, ind);
    var clean = cd.viol <= 0.5;

    /* 라벨 */
    var label, badge, kindTxt;
    if (cd.form === 'abc') {
      label = dirWord + ' A-B-C 조정 완료';
      badge = 'C';
      kindTxt = '조정 A-B-C';
    } else if (!post.length) {
      var nm = ['', '1파 완료 · 2파 조정', '3파 진행', '3파 완료 · 4파 조정', '4파 완료 · 5파 진행', '5파 완료'][k];
      label = dirWord + ' ' + nm;
      badge = k === 1 ? '2' : k === 2 ? '3' : k === 3 ? '4' : '5';
      kindTxt = k >= 5 ? '임펄스 5파 완료' : '임펄스 ' + k + '파 완료';
    } else if (post.length === 1) {
      label = dirWord + ' 5파 완료 · A파 완료 · B파 ' + (dirWord === '상승' ? '반등' : '눌림');
      badge = 'B';
      kindTxt = '5파 완료 · ABC 조정 (B파 진행)';
    } else if (post.length === 2) {
      label = dirWord + ' 5파 완료 · B파 완료 · C파 진행';
      badge = 'C';
      kindTxt = '5파 완료 · ABC 조정 (C파 진행)';
    } else if (post.length === 3) {
      label = dirWord + ' 5파 완료 · A-B-C 조정 완료';
      badge = '1';
      kindTxt = '5파 완료 · ABC 조정 완료';
    } else {
      label = dirWord + ' 5파 완료 · 삼각수렴 ' + ['D', 'E'][post.length - 4] + '파 진행';
      badge = ['D', 'E'][post.length - 4] || 'E';
      kindTxt = '5파 완료 · 삼각수렴 (A-B-C-D-E)';
    }
    if (!clean) label += ' (규칙 위반)';
    if (!cd.live) label += ' · 무효화 이탈';

    var conf2 = Math.round(clamp(
      36 + k * 6.5 + cd.gl * 1.3 + (clean ? 7 : -9) + (cd.live ? 6 : -7) + (post.length ? 2 : 0) +
      (mom.div ? 3 : 0) + (alt.state === 'pass' ? 3 : 0) + (sub.ok ? 2 : 0) +
      (sub.ok && ((leg.expect === 'cor' && sub.form !== 'abc' && sub.k >= 5) || (leg.expect !== 'cor' && sub.form === 'abc')) ? -5 : 0), 20, 96));
    if (!clean) conf2 = Math.min(conf2, cd.viol >= 2 ? 42 : 58);
    if (!cd.live) conf2 = Math.min(conf2, 38);

    /* 차트 경로 */
    var path = [];
    for (var w = 0; w <= k; w++) path.push({ i: pts[w].i, p: pts[w].p, lab: labs[w], seg: 'imp', deg: 'major' });
    for (var q = 0; q < post.length; q++) path.push({ i: post[q].i, p: post[q].p, lab: 'ABCDE'[q], seg: 'cor', deg: 'major' });
    var lastPt = path[path.length - 1];
    if (n - 1 > lastPt.i) path.push({ i: n - 1, p: price, lab: '', seg: 'run', deg: 'major' });

    /* 파동 다리 요약 */
    var legs = [];
    for (var w2 = 1; w2 <= k; w2++) {
      var len = Math.abs(pts[w2].p - pts[w2 - 1].p);
      legs.push({
        lab: labs[w2] + '파', from: pts[w2 - 1].p, to: pts[w2].p, i0: pts[w2 - 1].i, i1: pts[w2].i,
        len: len, pct: pts[w2 - 1].p ? (pts[w2].p / pts[w2 - 1].p - 1) : 0,
        ratio: w2 === 1 ? null : (len / cd.L.w1), dt: series.d[pts[w2].i]
      });
    }
    for (var q2 = 0; q2 < post.length; q2++) {
      var f0 = q2 === 0 ? pts[5].p : post[q2 - 1].p;
      legs.push({
        lab: 'ABCDE'[q2] + '파', from: f0, to: post[q2].p,
        i0: q2 === 0 ? pts[5].i : post[q2 - 1].i, i1: post[q2].i,
        len: Math.abs(post[q2].p - f0), pct: f0 ? (post[q2].p / f0 - 1) : 0,
        ratio: null, dt: series.d[post[q2].i]
      });
    }

    var guidelines = [alt].concat(mom.items);
    if (sub.ok) {
      var legCor = (leg.expect === 'cor');
      var subImp = sub.form !== 'abc';
      if (legCor && subImp && sub.k >= 5) {
        guidelines.push({
          key: 'legform', name: '조정 레그 내부 구조', state: 'warn',
          text: leg.name + '는 조정 파동인데 내부가 5소파 충격형 — 카운트 재검토 신호'
        });
      } else if (!legCor && !subImp) {
        guidelines.push({
          key: 'legform', name: '충격 레그 내부 구조', state: 'warn',
          text: leg.name + '는 충격 파동인데 내부가 ABC 3파 — 등급 강등 검토'
        });
      } else {
        guidelines.push({
          key: 'legform', name: '레그 내부 구조', state: 'pass',
          text: leg.name + ' (' + (legCor ? '조정 기대' : '충격 기대') + ') 내부 ' +
            (subImp ? '5소파 충격형' : 'ABC 조정형') + ' — 구조 일치'
        });
      }
    }

    return {
      dir: dir, dirWord: dirWord, kind: cd.form === 'abc' ? 'corrective' : 'impulse',
      wave: cd.form === 'abc' ? 3 : k, form: cd.form, k: k, postN: post.length,
      label: label, badge: badge, kindTxt: kindTxt, conf: conf2, valid: clean, live: cd.live, viol: cd.viol,
      degree: degree, degreeKo: degreeKo, degreeEn: degreeEn, span: span, thr: cd.thr, diag: !!cd.diag,
      rules: ewRules(cd), guidelines: guidelines, momentum: mom, corr: corr, channel: chan,
      targets: plan.targets, supports: plan.supports, inv: plan.inv, comment: plan.comment, bias: plan.bias,
      scenario: ewScenarioText(cd, plan, leg), leg: leg, sub: sub, confluence: conf,
      path: path, legs: legs,
      from: { i: pts[0].i, p: pts[0].p, d: series.d[pts[0].i] },
      to: { i: pts[k].i, p: pts[k].p, d: series.d[pts[k].i] },
      fib: { w1: cd.L.w1, w2: cd.L.w2 || null, w3: cd.L.w3 || null, w4: cd.L.w4 || null, w5: cd.L.w5 || null },
      pivots: (cd.piv || []).map(function (x) { return { i: x.i, p: x.p, t: x.t }; })
    };
  }

  /* 대안 카운트가 기본 카운트를 뒤집는 트리거 가격 */
  function ewSwitch(prim, altCd, alt, price) {
    var d = prim.dir, P = prim.pts[prim.k].p, A = altCd.pts[altCd.k].p;
    var side = function (v) { return v > price ? '돌파' : '이탈'; };
    if (altCd.dir === d && ((d > 0 && A > P) || (d < 0 && A < P))) {
      return { price: P, text: px(P) + ' ' + (P > price ? '돌파' : '이탈') + ' 시 임펄스 연장 — 대안 카운트 우세', tone: 'on' };
    }
    var inv = alt.inv ? alt.inv.price : A;
    return {
      price: inv,
      text: px(inv) + ' ' + side(inv) + ' 시 대안 카운트 무효 — 기본 시나리오 유지',
      textAlt: px(inv) + ' ' + side(inv) + ' 시 이 대안 카운트 무효 — 기본 시나리오로 복귀',
      tone: 'off'
    };
  }

  function ewDiffers(a, b) {
    return a.dir !== b.dir || a.k !== b.k ||
      Math.abs(a.pts[0].i - b.pts[0].i) >= 10 || Math.abs(a.pts[a.k].i - b.pts[b.k].i) >= 10;
  }

  /* 메인: 엘리어트 파동 분석 (기본 + 대안 카운트) */
  function ewAnalyze(series, ind) {
    var c = series.c, h = series.h, l = series.l, n = c.length;
    var out = { ok: false, reason: '표본 부족', path: [], rules: [], targets: [], supports: [], scenarios: [] };
    if (n < 80) return out;
    var price = c[n - 1];
    var sets = zigzagSet(h, l, c);
    if (!sets.length) { out.reason = '스윙 피벗 부족'; return out; }
    var ctx = { n: n, price: price, lo: Math.min.apply(null, l), hi: Math.max.apply(null, h), j: 0 };
    var pool = [];
    for (var si = 0; si < sets.length; si++) {
      var pv = sets[si].piv, j = pv.length - 1;
      ctx.j = j;
      for (var e = Math.max(4, j - 3); e <= j; e++) {
        for (var k = 1; k <= 5; k++) {
          if (e - k < 0) continue;
          if (e < j && (j - e) > 5) continue;
          for (var di = 0; di < 2; di++) {
            var cd = ewCount(pv, e, k, di === 0 ? 1 : -1);
            if (!cd) continue;
            cd.thr = sets[si].thr; cd.lvl = sets[si].lvl; cd.piv = pv;
            for (var q = e + 1; q <= j; q++) cd.post.push(pv[q]);
            if (!ewPostOk(cd)) continue;
            cd.live = ewLiveOk(cd, price);
            cd.viol = (cd.r1 === false ? 1 : 0) + (cd.r2 === false ? 1 : 0) + (cd.r3 === false ? 1 : 0);
            /* 4파가 1파 고점과 소폭 겹치는 대각(diagonal)은 규칙 위반이 아니라 형태로 인정 */
            cd.diag = false;
            if (cd.r3 === false && cd.k >= 4) {
              var ov = cd.dir * (cd.pts[1].p - cd.pts[4].p);
              if (ov > 0 && ov <= cd.L.w1 * 0.25) { cd.diag = true; cd.viol -= 0.5; }
            }
            cd.score = ewScoreOf(cd, ctx);
            pool.push(cd);
          }
        }
      }
    }
    if (!pool.length) { out.reason = '파동 카운트 없음'; return out; }
    pool.sort(function (a, b) { return b.score - a.score; });

    /* 대파동 우선: 전체 구간의 25% 이상을 설명하는 카운트 중 최고점 (규칙 위반 1건까지 허용).
       큰 차수가 조금 불리해도 차수 우선으로 읽는다 — 파동은 차수부터 정하는 것이 원칙. */
    var cleanLive = pool.filter(function (x) { return x.viol <= 0.5 && x.live; });
    var clean = pool.filter(function (x) { return x.viol <= 0.5; });
    var best = pool[0].score;
    var spanOk = function (x) { return x.pts[x.k].i - x.pts[0].i >= n * 0.25; };
    var bigLive = pool.filter(function (x) { return spanOk(x) && x.viol <= 0.5 && x.live; });
    var bigAny = pool.filter(function (x) { return spanOk(x) && x.viol <= 0.5; });
    var floorScore = Math.max(24, best - 16);
    var prim;
    if (bigLive.length && bigLive[0].score >= floorScore) prim = bigLive[0];      /* 대파동 + 규칙 준수 + 유효 */
    else if (cleanLive.length) prim = cleanLive[0];                                /* 유효한 카운트 우선 */
    else if (bigAny.length && bigAny[0].score >= floorScore) prim = bigAny[0];
    else if (clean.length) prim = clean[0];
    else prim = pool[0];

    /* 대안: 구조가 다른 차선 카운트 (방향이 다른 쪽을 먼저) */
    var altCd = null, i;
    for (i = 0; i < pool.length; i++) {
      var x = pool[i];
      if (x === prim) continue;
      if (prim.score - x.score > 30) break;
      if (x.dir !== prim.dir && ewDiffers(x, prim)) { altCd = x; break; }
    }
    if (!altCd) {
      for (i = 0; i < pool.length; i++) {
        var y = pool[i];
        if (y === prim) continue;
        if (prim.score - y.score > 22) break;
        if (ewDiffers(y, prim)) { altCd = y; break; }
      }
    }

    var S0 = ewBuild(prim, series, ind, ctx);
    S0.name = '기본 시나리오';
    var scen = [S0];
    if (altCd) {
      var S1 = ewBuild(altCd, series, ind, ctx);
      S1.name = '대안 시나리오';
      S1.switch = ewSwitch(prim, altCd, S1, price);
      S0.switch = S1.switch;
      scen.push(S1);
    }
    out = { ok: true, scenarios: scen, count: scen.length };
    /* 하위 호환: 기본 시나리오 필드를 최상위에 그대로 노출 */
    for (var f in S0) if (Object.prototype.hasOwnProperty.call(S0, f)) out[f] = S0[f];
    out.scenarios = scen;
    out.count = scen.length;
    return out;
  }


  /* ============================================================
     Public: analyze one ticker
     ============================================================ */
  function analyze(ticker, name, series, opts) {
    var ind = computeIndicators(series);
    var sc = scoreSeries(series, ind);
    var bt = backtestRun(series, ind, sc, opts);
    var n = series.c.length;
    var i = n - 1;
    var price = series.c[i], prev = series.c[i - 1];
    var atrNow = nz(ind.atr[i], price * 0.02);
    var score = sc.score[i];
    var lab = labelOf(score);
    var g = sc.groups[i];
    var rec = {
      price: price, change: price / prev - 1, changeAbs: price - prev,
      score: score, label: lab, groups: g,
      rsi: ind.rsi[i], macdHist: ind.macd.hist[i], macd: ind.macd.line[i], macdSig: ind.macd.signal[i],
      atr: atrNow, atrPct: atrNow / price,
      ema20: ind.ema20[i], ema50: ind.ema50[i], ema200: ind.ema200[i],
      bbUp: ind.bb.up[i], bbLo: ind.bb.lo[i], bbMid: ind.bb.mid[i],
      vol: series.v[i], volAvg: ind.volSma[i], volRatio: ind.volSma[i] ? series.v[i] / ind.volSma[i] : null,
      hi52: Math.max.apply(null, series.h.slice(Math.max(0, n - 252))),
      lo52: Math.min.apply(null, series.l.slice(Math.max(0, n - 252))),
      stop: price - 6 * atrNow, target: price + 10 * atrNow,
      entryZone: [Math.max(price - 1.2 * atrNow, ind.ma20[i] || price), price + 0.3 * atrNow],
      lastDate: series.d[i],
      hist: { score: sc.score.slice(-260), dates: series.d.slice(-260) },
      ind: ind, scoreSeries: sc
    };
    rec.stats = bt.stats;
    rec.trades = bt.trades;
    rec.equity = bt.equity;
    rec.startIdx = bt.startIdx;
    rec.dates = series.d;
    rec.close = series.c;
    rec.elliott = ewAnalyze(series, ind);
    return rec;
  }

  var api = {
    sma: sma, ema: ema, rsi: rsi, macd: macd, atr: atr, stdev: stdev,
    bollinger: bollinger, obv: obv,
    computeIndicators: computeIndicators, scoreSeries: scoreSeries,
    backtest: backtestRun, analyze: analyze, labelOf: labelOf, LABELS: LABELS, explain: explain,
    clamp: clamp, elliott: ewAnalyze
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.QE = api;
})(typeof window !== 'undefined' ? window : globalThis);
