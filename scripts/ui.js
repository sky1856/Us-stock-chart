/* ============================================================
   APEX QUANT — UI layer
   ============================================================ */
(function () {
  'use strict';
  var M = window.MARKET, QE = window.QE;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* 이동평균선 5·20·60·120·240일 (단순이동평균) — 색은 5개 모두 어두운 배경에서 서로 구분되도록 고른 값 */
  var MA = [
    { p: 5, label: '5일', color: '#38BDF8', w: 1.8 },
    { p: 20, label: '20일', color: '#FBBF24', w: 1.6 },
    { p: 60, label: '60일', color: '#34D399', w: 1.6 },
    { p: 120, label: '120일', color: '#A78BFA', w: 1.5 },
    { p: 240, label: '240일', color: '#F97316', w: 1.5 }
  ];

  /* 일목균형표 9·26·52 — 선행스팬과 구름대만 표시 (전환선·기준선은 차트에 그리지 않음)
     상승(양운)은 빨강, 하락(음운)은 파랑 */
  var ICHI = [
    { k: 'spanA', label: '선행A', short: '선A', color: '#EF4444', w: 1.2, dash: [4, 3] },
    { k: 'spanB', label: '선행B', short: '선B', color: '#3B82F6', w: 1.2, dash: [4, 3] }
  ];
  function narrow() { return window.innerWidth <= 700; }

  /* ---------------- 관심종목 (개인 브라우저 localStorage 저장) ---------------- */
  var WATCH_KEY = 'apex.watchlist.v1';
  var WATCH_DEFAULT = M.tickers.filter(function (x) { return x.fav; }).map(function (x) { return x.t; });
  var watchKnown = {};
  M.tickers.forEach(function (x) { watchKnown[x.t] = 1; });
  function isWatch(t) { return state.watch.indexOf(t) >= 0; }
  function watchPersist() {
    try { localStorage.setItem(WATCH_KEY, JSON.stringify(state.watch)); } catch (e) {}
  }
  function watchRestore() {
    var saved = null;
    try {
      var raw = localStorage.getItem(WATCH_KEY);
      if (raw) {
        var v = JSON.parse(raw);
        if (Array.isArray(v)) saved = v;
        else if (v && Array.isArray(v.t)) saved = v.t;
      }
    } catch (e) { saved = null; }
    if (!saved) { state.watch = WATCH_DEFAULT.slice(); return; }   /* 저장된 값이 없으면 기본 5종목 */
    var seen = {};
    var kept = saved.filter(function (t) {           /* 종목 코드 검증·중복 제거 (데이터셋에 없는 티커는 버린다) */
      if (typeof t !== 'string' || !watchKnown[t] || seen[t]) return false;
      seen[t] = 1; return true;
    });
    state.watch = kept.length ? kept : (saved.length ? WATCH_DEFAULT.slice() : []);   /* 전부 무효면 기본값 */
  }
  function watchToggle(t, force) {
    if (!watchKnown[t]) return;
    var has = isWatch(t), want = (force == null) ? !has : !!force;
    if (want === has) return;
    state.watch = want ? state.watch.concat([t]) : state.watch.filter(function (x) { return x !== t; });
    watchPersist();
    watchRefresh();
  }
  function watchRefresh() {
    renderFavs();
    var sl = $('#scanList'), st = sl ? sl.scrollTop : 0;
    renderScanner();
    if (sl) sl.scrollTop = st;                       /* 별을 찍어도 목록 스크롤이 튀지 않게 */
    var cf = $('#cFav'); if (cf) cf.textContent = state.watch.length;
    var fc = $('#favCount'); if (fc) fc.textContent = '관심 ' + state.watch.length + '종목';
    syncHeroFav();
    var pop = $('#favPop');
    if (pop && pop.classList.contains('on')) renderFavPop();
  }
  function syncHeroFav() {
    var b = $('#heroFav'); if (!b) return;
    var on = isWatch(state.cur);
    b.textContent = on ? '★' : '☆';
    b.classList.toggle('on', on);
    b.title = on ? '관심종목에서 제거 (' + state.cur + ')' : '관심종목에 추가 (' + state.cur + ')';
  }

  var cache = new Map();
  var state = {
    cur: 'NVDA', range: 128, filter: 'all', sort: 'mc', q: '', listQ: '',
    show: { ma: true, ichi: true, bb: true, sig: true, rsi: true, macd: true, ew: true },
    maOn: { 5: true, 20: true, 60: true, 120: true, 240: true },
    simIdx: 0, tool: 'cursor', ewMode: 0,
    ewShow: { sub: true, ch: true, clu: true },
    watch: [], strategy: 'trend'
  };
  watchRestore();

  /* ---------------- 전략 전환 (추세형 ↔ 스윙형) ---------------- */
  var STRAT_KEY = 'apex.strategy.v1';
  var STRAT = {
    trend: {
      key: 'trend', title: '추세형', sub: '중기',
      desc: '종합 기술점수 50 이상 매수 · 시장 단계(100/50/0%)로 비중 조절 · 손절 6 ATR · 트레일 10 ATR 청산',
      logSub: '종합점수 50 이상 매수 · 시장 단계(100/50/0%) 방어 · 손절 6 ATR · 트레일 10 ATR 청산'
    },
    swing: {
      key: 'swing', title: '스윙형', sub: '단기',
      desc: 'RSI(2) 15 미만 + QQQ 200일선 위 → 다음 날 시가 매수 · 이익 시(+5% 이상) 20일선 이탈 → 다음 날 시가 청산 · 손절 4.5 ATR (평균 약 49일)',
      logSub: 'RSI(2) 15 미만 + QQQ 200일선 위 매수 · 손절 4.5 ATR · 이익 중 20일선 이탈 시 다음 날 시가 청산 (평균 약 49일)'
    }
  };
  function stratKey() { return state.strategy === 'swing' ? 'swing' : 'trend'; }
  function stratRestore() {
    try {
      var v = localStorage.getItem(STRAT_KEY);
      if (v === 'swing' || v === 'trend') state.strategy = v;
    } catch (e) { /* 저장소 차단 환경에서는 추세형 */ }
  }
  function stratPersist() {
    try { localStorage.setItem(STRAT_KEY, state.strategy); } catch (e) {}
  }
  function stratBundle(a) {
    return (a && a.strategy) ? (a.strategy[stratKey()] || a.strategy.trend) : null;
  }
  /* 선택된 전략의 KPI·거래·에쿼티만 갈아 끼운 사본 — 백테스트를 다시 돌리지 않는다 */
  function stratView(a) {
    if (!a || !a.strategy) return a;
    var b = stratBundle(a);
    if (!b) return a;
    var store = a._sv || (a._sv = {});
    if (store[b.key]) return store[b.key];
    var v = {}, k;
    for (k in a) {
      if (k === '_sv') continue;
      if (Object.prototype.hasOwnProperty.call(a, k)) v[k] = a[k];
    }
    v.stats = b.stats; v.trades = b.trades; v.equity = b.equity; v.startIdx = b.startIdx;
    v.plan = b.plan; v.stratKey = b.key; v.strat = b;
    store[b.key] = v;
    return v;
  }
  stratRestore();
  function maVisible(p) { return state.show.ma && state.maOn[p]; }
  function maSeries(a, p) { return a.ind['ma' + p]; }

  /* ---------------- data ---------------- */
  function seriesOf(t) {
    var s = M.series[t];
    if (!s) return null;
    return { d: M.dates.slice(s.off), o: s.o, h: s.h, l: s.l, c: s.c, v: s.v };
  }
  function info(t) {
    for (var i = 0; i < M.tickers.length; i++) if (M.tickers[i].t === t) return M.tickers[i];
    return null;
  }
  function get(t) {
    if (cache.has(t)) return cache.get(t);
    var s = seriesOf(t);
    if (!s) return null;
    var a = QE.analyze(t, info(t).n , s);
    a.sym = t;
    a.series = s;
    a.limited = s.c.length < 260;
    a.meta = info(t);
    a.rangePct = (a.price - a.lo52) / Math.max(a.hi52 - a.lo52, 1e-9);
    cache.set(t, a);
    return a;
  }
  function all() { return M.tickers.map(function (x) { return get(x.t); }).filter(Boolean); }

  /* ---------------- as-of view (리플레이) ---------------- */
  function lastIdx() { return M.dates.length - 1; }
  function idxOf(a) { return Math.max(0, Math.min(state.simIdx, a.close.length - 1)); }
  var viewCache = new Map();
  function viewOf(t) {
    var a = A[t];
    if (!a) return null;
    var i = idxOf(a);
    if (i >= a.close.length - 1) return a;
    var k = t + '@' + i;
    if (viewCache.has(k)) return viewCache.get(k);
    var s = seriesOf(t);
    var v = QE.analyze(t, a.meta.n, {
      d: s.d.slice(0, i + 1), o: s.o.slice(0, i + 1), h: s.h.slice(0, i + 1),
      l: s.l.slice(0, i + 1), c: s.c.slice(0, i + 1), v: s.v.slice(0, i + 1)
    });
    v.sym = t;
    v.meta = a.meta;
    v.series = { d: s.d.slice(0, i + 1), o: s.o.slice(0, i + 1), h: s.h.slice(0, i + 1), l: s.l.slice(0, i + 1), c: s.c.slice(0, i + 1), v: s.v.slice(0, i + 1) };
    v.limited = (i + 1) < 260;
    v.replay = true;
    viewCache.set(k, v);
    return v;
  }
  /* 스캐너 행: 성과·거래는 최신 분석에서, 가격·점수는 기준일 값으로 */
  function rowOf(a) {
    var i = idxOf(a);
    var sc = a.scoreSeries.score[i];
    return {
      price: a.close[i],
      change: i > 0 ? a.close[i] / a.close[i - 1] - 1 : 0,
      score: sc, label: QE.labelOf(sc), i: i
    };
  }

  /* ---------------- format ---------------- */
  function usd(v, d) {
    if (v == null || isNaN(v)) return '—';
    d = d === undefined ? (Math.abs(v) < 1 ? 3 : 2) : d;
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function pct(v, d) {
    if (v == null || isNaN(v)) return '—';
    d = d === undefined ? 2 : d;
    return (v > 0 ? '+' : '') + (v * 100).toFixed(d) + '%';
  }
  function pctP(v) { return v == null ? '—' : (v * 100).toFixed(2) + '%'; }
  function vol(v) {
    if (v == null) return '—';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return String(v);
  }
  function cls(v) { return v > 0 ? 'pos' : (v < 0 ? 'neg' : ''); }
  function signalCls(k) { return { strongbuy: 'sb', buy: 'b', watch: 'w', sell: 's', strongsell: 'ss' }[k]; }
  function pxs(v) { return v == null ? '—' : (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2)); }

  /* ============================================================
     차트 작도 (추세선·수평선·피보나치·구간) — 날짜/가격 좌표로 저장
     ============================================================ */
  var DRAW_KEY = 'apex.draw.v1';
  var drawStore = {};
  var drawState = { anchor: null, preview: null, moved: false, downXY: null };
  function drawLoad() {
    try {
      var o = JSON.parse(localStorage.getItem(DRAW_KEY) || '{}');
      if (o && typeof o === 'object') {
        Object.keys(o).forEach(function (t) {
          if (Array.isArray(o[t])) drawStore[t] = o[t].filter(function (d) { return d && d.type; });
        });
      }
    } catch (e) { /* 저장소 차단 환경에서는 메모리 상태로만 동작 */ }
  }
  function drawSave() {
    try { localStorage.setItem(DRAW_KEY, JSON.stringify(drawStore)); } catch (e) {}
  }
  function drawList(t) {
    if (!drawStore[t]) drawStore[t] = [];
    return drawStore[t];
  }
  function drawCount() {
    var n = drawList(state.cur).length;
    var el = $('#drawCount');
    if (el) el.textContent = String(n);
    return n;
  }

  /* ---------------- boot ---------------- */
  var A = {};   // analysis by ticker
  function boot() {
    state.simIdx = lastIdx();
    ptLoad();
    drawLoad();
    if (paper.simDate) {
      var sdi = M.dates.indexOf(paper.simDate);
      if (sdi >= 0) state.simIdx = sdi;                  /* 저장된 리플레이 날짜 복원 (인덱스 이동 보정) */
      else if (paper.sim != null) state.simIdx = Math.max(0, Math.min(lastIdx(), Math.round(paper.sim)));
    } else if (paper.sim != null) state.simIdx = Math.max(0, Math.min(lastIdx(), Math.round(paper.sim)));
    $('#asOf').textContent = M.asOf;
    $('#footAsOf').textContent = M.asOf;
    $('#footAsOf2').textContent = M.asOf;
    var pb = $('#ptBars'); if (pb) pb.textContent = M.dates.length.toLocaleString('en-US');
    renderMacro();
    renderFearGreed(M.fearGreed, false);
    setTimeout(fgRealtime, 500);
    var t0 = performance.now();
    M.tickers.forEach(function (x) { A[x.t] = get(x.t); });
    $('#uniCount').textContent = M.tickers.filter(function (x) { return x.r; }).length;
    var cf = $('#cFav'); if (cf) cf.textContent = state.watch.length;
    renderFavs();
    renderScanner();
    renderStrategy();
    select(state.cur, true);    console.log('[APEX] analyzed ' + M.tickers.length + ' tickers in ' + Math.round(performance.now() - t0) + 'ms');
  }

  function renderFavs() {
    var el = $('#favPills'); if (!el) return;
    el.innerHTML = state.watch.map(function (t) {
      var a = A[t]; if (!a) return '';
      var rv = rowOf(a);
      return '<button class="pill' + (state.cur === t ? ' on' : '') + '" data-t="' + t + '" title="' + a.meta.nk + ' · 클릭하여 차트 보기">' +
        '<b>' + t + '</b><span class="' + cls(rv.change) + '">' + pct(rv.change, 2) + '</span>' +
        '<i class="x" data-x="' + t + '" role="button" aria-label="' + t + ' 관심종목에서 삭제" title="관심종목에서 삭제">×</i></button>';
    }).join('');
    el.onclick = function (e) {
      var x = e.target.closest('[data-x]');
      if (x) { e.preventDefault(); e.stopPropagation(); watchToggle(x.getAttribute('data-x'), false); return; }
      var b = e.target.closest('.pill');
      if (b) select(b.getAttribute('data-t'));
    };
  }

  /* 관심종목 추가 팝오버 — 102종목 검색·토글 */
  function renderFavPop() {
    var list = $('#favList'); if (!list) return;
    var q = ($('#favSearch') && $('#favSearch').value ? $('#favSearch').value : '').trim().toLowerCase();
    var keepTop = list.scrollTop;
    var rows = M.tickers.filter(function (x) {
      if (!q) return true;
      return (x.t + ' ' + x.n + ' ' + x.nk + ' ' + (x.sk || '') + ' ' + (x.s || '')).toLowerCase().indexOf(q) >= 0;
    });
    rows.sort(function (a, b) {
      var aw = isWatch(a.t) ? 0 : 1, bw = isWatch(b.t) ? 0 : 1;
      return aw - bw || ((a.r || 999) - (b.r || 999));
    });
    list.innerHTML = rows.length ? rows.map(function (x) {
      var a = A[x.t], rv = a ? rowOf(a) : null, on = isWatch(x.t);
      return '<button class="fp-row' + (on ? ' on' : '') + '" data-t="' + x.t + '">' +
        '<b>' + x.t + '</b><span class="nm">' + x.nk + '</span>' +
        (rv ? '<span class="ch ' + cls(rv.change) + '">' + pct(rv.change, 2) + '</span>' : '') +
        '<i class="st" title="' + (on ? '관심종목에서 제거' : '관심종목에 추가') + '">' + (on ? '★' : '＋') + '</i></button>';
    }).join('') : '<div class="fp-row" style="color:var(--txt3)">검색 결과가 없습니다</div>';
    var cnt = $('#favCount'); if (cnt) cnt.textContent = '관심 ' + state.watch.length + '종목';
    list.scrollTop = keepTop;
    $$('.fp-row', list).forEach(function (b) {
      if (!b.dataset.t) return;
      b.onclick = function (e) { e.stopPropagation(); watchToggle(b.dataset.t); };
    });
  }

  /* ---------------- scanner ---------------- */
  function matchesFilter(a, rv) {
    if (state.filter === 'buy') return rv.score >= 58;
    if (state.filter === 'sell') return rv.score < 45;
    if (state.filter === 'fav') return isWatch(a.sym);
    return true;
  }
  function spark(a, upto) {
    var c = a.close, n = upto == null ? c.length : upto + 1, k = Math.min(34, n);
    var seg = c.slice(n - k, n);
    var lo = Math.min.apply(null, seg), hi = Math.max.apply(null, seg);
    var w = 62, h = 20;
    var d = seg.map(function (v, i) {
      var x = (i / (k - 1)) * w;
      var y = h - 1 - ((v - lo) / Math.max(hi - lo, 1e-9)) * (h - 2);
      return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');
    var col = seg[k - 1] >= seg[0] ? '#10B981' : '#F43F5E';
    return '<svg class="spark" viewBox="0 0 62 20" preserveAspectRatio="none">' +
      '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="1.3" stroke-linejoin="round"/>' +
      '<circle cx="' + w + '" cy="' + (h - 1 - ((seg[k - 1] - lo) / Math.max(hi - lo, 1e-9)) * (h - 2)).toFixed(1) + '" r="1.6" fill="' + col + '"/></svg>';
  }
  function renderScanner() {
    var q = state.listQ.trim().toLowerCase();
    var rows = M.tickers.map(function (x) { return A[x.t]; }).filter(function (a) {
      if (!a) return false;
      var rv = rowOf(a);
      if (!matchesFilter(a, rv)) return false;
      if (!q) return true;
      return (a.sym + ' ' + a.meta.n + ' ' + a.meta.nk + ' ' + (a.meta.sk || '') + ' ' + (a.meta.s || '')).toLowerCase().indexOf(q) >= 0;
    });
    var cmp = {
      mc: function (a, b) { return (b.meta.mc || 0) - (a.meta.mc || 0); },
      score: function (a, b) { return rowOf(b).score - rowOf(a).score; },
      ret: function (a, b) {
        var av = stratBundle(a), bv = stratBundle(b);
        return ((bv && bv.stats) ? bv.stats.totalReturn : -9) - ((av && av.stats) ? av.stats.totalReturn : -9);
      },
      rsi: function (a, b) { return (a.ind.rsi[idxOf(a)] || 99) - (b.ind.rsi[idxOf(b)] || 99); },
      chg: function (a, b) { return rowOf(b).change - rowOf(a).change; }
    }[state.sort] || function (a, b) { return (b.meta.mc || 0) - (a.meta.mc || 0); };
    rows.sort(cmp);
    var counts = { all: 0, buy: 0, sell: 0 };
    M.tickers.forEach(function (x) {
      var a = A[x.t]; if (!a) return;
      var rv = rowOf(a);
      counts.all++;
      if (rv.score >= 58) counts.buy++;
      if (rv.score < 45) counts.sell++;
    });
    $('#cAll').textContent = counts.all;
    $('#cBuy').textContent = counts.buy;
    $('#cSell').textContent = counts.sell;

    $('#scanList').innerHTML = rows.length ? rows.map(function (a) {
      var x = a.meta, rv = rowOf(a), ew = a.elliott;
      var ewb = (ew && ew.ok) ? '<i class="ewb ' + (ew.dir > 0 ? 'up' : 'dn') + '">' + ew.badge + '</i>' : '';
      return '<div class="srow' + (state.cur === x.t ? ' on' : '') + '" data-t="' + x.t + '">' +
        '<div class="rk">' + (x.r || '·') + '</div>' +
        '<div class="tk"><b><i class="fstar' + (isWatch(x.t) ? ' on' : '') + '" data-f="' + x.t + '" role="button" title="' + (isWatch(x.t) ? '관심종목에서 제거' : '관심종목에 추가') + '">' + (isWatch(x.t) ? '★' : '☆') + '</i>' + x.t + ewb + '</b><span>' + x.nk + '</span></div>' +
        spark(a, rv.i) +
        '<div class="px"><b>' + (rv.price >= 1000 ? rv.price.toFixed(0) : rv.price.toFixed(2)) + '</b>' +
        '<span class="' + cls(rv.change) + '">' + pct(rv.change, 2) + '</span></div>' +
        '<div class="sg"><span class="chip ' + signalCls(rv.label.key) + '">' + rv.label.ko + '</span>' +
        '<span class="sc">' + Math.round(rv.score) + '</span></div>' +
        '</div>';
    }).join('') : '<div class="empty">해당 조건의 종목이 없습니다</div>';
    $$('#scanList .srow').forEach(function (r) {
      r.onclick = function (e) {
        var f = e.target.closest('.fstar');
        if (f) { e.stopPropagation(); watchToggle(f.getAttribute('data-f')); return; }
        select(r.dataset.t);
      };
    });
  }

  /* ---------------- 전략 탭 · 100종목 요약 ---------------- */
  function meanOf(a) {
    if (!a.length) return 0;
    var s = 0; for (var i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
  }
  function medianOf(a) {
    if (!a.length) return 0;
    var b = a.slice().sort(function (x, y) { return x - y; }), m = b.length >> 1;
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  }
  var uniCache = {};
  /* 5년 백테스트 창을 온전히 채운 종목의 전략 성과 분포 (상장 초기·표본 부족 제외) */
  function universeStats(mode) {
    if (uniCache[mode]) return uniCache[mode];
    var rets = [], mdds = [], bhs = [], wrs = [], beat = 0, ntr = 0;
    M.tickers.forEach(function (x) {
      var a = A[x.t];
      if (!a || !a.strategy || !a.close) return;
      var b = a.strategy[mode];
      if (!b || !b.stats) return;
      if (a.close.length - b.startIdx < 1250) return;   /* 5년(1,255거래일) 창을 다 채우지 못한 종목 제외 */
      rets.push(b.stats.totalReturn); mdds.push(b.stats.mdd); bhs.push(b.stats.bhReturn);
      if (b.stats.totalReturn > b.stats.bhReturn) beat++;
      if (b.stats.trades > 0) { wrs.push(b.stats.winRate); ntr += b.stats.trades; }
    });
    var r = { n: rets.length, mean: meanOf(rets), med: medianOf(rets), beat: beat, mdd: meanOf(mdds), bh: meanOf(bhs),
      win: wrs.length ? meanOf(wrs) : null, trades: ntr };
    if (r.n) uniCache[mode] = r;
    return r;
  }
  function renderStrategy() {
    var info = STRAT[stratKey()];
    $$('#stratSeg button').forEach(function (b) {
      var on = b.getAttribute('data-m') === info.key;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var ti = $('#stratTitle'); if (ti) ti.textContent = info.title + ' (' + info.sub + ')';
    var de = $('#stratDesc'); if (de) de.textContent = info.desc;
    var el = $('#stratUni'), u = universeStats(info.key), ua = A[state.cur];
    if (el && u.n) {
      el.innerHTML =
        '<span><b>' + u.n + '종목 평균</b> <b class="' + cls(u.mean) + '">' + pct(u.mean, 2) + '</b></span>' +
        '<span>중앙 <b class="' + cls(u.med) + '">' + pct(u.med, 2) + '</b></span>' +
        '<span>보유 초과 <b>' + u.beat + '/' + u.n + '</b></span>' +
        '<span>평균 MDD <b class="neg">' + pct(u.mdd, 2) + '</b></span>' +
        '<span>승률 <b class="' + (u.win >= 0.5 ? 'pos' : '') + '">' + (u.win == null ? '—' : (u.win * 100).toFixed(1) + '%') + '</b></span>';
      el.title = u.n + '종목 단순보유 평균 ' + pct(u.bh, 2) + ' · 5년(1,255거래일) 구간 · 워밍업 250거래일' +
        (ua ? ' (' + (ua.close.length - ua.startIdx) + '거래일)' : '');
    }
  }
  function setStrategy(mode) {
    if (mode !== 'swing' && mode !== 'trend') return;
    if (state.strategy === mode) return;
    state.strategy = mode;
    stratPersist();
    renderStrategy();
    renderScanner();
    if (state.cur && A[state.cur]) select(state.cur, true);
  }

  /* ---------------- selection ---------------- */
  function select(t, first) {
    var a = A[t];
    if (!a) return;
    state.cur = t;
    var v = stratView(viewOf(t));
    drawState.anchor = null; drawState.preview = null;
    drawCount();
    $$('#favPills .pill').forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
    syncHeroFav();
    $$('#scanList .srow').forEach(function (r) { r.classList.toggle('on', r.dataset.t === t); });
    renderHero(v);
    renderFund(v);
    renderKpis(v);
    renderScoreExplain(v);
    renderElliott(v);
    renderEquity(v);
    renderRecent(v);
    renderTrades(v);
    chart.setAnalysis(v);
    chart.setRange(state.range);
    ptRender();
    if (window.innerWidth <= 900) closeDrawer();
    try { history.replaceState(null, '', '#' + t); } catch (e) {}
  }

  /* ---------------- hero ---------------- */
  function renderHero(a) {
    $('#heroRank').textContent = a.meta.r ? '#' + a.meta.r : '관심';
    $('#heroTicker').textContent = a.sym;
    $('#heroName').textContent = a.meta.nk;
    $('#heroSector').textContent = a.meta.sk;
    var ha = $('#heroAsOf'); if (ha) ha.textContent = a.dates[a.dates.length - 1] + ' 종가';
    $('#heroPrice').textContent = usd(a.price);
    var c = $('#heroChg');
    c.className = 'chg ' + cls(a.change);
    c.textContent = (a.change > 0 ? '▲ ' : a.change < 0 ? '▼ ' : '') + Math.abs(a.changeAbs).toFixed(2) + ' (' + pct(a.change) + ')';
    $('#sigName').textContent = a.label.ko;
    $('#sigName').style.color = a.label.color;
    $('#sigSub').textContent = '종합 기술 점수 ' + a.score.toFixed(1) + ' / 100';
    var circ = 2 * Math.PI * 27;
    var arc = $('#gaugeArc');
    arc.style.strokeDasharray = circ;
    arc.style.strokeDashoffset = circ * (1 - a.score / 100);
    arc.style.stroke = a.label.color;
    $('#gaugeVal').textContent = Math.round(a.score);
    $('#gaugeVal').style.color = a.label.color;

    var bullish = a.score >= 45;
    var lvEL = $('#lvEntryL'), lvSL = $('#lvStopL'), lvTL = $('#lvTargetL'), lvRL = $('#lvRRL');
    if (a.stratKey === 'swing') {
      /* 스윙형: 다음 시가 진입 · 손절 4.5 ATR · 고정 보유기간 없이 이익 중 20일선 이탈 청산 */
      var p = a.plan || {};
      var on = !!p.signal;
      if (lvEL) lvEL.textContent = on ? '진입 · 다음 시가 매수' : '진입 대기 · RSI(2) 15 미만';
      $('#lvEntry').textContent = usd(p.entryRef != null ? p.entryRef : a.price);
      if (lvSL) lvSL.textContent = '손절가 · 4.5 ATR';
      $('#lvStop').textContent = usd(p.stopPrice);
      if (lvTL) lvTL.textContent = '청산 기준 · 이익 중 20일선 이탈';
      var tEl = $('#lvTarget');
      tEl.textContent = p.ma20 != null ? usd(p.ma20) : '대기';
      tEl.className = '';
      if (lvRL) lvRL.textContent = 'RSI(2) · QQQ 200일선';
      $('#lvRR').textContent = (p.rsi2 == null ? '—' : p.rsi2.toFixed(1)) + ' · ' + (p.marketOk ? 'QQQ\u2191' : 'QQQ\u2193');
    } else {
      var lo = bullish ? a.price - 0.6 * a.atr : a.price - 1.6 * a.atr;
      var hi = bullish ? a.price + 0.25 * a.atr : a.price - 0.5 * a.atr;
      if (lvEL) lvEL.textContent = bullish ? '진입 참고 구간 (분할 매수)' : '눌림 대기 구간';
      $('#lvEntry').textContent = usd(lo) + ' ~ ' + usd(hi);
      if (lvSL) lvSL.textContent = '손절가 · 6 ATR';
      $('#lvStop').textContent = usd(a.stop);
      if (lvTL) lvTL.textContent = '트레일 기준 · 10 ATR';
      var tEl2 = $('#lvTarget');
      tEl2.textContent = usd(a.target);
      tEl2.className = 'pos';
      if (lvRL) lvRL.textContent = '손익비 (R:R)';
      $('#lvRR').textContent = '1 : ' + ((a.target - a.price) / Math.max(a.price - a.stop, 1e-9)).toFixed(2);
    }
  }

  /* ---------------- 기간 라벨 ---------------- */
  function periodTag(bars) {
    if (bars >= 1200) return '5Y';
    if (bars >= 850) return (bars / 252).toFixed(1) + 'Y';   /* 워밍업 250 이후 = 1,255봉이면 5Y */
    if (bars >= 400) return '2Y';
    if (bars >= 180) return '1Y';
    if (bars >= 60) return '3M';
    return '신규';
  }

  /* ---------------- 거시 지표 (VIX · US 10Y) ---------------- */
  function indexSeries(t) {
    var s = M.series && M.series[t];
    return (s && s.c && s.c.length > 1) ? s.c : null;
  }
  function sparkDraw(cv, arr, color) {
    if (!cv || !arr || arr.length < 2) return;
    var w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;                    /* 숨김 상태(모바일)에서는 그리지 않음 */
    var dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    var k = Math.min(arr.length, 66), seg = arr.slice(-k);
    var lo = Math.min.apply(null, seg), hi = Math.max.apply(null, seg);
    var pad = 2, ih = h - pad * 2;
    var pt = function (v, i) {
      return [(i / (k - 1)) * w, pad + (1 - (v - lo) / Math.max(hi - lo, 1e-9)) * ih];
    };
    g.beginPath();
    for (var i = 0; i < k; i++) { var p = pt(seg[i], i); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
    g.strokeStyle = color; g.lineWidth = 1.4; g.lineJoin = 'round'; g.stroke();
    var last = pt(seg[k - 1], k - 1);
    g.beginPath(); g.arc(last[0] - 1.2, last[1], 1.8, 0, Math.PI * 2); g.fillStyle = color; g.fill();
  }
  function mchipFill(id, series, o) {
    var chip = $('#mchip' + id);
    if (!series || !chip) return;
    var n = series.length, last = series[n - 1], prev = series[n - 2];
    var diff = last - prev, chg = prev ? last / prev - 1 : 0;
    var valEl = $('#' + o.key + 'Val'), chgEl = $('#' + o.key + 'Chg');
    if (valEl) valEl.textContent = o.fmt(last);
    var arrow = diff > 0 ? '▲' : (diff < 0 ? '▼' : '–');
    if (chgEl) {
      chgEl.className = 'mc-c ' + (diff === 0 ? '' : (o.invert ? (diff > 0 ? 'neg' : 'pos') : (diff > 0 ? 'warn' : 'pos')));
      chgEl.textContent = arrow + ' ' + o.chgFmt(Math.abs(diff)) +
        ' (' + (chg >= 0 ? '+' : '−') + Math.abs(chg * 100).toFixed(1) + '%)';
      chgEl.title = '전일 대비 ' + o.deltaTitle(diff);
    }
    chip.setAttribute('data-load', '1');
    sparkDraw($('#' + o.key + 'Spark'), series, diff >= 0 ? (o.invert ? '#FB7185' : '#FBBF24') : '#34D399');
  }
  function renderMacro() {
    mchipFill('Vix', indexSeries('^VIX'), {
      key: 'vix', invert: true,
      fmt: function (v) { return v.toFixed(2); },
      chgFmt: function (d) { return d.toFixed(2); },
      deltaTitle: function (d) { return (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(2) + 'pt'; }
    });
    mchipFill('Tnx', indexSeries('^TNX'), {
      key: 'tnx',
      fmt: function (v) { return v.toFixed(2) + '%'; },
      chgFmt: function (d) { return Math.round(d * 100) + 'bp'; },
      deltaTitle: function (d) { return (d >= 0 ? '+' : '−') + Math.round(Math.abs(d) * 100) + 'bp'; }
    });
    var md = $('#macroDate'); if (md) md.textContent = M.asOf;
  }

  /* ============================================================
     CNN 공포·탐욕 지수 — 반원 게이지 + 상황별 심리 해석
     data.js(window.MARKET.fearGreed)로 즉시 그리고, 백그라운드로 CNN API를
     한 번 더 시도해 성공하면 '실시간'으로 교체한다(CORS·타임아웃은 조용히 무시).
     ============================================================ */
  var FG_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
  /* 5구간 — CNN 기준: 0~25 극단적 공포 · 25~45 공포 · 45~55 중립 · 55~75 탐욕 · 75~100 극단적 탐욕 */
  var FG_BANDS = [
    { min: 0, max: 25, ko: '극단적 공포', color: '#EF4444', fill: 'rgba(239,68,68,.20)',
      guide: '투매가 쏟아지며 시장 심리가 과하게 얼어붙은 자리입니다. 공포에 휩쓸린 추격 손절은 피하고, 펀더멘털이 탄탄한 종목 위주로 <b>스윙 반등·분할 매수</b> 기회를 노려보기 좋은 구간입니다.' },
    { min: 25, max: 45, ko: '공포', color: '#F97316', fill: 'rgba(249,115,22,.18)',
      guide: '약세 심리가 우세하지만 극단까지는 아닌 구간입니다. 성급한 물타기·풀매수보다는 <b>분할 접근</b>이 유리하고, 지지선을 확인하고 반등 신호가 나올 때 비중을 늘리는 편이 안전합니다.' },
    { min: 45, max: 55, ko: '중립', color: '#94A3B8', fill: 'rgba(148,163,184,.16)',
      guide: '상승·하락 어느 쪽으로도 기울지 않은 중립 구간입니다. 방향이 정해질 때까지 현금 비중을 지키고, <b>20·60일선이 정렬된 종목</b>만 골라 대응하는 편이 좋습니다.' },
    { min: 55, max: 75, ko: '탐욕', color: '#84CC16', fill: 'rgba(132,204,22,.18)',
      guide: '낙관론이 앞서는 구간입니다. 신규 <b>추격 매수는 자제</b>하고, 보유 종목은 트레일 스탑으로 수익을 지키면서 비중을 서서히 줄여가는 편이 좋습니다.' },
    { min: 75, max: 100, ko: '극단적 탐욕', color: '#22C55E', fill: 'rgba(34,197,94,.18)',
      guide: '과열된 탐욕 구간입니다. 신고가 추격 매수가 가장 위험한 자리이니, <b>분할 차익실현과 손절선 상향</b>으로 리스크를 먼저 관리하세요.' }
  ];
  var FGG = { cx: 190, cy: 195, R: 166, r: 102, lab: 128, tick: 93, num: 74, hub: 46 };
  function fgAng(s) { return 180 - Math.max(0, Math.min(100, s)) * 1.8; }
  function fgPt(rad, a) { var t = a * Math.PI / 180; return [FGG.cx + rad * Math.cos(t), FGG.cy - rad * Math.sin(t)]; }
  function fgXY(p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }
  function fgBandIdx(s) {
    var v = Number(s);
    if (!isFinite(v)) return 2;
    for (var i = 0; i < FG_BANDS.length; i++) { if (v < FG_BANDS[i].max) return i; }
    return FG_BANDS.length - 1;
  }
  function fgNum(x) {
    if (x === null || x === undefined || x === '') return null;
    var v = Number(x);
    return isFinite(v) ? Math.round(v * 10) / 10 : null;
  }
  /* CNN 페이지 표기와 동일하게 과거값은 내림 표기 (15.9→15, 29.8→29, 17.7→17) */
  function fgShow(v) { return Math.floor(Number(v) + 1e-9); }
  /* 0~100 원호 한 구간(도넓이 64px) 경로 */
  function fgArc(a1, a2) {
    return 'M' + fgXY(fgPt(FGG.R, a1)) + 'A' + FGG.R + ' ' + FGG.R + ' 0 0 1 ' + fgXY(fgPt(FGG.R, a2)) +
      'L' + fgXY(fgPt(FGG.r, a2)) + 'A' + FGG.r + ' ' + FGG.r + ' 0 0 0 ' + fgXY(fgPt(FGG.r, a1)) + 'Z';
  }
  function fgSvg(score) {
    var bi = fgBandIdx(score), b = FG_BANDS[bi], out = [];
    /* 구간별 글로우 필터 */
    out.push('<defs>');
    FG_BANDS.forEach(function (x, i) {
      out.push('<filter id="fgG' + i + '" x="-40%" y="-40%" width="180%" height="180%">' +
        '<feDropShadow dx="0" dy="0" stdDeviation="4.5" flood-color="' + x.color + '" flood-opacity=".5"/></filter>');
    });
    /* 구간 안쪽 글자용 호 */
    FG_BANDS.forEach(function (x, i) {
      out.push('<path id="fgL' + i + '" d="M' + fgXY(fgPt(FGG.lab, fgAng(x.min))) + 'A' + FGG.lab + ' ' + FGG.lab +
        ' 0 0 1 ' + fgXY(fgPt(FGG.lab, fgAng(x.max))) + '"/>');
    });
    out.push('</defs>');
    /* 5구간 링 — 현재 구간만 컬러 테두리 + 글로우, 나머지는 다크 슬레이트 */
    FG_BANDS.forEach(function (x, i) {
      var on = i === bi;
      out.push('<path d="' + fgArc(fgAng(x.min), fgAng(x.max)) + '" fill="' + (on ? x.fill : '#151f32') +
        '" stroke="' + (on ? x.color : '#233046') + '" stroke-width="' + (on ? 2 : 1.2) + '"' +
        (on ? ' filter="url(#fgG' + i + ')"' : '') + '/>');
    });
    /* 구간 이름 */
    FG_BANDS.forEach(function (x, i) {
      var on = i === bi, narrowSeg = (x.max - x.min) < 20;
      out.push('<text fill="' + (on ? x.color : '#5c6a80') + '" font-size="' + (narrowSeg ? 9.5 : 10.5) +
        '" font-weight="' + (on ? 800 : 700) + '" letter-spacing=".02em" text-anchor="middle">' +
        '<textPath href="#fgL' + i + '" startOffset="50%">' + x.ko + '</textPath></text>');
    });
    /* 0~100 눈금 점선(5점 간격) */
    var tk = [];
    for (var s = 0; s <= 100; s += 5) {
      var p = fgPt(FGG.tick, fgAng(s)), major = (s % 25 === 0), inBand = fgBandIdx(s) === bi;
      tk.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + (major ? 1.9 : 1.2) +
        '" fill="' + (inBand ? b.color : (major ? '#5c6a80' : '#3d4a5f')) + '" opacity="' + (inBand ? '.8' : '.7') + '"/>');
    }
    out.push('<g>' + tk.join('') + '</g>');
    /* 기준 숫자 0 · 25 · 50 · 75 · 100 */
    [[0, '0'], [25, '25'], [50, '50'], [75, '75'], [100, '100']].forEach(function (n) {
      var q = fgPt(FGG.num, fgAng(n[0]));
      out.push('<text x="' + q[0].toFixed(1) + '" y="' + q[1].toFixed(1) + '" fill="#64748b" font-size="10.5"' +
        ' font-weight="700" text-anchor="middle" dominant-baseline="middle">' + n[1] + '</text>');
    });
    /* 가운데 원 + 점수 + 등급 (숫자는 항상 맨 위 레이어) */
    out.push('<circle cx="' + FGG.cx + '" cy="' + FGG.cy + '" r="' + FGG.hub + '" fill="#0d1422" stroke="#243247" stroke-width="1.5"/>');
    out.push('<circle cx="' + FGG.cx + '" cy="' + FGG.cy + '" r="' + FGG.hub + '" fill="none" stroke="' + b.color + '" stroke-width="1.4" opacity=".38"/>');
    /* 바늘 — 원 테두리(r=46) 바깥에서 시작해 숫자를 가리지 않는다 */
    var a = fgAng(score), t = a * Math.PI / 180;
    var base = fgPt(FGG.hub + 1, a), tip = fgPt(100, a);
    var px = Math.sin(t), py = Math.cos(t), hw = 2.8;
    out.push('<polygon class="fg-needle" points="' +
      (base[0] + px * hw).toFixed(1) + ',' + (base[1] + py * hw).toFixed(1) + ' ' +
      (base[0] - px * hw).toFixed(1) + ',' + (base[1] - py * hw).toFixed(1) + ' ' +
      tip[0].toFixed(1) + ',' + tip[1].toFixed(1) + '" fill="#f8fafc" stroke="#0b0e14" stroke-width=".6"/>');
    out.push('<circle cx="' + tip[0].toFixed(1) + '" cy="' + tip[1].toFixed(1) + '" r="2.9" fill="' + b.color +
      '" stroke="#0b0e14" stroke-width="1.1"/>');
    out.push('<circle cx="' + base[0].toFixed(1) + '" cy="' + base[1].toFixed(1) + '" r="2.2" fill="#f1f5f9"/>');
    out.push('<text x="' + FGG.cx + '" y="200" fill="#f8fafc" font-size="31" font-weight="900" text-anchor="middle"' +
      ' style="font-variant-numeric:tabular-nums;letter-spacing:-.02em">' + Math.round(score) + '</text>');
    out.push('<text x="' + FGG.cx + '" y="219" fill="' + b.color + '" font-size="9" font-weight="800" text-anchor="middle"' +
      ' letter-spacing=".04em">' + b.ko + '</text>');
    return out.join('');
  }
  /* 1주 전·1개월 전 대비 변화 방향 문구 */
  function fgMove(score, v, label) {
    if (v === null || v === undefined || !isFinite(v)) return '';
    var d = score - v, di = fgBandIdx(score) - fgBandIdx(v), vv = fgShow(v);
    if (di <= -2) return label + '(' + vv + ') 대비 두 단계 넘게 얼어붙은 상태';
    if (di === -1) return label + '(' + vv + ') 대비 한 단계 더 공포 쪽으로 밀린 상태';
    if (di === 1) return label + '(' + vv + ') 대비 한 단계 회복된 상태';
    if (di >= 2) return label + '(' + vv + ') 대비 두 단계 넘게 회복된 상태';
    if (Math.abs(d) <= 3) return label + '(' + vv + ') 대비 거의 같은 수준';
    return label + '(' + vv + ') 대비 같은 구간에서 ' + (d < 0 ? '조금 더 가라앉은' : '조금 회복된') + ' 상태';
  }
  function fgTrendText(score, fg) {
    var m = fgNum(fg.previous1Month), w = fgNum(fg.previous1Week);
    var mt = fgMove(score, m, '1개월 전'), wt = fgMove(score, w, '지난주');
    if (mt && wt) return '지금은 ' + mt + '이고, ' + wt + '입니다.';
    if (mt) return '지금은 ' + mt + '입니다.';
    if (wt) return '지금은 ' + wt + '입니다.';
    return '';
  }
  function fgTsText(iso) {
    if (!iso) return '';
    var tms = Date.parse(iso);
    if (!isFinite(tms)) return '';
    var d = new Date(tms + 9 * 3600 * 1000);      /* KST 고정 표기 */
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + ' ' +
      p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
  }
  function fgLiveUI(on) {
    var el = $('#fgLive'); if (!el) return;
    el.className = 'fg-live' + (on ? ' on' : '');
    var tx = $('#fgLiveTx'); if (tx) tx.textContent = on ? '실시간' : '일일 갱신';
    el.title = on ? 'CNN 실시간 API 응답으로 갱신됨' : 'CNN API 연결 전 — data.js 일일 갱신값 표시';
  }
  function renderFearGreed(fg, live) {
    var card = $('#fgCard'); if (!card || !fg) return;
    var score = Number(fg.score);
    if (!isFinite(score)) return;
    var b = FG_BANDS[fgBandIdx(score)], dial = $('#fgDial');
    if (dial) {
      dial.innerHTML = '<svg viewBox="0 0 380 246" role="img" aria-label="CNN 공포·탐욕 지수 ' +
        Math.round(score) + ' · ' + b.ko + '">' + fgSvg(score) + '</svg>';
    }
    var badge = $('#fgBadge');
    if (badge) {
      badge.textContent = b.ko + ' · ' + Math.round(score);
      badge.style.color = b.color;
      badge.style.borderColor = b.color + '88';
      badge.style.background = b.fill;
      badge.title = 'CNN Fear & Greed ' + (fg.rating ? '(' + fg.rating + ') ' : '') + (fgNum(score) || '') + '점';
    }
    var hist = $('#fgHist');
    if (hist) {
      var rows = [['직전 마감', fg.previousClose], ['1주 전', fg.previous1Week],
                  ['1개월 전', fg.previous1Month], ['1년 전', fg.previous1Year]];
      hist.innerHTML = rows.map(function (r) {
        var v = fgNum(r[1]), has = v !== null, sb = has ? FG_BANDS[fgBandIdx(v)] : null;
        return '<div class="fg-row"><div class="fg-rw">' +
          '<span class="w">' + r[0] + '</span>' +
          '<span class="s" style="color:' + (sb ? sb.color : 'var(--txt3)') + '">' + (sb ? sb.ko : '—') + '</span></div>' +
          '<i class="fg-dots"></i>' +
          '<b class="fg-b"' + (has ? ' title="' + v + '점 · ' + sb.ko + '"' : '') + ' style="color:' +
          (sb ? sb.color : 'var(--txt3)') + ';border-color:' + (sb ? sb.color + '99' : 'var(--line)') +
          ';background:' + (sb ? sb.fill : 'transparent') + '">' + (has ? fgShow(v) : '—') + '</b></div>';
      }).join('');
    }
    var guide = $('#fgGuide');
    if (guide) {
      var trend = fgTrendText(score, fg);
      guide.style.borderLeftColor = b.color;
      guide.innerHTML = '<div class="fg-gh" style="color:' + b.color + '">현재 심리 해석 · ' + b.ko +
        ' (' + b.min + '~' + b.max + ')</div><p>' + b.guide + (trend ? ' ' + trend : '') + '</p>';
    }
    var src = $('#fgSrc');
    if (src) {
      var ts = fgTsText(fg.timestamp);
      src.textContent = 'CNN 기준' + (ts ? ' · ' + ts + ' 갱신' : '') + (live ? ' · 실시간 연결' : '');
    }
    fgLiveUI(!!live);
  }
  /* 실시간 시도 — 4초 타임아웃, 실패·CORS 차단은 조용히 무시하고 data.js 값 유지 */
  var fgLiveTried = false;
  function fgRealtime() {
    if (fgLiveTried || typeof fetch !== 'function') return;
    fgLiveTried = true;
    var ctl = null, timer = null, done = false;
    try { if (window.AbortController) ctl = new AbortController(); } catch (e) { ctl = null; }
    var stop = function () { done = true; if (timer) { clearTimeout(timer); timer = null; } };
    timer = setTimeout(function () {
      if (done) return;
      stop();
      try { if (ctl) ctl.abort(); } catch (e) {}
    }, 4000);
    var opt = { cache: 'no-store', credentials: 'omit', mode: 'cors' };
    if (ctl) opt.signal = ctl.signal;
    try {
      fetch(FG_URL, opt).then(function (r) {
        if (!r || !r.ok) throw new Error('fg ' + (r ? r.status : 'no response'));
        return r.json();
      }).then(function (j) {
        if (done) return;
        stop();
        var f = j && j.fear_and_greed;
        if (!f || fgNum(f.score) === null) return;
        renderFearGreed({
          score: fgNum(f.score), rating: f.rating,
          previousClose: fgNum(f.previous_close), previous1Week: fgNum(f.previous_1_week),
          previous1Month: fgNum(f.previous_1_month), previous1Year: fgNum(f.previous_1_year),
          timestamp: f.timestamp
        }, true);
      }).catch(function () { stop(); });   /* console.error 없이 조용히 폴백 */
    } catch (e) { stop(); }
  }

  /* ---------------- 종목 펀더멘털 ---------------- */
  function fundOf(t) {
    var F = M.fundamentals;
    return (F && F.tickers && F.tickers[t]) || null;
  }
  function capStr(v) {
    if (v == null || !isFinite(v)) return '—';
    if (v >= 1e12) return '$' + (v / 1e12).toFixed(2) + 'T';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
    return '$' + v.toFixed(0);
  }
  function perStr(v) {
    if (v == null || !isFinite(v) || v <= 0) return '—';
    return v.toFixed(1) + '배';
  }
  function grStr(v) {
    if (v == null || !isFinite(v)) return '—';
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(1) + '%';
  }
  function divStr(v) {
    if (v == null || !isFinite(v)) return '—';
    if (v <= 0) return '무배당';
    return (v * 100).toFixed(2) + '%';
  }
  /* 실적 발표일 D-day — 'YYYY-MM-DD' 를 UTC 자정 기준 일수로 계산 (시간대 영향 없음) */
  function ymdNum(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function todayNum() {
    var d = new Date();
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function earnBase() {
    /* 기준일 = 장마감일(asOf)과 오늘 중 늦은 쪽 — 데이터가 하루 이틀 늦어도 D-day 가 어긋나지 않게 */
    var a = ymdNum(M.asOf), t = todayNum();
    return (a && a > t) ? a : t;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function earnPill(f, isETF) {
    if (isETF) return '';                       /* ETF 는 개별 실적 발표일이 없다 — 생략 */
    var ed = ymdNum(f.earningsDate);
    if (!ed) return '<span class="fund-pill earn none" title="Yahoo Finance 에 다음 실적 발표일이 없습니다">' +
      '다음 실적발표 <b>—</b></span>';
    var dd = Math.round((ed - earnBase()) / 86400000);
    var dt = new Date(ed);
    var mmdd = pad2(dt.getUTCMonth() + 1) + '/' + pad2(dt.getUTCDate());
    var soon = dd >= 0 && dd <= 7;
    var lab = dd === 0 ? 'D-DAY' : (dd > 0 ? 'D-' + dd : '지남');
    return '<span class="fund-pill earn' + (soon ? ' soon' : (dd < 0 ? ' past' : '')) + '"' +
      ' title="' + (soon ? '실적 발표가 ' + dd + '일 앞으로 다가왔습니다 · ' : '다음 실적 발표일 ') +
      f.earningsDate + '">다음 실적발표 <b>' + mmdd + '</b><em class="earn-dd">' + lab + '</em></span>';
  }
  var REC_KO = { strong_buy: '적극 매수', buy: '매수', hold: '보유', underperform: '시장 하회', sell: '매도', strong_sell: '적극 매도' };
  function renderFund(a) {
    var grid = $('#fundGrid');
    if (!grid) return;
    var f = fundOf(a.meta.t) || {};
    var isETF = String(f.quoteType || '').toUpperCase() === 'ETF';
    var price = a.price;
    var cells = [];
    function cell(k, v, s, c, wide, extra) {
      cells.push('<div class="fund-cell' + (wide ? ' wide' : '') + '"><span class="fk">' + k + '</span>' +
        '<span class="fv' + (c ? ' ' + c : '') + '">' + v + '</span>' +
        '<span class="fs' + (c === 'pos' || c === 'neg' ? ' ' + c : '') + '">' + (s || '&nbsp;') + '</span>' +
        (extra || '') + '</div>');
    }
    var mc = f.marketCap != null ? f.marketCap : a.meta.mc;
    cell('시가총액', capStr(mc), a.meta.r ? '시총 ' + a.meta.r + '위' : (mc != null && isETF ? 'ETF 순자산' : '—'));
    cell('Forward PER', perStr(f.forwardPE), f.forwardEps != null ? 'EPS ' + usd(f.forwardEps) : '—');
    cell('Trailing PER', perStr(f.trailingPE), f.trailingEps != null ? 'EPS ' + usd(f.trailingEps) : '—');
    var rv = f.revenueGrowth;
    cell('매출성장률', grStr(rv), '전년 대비 (YoY)', rv == null ? '' : cls(rv));
    var tp = f.targetMeanPrice, up = (tp != null && price > 0) ? tp / price - 1 : null;
    cell('애널리스트 목표가', usd(tp), up == null ? '—' : '현재가 대비 ' + pct(up, 1), up == null ? '' : cls(up));
    cell('배당수익률', divStr(f.dividendYield), f.dividendYield > 0 ? '연간 배당' : '—');
    var lo = f.fiftyTwoWeekLow, hi = f.fiftyTwoWeekHigh;
    var p52 = (lo != null && hi != null && hi > lo) ? (price - lo) / (hi - lo) : null;
    p52 = p52 == null ? null : Math.max(0, Math.min(1, p52));
    var bar = '<div class="frange">' + (p52 == null ? '' : '<i style="left:' + (p52 * 100).toFixed(1) + '%"></i>') + '</div>';
    cell('52주 범위', (lo == null || hi == null) ? '—' : usd(lo) + ' – ' + usd(hi),
      p52 == null ? '52주 최고·최저' : '현재 위치 ' + Math.round(p52 * 100) + '%', '', true, bar);
    grid.innerHTML = cells.join('');

    var sub = $('#fundSub');
    if (sub) {
      var fd = (M.fundamentals && M.fundamentals.asOf) || '—';
      var sec = a.meta.sk || a.meta.s || '';
      var parts = [a.meta.t, a.meta.nk];
      if (sec && !(isETF && sec === 'ETF')) parts.push(sec);
      sub.textContent = parts.join(' · ') +
        ' · ' + (isETF ? 'ETF — 개별 기업 펀더멘털 없음' : '기업 펀더멘털') +
        ' · 기준일 ' + fd + ' (Yahoo\u00A0Finance)';
    }
    var side = $('#fundSide');
    if (side) {
      var pills = [];
      var ep = earnPill(f, isETF);
      if (ep) pills.push(ep);
      var rk = f.recommendationKey;
      if (rk && REC_KO[rk]) {
        pills.push('<span class="fund-pill ' + (/buy/.test(rk) ? 'buy' : (/sell|underperform/.test(rk) ? 'sell' : 'hold')) + '">' +
          '투자의견 <b>' + REC_KO[rk] + '</b></span>');
      }
      if (f.numberOfAnalystOpinions != null) pills.push('<span class="fund-pill">애널리스트 <b>' + f.numberOfAnalystOpinions + '명</b></span>');
      if (f.beta != null) pills.push('<span class="fund-pill">베타 <b>' + f.beta.toFixed(2) + '</b></span>');
      if (f.returnOnEquity != null) pills.push('<span class="fund-pill">ROE <b>' + grStr(f.returnOnEquity) + '</b></span>');
      if (!pills.length && !isETF) pills.push('<span class="fund-pill">펀더멘털 데이터 없음</span>');
      side.innerHTML = pills.join('');
    }
  }

  /* ---------------- kpi ---------------- */
  function renderKpis(a) {
    var s = a.stats;
    var tagEl = $('#kpis .kpi .lab .tag');
    if (tagEl) {
      var bars = a.close.length - a.startIdx;
      tagEl.textContent = a.replay ? '리플레이'
        : ((a.stratKey === 'swing' ? '스윙 ' : '') + periodTag(bars));
      tagEl.title = '백테스트 구간 ' + bars + '거래일' + (a.dates && a.dates[a.startIdx] ? ' · ' + a.dates[a.startIdx] + ' ~ ' + a.dates[a.dates.length - 1] : '') +
        (a.dates && a.dates[a.startIdx] && a.dates[a.startIdx] <= '2022-12-30' && a.dates[a.dates.length - 1] >= '2022-01-03'
          ? ' · 2022년 하락장 포함' : '');
    }
    if (a.limited || !s) {
      $('#k1').textContent = '—'; $('#k2').textContent = '—'; $('#k3').textContent = '—';
      $('#k1s').innerHTML = '<span>상장 초기 · 백테스트 표본 부족</span>';
      $('#k1t').textContent = ''; $('#k2t').textContent = ''; $('#k3t').textContent = '';
      ['#m1', '#m2', '#m3'].forEach(function (sel) { var cc = $(sel); if (cc) { var g2 = cc.getContext('2d'); g2.clearRect(0, 0, cc.width, cc.height); } });
      $('#k2s').innerHTML = '<span>' + a.close.length + '거래일 데이터</span>';
      $('#k3s').innerHTML = '<span>—</span>';
    } else {
      $('#k1').textContent = pct(s.totalReturn, 1);
      $('#k1').className = cls(s.totalReturn);
      $('#k1s').innerHTML = '<span>보유 <b class="' + cls(s.bhReturn) + '">' + pct(s.bhReturn, 1) + '</b></span>' +
        '<span>초과 <b class="' + cls(s.alpha) + '">' + (s.alpha >= 0 ? '+' : '') + (s.alpha * 100).toFixed(1) + '%p</b></span>';
      $('#k2').textContent = (s.winRate * 100).toFixed(0) + '%';
      $('#k2').className = s.winRate >= 0.5 ? 'pos' : (s.winRate >= 0.4 ? '' : 'neu');
      $('#k2s').innerHTML = '<span>거래 <b>' + s.trades + '회</b></span><span>보유 <b>' + s.avgHold.toFixed(0) + '일</b></span>';
      $('#k3').textContent = s.profitFactor.toFixed(2);
      $('#k3').className = s.profitFactor >= 1.5 ? 'pos' : (s.profitFactor >= 1 ? '' : 'neg');
      $('#k3s').innerHTML = '<span>MDD <b class="neg">' + pct(s.mdd, 1) + '</b></span>' +
        '<span>보유 <b style="color:#6B7689">' + pct(s.bhMdd, 1) + '</b></span>';
      $('#k1t').textContent = '연율화 ' + pct(s.cagr, 1) + ' · 샤프 ' + s.sharpe.toFixed(2);
      var eqv = [];
      for (var q = a.startIdx; q < a.equity.length; q++) if (a.equity[q] != null) eqv.push(a.equity[q]);
      miniLine($('#m1'), eqv, 'rgba(56,189,248,ALPHA)', 1);
      miniBars($('#m2'), (a.trades || []).slice(-14).map(function (tr) { return tr.ret; }));
      miniDrawdown($('#m3'), eqv);
      $('#k2t').textContent = '평균 수익 ' + pct(s.avgWin, 1) + ' / 평균 손실 ' + pct(s.avgLoss, 1);
      $('#k3t').textContent = '시장 노출 ' + (s.exposure * 100).toFixed(0) + '% · 거래비용 0.03% 반영';
    }
    $('#k4').textContent = Math.round(a.score);
    $('#k4').style.color = a.label.color;
    var g = a.groups;
    var items = [
      ['추세', g.trend, 30], ['모멘텀', g.momentum, 25], ['반전', g.reversal, 15],
      ['거래량', g.volume, 15], ['구조', g.structure, 15]
    ];
    $('#k4b').innerHTML = items.map(function (it) {
      var v = it[1], mx = it[2];
      var r0 = QE.clamp(v / mx, -1, 1);
      var half = Math.abs(r0) * 50;
      var tone = r0 >= 0 ? 'p' : 'n';
      var style = r0 >= 0 ? 'left:50%;width:' + half.toFixed(1) + '%' : 'left:' + (50 - half).toFixed(1) + '%;width:' + half.toFixed(1) + '%';
      return '<div class="b"><span>' + it[0] + '</span><div class="t"><div class="f ' + tone + '" style="' + style + '"></div></div>' +
        '<span class="v" style="color:' + (r0 > 0.05 ? '#34D399' : r0 < -0.05 ? '#FDA4AF' : '#6B7689') + '">' + (v > 0 ? '+' : '') + v.toFixed(0) + '</span></div>';
    }).join('');
  }

  /* ---------------- 종합점수 산출 근거 ---------------- */
  var FACTORS = [
    { k: 'trend', name: '추세', w: 30, d: '현재가·이동평균(5·20·60·120일) 배열, 240일선 기울기' },
    { k: 'momentum', name: '모멘텀', w: 25, d: 'MACD 히스토그램·신호선, RSI 위치' },
    { k: 'reversal', name: '반전', w: 15, d: 'RSI 과매수·과매도, 볼린저 밴드 이탈 (역방향 가점)' },
    { k: 'volume', name: '거래량', w: 15, d: '20일 평균 대비 거래량, OBV 20일 방향' },
    { k: 'structure', name: '가격구조', w: 15, d: '20일·50일 고저 범위 내 위치, 신고가·신저가' }
  ];
  var SCALE = [
    { t: '강력매수', r: '75+', c: '#10B981' },
    { t: '매수', r: '58~74', c: '#34D399' },
    { t: '관망', r: '45~57', c: '#F59E0B' },
    { t: '매도', r: '35~44', c: '#FB7185' },
    { t: '강력매도', r: '<35', c: '#F43F5E' }
  ];
  function toneColor(t) { return t === 'bull' ? '#10B981' : (t === 'bear' ? '#F43F5E' : '#6B7689'); }
  function buildScoreExplain() {
    var sc = $('#seScale');
    if (sc) sc.innerHTML = SCALE.map(function (s) {
      return '<span class="se-pill" style="color:' + s.c + ';border-color:' + s.c + '55;background:' + s.c + '14">' +
        s.t + ' <b style="font-family:var(--mono)">' + s.r + '</b></span>';
    }).join('');
    var wr = $('#seWeightRows');
    if (wr) wr.innerHTML = FACTORS.map(function (f) {
      return '<div class="se-wrow"><div class="nm">' + f.name + '</div>' +
        '<div class="tr"><i style="width:' + (f.w / 30 * 100).toFixed(0) + '%"></i></div>' +
        '<div class="wv">' + f.w + '점</div>' +
        '<div class="ds">' + f.d + '</div></div>';
    }).join('');
  }
  function renderScoreExplain(a) {
    if (!$('#seRows')) return;
    var s = a.series || seriesOf(a.sym);
    if (!s) return;
    var i = s.c.length - 1;
    var ex = QE.explain(s, a.ind, a.groups, i);
    var bull = 0, bear = 0;
    ex.forEach(function (x) { if (x.tone === 'bull') bull++; else if (x.tone === 'bear') bear++; });
    $('#seTicker').textContent = a.sym + ' · ' + a.meta.nk;
    $('#seSummary').innerHTML = '종합 <b style="color:' + a.label.color + ';font-family:var(--mono)">' + a.score.toFixed(1) + '점 · ' + a.label.ko + '</b>' +
      ' · 5개 팩터 중 강세 ' + bull + ' / 중립 ' + (5 - bull - bear) + ' / 약세 ' + bear;
    $('#seRows').innerHTML = ex.map(function (x) {
      var tc = toneColor(x.tone);
      var wd = Math.min(Math.abs(x.v) / x.w, 1) * 100;
      return '<div class="se-row">' +
        '<div class="fn"><i style="background:' + tc + '"></i>' + x.name + '</div>' +
        '<div class="pt" style="color:' + tc + '">' + (x.v > 0 ? '+' : '') + x.v.toFixed(1) +
        ' <span style="color:var(--txt4)">/ ' + x.w + '</span></div>' +
        '<div class="tx">' + x.text + '</div>' +
        '<div class="bar"><i style="width:' + wd.toFixed(1) + '%;background:' + tc + '"></i></div>' +
        '</div>';
    }).join('');
  }

  /* ---------------- 엘리어트 파동 분석 카드 ---------------- */
  var EW_MK = { pass: '✓', fail: '✕', warn: '!', na: '–', pending: '·' };
  function ewScnOf(a) {
    var e = a && a.elliott;
    if (!e || !e.ok) return null;
    var arr = (e.scenarios && e.scenarios.length) ? e.scenarios : [e];
    var i = Math.min(Math.max(state.ewMode, 0), arr.length - 1);
    return arr[i] || e;
  }
  function ewRuleRow(r) {
    var mk = EW_MK[r.state] || '·';
    return '<div class="ew-rule ' + r.state + '"><span class="mk">' + mk + '</span><div>' +
      '<div class="nm">' + r.name + '</div><div class="tx">' + r.text + '</div></div></div>';
  }
  function ewSec(title, note) {
    return '<div class="ew-sec"><b>' + title + '</b>' + (note ? '<em>' + note + '</em>' : '') + '</div>';
  }

  function renderElliott(a) {
    if (!$('#ewState')) return;
    var card = $('#ewCard');
    var e0 = a.elliott;
    if (!e0 || !e0.ok) {
      card.classList.add('ew-no');
      card.classList.remove('ew-alt');
      $('#ewConf').innerHTML = '';
      $('#ewState').innerHTML = '<div class="ew-empty">' + (e0 && e0.reason ? e0.reason : '표본 부족') +
        ' · 이 종목은 파동 카운트를 산출할 만큼 거래일이 충분하지 않습니다.</div>';
      ['#ewDegrees', '#ewRules', '#ewLegs', '#ewFib'].forEach(function (sel) { var el = $(sel); if (el) el.innerHTML = ''; });
      var sw = $('#ewSwitch'); if (sw) sw.innerHTML = '';
      var cm = $('#ewComment'); if (cm) cm.textContent = '';
      return;
    }
    card.classList.remove('ew-no');
    var arr = (e0.scenarios && e0.scenarios.length) ? e0.scenarios : [e0];
    state.ewMode = Math.min(state.ewMode, arr.length - 1);
    var e = arr[state.ewMode];
    var wcl = e.dir > 0 ? 'up' : 'dn';
    card.classList.toggle('ew-alt', state.ewMode === 1);

    /* 신뢰도 */
    $('#ewConf').innerHTML = '<span class="lbl">신뢰도</span><div class="bar"><i style="width:' + e.conf + '%;' +
      (e.valid ? '' : 'background:linear-gradient(90deg,rgba(244,63,94,.45),#FB7185)') + '"></i></div>' +
      '<b style="color:' + (e.valid ? '#C4B5FD' : '#FDA4AF') + '">' + e.conf + '</b>';

    /* 기본 / 대안 시나리오 전환 */
    var sw2 = $('#ewSwitch');
    if (sw2) {
      sw2.innerHTML = arr.map(function (s, i) {
        return '<button data-i="' + i + '" class="' + (i === state.ewMode ? 'on' : '') + (i ? ' alt' : '') + '">' +
          (i === 0 ? '기본 시나리오' : '대안 시나리오') + '<i>' + s.conf + '</i></button>';
      }).join('');
    }
    var chips = $('#ewChips');
    if (chips) {
      $$('#ewChips button').forEach(function (b) {
        b.classList.toggle('on', state.ewShow[b.dataset.k] !== false);
      });
    }

    /* 현재 파동 */
    $('#ewState').innerHTML =
      '<div class="ew-wave ' + wcl + '">' + e.badge + '</div>' +
      '<div class="ew-st-t"><b>' + e.label + '</b>' +
      '<span>' + e.from.d + ' ' + usd(e.from.p) + ' 기점 · ' + e.kindTxt +
      ' · 스윙 임계 ' + (e.thr * 100).toFixed(1) + '%' + (e.diag ? ' · 대각(Diagonal)' : '') + '</span></div>';

    /* 다중 차수 계층 */
    var deg = '<div class="ew-deg">' +
      '<div class="ew-deg-i"><div class="dh"><em>' + (e.degree === 'Minor' ? '주 카운트' : (e.degreeKo || '대파동')) + '</em><b>' +
      e.label.replace(' (규칙 위반)', '') + '</b></div>' +
      '<i>' + e.from.d.slice(2) + ' ~ ' + e.to.d.slice(2) + ' · ' + e.k + '파 · ' + e.span + '봉 · ' +
      (e.degreeEn || '') + '</i></div>';
    if (e.sub && e.sub.ok) {
      deg += '<div class="ew-deg-a">›</div><div class="ew-deg-i sub"><div class="dh"><em>소파동</em><b>' +
        (e.sub.form === 'abc' ? 'ABC' : '(i)-(v)') + ' ' + e.sub.k + '파</b></div><i>' + e.sub.head + '</i></div>';
    }
    deg += '</div>';
    if (e.corr && e.corr.name) {
      deg += '<div class="ew-pat"><span class="k">조정 패턴</span><b>' + e.corr.name + '</b>' +
        (e.corr.detail ? '<i>' + e.corr.detail + '</i>' : '') + '</div>';
    }
    $('#ewDegrees').innerHTML = deg;

    /* 3대 절대 규칙 + 가이드라인 */
    var nFail = (e.rules || []).filter(function (r) { return r.state === 'fail'; }).length;
    var nWarn = (e.rules || []).filter(function (r) { return r.state === 'warn'; }).length;
    $('#ewRules').innerHTML =
      ewSec('3대 절대 규칙', nFail ? '위반 ' + nFail + '건' : (nWarn ? '대각 형태' : '모두 충족')) +
      (e.rules || []).map(ewRuleRow).join('') +
      ewSec('가이드라인', '교대 법칙 · 3파 모멘텀 · 5파 다이버전스') +
      (e.guidelines || []).map(ewRuleRow).join('');

    /* 파동 다리 */
    $('#ewLegs').innerHTML = (e.legs || []).map(function (l) {
      return '<div class="ew-leg"><span class="lb">' + l.lab + '</span>' +
        '<span class="vv">' + pxs(l.from) + '→' + pxs(l.to) + '</span>' +
        '<span class="rr ' + cls(l.pct) + '">' + pct(l.pct, 1) + '</span></div>';
    }).join('');

    /* 목표 · 무효화 · 클러스터 · 채널 · 시나리오 */
    var rows = [];
    (e.targets || []).forEach(function (t, i) {
      rows.push('<div class="ew-fib-row tgt"><div class="k"><i></i>' + (i === 0 ? '다음 목표가 구간' : '2차 목표 구간') + '</div>' +
        '<div class="v">' + usd(t.lo) + ' ~ ' + usd(t.hi) + '</div><div class="s">' + t.name + '</div></div>');
    });
    (e.supports || []).forEach(function (s) {
      if (e.inv && Math.abs(s.price - e.inv.price) / Math.max(Math.abs(e.inv.price), 1e-9) < 0.002) return;
      rows.push('<div class="ew-fib-row sup"><div class="k"><i></i>지지 · 되돌림</div>' +
        '<div class="v">' + usd(s.price) + '</div><div class="s">' + s.name + '</div></div>');
    });
    if (e.inv) rows.push('<div class="ew-fib-row inv"><div class="k"><i></i>파동 무효화 가격</div>' +
      '<div class="v">' + usd(e.inv.price) + '</div><div class="s">' + e.inv.name + ' ' +
      (e.inv.side || (e.dir > 0 ? '이탈' : '돌파')) + ' 시 파동 카운트 폐기</div></div>');

    if (e.confluence && e.confluence.length) {
      rows.push('<div class="ew-block"><div class="ew-sec"><b>피보나치 클러스터</b><em>되돌림·확장 겹침 구간</em></div>' +
        e.confluence.map(function (c) {
          return '<div class="ew-clu"><span class="n">' + c.count + '</span><div class="b"><b>' + usd(c.lo) + ' ~ ' + usd(c.hi) + '</b>' +
            '<i>' + c.side + ' · ' + c.names.join(' · ') + '</i></div></div>';
        }).join('') + '</div>');
    }
    if (e.channel) {
      var chn = e.channel;
      rows.push('<div class="ew-block"><div class="ew-sec"><b>엘리어트 채널</b><em>' +
        (chn.kind === '0-2' ? '0-2 기준선 · 1 평행선' : (chn.kind === '2-4' ? '2-4 기준선 · 3 평행선' : 'A-C 기준선 · B 평행선')) +
        (chn.far ? ' · 현재가 이탈' : '') + '</em></div>' +
        '<div class="ew-chan' + (chn.far ? ' far' : '') + '"><span class="u">상단 ' + usd(chn.upper) + '</span>' +
        '<span class="l">하단 ' + usd(chn.lower) + '</span>' +
        '<span class="d">기울기 ' + (chn.slopePct >= 0 ? '+' : '') + chn.slopePct.toFixed(2) + '%/봉</span>' +
        (chn.far ? '<span class="x">카운트 이후 이탈 — 추세 가이드로만 참고</span>' : '') + '</div></div>');
    }
    if (e.scenario) {
      rows.push('<div class="ew-scn">' +
        '<div class="r"><span class="k">전개</span><span class="v">' + e.scenario.main + '</span></div>' +
        '<div class="r alt"><span class="k">반대</span><span class="v">' + e.scenario.alt + '</span></div></div>');
    }
    if (e.switch) {
      var swTxt = (state.ewMode === 1 && e.switch.textAlt) ? e.switch.textAlt : e.switch.text;
      rows.push('<div class="ew-switch-row"><span class="k">판단 경계</span><span class="v">' + swTxt + '</span></div>');
    }
    $('#ewFib').innerHTML = rows.length ? rows.join('') : '<div class="ew-empty">현재 단계에서 산출된 레벨이 없습니다.</div>';
    $('#ewComment').textContent = e.comment || '';
  }

  /* ---------------- kpi mini charts ---------------- */
  function prepCanvas(cv, h) {
    if (!cv) return null;
    var w = cv.clientWidth || 200;
    h = h || 34;
    var dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }
  function miniLine(cv, vals, color, baseline) {
    var c = prepCanvas(cv); if (!c || !vals || vals.length < 2) return;
    var ctx = c.ctx, w = c.w, h = c.h, pad = 3;
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (baseline != null) { lo = Math.min(lo, baseline); hi = Math.max(hi, baseline); }
    var span = Math.max(hi - lo, 1e-9);
    var X = function (i) { return pad + i / (vals.length - 1) * (w - pad * 2); };
    var Y = function (v) { return h - pad - (v - lo) / span * (h - pad * 2); };
    if (baseline != null) {
      ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(pad, Y(baseline)); ctx.lineTo(w - pad, Y(baseline)); ctx.stroke();
      ctx.setLineDash([]);
    }
    var grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, color.replace('ALPHA', '.22')); grd.addColorStop(1, color.replace('ALPHA', '0'));
    var isFill = color.indexOf('ALPHA') >= 0;
    var stroke = color.replace('.22', '1');
    ctx.beginPath();
    vals.forEach(function (v, i) { i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)); });
    if (isFill) {
      ctx.lineTo(X(vals.length - 1), h - pad); ctx.lineTo(X(0), h - pad); ctx.closePath();
      ctx.fillStyle = grd; ctx.fill();
      ctx.beginPath();
      vals.forEach(function (v, i) { i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)); });
    }
    ctx.strokeStyle = isFill ? '#38BDF8' : stroke;
    ctx.lineWidth = 1.4; ctx.lineJoin = 'round'; ctx.stroke();
  }
  function miniBars(cv, vals) {
    var c = prepCanvas(cv); if (!c || !vals.length) return;
    var ctx = c.ctx, w = c.w, h = c.h, pad = 3;
    var mx = Math.max.apply(null, vals.map(Math.abs)) || 1;
    var bw = (w - pad * 2) / vals.length;
    var zero = h / 2;
    vals.forEach(function (v, i) {
      var hh = Math.abs(v) / mx * (h / 2 - pad);
      ctx.fillStyle = v >= 0 ? 'rgba(16,185,129,.75)' : 'rgba(244,63,94,.75)';
      ctx.fillRect(pad + i * bw + bw * 0.18, v >= 0 ? zero - hh : zero, Math.max(bw * 0.64, 1), Math.max(hh, 1));
    });
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(pad, zero); ctx.lineTo(w - pad, zero); ctx.stroke();
  }
  function miniDrawdown(cv, eq) {
    var c = prepCanvas(cv); if (!c || !eq || eq.length < 2) return;
    var ctx = c.ctx, w = c.w, h = c.h, pad = 2;
    var peak = eq[0], dd = [];
    for (var i = 0; i < eq.length; i++) { if (eq[i] > peak) peak = eq[i]; dd.push((eq[i] - peak) / peak); }
    var lo = Math.min.apply(null, dd) || -0.01;
    var X = function (i) { return pad + i / (dd.length - 1) * (w - pad * 2); };
    var Y = function (v) { return pad + (v / lo) * (h - pad * 2); };
    var grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(244,63,94,.03)'); grd.addColorStop(1, 'rgba(244,63,94,.3)');
    ctx.beginPath(); ctx.moveTo(X(0), Y(0));
    dd.forEach(function (v, i) { ctx.lineTo(X(i), Y(v)); });
    ctx.lineTo(X(dd.length - 1), Y(0)); ctx.closePath();
    ctx.fillStyle = grd; ctx.fill();
    ctx.beginPath();
    dd.forEach(function (v, i) { i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)); });
    ctx.strokeStyle = 'rgba(251,113,133,.85)'; ctx.lineWidth = 1.2; ctx.stroke();
  }

  /* ---------------- equity curve ---------------- */
  function renderEquity(a) {
    var cv = $('#equity'), wrap = cv.parentNode;
    var w = cv.clientWidth || wrap.clientWidth, h = 168;
    var dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = h * dpr;
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var padL = 4, padR = 46, padT = 10, padB = 16;
    var i0 = a.startIdx, i1 = a.dates.length - 1;
    if (a.limited || !a.stats) {
      ctx.fillStyle = '#4A5468'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('백테스트 표본 부족', w / 2, h / 2);
      return;
    }
    var eq = a.equity, cl = a.close;
    var vals = [];
    for (var i = i0; i <= i1; i++) { if (eq[i] != null) vals.push(eq[i]); vals.push(cl[i] / cl[i0]); }
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var span = Math.max(hi - lo, 1e-6);
    lo -= span * 0.08; hi += span * 0.1;
    var X = function (i) { return padL + (i - i0) / Math.max(i1 - i0, 1) * (w - padL - padR); };
    var Y = function (v) { return padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB); };

    /* zero / grid */
    ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1;
    ctx.font = '9.5px ui-monospace,monospace'; ctx.textAlign = 'left';
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      var gy = padT + f * (h - padT - padB);
      ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
    });
    if (lo < 1 && hi > 1) {
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.beginPath(); ctx.moveTo(padL, Y(1)); ctx.lineTo(w - padR, Y(1)); ctx.stroke();
    }
    /* buy&hold */
    ctx.strokeStyle = '#4A5468'; ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (i = i0; i <= i1; i++) { var vy = Y(cl[i] / cl[i0]); i === i0 ? ctx.moveTo(X(i), vy) : ctx.lineTo(X(i), vy); }
    ctx.stroke();
    /* strategy area */
    var grd = ctx.createLinearGradient(0, padT, 0, h - padB);
    grd.addColorStop(0, 'rgba(56,189,248,.26)'); grd.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.beginPath(); var started = false;
    for (i = i0; i <= i1; i++) {
      if (eq[i] == null) continue;
      var vq = Y(eq[i]);
      if (!started) { ctx.moveTo(X(i), vq); started = true; } else ctx.lineTo(X(i), vq);
    }
    var lastX = X(i1);
    ctx.lineTo(lastX, h - padB); ctx.lineTo(X(i0), h - padB); ctx.closePath();
    ctx.fillStyle = grd; ctx.fill();
    ctx.beginPath(); started = false;
    for (i = i0; i <= i1; i++) {
      if (eq[i] == null) continue;
      var v2 = Y(eq[i]);
      if (!started) { ctx.moveTo(X(i), v2); started = true; } else ctx.lineTo(X(i), v2);
    }
    ctx.strokeStyle = '#38BDF8'; ctx.lineWidth = 1.9; ctx.lineJoin = 'round'; ctx.stroke();
    /* end labels as pills */
    var lastEq = eq[i1] != null ? eq[i1] : 1;
    ctx.font = '600 9.5px ui-monospace,monospace'; ctx.textAlign = 'left';
    var pill = function (txt, y, color, bg) {
      var tw2 = ctx.measureText(txt).width + 8;
      ctx.fillStyle = bg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(w - padR + 3, y - 7, tw2, 14, 3); else ctx.rect(w - padR + 3, y - 7, tw2, 14);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillText(txt, w - padR + 7, y + 0.5);
    };
    var yA = Y(lastEq), yB = Y(cl[i1] / cl[i0]);
    if (Math.abs(yA - yB) < 13) { if (yA < yB) yA -= 7; else yB -= 7; }
    pill(pct(lastEq - 1, 1), yA, '#BEE9FF', 'rgba(56,189,248,.18)');
    pill(pct(cl[i1] / cl[i0] - 1, 1), yB, '#8B95A8', 'rgba(255,255,255,.07)');
    /* x labels */
    ctx.fillStyle = '#4A5468'; ctx.font = '9px ui-monospace,monospace'; ctx.textAlign = 'left';
    ctx.fillText(a.dates[i0], padL + 2, h - 4);
    ctx.textAlign = 'right';
    ctx.fillText(a.dates[i1], w - padR - 2, h - 4);
    $('#eqSub').textContent = '전략 ' + pct(lastEq - 1, 1) + ' vs 보유 ' + pct(cl[i1] / cl[i0] - 1, 1) +
      (window.innerWidth > 640 ? ' · ' + a.dates[i0] + ' ~ ' + a.dates[i1] : '');
  }

  /* ---------------- recent + trades ---------------- */
  function renderRecent(a) {
    var t = (a.trades || []).slice(-4).reverse();
    $('#recentList').innerHTML = t.length ? t.map(function (x) {
      var open = x.reason === '보유중';
      return '<div class="it"><span class="d">' + x.exitDate.slice(2) + '</span>' +
        '<div class="m"><b style="color:' + (open ? '#38BDF8' : (x.reason === '손절' ? '#FB7185' : (x.reason === '이익보전' || x.reason === '트레일') ? '#34D399' : '#9BA6BA')) + '">' +
        (open ? '보유 중' : x.reason) + '</b>' +
        '<span>' + usd(x.entry) + ' → ' + usd(x.exit) + ' · ' + Math.round(x.hold || 0) + '일</span></div>' +
        '<span class="r ' + cls(x.ret) + '">' + pct(x.ret, 1) + '</span></div>';
    }).join('') : '<div class="empty">거래 내역이 없습니다</div>';
  }
  function renderTrades(a) {
    $('#logTicker').textContent = a.sym;
    var sub = $('#logSub');
    if (sub) sub.textContent = STRAT[a.stratKey || 'trend'].logSub;
    var s = a.stats;
    $('#logStats').innerHTML = s && !a.limited ?
      '<span>' + s.trades + ' trades</span><span>평균 보유 ' + s.avgHold.toFixed(0) + '일</span><span>노출 ' + (s.exposure * 100).toFixed(0) + '%</span>' : '';
    var rows = (a.trades || []).slice().reverse();
    $('#tradeBody').innerHTML = rows.length ? rows.map(function (x) {
      var open = x.reason === '보유중';
      var hold = Math.round(x.hold || 0);   /* 거래일 기준 — 상단 '평균 보유'와 같은 값 */
      return '<tr>' +
        '<td data-l="진입일">' + x.entryDate + '</td>' +
        '<td data-l="진입가">' + usd(x.entry) + '</td>' +
        '<td data-l="청산일">' + (open ? '—' : x.exitDate) + '</td>' +
        '<td class="cm" data-l="청산가">' + (open ? usd(a.price) + ' <span style="color:#4A5468">*</span>' : usd(x.exit)) + '</td>' +
        '<td class="cm hold' + (open ? ' live' : '') + '" data-l="보유기간">' + hold + '일' + (open ? '<i>진행</i>' : '') + '</td>' +
        '<td class="' + cls(x.ret) + '" data-l="수익률">' + pct(x.ret, 1) + '</td>' +
        '<td class="rs" data-l="청산 사유"><span class="r-badge">' + (open ? '보유중' : x.reason) + '</span></td>' +
        '</tr>';
    }).join('') : '<tr><td class="rs" colspan="7" style="text-align:center;color:#6B7689;padding:22px">백테스트 거래가 없습니다 (조건 미충족)</td></tr>';
  }

  /* ---------------- 이동평균 · 일목균형표 범례 ---------------- */
  function buildMaLegend() {
    var el = $('#maLegend');
    if (!el) return;
    el.innerHTML = MA.map(function (m) {
      return '<button class="ma-it on" data-p="' + m.p + '" title="' + m.label + '선 보기/숨기기">' +
        '<i style="background:' + m.color + '"></i><span>' + m.label + '</span>' +
        '<b data-v="' + m.p + '">—</b></button>';
    }).join('') +
      '<span class="ma-div"></span>' +
      ICHI.map(function (x) {
        return '<span class="ma-it ichi" data-i="' + x.k + '" title="일목균형표 ' + x.label + ' · 툴바에서 켜고 끕니다">' +
          '<i style="background:' + x.color + '"></i><span>' + (narrow() ? x.short : x.label) + '</span><b>—</b></span>';
      }).join('');
    el.onclick = function (e) {
      var b = e.target.closest('.ma-it');
      if (!b || !b.dataset.p) return;
      var p = +b.dataset.p;
      state.maOn[p] = !state.maOn[p];
      if (state.maOn[p] && !state.show.ma) {   /* 개별로 켜면 이동평균 그룹도 켜진다 */
        state.show.ma = true;
        var tg = $('.tg[data-t=ma]'); if (tg) tg.classList.add('on');
      }
      chart.draw();
    };
  }
  var legendH = 0;
  function updateMaLegend(a, i) {
    var el = $('#maLegend');
    if (!el || !a) return;
    MA.forEach(function (m) {
      var chip = el.querySelector('.ma-it[data-p="' + m.p + '"]');
      if (!chip) return;
      var v = maSeries(a, m.p) ? maSeries(a, m.p)[i] : null;
      chip.querySelector('b').textContent = (v == null) ? '—' : usd(v);
      chip.classList.toggle('on', maVisible(m.p));
    });
    ICHI.forEach(function (x) {
      var chip = el.querySelector('.ma-it[data-i="' + x.k + '"]');
      if (!chip) return;
      var v = a.ind[x.k] ? a.ind[x.k][i] : null;
      chip.querySelector('b').textContent = (v == null) ? '—' : usd(v);
      chip.classList.toggle('on', !!state.show.ichi);
    });
    /* 범례가 두 줄로 늘어나면 HUD를 그 아래로 내림 */
    var h = el.offsetHeight;
    if (h !== legendH) {
      legendH = h;
      var hud = $('#hud');
      if (hud) hud.style.top = Math.round(h + 16) + 'px';
    }
  }

  /* ============================================================
     Chart
     ============================================================ */
  function Chart(cv, hud) {
    this.cv = cv; this.hud = hud; this.ctx = cv.getContext('2d');
    this.a = null; this.i0 = 0; this.i1 = 0; this.hover = null; this.drag = null; this.pinching = null;
    this.dpr = window.devicePixelRatio || 1;
    var self = this;
    window.addEventListener('resize', function () { self.resize(); self.draw(); });
    this.bind();
  }
  Chart.prototype.setAnalysis = function (a) {
    this.a = a;
    this.dindex = {};
    for (var i = 0; i < a.dates.length; i++) this.dindex[a.dates[i]] = i;
    this.resize();
  };
  Chart.prototype.setRange = function (n) {
    var total = this.a ? this.a.dates.length : 0;
    var want = (n === 0 || !n) ? total : n;
    want = Math.min(want, total);
    this.i1 = total - 1;
    this.i0 = Math.max(0, this.i1 - want + 1);
    this.draw();
  };
  Chart.prototype.resize = function () {
    var rect = this.cv.getBoundingClientRect();
    if (!rect.width) return;
    this.dpr = window.devicePixelRatio || 1;
    this.W = rect.width; this.H = rect.height;
    this.cv.width = Math.round(rect.width * this.dpr);
    this.cv.height = Math.round(rect.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };
  Chart.prototype.layout = function () {
    var padL = 8, padR = 56, padT = 8, padB = 20, gap = 10;
    var panels = [{ k: 'price', w: 3.5 }];
    panels.push({ k: 'vol', w: 0.78 });
    if (state.show.rsi) panels.push({ k: 'rsi', w: 1.0 });
    if (state.show.macd) panels.push({ k: 'macd', w: 1.05 });
    var usable = this.H - padT - padB - gap * (panels.length - 1);
    var totalW = panels.reduce(function (a, b) { return a + b.w; }, 0);
    var y = padT, out = {};
    panels.forEach(function (p, i) {
      var h = usable * p.w / totalW;
      out[p.k] = { y: y, h: h };
      y += h + gap;
    });
    out.padL = padL; out.padR = padR; out.padB = padB; out.plotW = this.W - padL - padR;
    return out;
  };
  Chart.prototype.x = function (i) {
    var L = this._L;
    return L.padL + (i - this.i0 + 0.5) * (L.plotW / (this.i1 - this.i0 + 1));
  };
  Chart.prototype.idxAt = function (px) {
    var L = this._L;
    var bw = L.plotW / (this.i1 - this.i0 + 1);
    var i = Math.floor((px - L.padL) / bw) + this.i0;
    return Math.max(this.i0, Math.min(this.i1, i));
  };
  Chart.prototype.bind = function () {
    var self = this, cv = this.cv;
    cv.addEventListener('mousemove', function (e) {
      if (state.tool !== 'cursor') { drawMove(e); return; }
      var r = cv.getBoundingClientRect();
      if (self.drag) {
        var bw = self._L.plotW / (self.i1 - self.i0 + 1);
        var shift = Math.round((self.drag.x - (e.clientX - r.left)) / bw);
        self.slide(self.drag.i0 + shift, self.drag.i1 + shift);
        self.drag.moved = true;
        return;
      }
      self.hover = self.idxAt(e.clientX - r.left);
      self.hudPos(e);
      self.draw();
    });
    cv.addEventListener('mouseleave', function () {
      if (state.tool !== 'cursor') return;
      self.hover = null; self.hud.classList.remove('on'); self.draw();
    });
    cv.addEventListener('mousedown', function (e) {
      if (state.tool !== 'cursor') { e.preventDefault(); drawDown(e); return; }
      var r = cv.getBoundingClientRect();
      self.drag = { x: e.clientX - r.left, i0: self.i0, i1: self.i1, moved: false };
      cv.style.cursor = 'grabbing';
    });
    window.addEventListener('mouseup', function (e) {
      if (state.tool !== 'cursor') { drawUp(e); return; }
      if (self.drag) { self.drag = null; cv.style.cursor = 'crosshair'; }
    });
    cv.addEventListener('dblclick', function () {
      if (state.tool !== 'cursor') return;
      self.setRange(state.range);
    });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = cv.getBoundingClientRect();
      var anchor = self.idxAt(e.clientX - r.left);
      self.zoom(e.deltaY > 0 ? 1.18 : 0.85, anchor);
    }, { passive: false });

    /* touch */
    var pts = {};
    cv.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      if (state.tool !== 'cursor') {
        if (e.cancelable) e.preventDefault();
        drawDown(e);
        return;
      }
      pts[e.pointerId] = { x: e.clientX - cv.getBoundingClientRect().left, y: e.clientY };
      if (Object.keys(pts).length === 2) {
        var k = Object.keys(pts);
        self.pinching = { d: Math.abs(pts[k[0]].x - pts[k[1]].x), i0: self.i0, i1: self.i1 };
        self.drag = null;
      } else {
        var r = cv.getBoundingClientRect();
        self.drag = { x: e.clientX - r.left, i0: self.i0, i1: self.i1, moved: false };
        self.hover = self.idxAt(e.clientX - r.left);
        self.draw();
      }
    });
    cv.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'mouse') return;
      if (state.tool !== 'cursor') {
        if (e.cancelable) e.preventDefault();
        drawMove(e);
        return;
      }
      if (!pts[e.pointerId]) return;
      pts[e.pointerId].x = e.clientX - cv.getBoundingClientRect().left;
      if (self.pinching && Object.keys(pts).length === 2) {
        var k = Object.keys(pts);
        var d = Math.abs(pts[k[0]].x - pts[k[1]].x);
        var f = d / Math.max(self.pinching.d, 1);
        var n = (self.pinching.i1 - self.pinching.i0 + 1) / f;
        var c = (self.pinching.i0 + self.pinching.i1) / 2;
        self.slide(Math.round(c - n / 2), Math.round(c + n / 2));
        return;
      }
      if (self.drag) {
        var bw = self._L.plotW / (self.i1 - self.i0 + 1);
        var shift = Math.round((self.drag.x - (e.clientX - cv.getBoundingClientRect().left)) / bw);
        if (Math.abs(shift) > 0) { self.slide(self.drag.i0 + shift, self.drag.i1 + shift); self.drag.moved = true; }
      }
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    function up(e) {
      if (state.tool !== 'cursor') { drawUp(e); return; }
      delete pts[e.pointerId];
      if (Object.keys(pts).length < 2) self.pinching = null;
      if (self.drag) { self.drag = null; }
      self.hover = null; self.hud.classList.remove('on'); self.draw();
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', up);
  };
  Chart.prototype.slide = function (n0, n1) {
    var total = this.a.dates.length;
    var size = QE.clamp(n1 - n0 + 1, 24, total);
    n1 = Math.min(n1, total - 1); n0 = n1 - size + 1;
    if (n0 < 0) { n0 = 0; n1 = Math.min(total - 1, size - 1); }
    this.i0 = n0; this.i1 = n1;
    this.draw();
  };
  Chart.prototype.zoom = function (f, anchor) {
    var total = this.a.dates.length;
    var size = QE.clamp(Math.round((this.i1 - this.i0 + 1) * f), 24, total);
    var ratio = (anchor - this.i0) / Math.max(this.i1 - this.i0, 1);
    var n0 = Math.round(anchor - ratio * size);
    this.slide(n0, n0 + size - 1);
  };
  Chart.prototype.hudPos = function (e) { /* placeholder */ };

  Chart.prototype.draw = function () {
    var a = this.a; if (!a) return;
    var ctx = this.ctx, W = this.W, H = this.H;
    if (!W) { this.resize(); W = this.W; H = this.H; if (!W) return; }
    var L = this._L = this.layout();
    var ind = a.ind, c = a.close, o = a.ind.__o || null;
    var s = a.series || seriesOf(a.sym) || a;
    var oo = s.o, hh = s.h, ll = s.l, vv = s.v;
    var i0 = this.i0, i1 = this.i1, nBars = i1 - i0 + 1;
    var bw = L.plotW / nBars;
    ctx.clearRect(0, 0, W, H);

    /* background grid + price range */
    var p = L.price;
    var lo = Infinity, hi = -Infinity, i;
    for (i = i0; i <= i1; i++) {
      if (hh[i] > hi) hi = hh[i];
      if (ll[i] < lo) lo = ll[i];
      if (state.show.ma) {
        MA.forEach(function (m) {
          if (!state.maOn[m.p]) return;
          var v = maSeries(a, m.p)[i];
          if (v != null) { if (v > hi) hi = v; if (v < lo) lo = v; }
        });
      }
      if (state.show.ichi) {
        ['spanA', 'spanB'].forEach(function (k) {
          var v = ind[k][i];
          if (v != null) { if (v > hi) hi = v; if (v < lo) lo = v; }
        });
      }
      if (state.show.bb && ind.bb.up[i] != null) {
        if (ind.bb.up[i] > hi) hi = ind.bb.up[i];
        if (ind.bb.lo[i] < lo) lo = ind.bb.lo[i];
      }
    }
    var pad = (hi - lo) * 0.06;
    lo -= pad; hi += pad;
    if (lo < 0) lo = 0;                       /* 주가축이 음수로 내려가지 않게 (5년 장기 범위) */
    var Y = function (v) { return p.y + (1 - (v - lo) / (hi - lo)) * p.h; };
    this._lo = lo; this._hi = hi; this._pt = p;

    /* 엘리어트 목표·무효화 레벨을 화면 가격범위에 포함 (너무 멀면 제외) */
    if (state.show.ew && a.elliott && a.elliott.ok) {
      var span0 = Math.max(hi - lo, 1e-6), ewa = (typeof ewScnOf === 'function' ? ewScnOf(a) : a.elliott) || a.elliott;
      var gs = [];
      if (ewa.targets && ewa.targets[0]) gs.push(ewa.targets[0].lo, ewa.targets[0].hi);
      if (ewa.supports && ewa.supports[0]) gs.push(ewa.supports[0].price);
      if (ewa.inv) gs.push(ewa.inv.price);
      gs.forEach(function (v) {
        if (!isFinite(v)) return;
        if (v > lo - span0 * 0.75 && v < hi + span0 * 0.75) { if (v < lo) lo = v; if (v > hi) hi = v; }
      });
      this._lo = lo; this._hi = hi;
    }

    this._tagRects = [];

    /* horizontal grid */
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 1;
    ctx.font = '9.5px ui-monospace,SFMono-Regular,monospace'; ctx.textBaseline = 'middle';
    for (var g = 0; g <= 4; g++) {
      var gv = lo + (hi - lo) * (g / 4), gy = Y(gv);
      ctx.beginPath(); ctx.moveTo(L.padL, gy); ctx.lineTo(L.padL + L.plotW, gy); ctx.stroke();
      ctx.fillStyle = '#5B6679'; ctx.textAlign = 'left';
      ctx.fillText(gv >= 1000 ? gv.toFixed(0) : gv.toFixed(2), L.padL + L.plotW + 6, gy);
    }

    /* 가격 패널 안으로만 그리기 (범위 밖 지표가 아래 패널을 침범하지 않게) */
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.padL, p.y - 1, L.plotW, p.h + 2);
    ctx.clip();

    /* 일목균형표 구름대 (선행스팬 A·B) — 캔들 아래 깔리는 반투명 영역 */
    if (state.show.ichi) {
      for (i = Math.max(i0, 1); i <= i1; i++) {
        var a0 = ind.spanA[i - 1], b0 = ind.spanB[i - 1], a1 = ind.spanA[i], b1 = ind.spanB[i];
        if (a0 == null || b0 == null || a1 == null || b1 == null) continue;
        ctx.beginPath();
        ctx.moveTo(this.x(i - 1), Y(a0));
        ctx.lineTo(this.x(i), Y(a1));
        ctx.lineTo(this.x(i), Y(b1));
        ctx.lineTo(this.x(i - 1), Y(b0));
        ctx.closePath();
        /* 상승 구름대(양운)는 빨강, 하락 구름대(음운)는 파랑 */
        ctx.fillStyle = (a1 >= b1) ? 'rgba(239,68,68,.15)' : 'rgba(59,130,246,.16)';
        ctx.fill();
      }
    }

    /* bollinger */
    if (state.show.bb) {
      var grd = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
      ctx.beginPath();
      for (i = i0; i <= i1; i++) { if (ind.bb.up[i] == null) continue; var xx = this.x(i), yy = Y(ind.bb.up[i]); i === i0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy); }
      for (i = i1; i >= i0; i--) { if (ind.bb.lo[i] == null) continue; ctx.lineTo(this.x(i), Y(ind.bb.lo[i])); }
      ctx.closePath();
      ctx.fillStyle = 'rgba(99,102,241,.055)'; ctx.fill();
      ctx.strokeStyle = 'rgba(129,140,248,.55)'; ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (i = i0; i <= i1; i++) { if (ind.bb.up[i] == null) continue; i === i0 ? ctx.moveTo(this.x(i), Y(ind.bb.up[i])) : ctx.lineTo(this.x(i), Y(ind.bb.up[i])); }
      ctx.stroke();
      ctx.beginPath();
      for (i = i0; i <= i1; i++) { if (ind.bb.lo[i] == null) continue; i === i0 ? ctx.moveTo(this.x(i), Y(ind.bb.lo[i])) : ctx.lineTo(this.x(i), Y(ind.bb.lo[i])); }
      ctx.stroke();
    }

    /* candles */
    var cw = Math.max(1, Math.min(bw * 0.66, 13));
    for (i = i0; i <= i1; i++) {
      var up = c[i] >= oo[i];
      var col = up ? '#10B981' : '#F43F5E';
      var x = this.x(i);
      ctx.strokeStyle = up ? 'rgba(16,185,129,.85)' : 'rgba(244,63,94,.85)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, Y(hh[i])); ctx.lineTo(x, Y(ll[i])); ctx.stroke();
      var yo = Y(oo[i]), yc = Y(c[i]);
      var top = Math.min(yo, yc), hgt = Math.max(Math.abs(yc - yo), 1);
      ctx.fillStyle = col;
      if (bw < 2.2) { ctx.fillRect(x - 0.5, top, 1, hgt); }
      else ctx.fillRect(x - cw / 2, top, cw, hgt);
    }

    /* 이동평균선 5·20·60·120·240 — 느린 선을 먼저(아래) 그려 빠른 선이 위로 오게 */
    if (state.show.ma) {
      var drawLine = function (arr, color, wd) {
        if (!arr) return;
        var path = function () {
          ctx.beginPath(); var st = false;
          for (var j = i0; j <= i1; j++) {
            if (arr[j] == null) continue;          /* 240일선은 앞쪽 240봉이 모자라면 값이 없다 → 선을 끊지 않고 시작점부터 */
            var px2 = this.x(j), py2 = Y(arr[j]);
            if (!st) { ctx.moveTo(px2, py2); st = true; } else ctx.lineTo(px2, py2);
          }
        }.bind(this);
        path();
        ctx.strokeStyle = 'rgba(11,14,20,.62)'; ctx.lineWidth = wd + 2.6;   /* 캔들 위에서도 선이 묻히지 않게 어두운 테두리 */
        ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
        path();
        ctx.strokeStyle = color; ctx.lineWidth = wd; ctx.stroke();
      }.bind(this);
      MA.slice().reverse().forEach(function (m) {
        if (!state.maOn[m.p]) return;
        drawLine(maSeries(a, m.p), m.color, m.w);
      });
    }

    /* 일목균형표 라인 */
    if (state.show.ichi) {
      var ichiLine = function (arr, color, wd, dash) {
        ctx.save();
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath(); var st = false;
        for (var j = i0; j <= i1; j++) {
          if (arr[j] == null) continue;
          var px4 = this.x(j), py4 = Y(arr[j]);
          if (!st) { ctx.moveTo(px4, py4); st = true; } else ctx.lineTo(px4, py4);
        }
        ctx.strokeStyle = color; ctx.lineWidth = wd; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.restore();
      }.bind(this);
      ICHI.forEach(function (x) { ichiLine(ind[x.k], x.color, x.w, x.dash); });
    }

    /* last price tag */
    if (state.show.ew) this.drawWave(ctx, a, L, Y, i0, i1, bw);
    this.drawUser(ctx, a, L, Y, i0, i1);
    ctx.restore();
    var lastC = c[i1], lastY = Y(lastC);
    ctx.fillStyle = c[i1] >= oo[i1] ? '#10B981' : '#F43F5E';
    var tag = usd(lastC);
    ctx.font = '600 9.5px ui-monospace,monospace';
    var tw = ctx.measureText(tag).width + 10;
    ctx.beginPath();
    var tx = L.padL + L.plotW + 2, ty = lastY;
    if (ctx.roundRect) { ctx.roundRect(tx, ty - 8, tw, 16, 3); } else { ctx.rect(tx, ty - 8, tw, 16); }
    ctx.fill();
    ctx.fillStyle = '#0B0E14'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(tag, tx + 5, ty);

    /* signal markers */
    if (state.show.sig && a.trades) {
      var markBars = nBars;
      var labelOn = bw > 9;
      a.trades.forEach(function (tr) {
        var bi = this.dindex[tr.entryDate], si = this.dindex[tr.exitDate];
        if (bi != null && bi >= i0 && bi <= i1) {
          var x = this.x(bi), y = Y(ll[bi]) + 9;
          ctx.fillStyle = '#10B981';
          ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x - 4.6, y + 1); ctx.lineTo(x + 4.6, y + 1); ctx.closePath(); ctx.fill();
          if (labelOn) {
            ctx.font = '600 8.5px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#6EE7B7';
            ctx.fillText('BUY', x, y + 13);
          }
        }
        if (si != null && si >= i0 && si <= i1 && tr.reason !== '보유중') {
          var x2 = this.x(si), y2 = Y(hh[si]) - 9;
          ctx.fillStyle = '#F43F5E';
          ctx.beginPath(); ctx.moveTo(x2, y2 + 7); ctx.lineTo(x2 - 4.6, y2 - 1); ctx.lineTo(x2 + 4.6, y2 - 1); ctx.closePath(); ctx.fill();
          if (labelOn) {
            ctx.font = '600 8.5px ui-monospace,monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#FDA4AF';
            ctx.fillText('SELL', x2, y2 - 5);
          }
        }
      }, this);
    }


    /* volume panel */
    var vp = L.vol;
    ctx.fillStyle = 'rgba(255,255,255,.03)';
    ctx.fillRect(L.padL, vp.y, L.plotW, vp.h);
    var vmax = 0;
    for (i = i0; i <= i1; i++) if (vv[i] > vmax) vmax = vv[i];
    for (i = i0; i <= i1; i++) {
      var vh = (vv[i] / (vmax || 1)) * (vp.h - 4);
      ctx.fillStyle = c[i] >= oo[i] ? 'rgba(16,185,129,.5)' : 'rgba(244,63,94,.5)';
      if (bw < 2.2) ctx.fillRect(this.x(i) - .5, vp.y + vp.h - vh, 1, vh);
      else ctx.fillRect(this.x(i) - cw / 2, vp.y + vp.h - vh, cw, vh);
    }
    var vlab = '거래량 ' + vol(vv[i1] * 1000);
    ctx.font = '9px ui-monospace,monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(11,14,20,.72)';
    ctx.fillRect(L.padL + 2, vp.y + 1, ctx.measureText(vlab).width + 8, 13);
    ctx.fillStyle = '#6B7689';
    ctx.fillText(vlab, L.padL + 6, vp.y + 10);

    /* RSI */
    if (L.rsi) {
      var rp = L.rsi;
      ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(L.padL, rp.y, L.plotW, rp.h);
      var yR = function (v) { return rp.y + (1 - v / 100) * rp.h; };
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.setLineDash([3, 3]);
      [30, 50, 70].forEach(function (lv) {
        ctx.beginPath(); ctx.moveTo(L.padL, yR(lv)); ctx.lineTo(L.padL + L.plotW, yR(lv)); ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(244,63,94,.055)'; ctx.fillRect(L.padL, yR(100), L.plotW, yR(70) - yR(100));
      ctx.fillStyle = 'rgba(16,185,129,.055)'; ctx.fillRect(L.padL, yR(30), L.plotW, yR(0) - yR(30));
      ctx.beginPath(); var st2 = false;
      for (i = i0; i <= i1; i++) {
        if (ind.rsi[i] == null) continue;
        var rx = this.x(i), ry = yR(ind.rsi[i]);
        if (!st2) { ctx.moveTo(rx, ry); st2 = true; } else ctx.lineTo(rx, ry);
      }
      ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = 'rgba(11,14,20,.72)';
      ctx.fillRect(L.padL + 2, rp.y + 1, 42, 13);
      ctx.fillStyle = '#6B7689'; ctx.font = '9px ui-monospace,monospace'; ctx.textAlign = 'left';
      ctx.fillText('RSI 14', L.padL + 5, rp.y + 10);
      ctx.textAlign = 'left'; ctx.fillStyle = '#7A8698';
      ctx.fillText(ind.rsi[i1] != null ? ind.rsi[i1].toFixed(1) : '—', L.padL + L.plotW + 6, yR(ind.rsi[i1] || 50));
    }

    /* MACD */
    if (L.macd) {
      var mp = L.macd;
      ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(L.padL, mp.y, L.plotW, mp.h);
      var mlo = 0, mhi = 0;
      for (i = i0; i <= i1; i++) {
        [ind.macd.line[i], ind.macd.signal[i], ind.macd.hist[i]].forEach(function (v) { if (v != null) { if (v > mhi) mhi = v; if (v < mlo) mlo = v; } });
      }
      var mpad = (mhi - mlo) * 0.12 || 1; mlo -= mpad; mhi += mpad;
      var yM = function (v) { return mp.y + (1 - (v - mlo) / (mhi - mlo)) * mp.h; };
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.beginPath(); ctx.moveTo(L.padL, yM(0)); ctx.lineTo(L.padL + L.plotW, yM(0)); ctx.stroke();
      for (i = i0; i <= i1; i++) {
        if (ind.macd.hist[i] == null) continue;
        var hv = ind.macd.hist[i];
        var y0 = yM(0), y1 = yM(hv);
        ctx.fillStyle = hv >= 0 ? 'rgba(16,185,129,.5)' : 'rgba(244,63,94,.5)';
        var hw = Math.max(1, Math.min(bw * 0.6, 10));
        ctx.fillRect(this.x(i) - hw / 2, Math.min(y0, y1), hw, Math.max(Math.abs(y1 - y0), 0.6));
      }
      var mline = function (arr, color, lw) {
        ctx.beginPath(); var st3 = false;
        for (var j = i0; j <= i1; j++) {
          if (arr[j] == null) continue;
          var px3 = this.x(j), py3 = yM(arr[j]);
          if (!st3) { ctx.moveTo(px3, py3); st3 = true; } else ctx.lineTo(px3, py3);
        }
        ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
      }.bind(this);
      mline(ind.macd.line, '#38BDF8', 1.3);
      mline(ind.macd.signal, '#F59E0B', 1.2);
      ctx.fillStyle = 'rgba(11,14,20,.72)';
      ctx.fillRect(L.padL + 2, mp.y + 1, 74, 13);
      ctx.fillStyle = '#6B7689'; ctx.font = '9px ui-monospace,monospace'; ctx.textAlign = 'left';
      ctx.fillText('MACD 12·26·9', L.padL + 5, mp.y + 10);
    }

    /* time axis */
    ctx.fillStyle = '#4A5468'; ctx.font = '9px ui-monospace,monospace'; ctx.textBaseline = 'alphabetic';
    var step = Math.max(1, Math.round(nBars / 6));
    ctx.textAlign = 'center';
    for (i = i0; i <= i1; i += step) {
      var dt = a.dates[i];
      var lab = nBars > 300 ? dt.slice(2, 7).replace('-', '/') : dt.slice(5).replace('-', '/');
      var lx0 = this.x(i);
      if (lx0 - ctx.measureText(lab).width / 2 < L.padL + 2) continue;   /* 왼쪽 축에 잘리는 첫 라벨은 생략 */
      ctx.fillText(lab, lx0, H - 6);
    }

    /* crosshair */
    if (this.hover != null && this.hover >= i0 && this.hover <= i1) {
      var hi2 = this.hover, cx = this.x(hi2);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(cx, L.price.y); ctx.lineTo(cx, H - L.padB); ctx.stroke();
      ctx.setLineDash([]);
      /* highlight candle */
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.strokeRect(cx - Math.max(cw, 3) / 2 - 1, Y(hh[hi2]) - 1, Math.max(cw, 3) + 2, Math.max(Y(ll[hi2]) - Y(hh[hi2]), 1) + 2);
      ctx.fillStyle = 'rgba(13,17,25,.92)'; ctx.strokeStyle = 'rgba(255,255,255,.1)';
      var dl = a.dates[hi2], dlw = ctx.measureText(dl).width + 14;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx - dlw / 2, H - L.padB + 2, dlw, 14, 3); else ctx.rect(cx - dlw / 2, H - L.padB + 2, dlw, 14);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#9BA6BA'; ctx.textAlign = 'center';
      ctx.fillText(dl, cx, H - L.padB + 12);
      ctx.restore();
    }
    ctx.restore();

    /* 내 가상 체결 마커 (현재 종목) */
    if (paper.fills.length) {
      paper.fills.forEach(function (f) {
        if (f.t !== a.sym) return;
        var bi = this.dindex[f.d];
        if (bi == null || bi < i0 || bi > i1) return;
        var bx = this.x(bi), by = Y(c[bi]) + (f.side === 'buy' ? 13 : -13);
        ctx.beginPath();
        ctx.moveTo(bx, by - 4); ctx.lineTo(bx + 4, by); ctx.lineTo(bx, by + 4); ctx.lineTo(bx - 4, by);
        ctx.closePath();
        ctx.fillStyle = f.side === 'buy' ? '#38BDF8' : '#F97316';
        ctx.strokeStyle = 'rgba(11,14,20,.9)'; ctx.lineWidth = 1.6;
        ctx.stroke(); ctx.fill();
      }, this);
    }

    /* 이동평균 범례 — 크로스헤어 위치(없으면 최근 봉)의 실제 값을 표시 */
    updateMaLegend(a, this.hover != null ? this.hover : i1);

    /* HUD */
    if (this.hover != null) this.updateHud(a, s, this.hover);
  };

  Chart.prototype.updateHud = function (a, s, i) {
    var ind = a.ind, h = this.hud;
    var lab = a.label;
    var sc = a.scoreSeries.score[i];
    var l2 = QE.labelOf(sc);
    var cls2 = { strongbuy: 'sb', buy: 'b', watch: 'w', sell: 's', strongsell: 'ss' }[l2.key];
    h.innerHTML =
      '<div class="h-d">' + a.dates[i] + '</div>' +
      '<div class="h-i"><em>시</em><b>' + (s.o[i] >= 1000 ? s.o[i].toFixed(0) : s.o[i].toFixed(2)) + '</b>' +
      '<em>고</em><b>' + (s.h[i] >= 1000 ? s.h[i].toFixed(0) : s.h[i].toFixed(2)) + '</b>' +
      '<em>저</em><b>' + (s.l[i] >= 1000 ? s.l[i].toFixed(0) : s.l[i].toFixed(2)) + '</b>' +
      '<em>종</em><b>' + (s.c[i] >= 1000 ? s.c[i].toFixed(0) : s.c[i].toFixed(2)) + '</b></div>' +
      '<div class="h-i"><em>거래량</em><b>' + vol(s.v[i] * 1000) + '</b></div>' +
      '<div class="h-i"><em>RSI</em><b>' + (ind.rsi[i] ? ind.rsi[i].toFixed(1) : '—') + '</b></div>' +
      '<div class="h-i"><em>MACD</em><b>' + (ind.macd.hist[i] != null ? ind.macd.hist[i].toFixed(2) : '—') + '</b></div>' +
      '<div class="h-s" style="color:' + l2.color + '">' + l2.ko + ' ' + Math.round(sc) + '</div>';
    h.classList.add('on');
  };
  Chart.prototype.hudPos = function () {};

  /* ---------------- 가격 ↔ 픽셀 ---------------- */
  Chart.prototype.priceAt = function (py) {
    if (this._lo == null || this._hi == null || !this._pt) return null;
    var r = QE.clamp((py - this._pt.y) / Math.max(this._pt.h, 1e-6), 0, 1);
    return this._hi - r * (this._hi - this._lo);
  };
  Chart.prototype.pillTag = function (ctx, x, y, text, color, bg, align) {
    ctx.save();
    ctx.font = '600 9.5px ui-monospace,SFMono-Regular,monospace';
    ctx.textBaseline = 'middle';
    var w = ctx.measureText(text).width + 10;
    var ax = align === 'right' ? x - w : (align === 'center' ? x - w / 2 : x);
    var rect = { x: ax, y: y - 7.5, w: w, h: 15 };
    if (!this._tagRects) this._tagRects = [];
    if (align === 'right') {
      var guard = 0;
      while (guard++ < 40 && this._tagRects.some(function (r) {
        return !(rect.x + rect.w < r.x + 1 || rect.x > r.x + r.w - 1 || rect.y + rect.h < r.y + 1 || rect.y > r.y + r.h - 1);
      })) { rect.y += 16; }
      var lim = (this._pt ? this._pt.y + this._pt.h - 12 : 1e9);
      if (rect.y > lim) {
        /* 오른쪽 여백이 꽉 찼으면 왼쪽 여백으로 옮긴다 */
        rect.x = (this._L ? this._L.padL + 3 : 6);
        rect.y = Math.max((this._pt ? this._pt.y + 2 : 0), Math.min(y - 7.5, lim));
        var clash = this._tagRects.some(function (r) {
          return !(rect.x + rect.w < r.x + 1 || rect.x > r.x + r.w - 1 || rect.y + rect.h < r.y + 1 || rect.y > r.y + r.h - 1);
        });
        if (clash) { ctx.restore(); return; }
      }
    }
    this._tagRects.push(rect);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 3); else ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'left';
    ctx.fillText(text, rect.x + 5, rect.y + 8);
    ctx.restore();
  };

  /* ---------------- 엘리어트 파동 오버레이 ---------------- */
  Chart.prototype.drawWave = function (ctx, a, L, Y, i0, i1, bw) {
    if (!state.show.ew) return;
    var e = ewScnOf(a);
    if (!e) return;
    var self = this, up = e.dir > 0;
    var impC = up ? '#2DD4BF' : '#FB7185';
    var corC = '#C4B5FD';
    var colOf = function (s) { return (s === 'cor' || s === 'subcor') ? corC : impC; };
    var xr = L.padL + L.plotW;
    var path = e.path || [];
    var boxes = [];
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    /* 0) 엘리어트 채널 — 0-2 기준선과 1을 지나는 평행선 사이 반투명 밴드 */
    if (state.ewShow.ch !== false && e.channel && !e.channel.far) {
      var ch = e.channel;
      var ci0 = Math.max(ch.i0, i0), ci1 = Math.min(ch.i1, i1);
      if (ci1 > ci0) {
        var yb0 = Y(ch.baseFrom.p + ch.slope * (ci0 - ch.baseFrom.i));
        var yb1 = Y(ch.baseFrom.p + ch.slope * (ci1 - ch.baseFrom.i));
        var yp0 = Y(ch.paraFrom.p + ch.slope * (ci0 - ch.paraFrom.i));
        var yp1 = Y(ch.paraFrom.p + ch.slope * (ci1 - ch.paraFrom.i));
        ctx.beginPath();
        ctx.moveTo(self.x(ci0), yb0); ctx.lineTo(self.x(ci1), yb1);
        ctx.lineTo(self.x(ci1), yp1); ctx.lineTo(self.x(ci0), yp0); ctx.closePath();
        ctx.fillStyle = 'rgba(129,140,248,.075)'; ctx.fill();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(129,140,248,.55)'; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(self.x(ci0), yb0); ctx.lineTo(self.x(ci1), yb1); ctx.stroke();
        ctx.strokeStyle = 'rgba(129,140,248,.42)';
        ctx.beginPath(); ctx.moveTo(self.x(ci0), yp0); ctx.lineTo(self.x(ci1), yp1); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    /* 1) 대파동 경로 — 굵은 선 / 조정은 점선 / 진행중은 얇은 점선 */
    for (var k = 1; k < path.length; k++) {
      var q0 = path[k - 1], q1 = path[k];
      var x0 = self.x(q0.i), y0 = Y(q0.p), x1 = self.x(q1.i), y1 = Y(q1.p);
      if (Math.max(x0, x1) < L.padL - 60 || Math.min(x0, x1) > xr + 60) continue;
      ctx.setLineDash(q1.seg === 'cor' ? [6, 4] : (q1.seg === 'run' ? [3, 4] : []));
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.strokeStyle = 'rgba(11,14,20,.82)'; ctx.lineWidth = 4.6; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.strokeStyle = colOf(q1.seg); ctx.lineWidth = 2.1; ctx.stroke();
    }
    ctx.setLineDash([]);

    /* 2) 소파동 경로 — 같은 레그 내부를 가는 선과 작은 (i)(ii) 라벨로 */
    var sub = e.sub;
    var subSpan = (sub && sub.ok && sub.path && sub.path.length > 2) ? (sub.path[sub.path.length - 1].i - sub.path[0].i) : 0;
    if (state.ewShow.sub !== false && sub && sub.ok && sub.path && sub.path.length > 2 && bw >= 1.6 && subSpan >= 6) {
      for (var s = 1; s < sub.path.length; s++) {
        var p0 = sub.path[s - 1], p1 = sub.path[s];
        var sx0 = self.x(p0.i), sy0 = Y(p0.p), sx1 = self.x(p1.i), sy1 = Y(p1.p);
        if (Math.max(sx0, sx1) < L.padL - 40 || Math.min(sx0, sx1) > xr + 40) continue;
        ctx.setLineDash(p1.seg === 'subcor' ? [2, 3] : []);
        ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx1, sy1);
        ctx.strokeStyle = 'rgba(11,14,20,.7)'; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx1, sy1);
        ctx.strokeStyle = p1.seg === 'subcor' ? 'rgba(221,214,254,.9)' : 'rgba(226,232,240,.9)';
        ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    /* 3) 대파동 변곡점과 1·2·3·4·5 / A·B·C 배지 (굵은 테두리) */
    var labOn = bw >= 1.4;
    for (var j = 0; j < path.length; j++) {
      var pt = path[j];
      if (!pt.lab) continue;
      var px1 = self.x(pt.i), py1 = Y(pt.p);
      if (px1 < L.padL - 6 || px1 > xr + 6) continue;
      var prev = path[j - 1] || pt, next = path[j + 1] || pt;
      var isHigh = pt.p >= prev.p && pt.p >= next.p;
      ctx.beginPath(); ctx.arc(px1, py1, bw > 5 ? 4.4 : (bw > 2.6 ? 3.2 : 2.4), 0, Math.PI * 2);
      ctx.fillStyle = '#0B0E14'; ctx.fill();
      ctx.strokeStyle = colOf(pt.seg); ctx.lineWidth = 2.2; ctx.stroke();
      if (!labOn) continue;
      ctx.font = '800 10.5px ui-monospace,SFMono-Regular,monospace';
      var tw = Math.max(ctx.measureText(pt.lab).width + 11, 18);
      var bx = px1 - tw / 2, by = isHigh ? py1 - 25 : py1 + 9;
      var topLim = L.price.y + 1, botLim = L.price.y + L.price.h - 18;
      if (by < topLim) by = py1 + 10;
      if (by > botLim) by = py1 - 25;
      by = Math.max(topLim, Math.min(by, botLim));
      var rect = { x: bx, y: by, w: tw, h: 17 };
      var hit = boxes.some(function (b) {
        return !(rect.x + rect.w < b.x - 1 || rect.x > b.x + b.w + 1 || rect.y + rect.h < b.y - 1 || rect.y > b.y + b.h + 1);
      });
      if (hit) continue;
      boxes.push(rect);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 4); else ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(11,14,20,.92)'; ctx.fill();
      var c2 = colOf(pt.seg);
      ctx.strokeStyle = c2; ctx.globalAlpha = .75; ctx.lineWidth = 1.4; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = c2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pt.lab, px1, rect.y + 9);
    }
    /* 진행중(현재) 지점 */
    var lp = path[path.length - 1];
    if (lp && lp.seg === 'run') {
      var cxp = self.x(lp.i), cyp = Y(lp.p);
      if (cxp >= L.padL - 4 && cxp <= xr + 4) {
        ctx.beginPath(); ctx.arc(cxp, cyp, 4.6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }


    /* 2b) 소파동 라벨 — 대파동 배지 뒤에 그려 자리를 양보한다 */
    if (state.ewShow.sub !== false && sub && sub.ok && sub.path && sub.path.length > 2 && bw >= 2.2 && subSpan >= 10) {
        ctx.font = '700 9px ui-monospace,SFMono-Regular,monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (var sj = 0; sj < sub.path.length; sj++) {
          var sp = sub.path[sj];
          if (!sp.lab) continue;
          var spx = self.x(sp.i), spy = Y(sp.p);
          if (spx < L.padL - 2 || spx > xr + 2) continue;
          if (spy < L.price.y + 2 || spy > L.price.y + L.price.h - 2) continue;
          var prev2 = sub.path[sj - 1] || sp, next2 = sub.path[sj + 1] || sp;
          var sHigh = sp.p >= prev2.p && sp.p >= next2.p;
          var ty = sHigh ? spy - 12 : spy + 12;
          var rect2 = { x: spx - 11, y: ty - 6, w: 22, h: 12 };
          var hit2 = boxes.some(function (b) {
            return !(rect2.x + rect2.w < b.x || rect2.x > b.x + b.w || rect2.y + rect2.h < b.y || rect2.y > b.y + b.h);
          });
          if (hit2) continue;
          boxes.push(rect2);
          ctx.strokeStyle = 'rgba(11,14,20,.85)'; ctx.lineWidth = 3;
          ctx.strokeText(sp.lab, spx, ty);
          ctx.fillStyle = sp.seg === 'subcor' ? '#DDD6FE' : '#E2E8F0';
          ctx.fillText(sp.lab, spx, ty);
        }
    }

    /* 4) 목표 구간 · 무효화 · 지지 가이드 */
    var gx0 = Math.min(QE.clamp(self.x(Math.min(e.to.i, i1)), L.padL, xr), xr - L.plotW * 0.34);
    var tags = [];
    e.targets.slice(0, 1).forEach(function (t) {
      var yl = Y(t.lo), yh = Y(t.hi);
      if (Math.min(yl, yh) > L.price.y + L.price.h || Math.max(yl, yh) < L.price.y) return;
      ctx.fillStyle = 'rgba(16,185,129,.085)';
      ctx.fillRect(gx0, Math.min(yl, yh), xr - gx0, Math.max(Math.abs(yh - yl), 1));
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(52,211,153,.5)'; ctx.lineWidth = 1;
      [t.lo, t.hi].forEach(function (v) {
        var yy = Y(v);
        ctx.beginPath(); ctx.moveTo(gx0, yy); ctx.lineTo(xr, yy); ctx.stroke();
      });
      ctx.setLineDash([]);
      tags.push({ y: (yl + yh) / 2, text: '목표 ' + pxs(t.lo) + '~' + pxs(t.hi), c: '#6EE7B7', bg: 'rgba(6,44,34,.92)' });
    });
    if (e.inv) {
      var yi = Y(e.inv.price);
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(L.padL, yi); ctx.lineTo(xr, yi);
      ctx.strokeStyle = 'rgba(244,63,94,.62)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.setLineDash([]);
      tags.push({ y: yi, text: '무효화 ' + pxs(e.inv.price), c: '#FDA4AF', bg: 'rgba(56,10,22,.92)' });
    }
    (e.supports || []).forEach(function (s) {
      if (e.inv && Math.abs(s.price - e.inv.price) / Math.max(Math.abs(e.inv.price), 1e-9) < 0.002) return;
      var ys = Y(s.price);
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(L.padL, ys); ctx.lineTo(xr, ys);
      ctx.strokeStyle = 'rgba(245,158,11,.5)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.setLineDash([]);
      tags.push({ y: ys, text: '지지 ' + pxs(s.price), c: '#FDE68A', bg: 'rgba(52,32,4,.92)' });
    });

    /* 5) 피보나치 클러스터 — 겹침이 많은 구간만 반투명 밴드로 */
    if (state.ewShow.clu !== false && e.confluence && e.confluence.length) {
      e.confluence.slice(0, 2).forEach(function (c) {
        if (c.count < 3) return;
        var yc0 = Y(c.lo), yc1 = Y(c.hi);
        if (Math.max(yc0, yc1) < L.price.y || Math.min(yc0, yc1) > L.price.y + L.price.h) return;
        ctx.fillStyle = 'rgba(196,181,253,.075)';
        ctx.fillRect(L.padL, Math.min(yc0, yc1) - 1, L.plotW, Math.max(Math.abs(yc1 - yc0), 2) + 2);
        ctx.setLineDash([1, 3]);
        ctx.strokeStyle = 'rgba(196,181,253,.38)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(L.padL, (yc0 + yc1) / 2); ctx.lineTo(xr, (yc0 + yc1) / 2); ctx.stroke();
        ctx.setLineDash([]);
        tags.push({ y: (yc0 + yc1) / 2, text: '클러스터 ' + c.count + '중 ' + pxs(c.price), c: '#E9D5FF', bg: 'rgba(46,26,71,.92)' });
      });
    }

    /* 태그가 서로 겹치면 아래로 밀어 배치 */
    tags.sort(function (b1, b2) { return b1.y - b2.y; });
    var lastY = -1e9;
    tags.forEach(function (t) {
      var ty = Math.max(t.y, lastY + 17);
      if (ty < L.price.y + 8 || ty > L.price.y + L.price.h - 8) return;
      self.pillTag(ctx, xr - 4, ty, t.text, t.c, t.bg, 'right');
      lastY = ty;
    });
    ctx.restore();
  };

  /* ---------------- 사용자 작도 ---------------- */
  Chart.prototype.drawUser = function (ctx, a, L, Y, i0, i1) {
    var self = this;
    drawList(a.sym).forEach(function (d) { self.drawItem(ctx, d, L, Y, false); });
    if (drawState.anchor && drawState.preview) {
      var an = drawState.anchor, pv = drawState.preview;
      var x0 = self.x(an.i), y0 = Y(an.p), x1 = self.x(pv.i), y1 = Y(pv.p);
      var col = state.tool === 'fib' ? '#A78BFA' : (state.tool === 'rect' ? '#38BDF8' : '#34D399');
      ctx.save();
      ctx.setLineDash([4, 4]);
      if (state.tool === 'rect') {
        ctx.strokeStyle = 'rgba(56,189,248,.7)'; ctx.lineWidth = 1;
        ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        ctx.fillStyle = 'rgba(56,189,248,.07)';
        ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      } else if (state.tool === 'fib') {
        [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(function (lv) {
          var yy = Y(an.p + (pv.p - an.p) * lv);
          ctx.strokeStyle = lv === 0.5 ? 'rgba(196,181,253,.8)' : 'rgba(167,139,250,.45)';
          ctx.beginPath(); ctx.moveTo(Math.min(x0, x1), yy); ctx.lineTo(L.padL + L.plotW, yy); ctx.stroke();
        });
      } else {
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(x0, y0, 3, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      self.pillTag(ctx, x1, y1 - 14, pxs(pv.p), '#CBD5E1', 'rgba(13,17,25,.9)', 'center');
      ctx.restore();
    }
  };

  Chart.prototype.drawItem = function (ctx, d, L, Y, preview) {
    var self = this;
    var xr = L.padL + L.plotW;
    var Pt = function (k) { return { x: self.x(d.pts[k].i), y: Y(d.pts[k].p) }; };
    ctx.save();
    if (d.type === 'trend') {
      var a0 = Pt(0), a1 = Pt(1);
      var col = d.pts[1].p >= d.pts[0].p ? '#34D399' : '#FB7185';
      ctx.setLineDash(preview ? [4, 3] : []);
      ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y);
      ctx.strokeStyle = 'rgba(11,14,20,.7)'; ctx.lineWidth = 3.6; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y);
      ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.setLineDash([]);
      [a0, a1].forEach(function (q) {
        ctx.beginPath(); ctx.arc(q.x, q.y, 2.6, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      });
      var chg = d.pts[0].p ? (d.pts[1].p / d.pts[0].p - 1) * 100 : 0;
      self.pillTag(ctx, (a0.x + a1.x) / 2, Math.min(a0.y, a1.y) - 12,
        pxs(d.pts[0].p) + ' → ' + pxs(d.pts[1].p) + ' (' + (chg > 0 ? '+' : '') + chg.toFixed(1) + '%)',
        '#CBD5E1', 'rgba(13,17,25,.9)', 'center');
    } else if (d.type === 'hline') {
      var y = Y(d.p);
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(L.padL, y); ctx.lineTo(xr, y);
      ctx.strokeStyle = 'rgba(11,14,20,.6)'; ctx.lineWidth = 3.2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L.padL, y); ctx.lineTo(xr, y);
      ctx.strokeStyle = '#FBBF24'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.setLineDash([]);
      self.pillTag(ctx, xr - 4, y - 11, pxs(d.p), '#FDE68A', 'rgba(52,32,4,.94)', 'right');
    } else if (d.type === 'fib') {
      var p1 = d.pts[0].p, p2 = d.pts[1].p;
      var x1 = Pt(0).x, x2 = Pt(1).x;
      var xa = Math.min(x1, x2), xb = Math.max(x1, x2);
      var LV = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      for (var f = 0; f < LV.length - 1; f++) {
        var ya = Y(p1 + (p2 - p1) * LV[f]), yb = Y(p1 + (p2 - p1) * LV[f + 1]);
        ctx.fillStyle = f % 2 === 0 ? 'rgba(167,139,250,.045)' : 'rgba(167,139,250,.08)';
        ctx.fillRect(xa, Math.min(ya, yb), Math.max(xb - xa, 1), Math.abs(yb - ya));
      }
      var prevY = -1e9;
      LV.forEach(function (lv) {
        var v = p1 + (p2 - p1) * lv, yy = Y(v);
        ctx.setLineDash(lv === 0 || lv === 1 ? [] : [4, 3]);
        ctx.beginPath(); ctx.moveTo(L.padL, yy); ctx.lineTo(xr, yy);
        ctx.strokeStyle = lv === 0.5 ? 'rgba(196,181,253,.85)' : 'rgba(167,139,250,.5)';
        ctx.lineWidth = lv === 0.5 ? 1.3 : 1; ctx.stroke();
        ctx.setLineDash([]);
        if (Math.abs(yy - prevY) >= 11) {
          self.pillTag(ctx, xr - 4, yy - 8, (lv * 100).toFixed(1) + '%  ' + pxs(v), '#E9D5FF', 'rgba(46,26,71,.92)', 'right');
          prevY = yy;
        }
      });
    } else if (d.type === 'rect') {
      var q0 = Pt(0), q1 = Pt(1);
      var rx = Math.min(q0.x, q1.x), ry = Math.min(q0.y, q1.y);
      var rw = Math.abs(q1.x - q0.x), rh = Math.abs(q1.y - q0.y);
      ctx.fillStyle = 'rgba(56,189,248,.09)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.setLineDash([4, 3]); ctx.strokeStyle = 'rgba(56,189,248,.55)'; ctx.lineWidth = 1;
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
      self.pillTag(ctx, rx + rw / 2, ry - 10, pxs(d.pts[0].p) + '~' + pxs(d.pts[1].p), '#BAE6FD', 'rgba(8,40,62,.92)', 'center');
    }
    ctx.restore();
  };

  /* ---------------- 작도 인터랙션 ---------------- */
  function chartPoint(cv, e) {
    var r = cv.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    var i = chart.idxAt(x);
    var p = chart.priceAt(y);
    if (i == null || p == null) return null;
    return { x: x, y: y, i: i, p: p };
  }
  function drawDown(e) {
    var pt = chartPoint(chart.cv, e);
    if (!pt) return;
    if (state.tool === 'hline') {
      addDrawing({ type: 'hline', p: pt.p });
      return;
    }
    if (drawState.anchor) {
      commitDraw(drawState.anchor, pt);
      return;
    }
    drawState.anchor = pt;
    drawState.preview = { i: pt.i, p: pt.p };
    drawState.moved = false;
    drawState.downXY = { x: pt.x, y: pt.y };
    chart.draw();
  }
  function drawMove(e) {
    if (!drawState.anchor) return;
    var pt = chartPoint(chart.cv, e);
    if (!pt) return;
    drawState.preview = { i: pt.i, p: pt.p };
    if (Math.abs(pt.x - drawState.downXY.x) > 4 || Math.abs(pt.y - drawState.downXY.y) > 4) drawState.moved = true;
    chart.draw();
  }
  function drawUp(e) {
    if (!drawState.anchor) return;
    if (!drawState.moved) return;   /* 클릭만 했다면 두 번째 점을 기다린다 */
    var pt = chartPoint(chart.cv, e);
    if (!pt) return;
    commitDraw(drawState.anchor, pt);
  }
  function commitDraw(a, b) {
    var type = state.tool;
    if (type !== 'trend' && type !== 'fib' && type !== 'rect') { drawState.anchor = null; drawState.preview = null; chart.draw(); return; }
    if (a.i === b.i && Math.abs(a.p - b.p) < Math.max(a.p, 1) * 1e-6) {
      drawState.anchor = null; drawState.preview = null; chart.draw(); return;
    }
    addDrawing({ type: type, pts: [{ i: a.i, p: a.p }, { i: b.i, p: b.p }] });
    drawState.anchor = null; drawState.preview = null;
  }
  function addDrawing(d) {
    var list = drawList(state.cur);
    d.id = 'd' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
    list.push(d);
    if (list.length > 200) list.splice(0, list.length - 200);
    drawSave();
    drawCount();
    chart.draw();
    toastDraw(d.type === 'hline' ? '수평선을 추가했습니다' : d.type === 'fib' ? '피보나치 되돌림을 추가했습니다' : d.type === 'rect' ? '구간을 표시했습니다' : '추세선을 추가했습니다');
  }
  var drawToastT = null;
  function toastDraw(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(drawToastT);
    drawToastT = setTimeout(function () { el.classList.remove('on'); }, 1400);
  }
  function setTool(t) {
    state.tool = t;
    drawState.anchor = null; drawState.preview = null; drawState.moved = false;
    $$('#drawTools button').forEach(function (b) { b.classList.toggle('on', b.dataset.tool === t); });
    var wrap = $('.chart-wrap');
    if (wrap) wrap.classList.toggle('drawing', t !== 'cursor');
    if (chart) { chart.cv.style.cursor = t === 'cursor' ? 'crosshair' : 'crosshair'; chart.draw(); }
    if (t !== 'cursor') {
      var tip = { trend: '두 점을 클릭하거나 드래그해 추세선을 긋습니다', hline: '클릭한 가격에 수평선을 긋습니다', fib: '고점 → 저점 순서로 두 점을 찍습니다', rect: '강조할 구간의 두 모서리를 찍습니다' }[t];
      toastDraw(tip + ' · Esc 취소');
    }
  }
  function wireDraw() {
    var bar = $('#drawTools');
    if (!bar) return;
    bar.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      setTool(b.dataset.tool);
    };
    $('#drawUndo').onclick = function () {
      var list = drawList(state.cur);
      if (!list.length) return toastDraw(state.cur + '에 그린 작도가 없습니다');
      list.pop(); drawSave(); drawCount(); chart.draw();
      toastDraw('마지막 작도를 취소했습니다');
    };
    var armed = false, armT = null;
    $('#drawClear').onclick = function () {
      var list = drawList(state.cur);
      if (!list.length) return toastDraw(state.cur + '에 그린 작도가 없습니다');
      if (!armed) {
        armed = true;
        this.classList.add('arm');
        toastDraw('한 번 더 누르면 ' + state.cur + '의 작도 ' + list.length + '개가 모두 삭제됩니다');
        clearTimeout(armT);
        armT = setTimeout(function () { armed = false; var b = $('#drawClear'); if (b) b.classList.remove('arm'); }, 4000);
        return;
      }
      armed = false;
      this.classList.remove('arm');
      drawStore[state.cur] = [];
      drawSave(); drawCount(); chart.draw();
      toastDraw('작도를 모두 지웠습니다');
    };
  }

  /* ============================================================
     가상투자 (Paper Trading) — localStorage 영구 저장
     ============================================================ */
  var PT_KEY = 'apex.paper.v1';
  var paper = { seed: 10000, fills: [], sim: null, simDate: null };
  var ptSide = 'buy';
  var ptPending = null, ptTimer = null;

  function round4(v) { return Math.round(v * 10000) / 10000; }
  function qty2(v) { return (Math.round(v * 10000) / 10000).toLocaleString('en-US', { maximumFractionDigits: 4 }); }
  function sgn(v) { return (v > 0 ? '+' : (v < 0 ? '\u2212' : '')) + usd(Math.abs(v), 2); }
  function weekday(d) {
    var dt = new Date(d + 'T12:00:00');
    return ['\uC77C', '\uC6D4', '\uD654', '\uC218', '\uBAA9', '\uAE08', '\uD1A0'][dt.getDay()] + '\uC694\uC77C';
  }

  function ptLoad() {
    try {
      var raw = localStorage.getItem(PT_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return;
      if (typeof o.seed === 'number' && o.seed > 0) paper.seed = o.seed;
      paper.fills = Array.isArray(o.fills) ? o.fills.filter(function (f) { return f && f.t && f.d && f.side && f.qty > 0; }) : [];
      paper.sim = (typeof o.sim === 'number' && isFinite(o.sim)) ? o.sim : null;
      paper.simDate = (typeof o.simDate === 'string' && o.simDate) ? o.simDate : null;
    } catch (e) { /* 저장소 차단된 환경에서는 메모리 상태로만 동작 */ }
  }
  function ptSave() {
    try { localStorage.setItem(PT_KEY, JSON.stringify(paper)); } catch (e) {}
  }

  function ptPx(t) { var a = A[t]; return a ? a.close[idxOf(a)] : null; }

  /* 기준일까지의 체결만 반영한 계좌 (리플레이 일관성) */
  function ptAsOf() {
    var dmax = M.dates[state.simIdx];
    var cash = paper.seed, realized = 0, hold = {}, n = 0;
    var fs = paper.fills.slice().sort(function (a, b) { return a.d < b.d ? -1 : (a.d > b.d ? 1 : 0); });
    fs.forEach(function (f) {
      if (f.d > dmax) return;
      n++;
      var amt = f.qty * f.px, fee = f.fee || 0;
      if (f.side === 'buy') {
        var h = hold[f.t] || { sh: 0, cost: 0 };
        var ns = h.sh + f.qty;
        hold[f.t] = { sh: ns, cost: (h.sh * h.cost + amt) / ns };
        cash -= amt + fee;
      } else {
        var h2 = hold[f.t];
        if (!h2) return;
        cash += amt - fee;
        realized += (f.px - h2.cost) * f.qty - fee;
        h2.sh -= f.qty;
        if (h2.sh <= 1e-9) delete hold[f.t];
      }
    });
    return { cash: cash, holdings: hold, realized: realized, n: n };
  }

  function ptStats() {
    var cur = ptAsOf();
    var mv = 0, cost = 0, rows = [];
    Object.keys(cur.holdings).forEach(function (t) {
      var h = cur.holdings[t];
      if (!h || !(h.sh > 1e-9)) return;
      var px = ptPx(t);
      if (px == null) px = h.cost;
      mv += h.sh * px; cost += h.sh * h.cost;
      rows.push({ t: t, sh: h.sh, cost: h.cost, px: px, val: h.sh * px,
        pnl: h.sh * (px - h.cost), ret: h.cost ? px / h.cost - 1 : 0 });
    });
    rows.sort(function (a, b) { return b.val - a.val; });
    var total = cur.cash + mv;
    return { cash: cur.cash, realized: cur.realized, mv: mv, cost: cost, total: total,
      unreal: mv - cost, unrealPct: cost ? (mv - cost) / cost : 0,
      totalRet: paper.seed ? total / paper.seed - 1 : 0, rows: rows };
  }

  function ptMsg(txt, kind) {
    var el = $('#ptMsg');
    if (!el) return;
    el.textContent = txt || '';
    el.className = 'pt-msg' + (kind ? ' ' + kind : '');
  }

  function ptRender() {
    if (!$('#ptSum')) return;
    var last = lastIdx(), i = state.simIdx, replay = i < last;
    var st = ptStats();

    var badge = $('#ptBadge');
    badge.textContent = replay ? 'REPLAY' : 'LIVE DAY';
    badge.classList.toggle('replay', replay);

    $('#ptSum').innerHTML =
      cell('\uCD1D \uD3C9\uAC00\uC790\uC0B0', usd(st.total, 2), pct(st.totalRet, 2) + ' (\uC2DC\uB4DC \uB300\uBE44)', cls(st.totalRet)) +
      cell('\uBCF4\uC720 \uD604\uAE08', usd(st.cash, 2), '\uD3C9\uAC00\uAE08\uC561 ' + usd(st.mv, 2), '') +
      cell('\uD3C9\uAC00\uC190\uC775 (\uBBF8\uC2E4\uD604)', sgn(st.unreal), pct(st.unrealPct, 2), cls(st.unreal)) +
      cell('\uC2E4\uD604\uC190\uC775', sgn(st.realized), '\uAE30\uC900\uC77C\uAE4C\uC9C0 \uB9E4\uB3C4 \uAE30\uC900', cls(st.realized));

    $('#ptDate').textContent = M.dates[i] + ' (' + weekday(M.dates[i]) + ')';
    $('#ptDateSub').textContent = replay
      ? (i + 1) + ' / ' + (last + 1) + ' \uAC70\uB798\uC77C \u00B7 \uC774\uD6C4 ' + (last - i) + '\uAC70\uB798\uC77C\uC740 \uCC28\uD2B8\u00B7\uC7A5\uBD80\uC5D0\uC11C \uC228\uAE40'
      : '\uCD5C\uC2E0 \uAC70\uB798\uC77C \u00B7 \uC804\uCCB4 ' + (last + 1) + '\uAC70\uB798\uC77C';
    var sl = $('#ptSlider');
    sl.max = String(last);
    sl.value = String(i);

    $$('#ptAcct [data-seed]').forEach(function (b) {
      b.classList.toggle('on', Number(b.dataset.seed) === paper.seed);
    });

    var a = A[state.cur];
    if (a) {
      var ii = idxOf(a), px = a.close[ii];
      $('#ptTicker').textContent = state.cur;
      $('#ptTickerPx').textContent = usd(px) + ' \u00B7 ' + a.dates[ii] + ' \uC885\uAC00';
    }
    ptEstimate();
    ptRenderHoldings(st);
    ptRenderFills();
  }
  function cell(k, v, s, c) {
    return '<div class="c"><div class="k">' + k + '</div><div class="v ' + (c || '') + '">' + v +
      '</div><div class="s">' + s + '</div></div>';
  }

  function ptEstimate() {
    var el = $('#ptEst');
    if (!el) return;
    var a = A[state.cur];
    if (!a) { el.textContent = '\u2014'; return; }
    var px = a.close[idxOf(a)];
    var qty = Number($('#ptQty').value) || 0;
    var feeOn = $('#ptFee').checked;
    var amt = qty * px, fee = feeOn ? amt * 0.0003 : 0;
    var st = ptStats();
    var h = st.rows.filter(function (r) { return r.t === state.cur; })[0] || { sh: 0, cost: 0 };
    var settle = ptSide === 'buy' ? amt + fee : amt - fee;
    el.innerHTML =
      '\uC8FC\uBB38\uAE08\uC561 <b>' + usd(amt) + '</b>' + (feeOn ? ' \u00B7 \uC218\uC218\uB8CC <b>' + usd(fee) + '</b>' : '') +
      '<br>' + (ptSide === 'buy' ? '\uCD1D \uCD9C\uAE08' : '\uC785\uAE08 \uC608\uC0C1') + ' <b>' + usd(settle) + '</b> \u00B7 \uD604\uAE08 <b>' + usd(st.cash) + '</b>' +
      '<br>' + state.cur + ' \uBCF4\uC720 <b>' + qty2(h.sh) + '\uC8FC</b>' + (h.sh > 0 ? ' \u00B7 \uD3C9\uB2E8 <b>' + usd(h.cost) + '</b>' : '');
  }

  function ptRenderHoldings(st) {
    st = st || ptStats();
    $('#ptHoldCount').textContent = st.rows.length;
    if (!st.rows.length) {
      $('#ptHoldings').innerHTML = '<div class="pt-empty">\uC544\uC9C1 \uBCF4\uC720 \uC885\uBAA9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC8FC\uBB38 \uD328\uB110\uC5D0\uC11C \uB9E4\uC218\uD574 \uBCF4\uC138\uC694.</div>';
      return;
    }
    $('#ptHoldings').innerHTML = st.rows.map(function (r) {
      return '<div class="pt-hrow">' +
        '<div class="tk">' + r.t + '<i>' + qty2(r.sh) + '\uC8FC</i></div>' +
        '<div class="vv"><b>' + usd(r.val) + '</b><span>\uD3C9\uB2E8 ' + usd(r.cost) + ' \u00B7 \uD604\uC7AC ' + usd(r.px) + '</span></div>' +
        '<div class="rp ' + cls(r.pnl) + '">' + pct(r.ret, 2) + '<i>' + sgn(r.pnl) + '</i></div>' +
        '<div class="ac"><button data-sell="' + r.t + '">\uC804\uB7C9\uB9E4\uB3C4</button><button data-chart="' + r.t + '">\uCC28\uD2B8</button></div>' +
        '</div>';
    }).join('');
  }
  function ptRenderFills() {
    var dmax = M.dates[state.simIdx];
    var shown = paper.fills.filter(function (f) { return f.d <= dmax; });
    $('#ptFillCount').textContent = shown.length;
    var rows = shown.slice().reverse().slice(0, 60);
    if (!rows.length) {
      $('#ptFills').innerHTML = '<div class="pt-empty">\uCCB4\uACB0 \uB0B4\uC5ED\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</div>';
      return;
    }
    $('#ptFills').innerHTML = rows.map(function (f) {
      return '<div class="pt-frow">' +
        '<span class="d">' + f.d.slice(2) + '</span>' +
        '<b class="tk">' + f.t + '</b>' +
        '<span class="side ' + f.side + '">' + (f.side === 'buy' ? '\uB9E4\uC218' : '\uB9E4\uB3C4') + '</span>' +
        '<span class="q">' + qty2(f.qty) + '</span>' +
        '<span class="p">' + usd(f.px) + '</span>' +
        '<span class="r ' + cls(f.side === 'sell' ? f.realized : 0) + '">' + (f.side === 'sell' ? sgn(f.realized) : '\u2014') + '</span>' +
        '</div>';
    }).join('');
  }

  function ptExecute(t, side, qty, feeOn) {
    var a = A[t];
    if (!a) return ptMsg('\uC885\uBAA9 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4', 'err');
    qty = Number(qty);
    if (!(qty > 0)) return ptMsg('\uC218\uB7C9\uC744 \uC785\uB825\uD558\uC138\uC694', 'err');
    var i = idxOf(a), px = a.close[i], d = a.dates[i];
    var amt = qty * px, fee = feeOn ? amt * 0.0003 : 0;
    var st = ptAsOf();
    var h = st.holdings[t] || { sh: 0, cost: 0 };
    if (side === 'buy') {
      if (amt + fee > st.cash + 1e-6) return ptMsg('\uD604\uAE08\uC774 \uBD80\uC871\uD569\uB2C8\uB2E4 (\uBCF4\uC720 ' + usd(st.cash) + ')', 'err');
      paper.fills.push({ d: d, t: t, side: 'buy', qty: round4(qty), px: px, fee: fee, realized: 0 });
      ptMsg('\uB9E4\uC218 \uCCB4\uACB0 \u00B7 ' + t + ' ' + qty2(qty) + '\uC8FC @ ' + usd(px) + ' (' + d + ')', 'ok');
    } else {
      if (qty > h.sh + 1e-6) return ptMsg('\uBCF4\uC720 \uC218\uB7C9\uC774 \uBD80\uC871\uD569\uB2C8\uB2E4 (' + qty2(h.sh) + '\uC8FC)', 'err');
      var rz = (px - h.cost) * qty - fee;
      paper.fills.push({ d: d, t: t, side: 'sell', qty: round4(qty), px: px, fee: fee, realized: rz });
      ptMsg('\uB9E4\uB3C4 \uCCB4\uACB0 \u00B7 ' + t + ' ' + qty2(qty) + '\uC8FC @ ' + usd(px) + ' \u00B7 \uC2E4\uD604 ' + sgn(rz), 'ok');
    }
    ptSave();
    ptRender();
    if (chart && chart.a) chart.draw();
  }

  function ptReset(amount) {
    amount = Number(amount);
    if (!(amount > 0)) return ptMsg('\uC2DC\uB4DC \uAE08\uC561\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694', 'err');
    paper.seed = amount;
    paper.fills = [];
    ptSave();
    ptRender();
    if (chart && chart.a) chart.draw();
    ptMsg('\uACC4\uC88C\uB97C ' + usd(amount, 0) + ' \uC2DC\uB4DC\uB85C \uCD08\uAE30\uD654\uD588\uC2B5\uB2C8\uB2E4', 'ok');
  }
  /* 두 번 눌러 확인 (다이얼로그 없이 실수 방지) */
  function ptArm(kind, val, label) {
    if (ptPending && ptPending.kind === kind && ptPending.val === val) {
      ptPending = null; clearTimeout(ptTimer); return true;
    }
    ptPending = { kind: kind, val: val };
    clearTimeout(ptTimer);
    ptTimer = setTimeout(function () { ptPending = null; }, 4000);
    ptMsg(label + ' \u2014 \uD55C \uBC88 \uB354 \uB204\uB974\uBA74 \uC2E4\uD589\uB429\uB2C8\uB2E4', '');
    return false;
  }

  function setSim(idx) {
    var last = lastIdx();
    idx = Math.max(0, Math.min(last, Math.round(idx)));
    if (idx === state.simIdx) { ptRender(); return; }
    state.simIdx = idx;
    paper.sim = idx >= last ? null : idx;
    /* 날짜로도 저장 — data.js 는 매일 앞쪽이 잘려 봉 인덱스가 하루씩 밀린다 */
    paper.simDate = idx >= last ? null : M.dates[idx];
    ptSave();
    viewCache.clear();
    ptMsg('');
    renderScanner();
    renderFavs();
    select(state.cur, true);
  }

  function wirePaper() {
    $('#ptTabs').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      ptSide = b.dataset.side;
      $$('#ptTabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
      var sub = $('#ptSubmit');
      sub.className = 'pt-submit ' + ptSide;
      sub.textContent = ptSide === 'buy' ? '\uB9E4\uC218 \uC8FC\uBB38' : '\uB9E4\uB3C4 \uC8FC\uBB38';
      ptMsg('');
      ptEstimate();
    };
    $('#ptAllocs').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var pct0 = Number(b.dataset.pct);
      var a = A[state.cur]; if (!a) return;
      var px = a.close[idxOf(a)];
      var feeRate = $('#ptFee').checked ? 0.0003 : 0;
      var st = ptStats();
      var q;
      if (ptSide === 'buy') q = st.cash * pct0 / (px * (1 + feeRate));
      else {
        var hh = st.rows.filter(function (r) { return r.t === state.cur; })[0];
        q = (hh ? hh.sh : 0) * pct0;
      }
      $('#ptQty').value = String(Math.floor(q * 10000) / 10000);
      ptEstimate();
    };
    $('#ptQty').oninput = ptEstimate;
    $('#ptFee').onchange = ptEstimate;
    $$('.pt-stepper button').forEach(function (b) {
      b.onclick = function () {
        var v = Number($('#ptQty').value) || 0;
        v = Math.max(0, v + Number(b.dataset.step));
        $('#ptQty').value = String(round4(v));
        ptEstimate();
      };
    });
    $('#ptSubmit').onclick = function () {
      ptExecute(state.cur, ptSide, $('#ptQty').value, $('#ptFee').checked);
    };
    $('#ptPresets').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var last = lastIdx(), go = b.dataset.go;
      if (go === 'last') setSim(last);
      else if (go === '1' || go === '5' || go === '-1') setSim(state.simIdx + Number(go));
      else setSim(last + Number(go));
    };
    $('#ptSlider').onchange = function () { setSim(Number(this.value)); };
    $('#ptAcct').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.id === 'ptReset') {
        if (ptArm('reset', 0, '\uACC4\uC88C \uCD08\uAE30\uD654')) ptReset(paper.seed);
        return;
      }
      if (b.id === 'ptSeedApply') {
        var v = Math.round(Number($('#ptSeedInput').value));
        if (!(v >= 100)) return ptMsg('\uC2DC\uB4DC\uB294 $100 \uC774\uC0C1\uC73C\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694', 'err');
        if (ptArm('custom', v, usd(v, 0) + ' \uC2DC\uB4DC\uB85C \uC0C8 \uACC4\uC88C')) ptReset(v);
        return;
      }
      if (b.dataset.seed) {
        var amt = Number(b.dataset.seed);
        if (ptArm('seed', amt, usd(amt, 0) + ' \uC2DC\uB4DC\uB85C \uC0C8 \uACC4\uC88C')) ptReset(amt);
      }
    };
    $('#ptHoldings').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.chart) { select(b.dataset.chart); return; }
      if (b.dataset.sell) {
        var t = b.dataset.sell, h = ptAsOf().holdings[t];
        if (!h) return;
        if (state.cur !== t) select(t);
        ptExecute(t, 'sell', h.sh, $('#ptFee').checked);
      }
    };
  }

  /* ---------------- search ---------------- */
  function searchResults(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var out = M.tickers.map(function (x) {
      var score = 0;
      if (x.t.toLowerCase() === q) score = 100;
      else if (x.t.toLowerCase().indexOf(q) === 0) score = 90;
      else if (x.nk.toLowerCase().indexOf(q) === 0) score = 80;
      else if (x.n.toLowerCase().indexOf(q) === 0) score = 70;
      else if ((x.t + ' ' + x.n + ' ' + x.nk + ' ' + (x.sk || '')).toLowerCase().indexOf(q) >= 0) score = 40;
      return { x: x, s: score };
    }).filter(function (r) { return r.s > 0; });
    out.sort(function (a, b) { return b.s - a.s || (a.x.r || 999) - (b.x.r || 999); });
    return out.slice(0, 8).map(function (r) { return r.x; });
  }
  var spIndex = -1, spItems = [];
  function renderSearchPop(q) {
    var pop = $('#searchPop'), items = searchResults(q);
    spItems = items; spIndex = -1;
    if (!items.length) { pop.classList.remove('on'); return; }
    pop.innerHTML = items.map(function (x) {
      var a = A[x.t];
      return '<div class="hit" data-t="' + x.t + '"><b>' + x.t + '</b><span>' + x.nk + ' · ' + x.n + '</span>' +
        '<span class="chip ' + signalCls(a.label.key) + '">' + a.label.ko + '</span></div>';
    }).join('');
    pop.classList.add('on');
    $$('.hit', pop).forEach(function (h) {
      h.onclick = function () { pickSearch(h.dataset.t); };
    });
  }
  function pickSearch(t) {
    $('#searchPop').classList.remove('on');
    $('#globalSearch').value = '';
    select(t);
    $('#searchPop').classList.remove('on');
  }

  /* ---------------- drawer ---------------- */
  function openDrawer() { $('#sidebar').classList.add('open'); $('#backdrop').classList.add('on'); }
  function closeDrawer() { $('#sidebar').classList.remove('open'); $('#backdrop').classList.remove('on'); }

  /* ---------------- wire ---------------- */
  var chart;
  function wire() {
    chart = new Chart($('#chart'), $('#hud'));
    buildMaLegend();
    buildScoreExplain();
    wirePaper();
    wireDraw();
    setTool('cursor');
    drawCount();

    /* ---- 전략 전환 탭 (추세형 ↔ 스윙형) ---- */
    var stratSeg = $('#stratSeg');
    if (stratSeg) stratSeg.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      setStrategy(b.getAttribute('data-m'));
    };

    /* ---- 관심종목 추가·삭제 바인딩 ---- */
    var heroFav = $('#heroFav');
    if (heroFav) heroFav.onclick = function () { watchToggle(state.cur); };
    var favAdd = $('#favAdd');
    if (favAdd) favAdd.onclick = function (e) {
      e.stopPropagation();
      var pop = $('#favPop'); if (!pop) return;
      if (pop.classList.contains('on')) { pop.classList.remove('on'); return; }
      var fs = $('#favSearch'); if (fs) fs.value = '';
      renderFavPop();
      pop.classList.add('on');
      if (fs) fs.focus();
    };
    var favSearch = $('#favSearch');
    if (favSearch) favSearch.oninput = function () { renderFavPop(); };
    if (favSearch) favSearch.onkeydown = function (e) {
      if (e.key === 'Escape') { var p = $('#favPop'); if (p) p.classList.remove('on'); this.blur(); }
      if (e.key === 'Enter') { var f0 = $('#favList .fp-row'); if (f0 && f0.dataset.t) watchToggle(f0.dataset.t); }
    };
    var favReset = $('#favReset');
    if (favReset) favReset.onclick = function (e) {
      e.stopPropagation();
      state.watch = WATCH_DEFAULT.slice();
      watchPersist();
      watchRefresh();
    };

    var swEl = $('#ewSwitch');
    if (swEl) swEl.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.ewMode = Number(b.dataset.i) || 0;
      renderElliott(chart.a);
      chart.draw();
    };
    var chEl = $('#ewChips');
    if (chEl) chEl.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var kk = b.dataset.k;
      state.ewShow[kk] = state.ewShow[kk] === false;
      b.classList.toggle('on', state.ewShow[kk] !== false);
      chart.draw();
    };
    $('#filterTabs').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $$('#filterTabs button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      state.filter = b.dataset.f;
      renderScanner();
    };
    $('#sortSel').onchange = function () { state.sort = this.value; renderScanner(); };
    $('#listSearch').oninput = function () { state.listQ = this.value; renderScanner(); };
    $('#tf').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $$('#tf button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      state.range = parseInt(b.dataset.n, 10);
      chart.setRange(state.range);
    };
    $('#toggles').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var k = b.dataset.t;
      state.show[k] = !state.show[k];
      b.classList.toggle('on', state.show[k]);
      chart.resize(); chart.draw();
    };
    var gs = $('#globalSearch');
    gs.oninput = function () { renderSearchPop(this.value); };
    gs.onfocus = function () { if (this.value) renderSearchPop(this.value); };
    gs.onkeydown = function (e) {
      var pop = $('#searchPop');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!spItems.length) return;
        spIndex = (spIndex + (e.key === 'ArrowDown' ? 1 : -1) + spItems.length) % spItems.length;
        $$('.hit', pop).forEach(function (h, i) { h.classList.toggle('act', i === spIndex); });
      } else if (e.key === 'Enter') {
        if (spItems.length) pickSearch((spItems[spIndex >= 0 ? spIndex : 0]).t);
      } else if (e.key === 'Escape') { pop.classList.remove('on'); this.blur(); }
    };
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.search')) $('#searchPop').classList.remove('on');
      if (!e.target.closest('.fav-wrap')) { var fp = $('#favPop'); if (fp) fp.classList.remove('on'); }
    });
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); gs.focus(); gs.select();
      }
      if (e.key === 'Escape') {
        closeDrawer(); $('#searchPop').classList.remove('on');
        var fpop = $('#favPop'); if (fpop) fpop.classList.remove('on');
        if (drawState.anchor) { drawState.anchor = null; drawState.preview = null; if (chart) chart.draw(); }
      }
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') { chart.slide(chart.i0 + 10, chart.i1 + 10); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { chart.slide(chart.i0 - 10, chart.i1 - 10); e.preventDefault(); }
      if (e.key === '+' || e.key === '=') chart.zoom(0.85, chart.i1);
      if (e.key === '-') chart.zoom(1.15, chart.i1);
    });
    $('#menuBtn').onclick = openDrawer;
    $('#closeSide').onclick = closeDrawer;
    $('#backdrop').onclick = closeDrawer;
    var rt = null;
    window.addEventListener('resize', function () {
      if (chart.a) { chart.resize(); chart.draw(); }
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (chart.a) { chart.resize(); chart.draw(); }
      }, 120);
      rt = setTimeout(function () {
        if (!state.cur || !A[state.cur]) return;
        var v = stratView(viewOf(state.cur));
        renderKpis(v); renderEquity(v); renderTrades(v); renderRecent(v);
      }, 160);
    });
  }

  /* ============================================================
     큰 카드 접기/펼치기 (아코디언) — 상태는 localStorage 에 기억
     ============================================================ */
  var ACC_KEY = 'apex.collapse.v1';
  var ACC_CARDS = [
    ['fundCard', '기업 펀더멘털'],
    ['seCard', '종합 기술점수 산출 근거'],
    ['ewCard', '엘리어트 파동 분석'],
    ['paperCard', '가상투자 · 모의매매'],
    ['logCard', '트레이드 로그']
  ];
  var accState = {};
  var accReduced = false;
  try { accReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

  function accLoad() {
    accState = {};
    try {
      var o = JSON.parse(localStorage.getItem(ACC_KEY) || '{}');
      if (o && typeof o === 'object' && !Array.isArray(o)) accState = o;
    } catch (e) { accState = {}; }
  }
  function accSave() {
    try { localStorage.setItem(ACC_KEY, JSON.stringify(accState)); } catch (e) {}
  }
  function kidByClass(el, cls) {
    var kids = el ? el.children : [];
    for (var i = 0; i < kids.length; i++) if (kids[i].classList.contains(cls)) return kids[i];
    return null;
  }
  /* 접힘/펼침 적용 — animate 면 높이 트랜지션, 아니면 즉시(새로고침 복원용) */
  function accSet(card, closed, animate) {
    var body = kidByClass(card, 'acc-body');
    if (!body) return;
    var btn = kidByClass(card, 'acc-head') ? card.querySelector('.acc-btn') : null;
    card.classList.toggle('acc-closed', !!closed);
    if (btn) {
      btn.setAttribute('aria-expanded', closed ? 'false' : 'true');
      var tx = btn.querySelector('.acc-tx');
      if (tx) tx.textContent = closed ? '펼치기' : '접기';
      btn.setAttribute('aria-label', (btn.getAttribute('data-name') || '카드') + (closed ? ' 펼치기' : ' 접기'));
    }
    if (!animate || accReduced) {
      body.style.height = '';
      body.style.display = closed ? 'none' : '';
      return;
    }
    if (closed) {
      body.style.display = '';
      body.style.height = body.scrollHeight + 'px';
      void body.offsetHeight;                    /* 리플로우 — 0px 로 줄어드는 애니메이션 시작점 */
      body.style.height = '0px';
      setTimeout(function () {
        if (card.classList.contains('acc-closed')) { body.style.display = 'none'; body.style.height = ''; }
      }, 300);
    } else {
      body.style.display = '';
      body.style.height = '0px';
      void body.offsetHeight;
      body.style.height = body.scrollHeight + 'px';
      setTimeout(function () {
        if (!card.classList.contains('acc-closed')) body.style.height = '';
      }, 300);
    }
  }
  function accToggle(id) {
    var card = document.getElementById(id);
    if (!card) return;
    var closed = !card.classList.contains('acc-closed');
    accState[id] = closed;
    accSave();
    accSet(card, closed, true);
  }
  /* 헤더 우측에 토글 버튼을 붙이고, 헤더 뒤 본문을 .acc-body 로 감싼다 */
  function accBuild() {
    accLoad();
    ACC_CARDS.forEach(function (c) {
      var id = c[0], name = c[1];
      var card = document.getElementById(id);
      if (!card || kidByClass(card, 'acc-body')) return;
      var head = kidByClass(card, 'fund-h') || kidByClass(card, 'panel-h');
      if (!head || head.children.length < 2) return;
      var kids = Array.prototype.slice.call(head.children);
      var wrap = document.createElement('div');
      wrap.className = 'acc-wrap';
      for (var i = 1; i < kids.length; i++) wrap.appendChild(kids[i]);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'acc-btn';
      btn.setAttribute('data-name', name);
      btn.innerHTML = '<span class="acc-tx">접기</span>' +
        '<svg class="acc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>';
      btn.addEventListener('click', function () { accToggle(id); });
      wrap.appendChild(btn);
      head.appendChild(wrap);
      head.classList.add('acc-head');
      var body = document.createElement('div');
      body.className = 'acc-body';
      var nodes = [];
      for (var n = head.nextSibling; n; n = n.nextSibling) nodes.push(n);
      nodes.forEach(function (nd) { body.appendChild(nd); });
      card.appendChild(body);
      accSet(card, !!accState[id], false);      /* 저장된 상태 복원 (기본은 펼침) */
    });
  }

  /* ---------------- go ---------------- */
  function start() {
    var h = (location.hash || '').replace('#', '');   /* boot()이 기본 종목을 고르기 전에 딥링크 보관 */
    accBuild();                                       /* 접힘 상태를 먼저 복원해 화면 깜빡임 방지 */
    wire();
    boot();
    if (h && A[h]) select(h);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
