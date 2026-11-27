/* ============================================================
   오늘의 주식 공부 & 검색기 팁 — 33편 인라인 SVG 도해 (개념도)
   : 실제 종목 데이터가 아니라 개념을 설명하기 위한 그림입니다.
   : 380x210 viewBox · 다크 HUD 톤(#07101E) · 한국어 라벨 기준 설계
   ============================================================ */
var EDUFIG = (function () {
  'use strict';

  var X0 = 26, X1 = 366, H = 210, W = 380;
  var C = {
    up: '#2FD9A6', dn: '#FB7185', cy: '#38BDF8', cy2: '#8FE7FF', am: '#F5B942',
    vi: '#A78BFA', tx: '#D9E4F2', mu: '#93A1B5', dim: '#5C6B80', or: '#FB923C'
  };

  function R(v) { return Math.round(v * 10) / 10; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function wide(ch) {
    return (ch >= 0x1100 && ch <= 0x115F) || (ch >= 0x2E80 && ch <= 0xA4CF) ||
      (ch >= 0xAC00 && ch <= 0xD7A3) || (ch >= 0xF900 && ch <= 0xFAFF) ||
      (ch >= 0xFE30 && ch <= 0xFE4F) || (ch >= 0xFF00 && ch <= 0xFF60);
  }
  function tw(s, fs) {
    var w = 0;
    for (var i = 0; i < s.length; i++) w += wide(s.charCodeAt(i)) ? fs * 1.0 : fs * 0.56;
    return w;
  }
  function T(x, y, s, o) {
    o = o || {};
    var a = '<text x="' + R(x) + '" y="' + R(y) + '" fill="' + (o.c || C.mu) + '" font-size="' + (o.fs || 8.8) + '"';
    if (o.a) a += ' text-anchor="' + o.a + '"';
    if (o.w) a += ' font-weight="' + o.w + '"';
    if (o.o != null) a += ' opacity="' + o.o + '"';
    return a + '>' + esc(s) + '</text>';
  }
  /* 라벨 칩: 반투명 배경 + 테두리 → 차트 선과 겹쳐도 읽히게 */
  function chip(x, y, s, o) {
    o = o || {};
    var fs = o.fs || 8.3, w = tw(s, fs) + 11, h = fs + 7.6;
    var bx = o.a === 'end' ? x - w : o.a === 'middle' ? x - w / 2 : x;
    return '<rect x="' + R(bx) + '" y="' + R(y - h / 2) + '" width="' + R(w) + '" height="' + R(h) + '" rx="' + R(h / 2) +
      '" fill="' + (o.bg || 'rgba(7,16,30,.94)') + '" stroke="' + (o.bd || 'rgba(120,190,230,.34)') + '" stroke-width=".8"/>' +
      T(bx + w / 2, y + fs * 0.36, s, { c: o.c || C.cy2, fs: fs, w: 600, a: 'middle' });
  }
  function badge(x, y, s, o) {
    o = o || {};
    var r = o.r || 7.2, fs = o.fs || 8.4;
    return '<circle cx="' + R(x) + '" cy="' + R(y) + '" r="' + r + '" fill="' + (o.bg || 'rgba(7,16,30,.95)') +
      '" stroke="' + (o.c || C.cy) + '" stroke-width="' + (o.sw || 1.1) + '"/>' +
      T(x, y + fs * 0.36, s, { c: o.c || C.cy, fs: fs, w: 600, a: 'middle' });
  }
  function line(x1, y1, x2, y2, o) {
    o = o || {};
    return '<line x1="' + R(x1) + '" y1="' + R(y1) + '" x2="' + R(x2) + '" y2="' + R(y2) + '" stroke="' + (o.c || C.cy) +
      '" stroke-width="' + (o.w || 1.2) + '"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') +
      ' stroke-linecap="round" opacity="' + (o.o == null ? 1 : o.o) + '"/>';
  }
  function poly(pts, o) {
    o = o || {};
    var d = '';
    for (var i = 0; i < pts.length; i++) d += (i ? 'L' : 'M') + R(pts[i][0]) + ' ' + R(pts[i][1]);
    return '<path d="' + d + '" fill="none" stroke="' + (o.c || C.cy) + '" stroke-width="' + (o.w || 1.7) + '"' +
      (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + ' stroke-linecap="round" stroke-linejoin="round" opacity="' +
      (o.o == null ? 1 : o.o) + '"/>';
  }
  function band(top, bot, o) {
    o = o || {};
    var d = '';
    for (var i = 0; i < top.length; i++) d += (i ? 'L' : 'M') + R(top[i][0]) + ' ' + R(top[i][1]);
    for (var j = bot.length - 1; j >= 0; j--) d += 'L' + R(bot[j][0]) + ' ' + R(bot[j][1]);
    return '<path d="' + d + 'Z" fill="' + (o.f || 'rgba(56,189,248,.12)') + '" stroke="' + (o.c || 'none') +
      '" stroke-width="' + (o.w || 0) + '" opacity="' + (o.o == null ? 1 : o.o) + '"/>';
  }
  function area(pts, baseY, o) {
    o = o || {};
    var d = 'M' + R(pts[0][0]) + ' ' + R(baseY);
    for (var i = 0; i < pts.length; i++) d += 'L' + R(pts[i][0]) + ' ' + R(pts[i][1]);
    d += 'L' + R(pts[pts.length - 1][0]) + ' ' + R(baseY) + 'Z';
    return '<path d="' + d + '" fill="' + (o.f || 'rgba(56,189,248,.12)') + '"' +
      (o.c ? ' stroke="' + o.c + '" stroke-width="' + (o.w || 1.2) + '"' : '') + ' opacity="' + (o.o == null ? 1 : o.o) + '"/>';
  }
  function dot(x, y, r, o) {
    o = o || {};
    return '<circle cx="' + R(x) + '" cy="' + R(y) + '" r="' + r + '" fill="' + (o.f || o.c || C.cy) +
      '"' + (o.f === 'none' ? ' stroke="' + (o.c || C.cy) + '" stroke-width="' + (o.w || 1.2) + '"' : '') +
      ' opacity="' + (o.o == null ? 1 : o.o) + '"/>';
  }
  function arrow(x1, y1, x2, y2, o) {
    o = o || {};
    var c = o.c || C.up, w = o.w || 1.6, a = Math.atan2(y2 - y1, x2 - x1), hl = o.hl || 6.4, hw = o.hw || 3.4;
    var bx = x2 - Math.cos(a) * hl, by = y2 - Math.sin(a) * hl;
    var p2 = [bx + Math.sin(a) * hw, by - Math.cos(a) * hw], p3 = [bx - Math.sin(a) * hw, by + Math.cos(a) * hw];
    return line(x1, y1, bx, by, { c: c, w: w, dash: o.dash, o: o.o }) +
      '<path d="M' + R(x2) + ' ' + R(y2) + 'L' + R(p2[0]) + ' ' + R(p2[1]) + 'L' + R(p3[0]) + ' ' + R(p3[1]) +
      'Z" fill="' + c + '" opacity="' + (o.o == null ? 1 : o.o) + '"/>';
  }
  function bracket(x1, y1, x2, y2, o) {
    o = o || {};
    var c = o.c || C.mu, w = o.w || 1;
    return line(x1, y1, x2, y2, { c: c, w: w, dash: o.dash || '3 3' }) +
      line(x1 - 3.4, y1, x1 + 3.4, y1, { c: c, w: w }) + line(x2 - 3.4, y2, x2 + 3.4, y2, { c: c, w: w });
  }
  function rectW(x, y, w, h, o) {
    o = o || {};
    return '<rect x="' + R(x) + '" y="' + R(y) + '" width="' + R(w) + '" height="' + R(h) + '" rx="' + (o.rx == null ? 5 : o.rx) +
      '" fill="' + (o.f || 'none') + '" stroke="' + (o.c || 'rgba(120,190,230,.3)') + '" stroke-width="' + (o.w || 1) +
      '"' + (o.dash ? ' stroke-dasharray="' + o.dash + '"' : '') + ' opacity="' + (o.o == null ? 1 : o.o) + '"/>';
  }
  /* 상단 여백을 쓰는 범례 줄 — 라벨이 몰리는 편에서 사용 */
  function legend(items, y) {
    var x = X0 + 2, s = '', i;
    for (i = 0; i < items.length; i++) {
      var it = items[i], fs = 8.2, lead = it.line !== false;
      if (lead) s += line(x, y - 2.8, x + 13, y - 2.8, { c: it.c, w: 1.8, dash: it.dash });
      x += lead ? 18 : 0;
      s += T(x, y, it.t, { c: it.c2 || it.c, fs: fs, w: 600 });
      x += tw(it.t, fs) + 14;
    }
    return s;
  }

  function frame(o) {
    o = o || {};
    var s = '<rect x=".5" y=".5" width="379" height="209" rx="11" fill="#07101E" stroke="rgba(96,222,255,.22)" stroke-width="1"/>';
    s += '<rect x=".5" y=".5" width="379" height="60" rx="11" fill="url(#edugrad)" opacity=".55"/>';
    var hy = o.hy || [38, 66, 94, 122, 150], i;
    for (i = 0; i < hy.length; i++) s += line(X0, hy[i], X1, hy[i], { c: 'rgba(148,178,214,.085)', w: 1 });
    var vx = o.vx || [X0, 111, 196, 281, X1];
    for (i = 0; i < vx.length; i++) s += line(vx[i], o.vy0 || 34, vx[i], o.vy1 || 202, { c: 'rgba(148,178,214,.055)', w: 1 });
    return s;
  }
  function defs() {
    return '<defs><linearGradient id="edugrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#12233c" stop-opacity=".85"/><stop offset="1" stop-color="#07101E" stop-opacity="0"/>' +
      '</linearGradient></defs>';
  }

  function rng(seed) {
    var s = (seed || 7) >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function curve(pts, n, noise, seed) {
    var r = rng(seed || 7), out = [], k = 0, i;
    for (i = 0; i < n; i++) {
      while (k < pts.length - 2 && i > pts[k + 1][0]) k++;
      var a = pts[k], b = pts[k + 1] || a;
      var t = (i - a[0]) / Math.max(0.001, (b[0] - a[0]));
      out.push(a[1] + (b[1] - a[1]) * t + (r() - 0.5) * noise);
    }
    return out;
  }
  function toCand(cl, vol, seed) {
    var r = rng(seed || 11), out = [], p = cl[0];
    for (var i = 0; i < cl.length; i++) {
      var o = i === 0 ? cl[0] - vol * 0.15 : p, c = cl[i];
      out.push([o, Math.max(o, c) + r() * vol, Math.min(o, c) - r() * vol, c]);
      p = c;
    }
    return out;
  }
  function candles(data, x0, x1, y0, y1, o) {
    o = o || {};
    var n = data.length, hi = -1e9, lo = 1e9, i;
    for (i = 0; i < n; i++) { if (data[i][1] > hi) hi = data[i][1]; if (data[i][2] < lo) lo = data[i][2]; }
    var pad = (hi - lo) * (o.pad == null ? 0.1 : o.pad);
    hi += pad; lo -= pad;
    var Y = function (v) { return y1 - (v - lo) / (hi - lo) * (y1 - y0); };
    var step = (x1 - x0) / n, bw = Math.max(1.6, step * (o.bw || 0.56)), s = '';
    for (i = 0; i < n; i++) {
      var d = data[i], cx = x0 + step * (i + 0.5), up = d[3] >= d[0];
      var col = o.mono || (up ? C.up : C.dn);
      s += line(cx, Y(d[1]), cx, Y(d[2]), { c: col, w: o.ww || 1, o: o.wo == null ? 0.8 : o.wo });
      var top = Y(Math.max(d[0], d[3])), bot = Y(Math.min(d[0], d[3]));
      s += rectW(cx - bw / 2, top, bw, Math.max(1.3, bot - top), { f: col, c: col, w: 0, rx: 0.5, o: o.bo == null ? 0.92 : o.bo });
    }
    return { svg: s, Y: Y, lo: lo, hi: hi, cx: function (i) { return x0 + step * (i + 0.5); }, step: step };
  }
  function bars(vals, x0, x1, y0, y1, o) {
    o = o || {};
    var n = vals.length, hi = 0, i;
    for (i = 0; i < n; i++) { if (vals[i] > hi) hi = vals[i]; }
    var step = (x1 - x0) / n, bw = Math.max(1.5, step * 0.56), s = '';
    for (i = 0; i < n; i++) {
      var h = Math.max(0.8, vals[i] / hi * (y1 - y0));
      var col = o.col ? o.col(i) : (o.mono || 'rgba(120,170,210,.42)');
      s += rectW(x0 + step * i + (step - bw) / 2, y1 - h, bw, h, { f: col, c: col, w: 0, rx: 0.5, o: o.o == null ? 1 : o.o });
    }
    return s;
  }
  function smooth(a, k) {
    var out = [], n = a.length;
    for (var i = 0; i < n; i++) {
      var s = 0, c = 0;
      for (var j = Math.max(0, i - k); j <= Math.min(n - 1, i + k); j++) { s += a[j]; c++; }
      out.push(s / c);
    }
    return out;
  }
  function arcPath(cx, cy, r, a0, a1) {
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    var x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    var big = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    return 'M' + R(x0) + ' ' + R(y0) + 'A' + r + ' ' + r + ' 0 ' + big + ' 1 ' + R(x1) + ' ' + R(y1);
  }
  function wrap(svg, o) {
    o = o || {};
    return '<svg class="edu-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" ' +
      'role="img" aria-label="' + esc(o.label || '개념 도해') + '">' + defs() + svg + '</svg>';
  }

  var F = [];

  /* 01. W 쌍바닥 + 넥라인 돌파 ---------------------------------- */
  F[0] = function () {
    var s = frame(), y0 = 44, y1 = 136, x0 = X0 + 2, x1 = X1 - 2, n = 34;
    var cl = curve([[0, 104], [3, 95], [6, 68], [8, 62], [11, 74], [14, 84], [18, 64], [21, 63], [24, 79], [27, 92], [33, 108]], n, 1.7, 4);
    var K = candles(toCand(cl, 2.1, 9), x0, x1, y0, y1, { pad: 0.16 });
    s += K.svg;
    var ny = K.Y(84);
    s += line(K.cx(12), ny, X1 - 4, ny, { c: C.am, w: 1.3, dash: '5 4' });
    s += legend([{ t: '넥라인 (중간 고점)', c: C.am, dash: '5 4' }, { t: '거래량 급증', c: C.am }], 20);
    s += badge(K.cx(8), K.Y(cl[8]) + 13, '1', { c: C.cy, r: 6.6 });
    s += badge(K.cx(21), K.Y(cl[21]) + 13, '2', { c: C.cy, r: 6.6 });
    s += T(K.cx(14), 152, '두 저점이 비슷한 가격대', { a: 'middle', c: C.mu, fs: 8.2 });
    var bx = K.cx(29);
    s += arrow(bx, ny + 30, bx, ny + 8, { c: C.up, w: 1.8 });
    s += chip(bx - 4, ny + 21, '매수', { c: C.up, bd: 'rgba(47,217,166,.5)', a: 'end' });
    var vols = [], i;
    for (i = 0; i < n; i++) vols.push(7 + (i % 3) * 2 + (i > 4 && i < 9 ? 4 : 0) + (i > 15 && i < 19 ? 3 : 0));
    vols[29] = 21; vols[30] = 16;
    s += bars(vols, x0, x1, 166, 200, { col: function (i) { return (i === 29 || i === 30) ? 'rgba(245,185,66,.85)' : 'rgba(120,170,210,.36)'; } });
    s += T(x0, 162, '거래량', { c: C.dim, fs: 7.6 });
    return { svg: wrap(s, { label: 'W 쌍바닥과 넥라인 돌파 도해' }),
      cap: '<b>①</b>·<b>②</b> 두 저점이 비슷 → 넥라인 돌파 봉에서 <b>매수</b>, 거래량 1.5~2배면 신뢰도 상승' };
  };

  /* 02. RSI(2) 과매도 스윙 -------------------------------------- */
  F[1] = function () {
    var s = frame(), y0 = 44, y1 = 132, x0 = X0 + 2, x1 = X1 - 2, n = 34;
    var cl = curve([[0, 60], [8, 78], [14, 88], [17, 72], [20, 90], [26, 104], [33, 116]], n, 1.5, 21);
    var K = candles(toCand(cl, 1.9, 31), x0, x1, y0, y1, { pad: 0.18 });
    s += K.svg;
    var i0 = 17;
    s += dot(K.cx(i0), K.Y(cl[i0]), 3.2, { c: C.am, f: C.am });
    s += line(K.cx(i0), K.Y(cl[i0]) + 4, K.cx(i0), 138, { c: 'rgba(245,185,66,.6)', w: 1, dash: '2 3' });
    s += chip(K.cx(i0), 146, 'RSI(2) 11 · 과매도', { a: 'middle', c: C.am, bd: 'rgba(245,185,66,.45)' });
    s += arrow(K.cx(22), 138, K.cx(22), 118, { c: C.up, w: 1.7 });
    s += T(K.cx(22) + 5, 134, '매수', { c: C.up, fs: 8, w: 600 });
    /* RSI 패널 */
    var py0 = 158, py1 = 200;
    s += line(x0, py0, x1, py0, { c: 'rgba(148,178,214,.18)', w: 1 });
    var rv = curve([[0, 62], [8, 58], [13, 66], [17, 9], [21, 74], [26, 62], [33, 68]], n - 2, 6, 41);
    var R2 = function (v) { return py1 - (Math.max(0, Math.min(100, v)) / 100) * (py1 - py0); };
    var pts = [];
    for (var i = 0; i < rv.length; i++) pts.push([x0 + (x1 - x0) / (n - 2) * (i + 0.5), R2(rv[i])]);
    s += line(x0, R2(15), x1, R2(15), { c: C.dn, w: 1, dash: '4 4', o: 0.75 });
    s += T(x0, R2(15) - 3.5, '15', { c: C.dn, fs: 7.6, w: 600 });
    s += poly(pts, { c: C.vi, w: 1.5 });
    s += dot(pts[15][0], pts[15][1], 3.2, { c: C.am, f: C.am });
    s += T(x0, py0 - 4, 'RSI(2)', { c: C.vi, fs: 7.8, w: 600 });
    s += T(x1, py0 - 4, '15 아래 = 과매도', { a: 'end', c: C.mu, fs: 7.8 });
    return { svg: wrap(s, { label: 'RSI(2) 과매도 스윙 도해' }),
      cap: '상승 추세에서 <b>RSI(2) 15 이하</b>로 급락 → 반등 시 매수. 하락장에서는 5 아래로도 계속 내려갑니다' };
  };

  /* 03. 240일선 기준선 ----------------------------------------- */
  F[2] = function () {
    var s = frame(), y0 = 46, y1 = 186, x0 = X0 + 2, x1 = X1 - 2, n = 44;
    var cl = curve([[0, 70], [10, 92], [18, 84], [24, 96], [30, 74], [36, 66], [43, 78]], n, 1.4, 5);
    var K = candles(toCand(cl, 1.6, 15), x0, x1, y0, y1, { pad: 0.3 });
    s += K.svg;
    var ma = smooth(cl, 4), pts = [], i;
    for (i = 0; i < n; i++) pts.push([K.cx(i), K.Y(ma[i])]);
    s += poly(pts, { c: C.or, w: 2.8 });
    s += T(x0, 42, '240일선', { c: C.or, fs: 8.4, w: 600 });
    s += T(X1 - 4, 56, '가격 ↑ = 상승장 · 눌림은 지지', { a: 'end', c: C.up, fs: 8.2, w: 600 });
    s += T(X1 - 4, 184, '가격 ↓ = 하락장 · 반등은 저항', { a: 'end', c: C.dn, fs: 8.2, w: 600 });
    return { svg: wrap(s, { label: '240일선 장기 기준선 도해' }),
      cap: '주황 굵은 <b>240일선 위 = 상승장(지지)</b>, 아래 = 하락장(반등은 저항). 선의 기울기까지 봅니다' };
  };

  /* 04. 일목균형표 구름대 -------------------------------------- */
  F[3] = function () {
    var s = frame(), y0 = 40, y1 = 190, x0 = X0 + 2, x1 = X1 - 2, n = 36;
    var cl = curve([[0, 112], [7, 101], [12, 108], [18, 100], [24, 92], [30, 82], [35, 74]], n, 1.3, 9);
    var K = candles(toCand(cl, 1.6, 19), x0, x1, y0, y1, { pad: 0.04 });
    /* 구름대: 가격 아래(지지) → 가격 위(저항)로 넘어가는 띠 */
    var top = [], bot = [], i;
    for (i = 0; i < n; i++) {
      var py = K.Y(cl[i]);
      var t = Math.min(1, Math.max(0, (i - 15) / 11));
      var y0c = py + 9 - 32 * t;
      top.push([K.cx(i), y0c]);
      bot.push([K.cx(i), y0c + 15]);
    }
    var cut = 19;
    s += band(top.slice(0, cut + 1), bot.slice(0, cut + 1), { f: 'rgba(251,113,133,.28)', c: 'rgba(251,113,133,.7)', w: 1 });
    s += band(top.slice(cut), bot.slice(cut), { f: 'rgba(56,189,248,.26)', c: 'rgba(56,189,248,.75)', w: 1 });
    s += K.svg;
    s += T(x0 + 2, 182, '양운 (빨강) = 지지', { c: '#FB9AA8', fs: 8.4, w: 600 });
    s += T(X1 - 6, 58, '음운 (파랑) = 저항', { a: 'end', c: '#77CBF7', fs: 8.4, w: 600 });
    s += chip(X0 + 2, 164, '구름 안 = 방향 불명', { c: C.mu, bd: 'rgba(120,190,230,.3)' });
    return { svg: wrap(s, { label: '일목균형표 구름대 도해' }),
      cap: '구름 <b>위 = 강세(양운이 지지)</b>, 구름 <b>아래 = 약세(음운이 저항)</b>. 구름이 두꺼울수록 뚫기 어렵습니다' };
  };

  /* 05. 엘리어트 1-5 / A-B-C ----------------------------------- */
  F[4] = function () {
    var s = frame(), y0 = 38, y1 = 186, x0 = X0 + 2, x1 = X1 - 8;
    var P = [[0, 60], [4, 104], [7, 84], [12, 146], [15, 128], [20, 172], [24, 150], [27, 162], [31, 132]];
    var Y = function (v) { return y1 - (v - 50) / (180 - 50) * (y1 - y0); };
    var pts = [], i;
    for (i = 0; i < P.length; i++) pts.push([x0 + (x1 - x0) * P[i][0] / 32, Y(P[i][1])]);
    s += poly(pts, { c: C.cy, w: 1.9 });
    for (i = 1; i < pts.length; i++) s += dot(pts[i][0], pts[i][1], 2.6, { c: '#BFE9FF', f: '#BFE9FF' });
    var lab = ['1', '2', '3', '4', '5', 'A', 'B', 'C'];
    for (i = 1; i < pts.length; i++) {
      var up = P[i][1] > P[i - 1][1];
      s += badge(pts[i][0], pts[i][1] + (up ? -12 : 12), lab[i - 1], { c: up ? C.up : C.dn, r: 6.8, fs: 8 });
    }
    s += T(x0, 50, '상승 1-5파 + 조정 A-B-C', { c: C.cy2, fs: 8.4, w: 600 });
    s += T(pts[3][0] + 6, pts[3][1] - 21, '3파 = 가장 길다', { c: C.tx, fs: 8.2, w: 600 });
    s += T(x0 + 2, 184, '2파는 1파 출발점을 깨지 않음', { c: C.mu, fs: 8 });
    s += line(pts[0][0], Y(60), pts[1][0] + 8, Y(60), { c: C.dn, w: 1, dash: '3 3', o: 0.7 });
    return { svg: wrap(s, { label: '엘리어트 파동 1-5 A-B-C 도해' }),
      cap: '상승 <b>1~5파</b> 뒤 <b>A-B-C 조정</b>. 2파는 출발점을 깨지 않고, 3파가 가장 짧을 수 없습니다' };
  };

  /* 06. 파라볼릭 SAR ------------------------------------------- */
  F[5] = function () {
    var s = frame(), y0 = 40, y1 = 186, x0 = X0 + 2, x1 = X1 - 2, n = 32;
    var cl = curve([[0, 66], [8, 104], [15, 140], [18, 148], [24, 112], [31, 92]], n, 1.4, 33);
    var K = candles(toCand(cl, 1.8, 43), x0, x1, y0, y1, { pad: 0.16 });
    s += K.svg;
    var i;
    for (i = 1; i <= 17; i++) s += dot(K.cx(i), K.Y(cl[i]) + 11, 2.3, { c: '#2FE3D0', f: '#2FE3D0' });
    for (i = 18; i < n; i++) s += dot(K.cx(i), K.Y(cl[i]) - 11, 2.3, { c: '#F472B6', f: '#F472B6' });
    s += legend([{ t: '점 아래 = 상승', c: '#2FE3D0' }, { t: '점 위 = 하락', c: '#F472B6', line: false }], 20);
    s += line(K.cx(17) + K.step / 2, 40, K.cx(17) + K.step / 2, 182, { c: 'rgba(244,114,182,.45)', w: 1, dash: '4 4' });
    s += T(K.cx(17) + K.step / 2 + 5, 44, '전환', { c: '#F9A8D4', fs: 7.6, w: 600 });
    return { svg: wrap(s, { label: '파라볼릭 SAR 도해' }),
      cap: '청록 점이 캔들 <b>아래 = 상승 추세(자동 손절선)</b>, 점이 위로 넘어가면 <b>하락 전환</b>. 횡보장에선 신호가 잦습니다' };
  };

  /* 07. 엔벨로프 ±20% ------------------------------------------ */
  F[6] = function () {
    var s = frame(), y0 = 40, y1 = 190, x0 = X0 + 2, x1 = X1 - 2, n = 34;
    var cl = curve([[0, 86], [6, 92], [11, 108], [15, 126], [19, 98], [24, 84], [29, 92], [33, 98]], n, 1.2, 55);
    var K = candles(toCand(cl, 1.5, 65), x0, x1, y0, y1, { pad: 0.5 });
    s += K.svg;
    var mid = smooth(cl, 3), up = [], lo = [], m = [], i;
    for (i = 0; i < n; i++) {
      m.push([K.cx(i), K.Y(mid[i])]);
      up.push([K.cx(i), K.Y(mid[i] * 1.2)]);
      lo.push([K.cx(i), K.Y(mid[i] * 0.8)]);
    }
    s += poly(up, { c: C.am, w: 1.1, dash: '5 4', o: 0.9 });
    s += poly(lo, { c: C.cy, w: 1.1, dash: '5 4', o: 0.9 });
    s += poly(m, { c: '#C7D6E6', w: 1.4 });
    s += chip(X1 - 6, K.Y(mid[33]) + 13, '20일선', { a: 'end', c: '#C7D6E6', bd: 'rgba(199,214,230,.4)' });
    s += chip(X1 - 6, 54, '+20% 상단 · 과열', { a: 'end', c: C.am, bd: 'rgba(245,185,66,.45)' });
    s += chip(X0 + 2, 182, '−20% 하단 · 과매도', { c: C.cy, bd: 'rgba(56,189,248,.45)' });
    s += dot(K.cx(15), K.Y(cl[15]), 3, { c: C.am, f: C.am });
    s += T(X0 + 2, 50, '상단 터치 = 추격 매도를 멈출 자리', { c: C.mu, fs: 8 });
    return { svg: wrap(s, { label: '엔벨로프 20퍼센트 밴드 도해' }),
      cap: '20일선에서 <b>±20%</b> 고정 밴드. 상단은 “팔 자리”보다 <b>추격을 멈출 자리</b>, 하단은 낙폭과대 참고' };
  };

  /* 08. VCP 변동성 축소 ---------------------------------------- */
  F[7] = function () {
    var s = frame(), y0 = 46, y1 = 188, x0 = X0 + 2, x1 = X1 - 2, n = 40;
    var cl = curve([[0, 80], [4, 96], [7, 82], [9, 104], [12, 94], [15, 114], [18, 109], [22, 124], [25, 120], [29, 136], [33, 132], [39, 148]], n, 0.9, 77);
    var K = candles(toCand(cl, 1.1, 87), x0, x1, y0, y1, { pad: 0.2 });
    s += K.svg;
    var boxes = [[4, 7, 96, 82, '−20%'], [15, 18, 114, 109, '−10%'], [25, 29, 136, 132, '−4%']];
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      s += rectW(K.cx(b[0]) - 3, K.Y(b[2]) - 3, K.cx(b[1]) - K.cx(b[0]) + 6, K.Y(b[3]) - K.Y(b[2]) + 6,
        { c: 'rgba(167,139,250,.65)', f: 'rgba(167,139,250,.14)', w: 1, rx: 3, dash: '3 3' });
      s += T(K.cx(b[0]) - 3, K.Y(b[2]) - 7, b[4], { c: C.vi, fs: 8, w: 600 });
    }
    var pv = 140;
    s += line(K.cx(22), K.Y(pv), X1 - 4, K.Y(pv), { c: C.am, w: 1.2, dash: '5 4' });
    s += T(K.cx(22) - 2, K.Y(pv) - 6, '피벗 (직전 고점)', { a: 'end', c: C.am, fs: 8, w: 600 });
    s += arrow(K.cx(36), K.Y(pv) + 18, K.cx(36), K.Y(pv) - 2, { c: C.up, w: 1.8 });
    s += chip(X1 - 6, K.Y(pv) + 30, '돌파 + 거래량', { a: 'end', c: C.up, bd: 'rgba(47,217,166,.45)' });
    return { svg: wrap(s, { label: 'VCP 변동성 축소 도해' }),
      cap: '조정폭 <b>−20% → −10% → −4%</b>로 줄고 거래량이 마르면 매물 소진. <b>피벗 돌파</b>가 매수 자리' };
  };

  /* 09. 달러(DXY)와 빅테크 ------------------------------------- */
  F[8] = function () {
    var s = frame(), y0 = 50, y1 = 186, x0 = X0 + 2, x1 = X1 - 2, n = 34;
    var dxy = curve([[0, 70], [8, 84], [16, 110], [24, 128], [33, 150]], n, 1.4, 101);
    var tech = curve([[0, 140], [8, 126], [16, 100], [24, 86], [33, 66]], n, 1.6, 111);
    var Y = function (v) { return y1 - (v - 50) / (170 - 50) * (y1 - y0); };
    var A = [], B = [], i;
    for (i = 0; i < n; i++) {
      A.push([x0 + (x1 - x0) / n * (i + 0.5), Y(dxy[i])]);
      B.push([x0 + (x1 - x0) / n * (i + 0.5), Y(tech[i])]);
    }
    s += poly(A, { c: C.am, w: 1.9 });
    s += poly(B, { c: C.cy, w: 1.9 });
    s += chip(A[27][0], A[27][1] - 12, 'DXY ↑ 달러 강세', { a: 'end', c: C.am, bd: 'rgba(245,185,66,.45)' });
    s += chip(B[27][0], B[27][1] + 13, '빅테크 ↓', { a: 'end', c: C.cy, bd: 'rgba(56,189,248,.45)' });
    s += T(X0 + 2, 44, '달러 강세 = 해외 매출 환산액 감소 → 실적 역풍', { c: C.mu, fs: 8.2 });
    s += T(X0 + 2, 186, '해외 비중 큰 종목: AAPL · MSFT · NVDA', { c: C.tx, fs: 8, w: 600 });
    return { svg: wrap(s, { label: '달러 지수와 빅테크 역상관 도해' }),
      cap: 'DXY가 오르면 해외 매출이 큰 <b>빅테크는 역풍</b>. 실적 D-3과 함께 보면 위험 구간이 보입니다' };
  };

  /* 10. 장단기 금리차 10Y−2Y ---------------------------------- */
  F[9] = function () {
    var s = frame(), y0 = 48, y1 = 188, x0 = X0 + 4, x1 = X1 - 4, n = 40;
    var zero = 108;
    var sp = curve([[0, 150], [8, 128], [14, 112], [18, 100], [24, 82], [30, 74], [34, 92], [39, 116]], n, 1.6, 121);
    var Y = function (v) { return y1 - (v - 60) / (160 - 60) * (y1 - y0); };
    var pts = [], neg = [], i;
    for (i = 0; i < n; i++) {
      var x = x0 + (x1 - x0) / n * (i + 0.5);
      pts.push([x, Y(sp[i])]);
      if (sp[i] < zero) neg.push([x, Y(sp[i])]);
    }
    s += area(pts, Y(zero), { f: 'rgba(56,189,248,.10)' });
    s += band(neg, neg.map(function (p) { return [p[0], Y(zero)]; }), { f: 'rgba(251,113,133,.28)' });
    s += poly(pts, { c: C.cy, w: 1.9 });
    s += line(x0, Y(zero), x1, Y(zero), { c: 'rgba(220,235,250,.7)', w: 1.2, dash: '6 4' });
    s += T(X1 - 4, Y(zero) - 6, '금리차 0', { a: 'end', c: C.tx, fs: 7.8 });
    s += T(x0 + 6, Y(zero) - 9, '＋ 정상', { c: C.up, fs: 8.2, w: 600 });
    s += chip(x0 + 236, Y(zero) + 34, '역전 (−)', { c: C.dn, bd: 'rgba(251,113,133,.45)' });
    s += T(x0 + 2, 44, '10년물 − 2년물', { c: C.mu, fs: 8.4, w: 600 });
    s += T(X1 - 4, 44, '역전은 침체의 선행 신호', { a: 'end', c: C.mu, fs: 8.2 });
    return { svg: wrap(s, { label: '장단기 금리차 역전 도해' }),
      cap: '10년물 − 2년물이 <b>마이너스 = 수익률 곡선 역전</b>. 침체는 역전이 <b>풀린 뒤</b> 오는 경우가 많았습니다' };
  };

  /* 11. 돌파에는 거래량이 필요하다 ------------------------------ */
  F[10] = function () {
    var s = frame(), y0 = 40, y1 = 136, x0 = X0 + 2, x1 = X1 - 2, n = 34;
    var cl = curve([[0, 92], [8, 104], [14, 108], [18, 112], [22, 120], [24, 126], [27, 138], [33, 146]], n, 1.2, 131);
    var K = candles(toCand(cl, 1.5, 141), x0, x1, y0, y1, { pad: 0.18 });
    s += K.svg;
    var ry = K.Y(112);
    s += line(x0, ry, x1, ry, { c: C.am, w: 1.2, dash: '5 4' });
    s += legend([{ t: '저항선', c: C.am, dash: '5 4' }, { t: '돌파 봉 거래량', c: C.up }], 20);
    var vols = [], i;
    for (i = 0; i < n; i++) vols.push(8 + (i % 4) * 2);
    vols[23] = 24; vols[24] = 22;
    s += bars(vols, x0, x1, 174, 202, { col: function (i) { return (i === 23 || i === 24) ? 'rgba(47,217,166,.9)' : 'rgba(120,170,210,.33)'; } });
    s += T(x0, 164, '거래량', { c: C.dim, fs: 7.6 });
    s += T(x0 + 2, 146, '돌파 봉 거래량 = 20일 평균의 1.5~2배', { c: C.up, fs: 8, w: 600 });
    s += badge(K.cx(23), ry - 13, '↑', { c: C.am, r: 6.4, fs: 7.6 });
    return { svg: wrap(s, { label: '돌파와 거래량 도해' }),
      cap: '저항 돌파 날 거래량이 <b>1.5~2배</b>로 늘어야 진짜 돌파. 2~3일 안에 넥라인 아래로 돌아오면 실패' };
  };

  /* 12. ATR 손절 거리 ------------------------------------------ */
  F[11] = function () {
    var s = frame(), y0 = 46, y1 = 168, x0 = 74, x1 = X1 - 8, n = 24;
    var cl = curve([[0, 118], [8, 126], [14, 122], [20, 116], [23, 104]], n, 2.0, 151);
    var K = candles(toCand(cl, 2.4, 161), x0, x1, y0, y1, { pad: 0.16 });
    s += K.svg;
    var entry = 120, yE = K.Y(entry), yS = K.Y(102), yC = K.Y(108);
    s += line(x0 - 6, yE, x1, yE, { c: '#C7D6E6', w: 1.2, dash: '4 4' });
    s += line(x0 - 6, yS, x1, yS, { c: C.dn, w: 1.4, dash: '5 4' });
    s += line(x0 - 6, yC, x1, yC, { c: C.am, w: 1.2, dash: '2 3' });
    s += T(X0 + 2, yC - 6, '−10% 상한', { c: C.am, fs: 8, w: 600 });
    s += T(X0 + 2, yS + 12, '−4.5 ATR', { c: C.dn, fs: 8, w: 600 });
    s += T(X0 + 2, yE - 7, '진입 120', { c: '#C7D6E6', fs: 8, w: 600 });
    s += bracket(x0 - 20, yE, x0 - 20, K.Y(entry - 4), { c: C.mu });
    s += T(x0 - 24, (yE + K.Y(entry - 4)) / 2 + 3, '1 ATR', { a: 'end', c: C.mu, fs: 7.6 });
    s += chip(X1 - 6, 54, 'ATR = 평균 진폭', { a: 'end', c: C.cy2 });
    s += T(X0 + 2, 196, '실제 손절 = 두 선 중 가까운 쪽', { c: C.tx, fs: 8, w: 600 });
    return { svg: wrap(s, { label: 'ATR 손절 거리 도해' }),
      cap: '손절은 가격이 아니라 <b>ATR 배수</b>로. 스윙형은 4.5 ATR과 <b>−10% 중 가까운 쪽</b>을 씁니다' };
  };

  /* 13. 볼린저 밴드와 스퀴즈 ------------------------------------ */
  F[12] = function () {
    var s = frame(), y0 = 46, y1 = 190, x0 = X0 + 2, x1 = X1 - 2, n = 38;
    var cl = curve([[0, 96], [10, 100], [16, 98], [22, 99], [26, 97], [29, 104], [33, 116], [37, 128]], n, 1.0, 171);
    var K = candles(toCand(cl, 1.2, 181), x0, x1, y0, y1, { pad: 0.42 });
    s += K.svg;
    var mid = smooth(cl, 3), up = [], lo = [], m = [], i;
    for (i = 0; i < n; i++) {
      var w = i < 26 ? (24 - i * 0.68) : Math.min(38, 6 + (i - 26) * 2.4);
      var my = K.Y(mid[i]);
      m.push([K.cx(i), my]);
      up.push([K.cx(i), Math.max(42, my - w)]);
      lo.push([K.cx(i), Math.min(188, my + w)]);
    }
    s += band(up, lo, { f: 'rgba(56,189,248,.12)', c: 'rgba(56,189,248,.5)', w: 1 });
    s += poly(m, { c: 'rgba(199,214,230,.6)', w: 1.1, dash: '4 3' });
    var ax = K.cx(24);
    s += bracket(ax + 4, up[24][1], ax + 4, lo[24][1], { c: C.vi, w: 1.2 });
    s += chip(ax + 12, lo[24][1] + 20, '스퀴즈 · 폭 축소', { c: C.vi, bd: 'rgba(167,139,250,.45)' });
    s += chip(X1 - 6, 54, '확장 = 방향 확인', { a: 'end', c: C.cy, bd: 'rgba(56,189,248,.45)' });
    s += T(x0 + 2, 42, '중심선 = 20일선', { c: C.mu, fs: 7.8 });
    return { svg: wrap(s, { label: '볼린저 밴드 스퀴즈 도해' }),
      cap: '밴드 폭이 <b>좁아지면(스퀴즈)</b> 곧 큰 움직임. 방향은 알려주지 않으니 <b>돌파 확인 후</b> 대응합니다' };
  };

  /* 14. MACD 다이버전스 ---------------------------------------- */
  F[13] = function () {
    var s = frame(), y0 = 44, y1 = 118, x0 = X0 + 2, x1 = X1 - 2, n = 34;
    var cl = curve([[0, 80], [7, 116], [11, 96], [18, 130], [22, 116], [30, 124], [33, 120]], n, 1.3, 191);
    var K = candles(toCand(cl, 1.7, 201), x0, x1, y0, y1, { pad: 0.2 });
    s += K.svg;
    s += badge(K.cx(7), K.Y(cl[7]) - 11, '1', { c: C.cy, r: 6, fs: 7.4 });
    s += badge(K.cx(18), K.Y(cl[18]) - 11, '2', { c: C.cy, r: 6, fs: 7.4 });
    s += legend([{ t: '가격 고점은 ↑', c: C.cy2, line: false }, { t: 'MACD 고점은 ↓', c: C.dn, line: false }], 20);
    /* MACD 패널 */
    var py0 = 132, base = 196, i;
    var hist = curve([[0, 52], [7, 78], [11, 46], [18, 68], [22, 38], [30, 26]], n, 3, 221);
    var hs = '';
    for (i = 0; i < n; i++) {
      var h = Math.max(1.4, (hist[i] - 20) / 62 * 30);
      var x = x0 + (x1 - x0) / n * i + 2, wdt = (x1 - x0) / n - 4;
      hs += rectW(x, base - h, wdt, h, { f: 'rgba(56,189,248,.5)', c: 'none', w: 0, rx: 0.6 });
    }
    s += hs;
    s += line(x0, base, x1, base, { c: 'rgba(148,178,214,.25)', w: 1 });
    var mp = [];
    for (i = 0; i < n; i++) mp.push([K.cx(i), base - (hist[i] - 20) / 62 * 56]);
    s += poly(mp, { c: C.vi, w: 1.6 });
    s += dot(mp[7][0], mp[7][1], 3, { c: C.vi, f: C.vi });
    s += dot(mp[18][0], mp[18][1], 3, { c: C.vi, f: C.vi });
    s += line(mp[7][0], mp[7][1] - 4, mp[18][0], mp[18][1] - 4, { c: C.dn, w: 1.2, dash: '4 3' });
    s += T(x0, py0 - 4, 'MACD', { c: C.vi, fs: 7.8, w: 600 });
    s += T(x1, py0 - 4, '히스토그램 · 선은 더 낮은 고점', { a: 'end', c: C.mu, fs: 7.8 });
    return { svg: wrap(s, { label: 'MACD 약세 다이버전스 도해' }),
      cap: '가격 고점은 올라가는데 <b>MACD 고점은 내려가면 약세 다이버전스</b>. 타이밍이 아니라 확인용입니다' };
  };

  /* 15. 52주 신고가 ------------------------------------------- */
  F[14] = function () {
    var s = frame(), y0 = 46, y1 = 186, x0 = X0 + 18, x1 = X1 - 2, n = 34;
    var cl = curve([[0, 96], [8, 82], [15, 92], [22, 120], [27, 136], [33, 148]], n, 1.3, 231);
    var K = candles(toCand(cl, 1.6, 241), x0, x1, y0, y1, { pad: 0.16 });
    s += K.svg;
    var hiY = K.Y(152), loY = K.Y(72);
    s += bracket(X0 + 5, hiY, X0 + 5, loY, { c: C.mu, w: 1 });
    s += T(X0 + 9, (hiY + loY) / 2 + 3, '52주', { c: C.mu, fs: 8, w: 600 });
    s += line(x0, hiY, x1, hiY, { c: C.cy, w: 1, dash: '4 4', o: 0.7 });
    s += chip(x1 - 6, hiY - 12, '신고가권 = 위쪽 매물 없음', { a: 'end', c: C.cy2 });
    s += chip(x0 + 4, 116, '바닥권 = 반등마다 본전 매물', { c: C.mu, bd: 'rgba(120,190,230,.28)' });
    s += T(x0 + 2, 180, '고점 대비 낙폭보다 “지금 어디에 있는지”', { c: C.dim, fs: 7.8 });
    return { svg: wrap(s, { label: '52주 신고가 근처 도해' }),
      cap: '신고가 부근은 <b>물린 매물이 없어 저항이 적음</b>. 손절을 피벗 아래로 짧게 잡을 수 있어 손익비가 좋습니다' };
  };

  /* 16. 지지·저항과 매물대 ------------------------------------- */
  F[15] = function () {
    var s = frame(), y0 = 46, y1 = 190;
    var px0 = 132;
    var cl = curve([[0, 74], [7, 96], [12, 108], [18, 118], [22, 126], [27, 112], [31, 120], [33, 132]], 30, 1.2, 251);
    var K = candles(toCand(cl, 1.6, 261), px0, X1 - 2, y0, y1, { pad: 0.16 });
    s += K.svg;
    /* 좌측 매물대 히스토그램 */
    var prof = [[64, 4], [70, 6], [76, 8], [82, 8], [88, 10], [94, 13], [100, 16], [106, 22],
      [112, 34], [118, 18], [124, 13], [130, 9], [136, 6], [142, 4]];
    var Y = K.Y, i;
    for (i = 0; i < prof.length; i++) {
      var w = prof[i][1] * 2.0, y = Y(prof[i][0]);
      var strong = prof[i][0] === 112;
      s += rectW(px0 - 12 - w, y - 3.6, w, 7.2, { f: strong ? 'rgba(245,185,66,.65)' : 'rgba(120,170,210,.22)', c: 'none', w: 0, rx: 1.5 });
    }
    var ry = Y(112);
    s += line(px0 - 12, ry, X1 - 2, ry, { c: C.am, w: 1, dash: '4 4', o: 0.75 });
    s += legend([{ t: '거래 집중 가격대 = 저항', c: C.am, dash: '4 4' }], 20);
    s += T(X0 + 2, 40, '매물대 = 거래 집중 구간', { c: C.mu, fs: 7.8, w: 600 });
    s += chip(K.cx(26), ry + 30, '뚫고 지지로 전환', { a: 'middle', c: C.up, bd: 'rgba(47,217,166,.45)' });
    return { svg: wrap(s, { label: '지지와 저항 매물대 도해' }),
      cap: '지지·저항은 선이 아니라 <b>거래가 쌓인 가격대(매물대)</b>. 뚫은 뒤 지지로 바뀌는지가 재진입 자리' };
  };

  /* 17. 손익비 1:2 -------------------------------------------- */
  F[16] = function () {
    var s = frame(), x0 = X0 + 2, x1 = X1 - 4, n = 22;
    var cl = curve([[0, 100], [6, 112], [10, 104], [15, 124], [19, 136], [21, 140]], n, 2.0, 271);
    var K = candles(toCand(cl, 2.2, 281), x0, x1, 54, 168, { pad: 0.1 });
    var entry = 110, R1 = 10;
    var yE = K.Y(entry), yT = K.Y(entry + 2 * R1), yS = K.Y(entry - R1);
    s += rectW(x0, yT, x1 - x0, yE - yT, { f: 'rgba(47,217,166,.10)', c: 'none', w: 0, rx: 3 });
    s += rectW(x0, yE, x1 - x0, yS - yE, { f: 'rgba(251,113,133,.10)', c: 'none', w: 0, rx: 3 });
    s += line(x0, yE, x1, yE, { c: '#C7D6E6', w: 1.2 });
    s += line(x0, yT, x1, yT, { c: C.up, w: 1.2, dash: '5 4' });
    s += line(x0, yS, x1, yS, { c: C.dn, w: 1.2, dash: '5 4' });
    s += K.svg;
    s += T(x0 + 4, yE - 7, '진입', { c: '#C7D6E6', fs: 8, w: 600 });
    s += T(x0 + 4, yT + 12, '목표 +2R', { c: C.up, fs: 8, w: 600 });
    s += T(x0 + 4, yS - 7, '손절 −1R', { c: C.dn, fs: 8, w: 600 });
    s += T(x0 + 2, 46, '승률 40% × 2R − 60% × 1R = +0.2R', { c: C.cy2, fs: 8.6, w: 600 });
    s += T(X1 - 6, 192, '손익비 1.5 미만이면 건너뛰기', { a: 'end', c: C.mu, fs: 8 });
    return { svg: wrap(s, { label: '손익비 1대2 도해' }),
      cap: '목표 <b>+2R</b>, 손절 <b>−1R</b>이면 승률 40%로도 기대값은 플러스. 진입 전에 두 선을 먼저 긋습니다' };
  };

  /* 18. 추세선 세 번째 접점 ------------------------------------ */
  F[17] = function () {
    var s = frame(), y0 = 44, y1 = 176, x0 = X0 + 4, x1 = X1 - 2, n = 32;
    var cl = curve([[0, 64], [5, 92], [8, 84], [13, 108], [16, 100], [21, 126], [24, 118], [29, 142], [31, 128]], n, 1.3, 291);
    var K = candles(toCand(cl, 1.6, 301), x0, x1, y0, y1, { pad: 0.16 });
    s += K.svg;
    var p1 = [K.cx(8), K.Y(84)], p2 = [K.cx(24), K.Y(118)];
    var slope = (p2[1] - p1[1]) / (p2[0] - p1[0]);
    s += line(p1[0] - 18, p1[1] - slope * 18, x1, p1[1] + slope * (x1 - p1[0]), { c: C.am, w: 1.6 });
    s += badge(p1[0], p1[1] + 12, '1', { c: C.am, r: 6.4, fs: 7.6 });
    s += badge(K.cx(16), p1[1] + slope * (K.cx(16) - p1[0]) + 12, '2', { c: C.am, r: 6.4, fs: 7.6 });
    s += badge(p2[0], p2[1] + 12, '3', { c: C.up, r: 6.4, fs: 7.6 });
    s += T(x0 + 2, 40, '두 점만으로는 아무 선이나 그을 수 있음', { c: C.mu, fs: 8 });
    s += chip(X1 - 6, 154, '세 번째 접점 = 유효 추세선', { a: 'end', c: C.up, bd: 'rgba(47,217,166,.45)' });
    s += chip(X1 - 6, 172, '이탈 = 청산', { a: 'end', c: C.dn, bd: 'rgba(251,113,133,.45)' });
    return { svg: wrap(s, { label: '추세선 세 번째 접점 도해' }),
      cap: '저점 두 개를 이은 선이 <b>세 번째로 닿아 반등</b>해야 진짜 추세선. 닿으면 매수, 이탈하면 청산' };
  };

  /* 19. 실적 D-3 갭 하락 --------------------------------------- */
  F[18] = function () {
    var s = frame(), y0 = 44, y1 = 186, x0 = X0 + 2, x1 = X1 - 2, n = 24;
    var cl = curve([[0, 108], [6, 118], [9, 124], [10, 96], [14, 88], [18, 94], [23, 90]], n, 1.5, 311);
    var data = toCand(cl, 1.8, 321);
    data[10] = [96.5, 99, 91, 96];
    var K = candles(data, x0, x1, y0, y1, { pad: 0.2 });
    s += K.svg;
    var gx = (K.cx(9) + K.cx(10)) / 2;
    s += line(gx, 44, gx, 180, { c: 'rgba(245,185,66,.55)', w: 1, dash: '4 4' });
    s += chip(gx, 52, '실적 발표', { c: C.am, bd: 'rgba(245,185,66,.5)' });
    s += bracket(K.cx(10) + 16, K.Y(124), K.cx(10) + 16, K.Y(96), { c: C.dn, w: 1.2 });
    s += chip(K.cx(10) + 22, K.Y(110), '갭 −22%', { c: C.dn, bd: 'rgba(251,113,133,.45)' });
    s += line(x0, K.Y(111), x1, K.Y(111), { c: 'rgba(251,113,133,.8)', w: 1, dash: '2 3' });
    s += chip(X1 - 6, K.Y(111) - 16, '−10% 손절선', { a: 'end', c: C.dn, bd: 'rgba(251,113,133,.4)' });
    s += T(X1 - 6, 172, '시가 체결 → 손절선 무력', { a: 'end', c: C.tx, fs: 8.2, w: 600 });
    s += T(x0 + 2, 182, 'D-3 이내 = 신규 진입 보류 · 비중 축소', { c: C.mu, fs: 7.8 });
    return { svg: wrap(s, { label: '실적 갭 하락 도해' }),
      cap: '실적은 <b>갭</b>으로 출발. −10% 손절을 걸어도 시가가 −22%면 그 가격에 체결됩니다 → <b>D-3부터 비중 축소</b>' };
  };

  /* 20. 최대낙폭(MDD) ----------------------------------------- */
  F[19] = function () {
    var s = frame(), y0 = 44, y1 = 182, x0 = X0 + 4, x1 = X1 - 4, n = 40;
    var eq = curve([[0, 60], [10, 96], [17, 140], [22, 150], [30, 96], [36, 128], [39, 148]], n, 1.3, 331);
    var Y = function (v) { return y1 - (v - 50) / (170 - 50) * (y1 - y0); };
    var pts = [], i;
    for (i = 0; i < n; i++) pts.push([x0 + (x1 - x0) / n * (i + 0.5), Y(eq[i])]);
    s += area(pts, Y(50), { f: 'rgba(56,189,248,.10)' });
    s += poly(pts, { c: C.cy, w: 1.9 });
    var pi = 22, ti = 30;
    s += band([[pts[pi][0], pts[pi][1]], [pts[ti][0], pts[ti][1]]],
      [[pts[pi][0], Y(50)], [pts[ti][0], Y(50)]], { f: 'rgba(251,113,133,.22)' });
    s += bracket(pts[pi][0] - 6, pts[pi][1], pts[pi][0] - 6, pts[ti][1], { c: C.dn, w: 1.2 });
    s += chip(pts[pi][0] + 8, (pts[pi][1] + pts[ti][1]) / 2, 'MDD −36.9%', { c: C.dn, bd: 'rgba(251,113,133,.45)' });
    s += dot(pts[pi][0], pts[pi][1], 3, { c: C.am, f: C.am });
    s += chip(pts[39][0] - 6, pts[39][1] - 14, '최종 +87%', { a: 'end', c: C.up, bd: 'rgba(47,217,166,.45)' });
    s += T(x0 + 2, 40, '중간 낙폭을 버티지 못하면 수익은 실현되지 않음', { c: C.mu, fs: 7.8 });
    return { svg: wrap(s, { label: '최대낙폭 MDD 도해' }),
      cap: '수익률보다 <b>최대낙폭(MDD)</b>. 내가 버틸 수 있는 하락 폭을 먼저 정하고 전략·비중을 고릅니다' };
  };

  /* 21. 분할 매수·분할 익절 ------------------------------------ */
  F[20] = function () {
    var s = frame(), y0 = 50, y1 = 184, x0 = X0 + 2, x1 = X1 - 2, n = 28;
    var cl = curve([[0, 120], [7, 96], [12, 84], [17, 92], [22, 112], [27, 130]], n, 1.6, 341);
    var K = candles(toCand(cl, 1.9, 351), x0, x1, y0, y1, { pad: 0.2 });
    s += K.svg;
    var buys = [[8, 92], [11, 86], [15, 90]], i;
    for (i = 0; i < buys.length; i++) {
      var yb = K.Y(buys[i][1]);
      s += arrow(K.cx(buys[i][0]) + 3, yb + 34, K.cx(buys[i][0]) + 3, yb + 12, { c: C.up, w: 1.4 });
      s += T(K.cx(buys[i][0]) + 8, yb + 37, '1/3', { c: C.up, fs: 8, w: 600 });
    }
    var avg = 89.3;
    s += line(x0, K.Y(avg), x1, K.Y(avg), { c: C.am, w: 1.2, dash: '5 4' });
    s += chip(x1 - 6, K.Y(avg) + 13, '평균단가', { a: 'end', c: C.am, bd: 'rgba(245,185,66,.45)' });
    var sells = [[25, 130], [27, 130]];
    for (i = 0; i < sells.length; i++) {
      var ys = K.Y(sells[i][1]);
      s += arrow(K.cx(sells[i][0]) + 2, ys - 26, K.cx(sells[i][0]) + 2, ys - 7, { c: C.cy, w: 1.4 });
    }
    s += legend([{ t: '매수 1/3씩 3회', c: C.up }, { t: '매도 절반씩 2회', c: C.cy, line: false }], 20);
    return { svg: wrap(s, { label: '분할 매수 분할 익절 도해' }),
      cap: '3~4회 <b>분할 매수</b>로 평균단가를 완만하게, <b>분할 익절</b>로 “너무 일찍 팔았다”는 후회를 줄입니다' };
  };

  /* 22. 시장 레짐 필터 ---------------------------------------- */
  F[21] = function () {
    var s = frame(), y0 = 46, y1 = 186, x0 = X0 + 2, x1 = X1 - 2, n = 44;
    var cl = curve([[0, 96], [12, 110], [20, 104], [28, 86], [34, 80], [43, 92]], n, 1.3, 361);
    var K = candles(toCand(cl, 1.5, 371), x0, x1, y0, y1, { pad: 0.2 });
    s += K.svg;
    var ma = smooth(cl, 6), pts = [], i;
    for (i = 0; i < n; i++) pts.push([K.cx(i), K.Y(ma[i])]);
    s += poly(pts, { c: C.am, w: 2 });
    s += chip(X0 + 4, 56, '위 = 스윙 ON', { c: C.up, bd: 'rgba(47,217,166,.45)' });
    s += legend([{ t: 'QQQ 100일선', c: C.am }], 196);
    var cx0 = K.cx(27), cx1 = K.cx(35);
    s += rectW(cx0, y0, cx1 - cx0, y1 - y0, { f: 'rgba(251,113,133,.10)', c: 'rgba(251,113,133,.35)', w: 1, rx: 3, dash: '3 3' });
    s += T((cx0 + cx1) / 2, y0 + 12, '진입 금지', { a: 'middle', c: C.dn, fs: 8, w: 600 });
    s += chip(X1 - 6, 200, '아래 = 스윙 OFF', { a: 'end', c: C.dn, bd: 'rgba(251,113,133,.45)' });
    s += T(x0 + 2, 40, '개별 종목 신호보다 시장이 먼저', { c: C.mu, fs: 7.8 });
    return { svg: wrap(s, { label: '시장 레짐 필터 도해' }),
      cap: 'QQQ가 <b>100일선 위일 때만 스윙 진입</b>. 필터는 수익을 늘리는 장치가 아니라 <b>큰 손실을 막는 장치</b>' };
  };

  /* 23. 시총 Top 30 + 실적 우량주 ------------------------------ */
  F[22] = function () {
    var s = frame();
    var rows = [
      { x: 34, w: 312, y: 50, lab: '전체 종목', val: '102', f: 'rgba(120,170,210,.16)', c: 'rgba(120,190,230,.4)' },
      { x: 62, w: 256, y: 84, lab: '시총 Top 30', val: '30', f: 'rgba(56,189,248,.16)', c: 'rgba(56,189,248,.5)' },
      { x: 92, w: 196, y: 118, lab: '실적 우량주', val: '조건 통과', f: 'rgba(47,217,166,.18)', c: 'rgba(47,217,166,.55)' }
    ], i;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      s += rectW(r.x, r.y, r.w, 26, { f: r.f, c: r.c, w: 1, rx: 7 });
      s += T(r.x + 11, r.y + 17, r.lab, { c: C.tx, fs: 8.6, w: 600 });
      s += T(r.x + r.w - 11, r.y + 17, r.val, { a: 'end', c: C.cy2, fs: i === 2 ? 7.8 : 9, w: 600 });
    }
    s += arrow(190, 78, 190, 82, { c: 'rgba(143,231,255,.55)', w: 1.2 });
    s += arrow(190, 112, 190, 116, { c: 'rgba(143,231,255,.55)', w: 1.2 });
    s += T(92, 156, 'EPS 흑자 · 매출 +5% · 순익률 15%', { c: C.up, fs: 8, w: 600 });
    s += T(34, 182, '정렬: 점수 높은순 / RSI 낮은순', { c: C.mu, fs: 8 });
    s += chip(34, 196, '남은 목록은 “더 볼 목록”', { c: C.am, bd: 'rgba(245,185,66,.45)' });
    return { svg: wrap(s, { label: '시총 상위와 실적 우량주 조합 도해' }),
      cap: '<b>큰 회사</b>에서 <b>잘 버는 회사</b>만 남기는 2단 압축. 프리셋은 “사도 되는 목록”이 아니라 “더 볼 목록”입니다' };
  };

  /* 24. 실적 D-3 배지 ------------------------------------------ */
  F[23] = function () {
    var s = frame();
    s += rectW(30, 46, 200, 74, { f: 'rgba(20,34,54,.75)', c: 'rgba(96,222,255,.32)', rx: 9 });
    s += T(42, 66, 'NVDA', { c: C.tx, fs: 10.5, w: 600 });
    s += T(42, 80, 'NVIDIA Corp · 반도체', { c: C.mu, fs: 7.6 });
    s += T(42, 100, '$182.44', { c: C.tx, fs: 12, w: 600 });
    s += T(110, 100, '+1.8%', { c: C.up, fs: 8.4, w: 600 });
    s += rectW(150, 54, 68, 20, { f: 'rgba(245,185,66,.16)', c: 'rgba(245,185,66,.6)', rx: 10 });
    s += T(184, 68, '실적 D-3', { a: 'middle', c: C.am, fs: 8.6, w: 600 });
    s += arrow(238, 68, 266, 68, { c: C.am, w: 1.6 });
    s += rectW(272, 50, 94, 36, { f: 'rgba(245,185,66,.10)', c: 'rgba(245,185,66,.45)', rx: 8, dash: '3 3' });
    s += T(319, 64, '신규 진입 보류', { a: 'middle', c: C.tx, fs: 8.2, w: 600 });
    s += T(319, 77, '보유분 비중 축소', { a: 'middle', c: C.mu, fs: 7.8 });
    s += line(30, 132, X1 - 6, 132, { c: 'rgba(148,178,214,.2)', w: 1 });
    s += T(30, 148, '트레이드 로그에도 보유 종목의 실적 일정 표시', { c: C.mu, fs: 8.2 });
    s += rectW(30, 158, 326, 28, { f: 'rgba(120,170,210,.06)', c: 'rgba(120,190,230,.22)', rx: 7 });
    s += T(42, 176, 'NVDA', { c: C.tx, fs: 8.4, w: 600 });
    s += T(96, 176, '보유 12일 · +8.4%', { c: C.mu, fs: 8 });
    s += chip(340, 172, 'D-3', { a: 'end', c: C.am, bd: 'rgba(245,185,66,.5)' });
    s += T(30, 200, '배지는 “위험”이 아니라 “갭이 날 수 있다”는 뜻', { c: C.dim, fs: 7.6 });
    return { svg: wrap(s, { label: '실적 디데이 배지 도해' }),
      cap: '히어로 카드·트레이드 로그의 <b>실적 D-day 배지</b>. D-3 이내면 노란 경고가 켜지고, 갭 위험 구간이 됩니다' };
  };

  /* 25. 추세형 ↔ 스윙형 ---------------------------------------- */
  F[24] = function () {
    var s = frame();
    s += rectW(24, 44, 164, 118, { f: 'rgba(47,217,166,.07)', c: 'rgba(47,217,166,.35)', rx: 9 });
    s += rectW(192, 44, 164, 118, { f: 'rgba(56,189,248,.07)', c: 'rgba(56,189,248,.35)', rx: 9 });
    s += T(34, 60, '추세형 (중기)', { c: C.up, fs: 9.2, w: 600 });
    s += T(202, 60, '스윙형 (단기)', { c: C.cy, fs: 9.2, w: 600 });
    var t1 = curve([[0, 66], [10, 84], [20, 80], [30, 110]], 24, 0.8, 381);
    var p1 = [], i;
    for (i = 0; i < 24; i++) p1.push([34 + i * 6.2, 130 - (t1[i] - 60) / 60 * 46]);
    s += poly(p1, { c: C.up, w: 1.7 });
    var t2 = curve([[0, 80], [4, 96], [8, 76], [12, 100], [16, 78], [20, 98], [24, 84]], 24, 1.6, 391);
    var p2 = [], j;
    for (j = 0; j < 24; j++) p2.push([202 + j * 6.2, 130 - (t2[j] - 60) / 60 * 46]);
    s += poly(p2, { c: C.cy, w: 1.7 });
    for (j = 3; j < 24; j += 5) s += dot(p2[j][0], p2[j][1], 2.4, { c: '#BFE9FF', f: '#BFE9FF' });
    s += T(34, 146, '점수 50+ · 6 ATR 손절', { c: C.mu, fs: 7.8 });
    s += T(34, 157, '10 ATR 트레일 · 보유 김', { c: C.mu, fs: 7.8 });
    s += T(202, 146, 'RSI(2)<15 · 4.5 ATR', { c: C.mu, fs: 7.8 });
    s += T(202, 157, '짧게 진입 · 짧게 청산', { c: C.mu, fs: 7.8 });
    s += chip(190, 178, '시장 장세를 보고 전환', { a: 'middle', c: C.am, bd: 'rgba(245,185,66,.45)' });
    s += T(24, 200, '전환은 최소 몇 주 유지 · 자주 바꾸면 비용만 늘어남', { c: C.dim, fs: 7.6 });
    return { svg: wrap(s, { label: '추세형과 스윙형 비교 도해' }),
      cap: '완만한 상승장엔 <b>추세형(오래 보유)</b>, 변동성 큰 장엔 <b>스윙형(짧게)</b>. 전환은 장세를 보고 정합니다' };
  };

  /* 26. 기간 버튼 3M~5Y ---------------------------------------- */
  F[25] = function () {
    var s = frame();
    var labs = ['3M', '6M', '1Y', '2Y', '5Y'], i, x = 30;
    for (i = 0; i < labs.length; i++) {
      var on = i === 4;
      s += rectW(x, 48, 52, 22, { f: on ? 'rgba(56,189,248,.20)' : 'rgba(255,255,255,.03)', c: on ? 'rgba(96,222,255,.7)' : 'rgba(120,190,230,.28)', rx: 6 });
      s += T(x + 26, 63, labs[i], { a: 'middle', c: on ? '#DCF6FF' : C.mu, fs: 9.2, w: 600 });
      x += 57;
    }
    var cl = curve([[0, 110], [6, 92], [10, 74], [16, 86], [24, 104], [30, 118], [34, 140]], 34, 1.4, 401);
    var K = candles(toCand(cl, 1.6, 411), 30, X1 - 8, 84, 158, { pad: 0.14 });
    s += K.svg;
    s += rectW(K.cx(6), 84, K.cx(16) - K.cx(6), 74, { f: 'rgba(251,113,133,.12)', c: 'rgba(251,113,133,.35)', w: 1, rx: 2, dash: '3 3' });
    s += T((K.cx(6) + K.cx(16)) / 2, 96, '2022 하락장', { a: 'middle', c: C.dn, fs: 8, w: 600 });
    s += line(30, 168, X1 - 8, 168, { c: 'rgba(148,178,214,.2)', w: 1 });
    s += T(30, 184, '차트 범위와 백테스트 기간이 함께 바뀜', { c: C.tx, fs: 8.6, w: 600 });
    s += T(30, 198, '5Y = MDD · 1Y = 최근 성과 확인', { c: C.mu, fs: 7.8 });
    return { svg: wrap(s, { label: '기간 버튼 도해' }),
      cap: '<b>3M~5Y 버튼 = 차트 범위 + 백테스트 기간</b>. 5Y로 MDD를, 1Y로 최근 성과를 확인합니다' };
  };

  /* 27. 트레이드 로그 ------------------------------------------ */
  F[26] = function () {
    var s = frame();
    s += T(30, 50, '보유기간 · 수익률 · 청산 사유', { c: C.mu, fs: 8 });
    var rows = [['NVDA', '12일', '+8.4%', '목표', C.up], ['MSFT', '7일', '+2.1%', '추세', C.up], ['AAPL', '4일', '−4.6%', '손절', C.dn]];
    for (var i = 0; i < rows.length; i++) {
      var y = 58 + i * 26;
      s += rectW(30, y, 322, 22, { f: i % 2 ? 'rgba(120,170,210,.05)' : 'rgba(120,170,210,.09)', c: 'rgba(120,190,230,.18)', rx: 5 });
      s += T(40, y + 15, rows[i][0], { c: C.tx, fs: 8.4, w: 600 });
      s += T(104, y + 15, rows[i][1], { c: C.mu, fs: 8.2 });
      s += T(178, y + 15, rows[i][2], { c: rows[i][4], fs: 8.4, w: 600 });
      s += T(258, y + 15, rows[i][3], { c: C.mu, fs: 8.2 });
    }
    s += T(30, 158, '청산 사유 분포', { c: C.tx, fs: 8.4, w: 600 });
    var segs = [[30, 158, '목표 50%', 'rgba(47,217,166,.65)'], [190, 96, '손절 30%', 'rgba(251,113,133,.6)'], [288, 64, '추세 20%', 'rgba(56,189,248,.6)']];
    for (var k = 0; k < segs.length; k++) {
      s += rectW(segs[k][0], 164, segs[k][1], 16, { f: segs[k][3], c: 'none', w: 0, rx: 4 });
      s += T(segs[k][0] + segs[k][1] / 2, 175, segs[k][2], { a: 'middle', c: '#071019', fs: 7.8, w: 600 });
    }
    s += T(30, 196, '연속 손실 구간을 찾아 “내가 버틸 길이”인지 확인', { c: C.mu, fs: 7.8 });
    return { svg: wrap(s, { label: '트레이드 로그 읽기 도해' }),
      cap: '로그는 실적표가 아니라 <b>전략의 성격</b>을 읽는 자료. 청산 사유 분포와 <b>연속 손실 구간</b>을 봅니다' };
  };

  /* 28. 모의매매 ---------------------------------------------- */
  F[27] = function () {
    var s = frame();
    s += rectW(28, 42, 324, 132, { f: 'rgba(16,28,46,.6)', c: 'rgba(96,222,255,.28)', rx: 9 });
    s += T(40, 60, '가상투자 · 모의매매', { c: C.tx, fs: 9.2, w: 600 });
    s += chip(340, 56, '시드 $10,000', { a: 'end', c: C.cy2 });
    var eq = curve([[0, 100], [12, 112], [24, 104], [34, 126], [44, 120], [52, 138]], 40, 1.2, 421);
    var pts = [], i;
    for (i = 0; i < 40; i++) pts.push([40 + i * 7.4, 152 - (eq[i] - 95) / 50 * 58]);
    s += area(pts, 156, { f: 'rgba(47,217,166,.10)' });
    s += poly(pts, { c: C.up, w: 1.7 });
    s += line(40, 168, 340, 168, { c: 'rgba(148,178,214,.3)', w: 1.4 });
    s += dot(196, 168, 4.2, { c: C.am, f: C.am });
    s += line(196, 168, 196, 118, { c: C.am, w: 1, dash: '3 3' });
    s += chip(196, 110, '리플레이 시점', { a: 'middle', c: C.am, bd: 'rgba(245,185,66,.45)' });
    s += T(40, 188, '그때 알 수 있었던 정보만 사용 · 실제 주문 아님', { c: C.mu, fs: 8 });
    s += T(28, 202, '목표는 수익이 아니라 규칙을 지키는 연습', { c: C.dim, fs: 7.8 });
    return { svg: wrap(s, { label: '모의매매 화면 도해' }),
      cap: '실제 돈 전에 <b>모의매매로 규칙부터</b>. 시점 리플레이로 과거 어느 날로 돌아가 손버릇을 검증합니다' };
  };

  /* 29. 종합 기술점수 ------------------------------------------ */
  F[28] = function () {
    var s = frame();
    var fac = [['추세', 18], ['모멘텀', 12], ['가격구조', 8], ['거래량', -5], ['반전', -7]], i;
    var zero = 196, sc = 4.6;
    s += T(30, 44, '5개 팩터 가중 합 · 50 = 중립', { c: C.mu, fs: 8 });
    for (i = 0; i < fac.length; i++) {
      var y = 66 + i * 25, v = fac[i][1], w = Math.abs(v) * sc;
      s += T(30, y + 4, fac[i][0], { c: C.tx, fs: 8.4, w: 600 });
      s += rectW(zero - 92, y - 5, 184, 11, { f: 'rgba(120,170,210,.06)', c: 'none', w: 0, rx: 5 });
      if (v >= 0) s += rectW(zero, y - 5, w, 11, { f: 'rgba(47,217,166,.72)', c: 'none', w: 0, rx: 5 });
      else s += rectW(zero - w, y - 5, w, 11, { f: 'rgba(251,113,133,.72)', c: 'none', w: 0, rx: 5 });
      s += T(v >= 0 ? zero + w + 6 : zero - w - 6, y + 4, (v > 0 ? '+' : '−') + Math.abs(v), { a: v >= 0 ? 'start' : 'end', c: v >= 0 ? C.up : C.dn, fs: 8, w: 600 });
    }
    s += line(zero, 58, zero, 192, { c: 'rgba(220,235,250,.45)', w: 1, dash: '4 3' });
    s += T(zero, 202, '기준 50', { a: 'middle', c: C.mu, fs: 7.6 });
    s += chip(X1 - 6, 202, '종합 76 · 매수 우위', { a: 'end', c: C.up, bd: 'rgba(47,217,166,.5)' });
    return { svg: wrap(s, { label: '종합 기술점수 팩터 도해' }),
      cap: '점수보다 <b>어느 팩터가 만들었는지</b>. 점수가 높아도 거래량이 마이너스면 힘없이 오른 것일 수 있습니다' };
  };

  /* 30. 관심종목 5개 ------------------------------------------ */
  F[29] = function () {
    var s = frame();
    var rows = [['NVDA', '+2.4%', C.up], ['MSFT', '+0.8%', C.up], ['AAPL', '−0.6%', C.dn], ['QQQ', '+0.5%', C.up], ['GOOGL', '+1.2%', C.up]];
    for (var i = 0; i < rows.length; i++) {
      var y = 46 + i * 28;
      s += rectW(28, y, 324, 24, { f: i % 2 ? 'rgba(120,170,210,.05)' : 'rgba(120,170,210,.09)', c: 'rgba(120,190,230,.18)', rx: 6 });
      s += '<path d="M44 ' + (y + 8) + 'l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6-4.5-4.2 6.1-.7z" fill="' + C.am + '" opacity=".9"/>';
      s += T(66, y + 16, rows[i][0], { c: C.tx, fs: 9, w: 600 });
      s += T(342, y + 16, rows[i][1], { a: 'end', c: rows[i][2], fs: 8.6, w: 600 });
    }
    s += T(28, 202, '실적 일정과 차트를 매일 확인할 수 있는 수', { c: C.mu, fs: 8 });
    s += chip(340, 202, '5 / 5', { a: 'end', c: C.cy2 });
    return { svg: wrap(s, { label: '관심종목 다섯 개 도해' }),
      cap: '관심종목은 <b>5개 안팎</b>. 많이 담으면 실적·차트를 매일 보지 못합니다 (브라우저에만 저장)' };
  };

  /* 31. 공포·탐욕 시계 ---------------------------------------- */
  F[30] = function () {
    var s = frame();
    var cx = 190, cy = 174, r = 108;
    var zones = [[0, 25, '#FB7185'], [25, 45, '#FB923C'], [45, 55, '#94A3B8'], [55, 75, '#34D399'], [75, 100, '#2FD9A6']];
    for (var i = 0; i < zones.length; i++) {
      var a0 = Math.PI + zones[i][0] / 100 * Math.PI, a1 = Math.PI + zones[i][1] / 100 * Math.PI;
      s += '<path d="' + arcPath(cx, cy, r, a0, a1) + '" fill="none" stroke="' + zones[i][2] + '" stroke-width="13" opacity=".85"/>';
    }
    var v = 18, ang = Math.PI + v / 100 * Math.PI;
    var nx = cx + Math.cos(ang) * (r - 30), ny = cy + Math.sin(ang) * (r - 30);
    s += line(cx, cy, nx, ny, { c: '#EAF2FF', w: 2.6 });
    s += dot(cx, cy, 5.2, { c: '#EAF2FF', f: '#EAF2FF' });
    s += T(82, 188, '공포 0', { c: '#FB7185', fs: 7.8, w: 600 });
    s += T(298, 188, '탐욕 100', { a: 'end', c: C.up, fs: 7.8, w: 600 });
    s += T(190, 52, '중립 50', { a: 'middle', c: C.mu, fs: 7.8, w: 600 });
    s += chip(cx, 200, '18 · 극단적 공포 → 분할 매수', { a: 'middle', c: C.am, bd: 'rgba(245,185,66,.5)' });
    return { svg: wrap(s, { label: '공포 탐욕 시계 도해' }),
      cap: '25 이하 <b>극단적 공포 = 분할 매수 구간</b>, 75 이상 탐욕 = 추격 자제. 비중 조절 도구로 씁니다' };
  };

  /* 32. W 프리셋 3단계 ---------------------------------------- */
  F[31] = function () {
    var s = frame();
    var Ws = [[26, '진행'], [140, '임박'], [254, '돌파']];
    for (var i = 0; i < 3; i++) {
      var x = Ws[i][0], y = 52;
      var on = i === 2;
      s += rectW(x, y, 100, 92, { f: on ? 'rgba(47,217,166,.10)' : 'rgba(120,170,210,.06)', c: on ? 'rgba(47,217,166,.5)' : 'rgba(120,190,230,.26)', rx: 9 });
      s += T(x + 50, y + 16, Ws[i][1], { a: 'middle', c: on ? C.up : C.cy2, fs: 9, w: 600 });
      var pts = [[x + 12, y + 30], [x + 28, y + 58], [x + 46, y + 36], [x + 66, y + 60], [x + 86, y + 40 - i * 7]];
      s += poly(pts, { c: on ? C.up : '#7FB6D8', w: 1.8 });
      s += line(x + 12, y + 36, x + 86, y + 36, { c: on ? 'rgba(47,217,166,.7)' : 'rgba(245,185,66,.55)', w: 1, dash: '4 3' });
    }
    s += arrow(128, 98, 138, 98, { c: 'rgba(143,231,255,.5)', w: 1.3 });
    s += arrow(242, 98, 252, 98, { c: 'rgba(143,231,255,.5)', w: 1.3 });
    s += T(26, 162, '바닥 형성 → 넥라인 5% 이내 → 넥라인 돌파(최근 5봉)', { c: C.tx, fs: 8.4 });
    s += chip(26, 180, '임박에서 지켜보다 돌파에서 진입 판단', { c: C.am, bd: 'rgba(245,185,66,.42)' });
    s += T(26, 200, '차트의 W 오버레이로 실제 넥라인·두 바닥 확인', { c: C.mu, fs: 7.8 });
    return { svg: wrap(s, { label: 'W 프리셋 세 단계 도해' }),
      cap: 'W 프리셋은 <b>진행 → 임박 → 돌파</b> 3단계. “임박”에서 지켜보다 “돌파”에서 진입을 판단합니다' };
  };

  /* 33. 거래량과 OBV ------------------------------------------ */
  F[32] = function () {
    var s = frame();
    var y0 = 44, y1 = 112, n = 36;
    var cl = curve([[0, 96], [8, 92], [14, 98], [20, 94], [26, 99], [32, 96], [35, 98]], n, 1.4, 431);
    var K = candles(toCand(cl, 1.6, 441), X0 + 2, X1 - 2, y0, y1, { pad: 0.5 });
    s += K.svg;
    s += T(X0 + 2, 40, '가격은 횡보', { c: C.mu, fs: 8.2, w: 600 });
    var obv = curve([[0, 40], [8, 54], [16, 62], [24, 78], [31, 92], [35, 100]], n, 2.2, 451);
    var Y2 = function (v) { return 186 - (v - 30) / 80 * 50; };
    var pts = [], i;
    for (i = 0; i < n; i++) pts.push([X0 + 2 + (X1 - X0 - 4) / n * (i + 0.5), Y2(obv[i])]);
    s += area(pts, 186, { f: 'rgba(167,139,250,.10)' });
    s += poly(pts, { c: C.vi, w: 1.8 });
    s += T(X0 + 2, 122, 'OBV (누적 거래량)', { c: C.vi, fs: 8, w: 600 });
    s += chip(X1 - 8, 132, '우상향 = 조용한 매집', { a: 'end', c: C.vi, bd: 'rgba(167,139,250,.45)' });
    s += line(X0, 128, X1, 128, { c: 'rgba(148,178,214,.16)', w: 1 });
    s += T(X0 + 2, 200, '가격이 안 움직여도 거래량은 먼저 움직인다', { c: C.mu, fs: 8.2 });
    return { svg: wrap(s, { label: '거래량과 OBV 도해' }),
      cap: '가격은 횡보인데 <b>OBV가 우상향 = 조용한 매집</b>. 거래량은 방향이 아니라 <b>확인</b>용입니다' };
  };

  return {
    count: F.length,
    get: function (i) { return (i >= 0 && i < F.length) ? F[i]() : null; }
  };
})();
