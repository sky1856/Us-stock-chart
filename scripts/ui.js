/* ============================================================
   APEX QUANT — UI layer
   ============================================================ */
(function () {
  'use strict';
  var M = window.MARKET, QE = window.QE;

  /* ============================================================
     테마 — 다크(기본) / 화이트
     · 화면(HTML·CSS)은 html[data-theme="light"] 로 전환하고,
     · 캔버스는 그리는 코드를 건드리지 않고 색만 바꿔 준다(themeCanvas 아래 getter/setter 패치).
     ============================================================ */
  var THEME_KEY = 'apex.theme.v1';
  function isLightTheme() { return document.documentElement.getAttribute('data-theme') === 'light'; }
  /* 인라인으로 찍는 강조색(배지·점수·사유)을 테마에 맞춰 바꿔 준다 */
  var TONE = {
    '#34d399': '#0B7A57', '#10b981': '#0E8F68', '#6ee7b7': '#047857',
    '#fda4af': '#BE123C', '#fb7185': '#BE123C', '#f43f5e': '#B31340', '#ef4444': '#B91C1C',
    '#f59e0b': '#B45309', '#fbbf24': '#8A5A06', '#fcd34d': '#8A5A06', '#f97316': '#C2410C',
    '#38bdf8': '#0369A1', '#7dd3fc': '#075985', '#22c55e': '#15803D',
    '#c4b5fd': '#6D28D9', '#a78bfa': '#6D28D9', '#5eead4': '#0B7261', '#2dd4bf': '#0E7490',
    '#9ba6ba': '#64748B', '#6b7689': '#64748B', '#94a3b8': '#5A6779', '#84cc16': '#4D7C0F', '#3b82f6': '#1D4ED8', '#e2e8f0': '#0F172A', '#e6eaf2': '#0F172A'
  };
  function thColor(c) {
    if (!isLightTheme() || typeof c !== 'string') return c;
    return TONE[c.toLowerCase()] || c;
  }
  /* 다크에서 쓰던 캔버스 색 → 화이트에서 읽히는 색 */
  var CV_MAP = {
    '#0b0e14': '#FFFFFF', '#0d1119': '#F1F5F9', '#0e131c': '#F1F5F9', '#121722': '#FFFFFF',
    '#0f131c': '#FFFFFF', '#161c29': '#FFFFFF', '#1a2232': '#E2E8F0', '#1e2836': '#CBD5E1',
    '#6b7689': '#64748B', '#4a5468': '#8A97A8', '#5b6679': '#64748B', '#7a8698': '#64748B',
    '#9ba6ba': '#475569', '#e2e8f0': '#0F172A', '#e6eaf2': '#0F172A',
    /* 밝은 파스텔 글씨(라벨·수치) → 흰 배경에서 읽히는 짙은 색 */
    '#fecdd3': '#9F1239', '#a7f3d0': '#065F46', '#fde68a': '#8A5A06',
    '#bee9ff': '#0B4C6B', '#dcf6ff': '#0B4C6B', '#eaf9ff': '#0F172A', '#eaf6ff': '#0F172A',
    '#ccfbf1': '#0F5F52', '#bae6fd': '#0B4C6B', '#f0fdfa': '#0F172A', '#f8fafc': '#0F172A',
    '#ddd6fe': '#5B21B6', '#86efac': '#047857', '#c4b5fd': '#6D28D9', '#fcd34d': '#8A5A06',
    '#5eead4': '#0B7261', '#7dd3fc': '#075985', '#6ee7b7': '#047857', '#fda4af': '#BE123C'
  };
  function cvColor(v) {
    if (!isLightTheme() || typeof v !== 'string') return v;
    var k = v.trim().toLowerCase();
    if (CV_MAP[k]) return CV_MAP[k];
    var m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(k);
    if (!m) return v;
    var r = +m[1], g = +m[2], b = +m[3], a = m[4] == null ? 1 : +m[4];
    if (r > 235 && g > 235 && b > 235)            /* 흰 계열 그리드·크로스헤어 → 먹색 */
      return 'rgba(15,23,42,' + Math.min(1, a * 1.15).toFixed(3) + ')';
    if (r < 80 && g < 80 && b < 90)               /* 어두운 테두리·라벨 바탕 → 흰색 */
      return 'rgba(255,255,255,' + Math.min(1, a * 1.08).toFixed(3) + ')';
    return v;
  }
  /* 모든 캔버스 컨텍스트에 한 번만 적용 — fillStyle/strokeStyle 문자열만 변환한다 */
  (function themeCanvas() {
    var P = window.CanvasRenderingContext2D && window.CanvasRenderingContext2D.prototype;
    if (!P) return;
    ['fillStyle', 'strokeStyle'].forEach(function (prop) {
      var d = Object.getOwnPropertyDescriptor(P, prop);
      if (!d || !d.get || !d.set) return;
      Object.defineProperty(P, prop, {
        configurable: true, enumerable: d.enumerable,
        get: function () { return d.get.call(this); },
        set: function (v) { d.set.call(this, cvColor(v)); }
      });
    });
  })();
  function themeLabel(light) {
    var b = $('#themeBtn');
    if (!b) return;
    b.setAttribute('aria-pressed', light ? 'true' : 'false');
    /* 심볼·글자 = 지금 켜져 있는 테마, 툴팁·aria = 누르면 바뀔 테마 (2026-11-28 회장님 지시) */
    b.title = light ? '다크 모드로 전환' : '화이트 모드로 전환';
    b.setAttribute('aria-label', b.title);
    var ic = b.querySelector('.th-ic'), tx = b.querySelector('.th-tx');
    if (ic) ic.textContent = light ? '☀️' : '🌙';
    if (tx) tx.textContent = light ? '화이트' : '다크';
  }
  function applyTheme(light, persist) {
    var root = document.documentElement;
    if (light) root.setAttribute('data-theme', 'light'); else root.removeAttribute('data-theme');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', themeMetaColor());
    themeLabel(light);
    if (persist) { try { localStorage.setItem(THEME_KEY, light ? 'light' : 'dark'); } catch (e) {} }
    if (window.EDUFIG && EDUFIG.setTheme) EDUFIG.setTheme(light);
    /* 캔버스·SVG 다시 그리기 */
    if (typeof chart !== 'undefined' && chart && chart.draw) chart.draw();
    if (typeof renderMacro === 'function') renderMacro();
    eduRender();
    if (typeof buildScoreExplain === 'function') buildScoreExplain();
    if (fgLast) renderFearGreed(fgLast, fgLastLive);
    var cur = A[state.cur] ? stratView(viewOf(state.cur)) : null;   /* select() 와 같은 전략 뷰 — 테마를 바꿔도 선택한 전략(추세형/스윙형) 카드가 그대로 유지된다 */
    if (cur) {
      renderHero(cur); renderFund(cur); renderKpis(cur); renderEquity(cur);
      renderScoreExplain(cur); renderElliott(cur); renderRecent(cur); renderTrades(cur);
      renderBtPeriod(cur);
    }
  }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* 이동평균선 5·20·60·120·240일 (단순이동평균)
     핵심선(20일·240일)만 굵고 선명하게 두고, 5·60·120일은 핵심선보다 가늘게 유지하되
     눈으로 또렷하게 따라갈 수 있는 수준(1.25~1.3px / alpha 0.75~0.8)까지 올린다 */
  var MA = [
    { p: 5, label: '5일', color: '#38BDF8', w: 1.3, a: 0.8, heavy: false },
    { p: 20, label: '20일', color: '#FBBF24', w: 2.3, a: 1, heavy: true },
    { p: 60, label: '60일', color: '#34D399', w: 1.25, a: 0.76, heavy: false },
    { p: 120, label: '120일', color: '#A78BFA', w: 1.25, a: 0.75, heavy: false },
    { p: 240, label: '240일', color: '#F97316', w: 2.85, a: 1, heavy: true }   /* 장기 기준선 — 가장 굵게 */
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
  /* 첫 접속 기본 종목은 고정값이 아니라 '선택한 전략의 추천 1위' — boot()에서 정한다 (아래 topScoreT) */
  var autoPick = false;
  var state = {
    cur: '', range: 128, btRange: 128, filter: 'all', preset: '', sort: 'rec', q: '', listQ: '',
    show: { ma: true, ichi: true, bb: true, sig: true, rsi: true, macd: true, ew: true, w: true, sar: false, env: false, tri: false, div: true },
    maOn: { 5: true, 20: true, 60: true, 120: true, 240: true },
    simIdx: 0, tool: 'cursor', ewMode: 0, clean: false,
    ewShow: { sub: true, ch: true, clu: true },
    watch: [], strategy: 'trend', risk: 'safe', invest: 'div10'
  };
  watchRestore();

  /* ---------------- W 쌍바닥 지표 토글 (기본 ON · 개인 브라우저 localStorage 저장) ---------------- */
  var WTOG_KEY = 'apex.wbottom.v1';
  function wRestore() {
    try {
      var v = localStorage.getItem(WTOG_KEY);
      if (v === '0') state.show.w = false;
      else if (v === '1') state.show.w = true;
    } catch (e) { /* 저장소 차단 환경에서는 기본 ON */ }
  }
  function wPersist() {
    try { localStorage.setItem(WTOG_KEY, state.show.w ? '1' : '0'); } catch (e) {}
  }
  function wSyncToggle() {
    var b = $('.tg[data-t=w]');
    if (b) b.classList.toggle('on', !!state.show.w);
  }
  wRestore();

  /* ---------------- 파라볼릭 SAR · 엔벨로프 토글 (둘 다 기본 OFF · 개인 브라우저 localStorage 저장)
     상승 다이버전스 표시(state.show.div)는 기본 ON 이라 여기서는 끈 경우만 저장한다. ---------------- */
  var XTOG_KEY = 'apex.extra.v1';
  function xtogRestore() {
    try {
      var o = JSON.parse(localStorage.getItem(XTOG_KEY) || '{}');
      if (o && typeof o === 'object') {
        if (o.sar === 1 || o.sar === true) state.show.sar = true;
        if (o.env === 1 || o.env === true) state.show.env = true;
        if (o.tri === 1 || o.tri === true) state.show.tri = true;
        if (o.div === 0 || o.div === false) state.show.div = false;
      }
    } catch (e) { /* 저장소 차단 환경에서는 기본 OFF */ }
  }
  xtogRestore();
  function xtogPersist() {
    try {
      localStorage.setItem(XTOG_KEY, JSON.stringify({ sar: state.show.sar ? 1 : 0, env: state.show.env ? 1 : 0, tri: state.show.tri ? 1 : 0, div: state.show.div ? 1 : 0 }));
    } catch (e) {}
  }
  function xtogSync() {
    ['sar', 'env', 'tri', 'div'].forEach(function (k) {
      var b = $('.tg[data-t=' + k + ']');
      if (b) b.classList.toggle('on', !!state.show[k]);
    });
  }
  xtogSync();

  /* ---------------- 깔끔 보기 (기본 OFF · 개인 브라우저 localStorage 저장) ----------------
     켜면 구름대·볼린저·엔벨로프·엘리어트(피보나치·채널·패턴)·W 쌍바닥·삼각수렴·SAR 을 잠시 숨기고
     캔들 + 핵심 이평선(20·240일선) + 고저점만 남긴다. state.show 값은 건드리지 않으므로
     다시 끄면 기존 오버레이 구성 그대로 돌아온다. */
  var CLEAN_KEY = 'apex.clean.v1';
  var CLEAN_HIDE = { ichi: 1, bb: 1, env: 1, ew: 1, w: 1, tri: 1, sar: 1, div: 1 };
  function vis(k) { return !!state.show[k] && !(state.clean && CLEAN_HIDE[k]); }
  function cleanRestore() {
    try { state.clean = localStorage.getItem(CLEAN_KEY) === '1'; } catch (e) { state.clean = false; }
  }
  function cleanPersist() {
    try { localStorage.setItem(CLEAN_KEY, state.clean ? '1' : '0'); } catch (e) {}
  }
  function cleanSync() {
    var b = $('#cleanToggle');
    if (b) {
      b.classList.toggle('on', !!state.clean);
      b.setAttribute('aria-pressed', state.clean ? 'true' : 'false');
      b.title = state.clean
        ? '깔끔 보기 켜짐 — 구름대·볼린저·엘리어트·패턴·다이버전스 오버레이를 숨기고 캔들 + 20·240일선 + 고저점만 표시 · 누르면 해제'
        : '깔끔 보기 — 구름대·볼린저·엘리어트·패턴·다이버전스를 잠시 숨기고 캔들 + 20·240일선 + 고저점만 표시 (기본 OFF)';
    }
    var bar = $('#toggles');
    if (bar) bar.classList.toggle('clean-mode', !!state.clean);
  }

  /* ---------------- 전략 전환 (추세형 ↔ 스윙형) ---------------- */
  var STRAT_KEY = 'apex.strategy.v1';
  /* 전략 설명은 엔진 파라미터에서 생성 — 상단 카드·백테스트와 같은 단일 소스 */
  function trendDesc() {
    var p = QE.trendParams || { entry: 50, stopAtr: 6, trailAtr: 10, trailStartAtr: 6, minHold: 3 };
    return '종합 기술점수 ' + p.entry + ' 이상 + ' + trendMktRule() + ' → 다음 날 시가 매수 · 손절 ' +
      p.stopAtr + ' ATR · 트레일 ' + p.trailAtr + ' ATR (진입 +' + p.trailStartAtr + ' ATR 발동) — 둘 다 즉시 · QQQ 100일선 이탈 시 전량 청산은 진입 ' + p.minHold + '거래일 이후';
  }
  /* 추세형 시장 필터 문구 — 엔진 파라미터(TREND_P.panicEntryRsi / panicExitRsi)에서 생성 */
  function trendMktRule() {
    var p = QE.trendParams || {};
    var ex = p.panicEntryRsi == null ? 5 : p.panicEntryRsi;
    var df = p.panicExitRsi == null ? 15 : p.panicExitRsi;
    return 'QQQ 100일선 단계 (또는 QQQ RSI(2)<' + ex + ' 극단 패닉 예외 · RSI(2)<' + df + ' 패닉일 청산 보류)';
  }
  /* 실효 스윙 파라미터 = 엔진 기본값(SWING_P) + 성향 프로필(안정형은 빈 값 → 기본값 그대로) */
  function effSwingP() {
    var base = QE.swingParams || { rsiEntry: 10, qqqMa: 200, stopAtr: 4.5, stopCap: 0.1, ma20Gate: 0.05, ma20Confirm: 2, coolLoss: 10 };
    var out = {}, k;
    for (k in base) out[k] = base[k];
    var rp = riskParams();
    if (rp && rp.swing) for (k in rp.swing) out[k] = rp.swing[k];
    return out;
  }
  function swingDesc() {
    var p = effSwingP();
    var exc = p.mktRsiExc == null ? 5 : p.mktRsiExc;
    return 'RSI(2) ' + p.rsiEntry + ' 미만 + QQQ ' + p.qqqMa + '일선 위(또는 QQQ RSI(2)<' + exc + ' 극단 패닉) → 다음 날 시가 매수 · W 쌍바닥 넥라인 돌파 보조' +
      (p.coolLoss ? ' · 손절 후 ' + p.coolLoss + '거래일 재진입 금지' : ' · 손절 후 재진입 금지 없음(공격형)') +
      ' · 이익 +' + Math.round(p.ma20Gate * 100) + '% 이상에서 20일선 아래 ' + p.ma20Confirm + '거래일 연속 마감 → 다음 날 시가 청산 · 손절 ' + p.stopAtr + ' ATR (최대 -' +
      Math.round(p.stopCap * 100) + '%)';
  }
  /* 전략 머리말 — desc·logSub 는 지금 성향(안정형/공격형)의 실효 파라미터로 매번 만든다 */
  var STRAT = {
    trend: { key: 'trend', title: '추세형', sub: '중기' },
    swing: { key: 'swing', title: '스윙형', sub: '단기' }
  };
  function stratInfo(key) {
    var k = key === 'swing' ? 'swing' : 'trend';
    var s = STRAT[k];
    if (k === 'swing') {
      var p = effSwingP();
      return {
        key: s.key, title: s.title, sub: s.sub, desc: swingDesc(),
        logSub: 'RSI(2) ' + p.rsiEntry + ' 미만 + QQQ ' + p.qqqMa + '일선 위(또는 QQQ RSI(2)<' + (p.mktRsiExc == null ? 5 : p.mktRsiExc) + ' 극단 패닉) 매수 · W 쌍바닥 넥라인 돌파 보조 루트 · ' +
          (p.coolLoss ? '손절 후 ' + p.coolLoss + '거래일 재진입 금지 · ' : '손절 후 재진입 금지 없음 · ') +
          '손절 ' + p.stopAtr + ' ATR (최대 -' + Math.round(p.stopCap * 100) + '%) · 이익 중 20일선 아래 ' + p.ma20Confirm + '거래일 연속 마감 시 다음 날 시가 청산'
      };
    }
    var tp = QE.trendParams || {};
    return {
      key: s.key, title: s.title, sub: s.sub, desc: trendDesc(),
      logSub: '종합점수 ' + (tp.entry == null ? 50 : tp.entry) + ' 이상 매수 · ' + trendMktRule() + ' · 손절 ' + (tp.stopAtr || 6) +
        ' ATR·트레일 ' + (tp.trailAtr || 10) + ' ATR 즉시 · 시장약세 전량 청산은 진입 ' + (tp.minHold || 3) + '거래일 이후'
    };
  }
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

  /* ============================================================
     성향(위험 선호) — 🛡️ 안정형 / 🔥 공격형
     ------------------------------------------------------------
     · state.risk: 'safe' | 'aggr'  (localStorage 'apex.risk.v1', 기본 'safe')
     · 화면은 html[data-risk="aggr"] 로 긴장감 테마(CSS) 전환
     · 계산은 엔진 프로필(QE.riskOpts)을 분석 호출 opts 로 넘긴다
         공격형 스윙 = coolLoss 0 · stopCap 0.15 → 스캐너·종목카드·백테스트·기간집계 재계산
         공격형 추세 = 규칙 불변 C2 그대로 + 6M모멘텀 Top5 50:50 블렌드 가이드 표시
     · 성향을 바꾸면 지금 전략(추세형/스윙형)의 추천순 1위 종목으로 자동 선택
     ============================================================ */
  var RISK_KEY = 'apex.risk.v1';
  function riskProfile() { return state.risk === 'aggr' ? 'aggr' : 'safe'; }
  function riskAggr() { return riskProfile() === 'aggr'; }
  /* 분석 호출에 넘기는 프로필 값 — 안정형은 {} (기존과 완전히 같은 계산) */
  function riskOpts() { return (QE.riskOpts ? QE.riskOpts(riskProfile()) : {}); }
  function riskParams(prof) {          /* prof 생략 = 지금 화면 성향 — 실전 보유는 종목별 기준을 넘긴다 */
    if (QE.riskParams) return QE.riskParams(prof || riskProfile());
    return { swing: QE.swingParams || {}, trend: QE.trendParams || {} };
  }
  function riskGuide() {
    return QE.RISK_GUIDE || { swing: {}, trend: {} };
  }
  function riskRestore() {
    try {
      var v = localStorage.getItem(RISK_KEY);
      if (v === 'aggr' || v === 'safe') state.risk = v;
    } catch (e) { /* 저장소 차단 환경에서는 안정형 */ }
  }
  function riskPersist() {
    try { localStorage.setItem(RISK_KEY, riskProfile()); } catch (e) {}
  }
  /* 다크/화이트 × 성향 — 모바일 상단 상태바 색(theme-color)까지 함께 */
  function themeMetaColor() {
    if (isLightTheme()) return riskAggr() ? '#F8F4F4' : '#EEF2F7';
    return riskAggr() ? '#1C141A' : '#0B0E14';
  }
  function applyRiskClass() {
    var root = document.documentElement;
    if (riskAggr()) root.setAttribute('data-risk', 'aggr');
    else root.removeAttribute('data-risk');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', themeMetaColor());
  }
  /* 성향 변경 — 재분석 → 스캐너·종목카드·백테스트·기간집계를 새 기준으로 다시 그린 뒤 1위 종목 선택 */
  function setRisk(profile) {
    var next = profile === 'aggr' ? 'aggr' : 'safe';
    if (next === riskProfile()) { renderRisk(); return; }
    state.risk = next;
    riskPersist();
    applyRiskClass();
    var top = riskRebuild();                        /* 이 함수가 renderRisk·renderAggrCard 까지 마친다 */
    var t = top || topScoreT();
    if (t) { state.cur = t; autoPick = true; clearDeepLink(); }
    if (state.cur && A[state.cur]) select(state.cur, true);
    renderScanner();
    setNxTab(next);                                  /* 투자 운영 원칙 탭도 그 성향으로 (사용자는 자유롭게 다시 고를 수 있음) */
  }
  /* 성향이 바뀌었으므로 모든 종목 분석을 새 프로필로 다시 돌린다 (102종목 약 1.2초) */
  function riskRebuild() {
    var t0 = (window.performance && performance.now) ? performance.now() : 0;
    cache.clear();
    viewCache.clear();
    for (var k in winCache) if (Object.prototype.hasOwnProperty.call(winCache, k)) delete winCache[k];
    for (var u in uniCache) if (Object.prototype.hasOwnProperty.call(uniCache, u)) delete uniCache[u];
    uniGen++;                                       /* 진행 중인 기간 집계 작업 결과는 버린다 */
    acctGen++;                                      /* 진행 중인 계좌 시뮬레이션 결과도 버린다 */
    mom6Cache = null;
    M.tickers.forEach(function (x) { A[x.t] = get(x.t); });
    renderFavs();
    renderScanner();
    renderRisk();
    renderStrategy();
    renderAggrCard();
    if (window.performance && performance.now) {
      console.log('[APEX] risk=' + riskProfile() + ' re-analyzed ' + M.tickers.length + ' tickers in ' + Math.round(performance.now() - t0) + 'ms');
    }
    prefetchPeriods();                              /* 바뀐 성향으로 3M·6M·1Y·2Y 집계를 다시 준비 */
    return topScoreT();
  }
  /* 성향 버튼·경계 배지 상태 동기화 (상단 헤더 + 전략 바 두 곳) */
  function renderRisk() {
    var aggr = riskAggr();
    $$('[data-risk-btn]').forEach(function (b) {
      var on = b.getAttribute('data-risk-btn') === riskProfile();
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var bn = $('#riskBanner');
    if (bn) {
      bn.hidden = !aggr;
      bn.classList.toggle('on', aggr);
    }
    if (aggr) {
      var p = riskParams(), tx = $('#riskBannerTx');
      if (tx) tx.innerHTML = '스윙 손절 <b>-' + Math.round((p.swing.stopCap || 0.15) * 100) + '%</b> · 쿨다운 <b>' + (p.swing.coolLoss || 0) + '일</b> · 추세 <b>C2 50 : 6M모멘텀 Top5 50</b> · 변동성 주의';
    }
    var seg = $('#stratBar');
    if (seg) seg.setAttribute('data-risk', riskProfile());
    renderAggrCard();
    renderNotice();                                 /* 투자 운영 원칙 탭의 규칙·검증 수치도 새 성향 기준으로 */
    renderAcct();                                   /* 성향이 바뀌면 계좌 시뮬레이션도 새 규칙으로 */
    mhRender();                                     /* 실전 보유도 새 성향(손절 상한)으로 다시 계산 */
  }
  /* 공격형 카드 — 추세형은 50:50 블렌드 가이드 + 오늘의 모멘텀 Top5, 스윙형은 S2 파라미터 요약 */
  function renderAggrCard() {
    var el = $('#aggrCard');
    if (!el) return;
    var aggr = riskAggr();
    el.hidden = !aggr;
    if (!aggr) return;
    var g = riskGuide(), p = riskParams();
    var swing = state.strategy === 'swing';
    var m6 = mom6Counts();
    var ti = $('#agTitle'), su = $('#agSub'), kp = $('#agKpis'), gd = $('#agGuide'), ft = $('#agFoot'), ao = $('#agMomAsOf');
    if (swing) {
      if (ti) ti.innerHTML = '공격형 · 스윙형 S2 <em>쿨다운 0일 · 손절 상한 -' + Math.round((p.swing.stopCap || 0.15) * 100) + '%</em>';
      if (su) su.textContent = 'RSI(2) ' + (p.swing.rsiEntry || 10) + ' 미만 진입 규칙은 그대로 — 손절 -' +
        Math.round((p.swing.stopCap || 0.15) * 100) + '% · 손절 후 재진입 금지 0일로 바꾼 조합 (10년 비교 검증 S2)';
      if (kp) kp.innerHTML =
        '<span><b>5년 ' + pct(g.swing.ret5, 1) + '</b><em>안정형 +144.86%</em></span>' +
        '<span><b>10년 ' + pct(g.swing.ret10, 0) + '</b><em>안정형 +249.36%</em></span>' +
        '<span><b>' + pct(g.swing.win10, 1) + '</b><em>10년 승률 · PF ' + (g.swing.pf10 || 0).toFixed(2) + '</em></span>';
      if (gd) gd.innerHTML =
        '<div class="ag-row buy"><b>매수</b><span>RSI(2) ' + (p.swing.rsiEntry || 10) + ' 미만 + QQQ ' + (p.swing.qqqMa || 200) +
          '일선 위(또는 QQQ RSI(2)<' + (p.swing.mktRsiExc == null ? 5 : p.swing.mktRsiExc) + ' 극단 패닉) → 다음 날 시가 — 신호 규칙 불변</span></div>' +
        '<div class="ag-row stop"><b>손절</b><span>진입가 − ' + (p.swing.stopAtr || 4.5) + ' ATR 또는 −' + Math.round((p.swing.stopCap || 0.15) * 100) + '% 중 가까운 쪽 · <b>손절 뒤 재진입 금지 없음</b> (안정형 10거래일 → 0일)</span></div>' +
        '<div class="ag-row sell"><b>청산</b><span>이익 +' + Math.round((p.swing.ma20Gate || 0.05) * 100) + '% 이상에서 20일선 아래 ' + (p.swing.ma20Confirm || 2) + '거래일 연속 마감 → 다음 날 시가 — 신호 규칙 불변</span></div>';
      if (ft) ft.innerHTML = '손절 폭을 −10% → −15%로 넓히고 손절 뒤 대기(10거래일)를 없앤 대신, 한 번의 손실이 더 커지고 같은 종목에서 연속 손절이 날 수 있습니다. 종목별 5년 ' +
        pct(0.14486, 2) + ' → ' + pct(g.swing.ret5, 2) + ' · 표본밖 ' + pct(0.5837, 1) + ' → ' + pct(g.swing.oos, 1) +
        ' · 계좌 10슬롯 5년은 오히려 낮아질 수 있습니다(슬롯 경쟁). 참고용이며 미래 수익을 보장하지 않습니다.';
    } else {
      if (ti) ti.innerHTML = '공격형 · 추세 C2 50% + 6M모멘텀 Top5 50% <em>월간 리밸런싱</em>';
      if (su) su.textContent = '추세 신호(C2)는 그대로 두고, 6개월 모멘텀 Top5 바스켓을 절반 섞는 계좌 운용 가이드 — 10년 계좌(10슬롯) 검증 결과';
      if (kp) kp.innerHTML =
        '<span><b>10년 ' + pctK(g.trend.ret10, 0) + '</b><em>MDD ' + pct(g.trend.mdd10, 1) + '</em></span>' +
        '<span><b>샤프 ' + (g.trend.sharpe10 || 0).toFixed(2) + '</b><em>C2 단독 1.45</em></span>' +
        '<span><b>5년 ' + pctK(g.trend.ret5, 0) + '</b><em>표본밖 ' + pctK(g.trend.oos, 0) + '</em></span>';
      if (gd) gd.innerHTML =
        '<div class="ag-row buy"><b>계좌</b><span>추세 C2 신호 자금 <b>50%</b> + 6개월 모멘텀 Top5 바스켓 <b>50%</b> — 매수·손절은 지금 추세형 신호 그대로</span></div>' +
        '<div class="ag-row rebal"><b>리밸런싱</b><span>월 1회 — 6개월(126거래일) 수익률 상위 5종목을 다시 고르고 비중을 절반으로 맞춥니다</span></div>' +
        '<div class="ag-row risk"><b>주의</b><span>수익은 C2 단독의 2배 이상이지만 MDD도 −21.3% → ' + pct(g.trend.mdd10, 1) + '로 커집니다 · 2022년 ' + pct(g.trend.y2022, 1) + '</span></div>';
      if (ft) ft.innerHTML = '10년 계좌(10슬롯) 기준 · 리밸런싱 시작일을 0~20일 옮기면 10년 총수익이 ' +
        pctK(g.trend.phaseMin, 0) + '~' + pctK(g.trend.phaseMax, 0) + '로 흔들립니다(샤프 1.30~1.56). ' +
        '샤프가 가장 좋은 조합은 C2 70% + 모멘텀 30%(1.52)이고, 50:50은 더 높은 수익을 원할 때의 선택입니다. 참고용이며 미래 수익을 보장하지 않습니다.';
    }
    if (ao) ao.textContent = m6.asOf + ' 종가 · ' + m6.pool + '종목 중 상위 ' + m6.n + ' · ' + MOM6_BARS + '거래일 수익률';
    var list = $('#agMomList');
    if (list) {
      list.innerHTML = m6.top.map(function (r) {
        return '<button type="button" class="ag-mom-b' + (state.cur === r.t ? ' on' : '') + '" data-t="' + r.t + '" title="' + r.t + ' · ' + MOM6_BARS + '거래일 ' + pct(r.r, 2) + ' · 클릭하면 이 종목 차트">' +
          '<em>' + r.k + '</em><b>' + r.t + '</b><span class="' + cls(r.r) + '">' + pct(r.r, 1) + '</span></button>';
      }).join('');
      list.onclick = function (e) {
        var b = e.target.closest('[data-t]');
        if (b) select(b.getAttribute('data-t'));
      };
    }
  }
  /* ---------------- 기간 (차트 표시 = 백테스트 검증 기간) ----------------
     차트 기간 버튼(#tf)과 자료 기간 버튼(#btf)은 같은 값(state.range = state.btRange)을 쓰고,
     어느 쪽을 눌러도 차트·KPI·자산곡선·전략 비교·트레이드 로그가 같은 기간으로 함께 움직인다. */
  var BT_WIN = { '64': 63, '128': 126, '252': 252, '501': 504, '1255': 1255 };
  var BT_TAG = { 63: '3M', 126: '6M', 252: '1Y', 504: '2Y', 1255: '5Y' };
  var BT_NAME = { 63: '최근 3개월', 126: '최근 6개월', 252: '최근 1년', 504: '최근 2년', 1255: '최근 5년' };
  function btBars() { return BT_WIN[String(state.btRange)] || 1255; }
  function btTag() { return BT_TAG[btBars()] || '5Y'; }
  function btName() { return BT_NAME[btBars()] || '최근 5년'; }
  function btSelSync() {
    var on = String(state.btRange);
    $$('#btf button').forEach(function (b) { b.classList.toggle('on', b.dataset.n === on); });
    $$('#tf button').forEach(function (b) { b.classList.toggle('on', b.dataset.n === String(state.range)); });
    /* 4️⃣ 상단 기간 선택 바(#topPeriod)도 같은 값 — 세 곳이 항상 같은 기간을 가리킨다 */
    $$('#topPeriod button').forEach(function (b) { b.classList.toggle('on', b.dataset.n === on); });
    /* 오른쪽 요약 — 지금 기간의 실제 날짜 구간·거래일 (하드코딩 금지) */
    var pn = $('#tcPerNow');
    if (pn && M.dates && M.dates.length) {
      var bars = btBars(), i0 = Math.max(0, M.dates.length - bars);
      pn.textContent = btTag() + ' · ' + M.dates[i0] + ' ~ ' + M.dates[M.dates.length - 1] + ' · ' +
        (M.dates.length - i0).toLocaleString('en-US') + '거래일 · 차트·백테스트·계좌 공통';
      pn.title = '이 기간은 차트 표시 구간 · 백테스트 검증 기간 · 계좌 시뮬레이션에 함께 적용됩니다';
    }
  }
  /* ---------------- 기간 동기화 (차트 ↔ 아래 자료) ----------------
     위 차트 기간 버튼(#tf)과 아래 자료 기간 버튼(#btf)은 같은 값을 쓴다.
     한쪽을 누르면 차트 표시 범위와 KPI·자산곡선·전략 비교·트레이드 로그가 모두 같은 기간으로 함께 움직인다. */
  function setPeriod(n) {
    n = parseInt(n, 10);
    if (!n) return;
    var a = A[state.cur];
    if (state.range !== n) {
      state.range = n;
      /* 차트도 백테스트와 **같은 봉 수**(3M 63 · 6M 126 · 2Y 504)로 그린다 — n(64/128/501) 그대로 쓰면 1~3봉 어긋난다 */
      if (chart && chart.setRange) chart.setRange(BT_WIN[String(n)] || btBars());
    }
    if (state.btRange !== n) {
      state.btRange = n;
      if (a) applyBtPeriod();               /* KPI·자산곡선·전략 비교·트레이드 로그 재계산 */
      prefetchPeriods();                    /* 다른 기간 집계를 미리 계산해 두어 전환이 빠르게 */
    }
    btSelSync();                            /* 세 버튼 그룹(#topPeriod·#tf·#btf)의 선택 표시를 같은 값으로 */
    if (a) { var v = stratView(viewOf(state.cur)); renderBtPeriod(v); }
  }
  var winCache = Object.create(null);      /* 'TICKER|bars|성향' → { trend, swing } */
  /* warm > 0 이면 창 앞 250봉까지 함께 돌려 **창 시작 시점에 이미 굴러가는 계좌**를 만든다.
     계좌(acctRun)는 그 거래 중 창 구간만 측정한다 — 웜스타트(2026-11-28). */
  function winOf(t, bars, warm) {
    var a = A[t];
    if (!a || !a.series || !a.ind || !a.wsig) return null;
    var w = warm > 0 ? Math.min(warm, Math.max(0, a.series.c.length - bars)) : 0;
    if (!bars || (!w && bars >= 1255)) return a.strategy;
    var span = bars + w;
    var k = t + '|' + bars + '|' + riskProfile() + (w ? '|w' + w : ''), c = winCache[k];
    if (c) return c;
    c = QE.strategyWindow(a.series, a.ind, a.scoreSeries, a.wsig, span, riskOpts());
    c.warm = w;
    winCache[k] = c;
    return c;
  }
  function stratBundle(a) {
    if (!a || !a.strategy) return null;
    var bars = btBars();
    if (!a.replay && bars < 1255 && a.sym) {                 /* 기간 집계가 이미 있으면 그것을 쓴다 */
      var w = winCache[a.sym + '|' + bars + '|' + riskProfile()];
      if (w && w[stratKey()]) return w[stratKey()];
    }
    return a.strategy[stratKey()] || a.strategy.trend;
  }
  /* 선택된 전략·선택된 기간의 KPI·거래·에쿼티만 갈아 끼운 사본 — 화면 전환마다 다시 돌리지 않는다 */
  function stratView(a) {
    if (!a || !a.strategy) return a;
    var bars = a.replay ? 0 : btBars();                       /* 리플레이 중에는 기간 연동을 끈다 */
    var src = bars ? winOf(a.sym, bars) : null;
    var b = src ? (src[stratKey()] || src.trend) : stratBundle(a);
    if (!b) return a;
    var store = a._sv || (a._sv = {});
    var key = b.key + '|' + (bars || 'full');
    if (store[key]) return store[key];
    var v = {}, k;
    for (k in a) {
      if (k === '_sv') continue;
      if (Object.prototype.hasOwnProperty.call(a, k)) v[k] = a[k];
    }
    v.stats = b.stats; v.trades = b.trades; v.equity = b.equity; v.startIdx = b.startIdx;
    /* 스윙 진입 계획(다음 시가·손절가 안내)은 마지막 봉 기준이라 기간과 무관 — 원본 것을 유지 */
    v.plan = (b.plan == null && a.strategy.swing) ? a.strategy.swing.plan : b.plan;
    v.stratKey = b.key; v.strat = b;
    v.btBars = bars || 1255;
    v.btCovered = (a.close ? a.close.length : 0) - b.startIdx;
    store[key] = v;
    return v;
  }
  stratRestore();
  /* 깔끔 보기에서는 20·240일선만 — 굵은 두 선만 남겨 캔들이 시원하게 보이게 */
  function maVisible(p) { return state.show.ma && state.maOn[p] && (!state.clean || p === 20 || p === 240); }
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
    var a = QE.analyze(t, info(t).n , s, riskOpts());   /* 성향 프로필(안정형 {})을 그대로 전달 — 공격형은 스윙 파라미터만 다름 */
    a.sym = t;
    a.series = s;
    a.limited = s.c.length < 260;
    a.meta = info(t);
    a.rangePct = (a.price - a.lo52) / Math.max(a.hi52 - a.lo52, 1e-9);
    cache.set(t, a);
    return a;
  }
  function all() { return M.tickers.map(function (x) { return get(x.t); }).filter(Boolean); }

  /* ============================================================
     전략별 유니버스 — 추세형은 Top 100(기존 102종목), 스윙형은 Top 150(152종목)
     · rank 는 data.js meta.r (시총 순위) — 1~100위 + NKE·QQQ(r 없음) = 102종목이 추세형
     · 스윙형은 101~150위 50종목을 더한 152종목 전체
     · 스캐너 목록·상태 탭 카운트·프리셋 카운트·유니버스 백테스트 평균·자동 선택(topScoreT)이
       모두 이 함수를 거치므로, 화면 제목(Top 100 / Top 150)과 집계가 항상 같은 집합을 가리킨다.
     · 검색(전역 검색·관심종목 추가)은 152종목 전체를 대상으로 한다 — 차트는 어느 종목이든 열 수 있다.
     ============================================================ */
  var UNIV_MAX_RANK = { trend: 100, swing: 150 };
  function uniMode(key) { return (key || stratKey()) === 'swing' ? 'swing' : 'trend'; }
  function inUniv(x, mode) { return !x || x.r == null || x.r <= UNIV_MAX_RANK[mode || 'swing']; }
  var uniListCache = {};
  function uniList(key) {
    var mode = uniMode(key);
    var c = uniListCache[mode];
    if (c && c.src === M.tickers) return c.list;
    var list = M.tickers.filter(function (x) { return inUniv(x, mode); });
    uniListCache[mode] = { src: M.tickers, list: list };
    return list;
  }
  /* 유니버스가 바뀌면(전략 전환) 이 집합으로 센 캐시들을 버린다 */
  function uniReset() {
    presetCache = null; wCountCache = null; mom6Cache = null; win70Cache = {};
    vcpCache = null; divCache = null; bkCache = null; triCache = null;
  }

  /* 자동 선택 종목 — '지금 선택한 전략(state.strategy)'의 추천 1위.
     좌측 스캐너를 추천순으로 정렬했을 때 맨 위 1행과 같은 종목이 되도록, 스캐너와 똑같은
     필터·검색(scanRows)과 비교 함수(recCmp)를 그대로 쓴다 — 화면과 자동 선택이 어긋나지 않는다.
       추세형: 진입/보유 단계(tier) → 종합 기술점수
       스윙형: 진입/보유 단계(tier) → 스윙 적합도(RSI(2) 과매도 깊이 · W 단계 · 종합점수)
     동점이면 데이터(시총) 순서가 그대로 유지되고, 데이터가 갱신되어 1위가 바뀌면
     다음 접속·전략 전환 때 그 종목이 자동으로 뜬다 (하드코딩 없음). */
  function topScoreT() {
    var rows = scanRows();
    if (!rows.length) rows = uniList().map(function (x) { return A[x.t]; }).filter(Boolean);  /* 필터로 목록이 비면 그 전략 유니버스 전체에서 */
    if (!rows.length) return '';
    rows.sort(recCmp);
    return rows[0].sym || '';
  }

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
    }, riskOpts());
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
  /* 큰 수익률용 — 천단위 구분(+2,165%) */
  function pctK(v, d) {
    if (v == null || isNaN(v)) return '—';
    d = d === undefined ? 0 : d;
    var x = v * 100;
    return (x > 0 ? '+' : '') + x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
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

  /* ---------------- 상단 슬림 로딩 진행바 (2026-11-28 2단계) ----------------
     8.3MB 데이터 파싱 → 152종목 엔진 계산 → 첫 화면 그리기까지의 실제 진행률을
     상단 3px 바 + 짧은 상태 문구로 보여 주고, 끝나면 스스로 사라진다.
     · 분석 루프를 60ms 단위로 나눠 yield 하므로 바가 실제로 움직인다(끝나면 노드는 제거)
     ------------------------------------------------------------ */
  var bootBarLive = true;
  function bootProgress(pct, msg) {
    if (!bootBarLive) return;
    var bar = $('#bootLoad'), fill = $('#bootFill'), tip = $('#bootTip'),
      pc = $('#bootPct'), ms = $('#bootMsg');
    var v = Math.max(0, Math.min(100, Math.round(pct)));
    if (bar) {
      bar.setAttribute('aria-valuenow', String(v));
      bar.setAttribute('aria-valuetext', v + '%' + (msg ? ' · ' + msg : ''));
    }
    if (fill) fill.style.width = v + '%';
    if (pc) pc.textContent = v + '%';
    if (ms && msg) ms.textContent = msg;
  }
  function bootFinish() {
    if (!bootBarLive) return;
    bootProgress(100, '준비 완료');
    setTimeout(function () {
      var bar = $('#bootLoad'), tip = $('#bootTip');
      bootBarLive = false;
      if (bar) bar.classList.add('done');
      if (tip) tip.classList.add('done');
      setTimeout(function () {
        if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
        if (tip && tip.parentNode) tip.parentNode.removeChild(tip);
      }, 420);
    }, 240);
  }

  /* 첫 분석(152종목) 전에 들어온 기간 집계·계좌 계산 요청은 큐에 모아 두었다가 분석 직후에 시작한다.
     (분석이 비동기로 쪼개져 있어서, 먼저 끝난 집계가 'A 가 비어 있는' 상태로 화면을 다시 그리면
      계좌 시뮬레이션이 일부 종목만으로 계산되는 문제가 있었다 — 2026-11-28 2단계) */
  var bootReady = false, jobQueue = [];
  function deferJob(kind, bars, done) {
    for (var i = 0; i < jobQueue.length; i++) {
      if (jobQueue[i].kind === kind && jobQueue[i].bars === bars) {
        if (done) jobQueue[i].dones.push(done);
        return;
      }
    }
    jobQueue.push({ kind: kind, bars: bars, dones: done ? [done] : [] });
  }
  function drainJobs() {
    var q = jobQueue.splice(0);
    q.forEach(function (j) {
      var f = j.kind === 'uni' ? startUniJob : startAcctJob;
      try { f(j.bars, j.dones.length ? function () { j.dones.forEach(function (d) { try { d(); } catch (e) {} }); } : null); } catch (e) {}
    });
  }

  /* ---------------- boot ---------------- */
  var A = {};   // analysis by ticker
  /* 데이터 갱신 시각(KST) — 미국 휴장일에도 '오늘 확인 마침'을 배지에서 바로 알 수 있게 병기 */
  function updStamp() {
    var u = M.updatedAt || (M.meta && M.meta.updatedAt) || (M.fundamentals && M.fundamentals.updatedAt) || '';
    var m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(u));
    if (!m) return '';
    return m[2] + '/' + m[3] + ' ' + m[4] + ':' + m[5];
  }
  function setUpdatedBadge() {
    var s = updStamp(), el = $('#asOfUpd'), mb = $('.market-badge');
    if (el) {
      el.textContent = s ? '· ' + s + ' 갱신' : '';
      el.title = s ? '한국시간 ' + s + '에 최신 데이터 확인을 마쳤습니다 (미국 휴장일에는 종가가 그대로입니다)' : '';
    }
    if (mb) mb.title = '장마감 ' + M.asOf + ' 종가' + (s ? ' · 한국시간 ' + s + ' 데이터 갱신 확인' : '');
    /* 좁은 화면에서는 상단 배지가 숨겨지므로 푸터에도 같은 시각을 남긴다 */
    ['#footUpd', '#footUpd2'].forEach(function (sel) {
      var f = $(sel);
      if (!f) return;
      f.textContent = s ? ' · ' + s + ' 갱신' : '';
      f.title = s ? '한국시간 ' + s + '에 최신 데이터 확인을 마쳤습니다 (미국 휴장일에는 종가가 그대로입니다)' : '';
    });
  }
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
    setUpdatedBadge();
    var pb = $('#ptBars'); if (pb) pb.textContent = M.dates.length.toLocaleString('en-US');
    bootProgress(40, '시장 지표 그리는 중…');
    renderMacro();
    renderFearGreed(M.fearGreed, false);
    setTimeout(fgRealtime, 500);
    var t0 = performance.now(), nTick = M.tickers.length, xIx = 0;
    /* 152종목 엔진 계산 — 60ms 단위로 끊어 진행률을 그리고, 끝나면 bootAfter() 로 이어진다 */
    (function analyzeStep() {
      var s0 = (window.performance && performance.now) ? performance.now() : Date.now();
      while (xIx < nTick) {
        var x = M.tickers[xIx++];
        A[x.t] = get(x.t);
        var nx = (window.performance && performance.now) ? performance.now() : Date.now();
        if (nx - s0 >= 60) break;
      }
      bootProgress(44 + (44 * xIx) / Math.max(1, nTick), '종목 ' + xIx + '/' + nTick + ' 분석 중…');
      if (xIx < nTick) { setTimeout(analyzeStep, 0); return; }
      bootAfter(Math.round(performance.now() - t0));
    })();
  }
  /* 분석이 끝난 뒤 첫 화면 조립 — 자동 선택·스캐너·성향/전략 버튼·히어로·계좌까지 한 번에 */
  function bootAfter(analyzeMs) {
    bootProgress(90, '스캐너 정리 중…');
    var topT = topScoreT();                    /* 첫 접속 = 선택한 전략(추세형/스윙형)의 추천 1위 종목 (URL로 종목을 지정한 경우는 start()에서 덮어쓴다) */
    if (topT) { state.cur = topT; autoPick = true; }
    else if (!A[state.cur]) state.cur = (M.tickers[0] || {}).t || '';
    wSyncToggle();
    fitSearchPlaceholder();
    $('#uniCount').textContent = String(uniList().length);      /* 스캐너 '전체' 집계와 같은 수 — 선택 전략 유니버스에서 동적 반영 */
    var fa = $('#favAdd'); if (fa) fa.title = '관심종목 추가 — ' + M.tickers.length + '종목 검색';   /* 검색은 152종목 전체 */
    var cf = $('#cFav'); if (cf) cf.textContent = state.watch.length;
    renderFavs();
    renderScanner();
    renderStrategy();
    renderRisk();               /* 성향 버튼·경계 배지·공격형 카드를 저장된 성향으로 */
    syncHeaderHeight(); syncPeriodTitles(); btSelSync();   /* 기간 버튼 3곳 + 기간 요약(오른쪽 날짜)까지 첫 화면부터 맞춘다 */
    bootProgress(95, '첫 화면 그리는 중…');
    select(state.cur, true);    console.log('[APEX] analyzed ' + M.tickers.length + ' tickers in ' + analyzeMs + 'ms');
    if (pendingDeep) {                      /* 딥링크(?t=·#종목) — 분석이 끝난 뒤에 선택한다 */
      var dT = pendingDeep; pendingDeep = '';
      if (A[dT]) select(dT);
    }
    bootReady = true;           /* 이제부터 기간 집계·계좌 계산을 실제로 시작한다 */
    drainJobs();
    renderAcct();               /* 대기 중이던 계좌 계산이 시작되면 카드도 그 상태로 다시 */
    mhRender();                 /* 실전 보유 관리 — 분석이 끝나면 내 보유 종목 진단을 계산 */
    bootFinish();               /* 진행바 100% → 페이드아웃 */
    prefetchPeriods();          /* 3M·6M·1Y·2Y 기간 집계를 백그라운드에서 미리 계산 */
  }

  /* 헤더 실제 높이를 CSS 변수로 — 사이드바(sticky)와 본문 앵커가 헤더 아래에서 시작한다.
     헤더는 폭에 따라 1~2줄로 늘어나므로 고정값(57px)을 쓰면 관심종목 줄이 사이드바 제목을 덮는다. */
  function syncHeaderHeight() {
    var hb = document.querySelector('.topbar');
    if (!hb) return;
    var h = Math.round(hb.getBoundingClientRect().height);
    if (h > 0) document.documentElement.style.setProperty('--hdr-h', h + 'px');
  }
  window.addEventListener('resize', syncHeaderHeight);
  if (window.ResizeObserver) {
    try { new ResizeObserver(syncHeaderHeight).observe(document.querySelector('.topbar')); } catch (e) {}
  }

  /* 5Y 버튼 툴팁 — 실제 데이터 구간으로 (예전 하드코딩 날짜가 어긋나던 문제) */
  function syncPeriodTitles() {
    var b = document.querySelector('#tf button[data-n="1255"]');
    if (!b || !M.dates || !M.dates.length) return;
    var n = Math.min(1255, M.dates.length);
    var i0 = M.dates.length - n;
    b.title = '5년 전체 (' + M.dates[i0] + ' ~ ' + M.dates[M.dates.length - 1] + ' · ' + n.toLocaleString('en-US') +
      '거래일 · 2022년 하락장 포함) — 아래 자료 기간과 같은 기간으로 함께 움직입니다';
    /* 상단 기간 바의 5Y 도 같은 날짜로 (하드코딩 금지) */
    var t = document.querySelector('#topPeriod button[data-n="1255"]');
    if (t) t.title = '5년 전체 (' + M.dates[i0] + ' ~ ' + M.dates[M.dates.length - 1] + ' · ' +
      n.toLocaleString('en-US') + '거래일 · 2022년 하락장 포함) — 차트·백테스트·계좌 시뮬레이션이 함께 바뀝니다';
  }

  /* 검색창 폭에 맞춰 안내 문구를 줄인다 — 좁은 화면에서 '종목 검색 · E' 처럼 잘리지 않게 */
  function fitSearchPlaceholder() {
    var el = $('#globalSearch'); if (!el) return;
    var short = (el.clientWidth || 0) < 190;
    el.placeholder = short ? '종목 검색' : '종목 검색 · 티커 또는 회사명';
  }
  /* 📱 ≤1023px — 헤더 검색창을 공포·탐욕 시계(#fgCard) 바로 위 슬롯(#msearchSlot)으로 옮기고,
     헤더 오른쪽에는 🏢 회의실 버튼만 남긴다(2026-11-28 회장님 지시). 노드를 옮길 뿐이라
     검색 이벤트·드롭다운·⌘K·딥링크는 그대로 동작한다. */
  var searchHome = null;
  function relocateSearch() {
    var el = $('#globalSearch'), s = el ? el.closest('.search') : null, slot = $('#msearchSlot');
    if (!s || !slot) return;
    if (!searchHome) searchHome = { parent: s.parentNode, next: s.nextSibling };
    if (window.innerWidth <= 1023) {
      if (s.parentNode !== slot) slot.appendChild(s);
    } else if (s.parentNode !== searchHome.parent) {
      searchHome.parent.insertBefore(s, searchHome.next);
    }
    fitSearchPlaceholder();
  }
  window.addEventListener('resize', function () { relocateSearch(); });
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
  /* 프리셋 필터 — 시총 Top 30 · 실적 우량주
     데이터(M.fundamentals)는 장마감 기준 스냅숏이므로 화면에도 그 기준일을 함께 적는다. */
  var PRESET_TOP_N = 30;
  var presetCache = null;
  function presetData() {
    if (presetCache) return presetCache;
    var F = (M.fundamentals && M.fundamentals.tickers) || {};
    var known = {};
    uniList().forEach(function (x) { known[x.t] = 1; });
    var keys = Object.keys(F).filter(function (t) { return known[t] && F[t] && F[t].marketCap != null; });
    keys.sort(function (a, b) { return F[b].marketCap - F[a].marketCap; });
    var top = keys.slice(0, PRESET_TOP_N);
    var qual = keys.filter(function (t) {
      var f = F[t];
      /* null/undefined 는 Number() 가 0·NaN 이 되어 자동으로 조건 밖으로 밀린다 */
      return Number(f.trailingEps) > 0 && Number(f.revenueGrowth) > 0.05 && Number(f.profitMargins) > 0.15;
    });
    var topSet = {}, qualSet = {};
    top.forEach(function (t) { topSet[t] = 1; });
    qual.forEach(function (t) { qualSet[t] = 1; });
    presetCache = {
      top30: topSet, quality: qualSet, nTop: top.length, nQual: qual.length,
      asOf: (M.fundamentals && M.fundamentals.asOf) || M.asOf
    };
    return presetCache;
  }
  /* W 쌍바닥 프리셋 — 마지막 종가 기준 단계별 종목 수와 집합 (돌파/임박/진행만, 돌파 실패는 제외) */
  var wCountCache = null;
  function wCounts() {
    if (wCountCache) return wCountCache;
    var cnt = { '돌파': 0, '임박': 0, '진행': 0 }, set = {}, total = 0, asOf = M.asOf;
    uniList().forEach(function (x) {
      var a = A[x.t];
      if (!a || !a.w || !a.w.stage) return;
      if (a.w.stage === '실패') { cnt['실패'] = (cnt['실패'] || 0) + 1; return; }
      cnt[a.w.stage] = (cnt[a.w.stage] || 0) + 1;
      set[x.t] = 1; total++;
      if (a.w.asOf) asOf = a.w.asOf;
    });
    wCountCache = { cnt: cnt, set: set, total: total, asOf: asOf };
    return wCountCache;
  }
  /* VCP 프리셋 — 대형 우량주(시총 Top 30 ∪ 실적 우량주) 안에서만
     미너비니 Trend Template(정배열) + VCP 변동성 축소(피벗 돌파/임박) 종목을 골라낸다.
     ※ 표시 전용 필터 — 스윙/추세 백테스트 규칙에는 손대지 않는다. */
  var vcpCache = null;
  var triCache = null;
  function vcpCounts() {
    if (vcpCache) return vcpCache;
    var pd = presetData();
    var set = {}, cnt = { pool: 0, tt: 0, brk: 0, near: 0, total: 0 }, rows = [];
    uniList().forEach(function (x) {
      var a = A[x.t];
      if (!a || !a.vcp || !a.meta) return;
      if (!pd.top30[x.t] && !pd.quality[x.t]) return;      /* 대형 우량주 풀 밖은 제외 */
      cnt.pool++;
      var v = a.vcp;
      if (!v.tt) return;
      cnt.tt++;
      if (v.state === '돌파' || v.breakRecent) cnt.brk++;
      if (v.state === '임박') cnt.near++;
      if (v.state === '돌파' || v.state === '임박') { set[x.t] = 1; rows.push(x.t); cnt.total++; }
    });
    vcpCache = { set: set, cnt: cnt, rows: rows, asOf: (M.fundamentals && M.fundamentals.asOf) || M.asOf };
    return vcpCache;
  }
  /* 목록 행의 VCP 표시 (TT 충족 + 돌파/임박만) */
  function vcpBadge(a) {
    var v = a && a.vcp;
    if (!v || !v.tt || (v.state !== '돌파' && v.state !== '임박')) return '';
    var t;
    if (v.state === '돌파') {
      t = 'VCP 돌파 · 피벗 ' + pxs(v.pivot) + ' 상향' + (v.volRatio ? ' · 거래량 ' + v.volRatio.toFixed(2) + '배' : '');
    } else {
      t = 'VCP 임박 · 피벗 ' + pxs(v.pivot) + '까지 ' + (v.dist * 100).toFixed(1) + '% · 베이스 ' + v.baseLen + '봉' +
        (v.tight ? ' · 10일 박스 8% 이내' : '') + (v.contracted ? ' · 변동성 축소' : '') +
        (v.volRatio ? ' · 거래량 ' + v.volRatio.toFixed(2) + '배' : '');
    }
    return '<i class="vcpb ' + (v.state === '돌파' ? 'brk' : 'near') + '" title="' + t + '">VCP</i>';
  }
  /* ---------------- 상승 다이버전스 (RSI14) — 참고 배지 · 프리셋 (표시 전용) ----------------
     엔진 divScan(series) 결과만 읽는다. 최근 3거래일 안에 성립한 건만 '지금 신호'로 본다.
     매매 전략(추세형·스윙형) 진입·청산 조건에는 어떤 값도 넘기지 않는다. */
  var divCache = null;
  function divCounts() {
    if (divCache) return divCache;
    var set = {}, list = [], asOf = M.asOf;
    uniList().forEach(function (x) {
      var a = A[x.t];
      if (!a || !a.div || !a.div.hit) return;
      set[x.t] = 1; list.push(x.t);
      if (a.div.date) asOf = a.div.date;
    });
    divCache = { set: set, list: list, n: list.length, asOf: asOf, recent: (QE.DIV_P && QE.DIV_P.recent) || 3 };
    return divCache;
  }
  function divTip(a) {
    var d = a && a.div;
    if (!d || !d.hit || !d.prev) return '';
    return '상승 다이버전스 (RSI14 · 최근 ' + (d.recent || 3) + '거래일) — 직전 저점 ' + d.prev.date + ' $' + pxs(d.prev.low) +
      ' (RSI ' + d.prev.rsi.toFixed(1) + ') → 최근 저점 ' + d.date + ' $' + pxs(d.low) + ' (RSI ' + d.rsi.toFixed(1) + ')' +
      ' — 가격은 더 낮은데 RSI는 올라선 자리 · 참고용 배지(매매 조건 미적용) · 과거 같은 자리 20일 평균 +3.3%·승률 61.6%';
  }
  function divBadge(a) {
    if (!a || !a.div || !a.div.hit) return '';
    return '<i class="divb" title="' + divTip(a) + '">다이버전스</i>';
  }
  /* 히어로(상단 카드) 배지 — 직전 저점 → 최근 저점을 날짜·가격·RSI로 보여 준다 */
  function divStripHtml(a) {
    var d = a && a.div;
    if (!d || !d.hit || !d.prev) return '';
    var when = d.age === 0 ? '오늘' : d.age + '거래일 전';
    return '<span class="dv-ico" aria-hidden="true">📈</span>' +
      '<b>상승 다이버전스</b><span class="dv-sep">·</span>' +
      '<span class="dv-t">직전 저점 <b>' + d.prev.date + '</b> $' + pxs(d.prev.low) + ' (RSI ' + d.prev.rsi.toFixed(1) + ')' +
      ' → 최근 저점 <b>' + d.date + '</b> $' + pxs(d.low) + ' (RSI ' + d.rsi.toFixed(1) + ')</span>' +
      '<span class="dv-sub">가격은 더 낮은데 RSI는 올라선 자리 · 10일 신저가 · ' + d.gap + '봉 간격 · ' + when +
      ' 발생 — 참고용 지표입니다 (매매 조건·수익률 계산에는 적용하지 않습니다)</span>';
  }
  /* ---------------- 20일 신고가 돌파 + 거래량 — 참고 배지 · 프리셋 (표시 전용) ----------------
     엔진 bkScan(series) 결과만 읽는다. 최근 3거래일 안에 성립한 건만 '지금 신호'로 본다.
     · 프리셋 '거래량 돌파' = 20일 돌파 + 돌파일 거래량 ≥ 20일 평균 1.5배(강한 돌파)
     · 행 배지 = 20일 돌파면 '돌파'(거래량 미달은 옅게), 1.5배 동반이면 '거래량돌파'
     매매 전략(추세형·스윙형) 진입·청산·백테스트에는 어떤 값도 넘기지 않는다. */
  var bkCache = null;
  function bkCounts() {
    if (bkCache) return bkCache;
    var set = {}, list = [], soft = {}, softList = [], asOf = M.asOf;
    uniList().forEach(function (x) {
      var a = A[x.t];
      if (!a || !a.bk || !a.bk.hit) return;
      soft[x.t] = 1; softList.push(x.t);
      if (a.bk.date) asOf = a.bk.date;
      if (a.bk.strong) { set[x.t] = 1; list.push(x.t); }
    });
    bkCache = { set: set, list: list, n: list.length, soft: soft, softList: softList, softN: softList.length,
      asOf: asOf, recent: (QE.BK_P && QE.BK_P.recent) || 3, level: (QE.BK_P && QE.BK_P.level) || 20, volX: (QE.BK_P && QE.BK_P.volX) || 1.5 };
    return bkCache;
  }
  /* ---------------- 승률 70%+ (참고 필터) ----------------
     현재 선택된 전략(추세형/스윙형)의 **5년 백테스트 승률**(a.strategy[key].stats.winRate)이
     70% 이상이고 최소 1건 이상 거래가 있는 종목만 모은다. 화면 기간(3M~5Y)과 무관하게 항상 5년 값.
     참고 필터 — 과거 성과 기반이며 매매 신호를 바꾸지 않는다. */
  var win70Cache = {};
  function win70Counts() {
    var key = state.strategy === 'swing' ? 'swing' : 'trend';
    if (win70Cache[key]) return win70Cache[key];
    var set = {}, list = [];
    uniList(key).forEach(function (x) {
      var a = A[x.t];
      if (!a || !a.strategy || !a.strategy[key]) return;
      var st = a.strategy[key].stats;
      if (!st || !(st.trades > 0)) return;                 /* 거래 0건 — 승률을 말할 수 없다 */
      var w = st.winRate != null ? st.winRate : st.win;
      if (w == null) return;
      if (w >= 0.7) { set[x.t] = 1; list.push(x.t); }
    });
    win70Cache[key] = { set: set, list: list, n: list.length, total: uniList(key).length, key: key,
      name: key === 'swing' ? '스윙형(단기)' : '추세형(중기)' };
    return win70Cache[key];
  }
  /* ---------------- 6개월(126거래일) 모멘텀 Top 5 — 참고 배지 · 프리셋 (표시 전용) ----------------
     최근 126거래일 = 종가 126개(오늘 포함) 구간 수익률 = c[마지막] / c[마지막-125] - 1.
     126봉을 채우지 못한 종목(신규 상장·데이터 부족)은 순위에서 제외한다.
     매매 전략(추세형·스윙형)의 진입·청산·백테스트 규칙에는 어떤 값도 넘기지 않는다. */
  var MOM6_BARS = 126, MOM6_TOP = 5;
  var mom6Cache = null;
  function mom6Counts() {
    if (mom6Cache) return mom6Cache;
    var rows = [];
    uniList().forEach(function (x) {
      var a = A[x.t];
      if (!a || !a.close || a.close.length < MOM6_BARS) return;
      var i = a.close.length - 1, j = i - (MOM6_BARS - 1);
      var base = a.close[j], last = a.close[i];
      if (!(base > 0)) return;
      rows.push({ t: x.t, nk: x.nk, r: last / base - 1, px0: base, px1: last,
        from: a.series.d[j], to: a.series.d[i] });
    });
    rows.sort(function (p, q) { return q.r - p.r || (p.t < q.t ? -1 : 1); });
    var set = {}, rank = {}, byT = {}, top = [];
    rows.forEach(function (r, i) {
      r.k = i + 1; byT[r.t] = r;
      if (r.k <= MOM6_TOP) { set[r.t] = 1; rank[r.t] = r.k; top.push(r); }
    });
    mom6Cache = { set: set, rank: rank, byT: byT, rows: rows, top: top,
      list: top.map(function (r) { return r.t; }), n: top.length, pool: rows.length,
      bars: MOM6_BARS, asOf: M.asOf,
      from: rows.length ? rows[0].from : M.asOf, to: rows.length ? rows[0].to : M.asOf };
    return mom6Cache;
  }
  function mom6Tip(r) {
    return '6M 모멘텀 ' + r.k + '위 — 최근 ' + MOM6_BARS + '거래일 ' + pct(r.r, 2) +
      ' (' + r.from + ' $' + pxs(r.px0) + ' → ' + r.to + ' $' + pxs(r.px1) + ')' +
      ' · 위성 10~15% 참고용 · 매매 규칙 미적용(전략 신호는 그대로)';
  }
  function mom6Badge(a) {
    var c = mom6Counts(), r = a && c.byT[a.sym];
    if (!r || r.k > MOM6_TOP) return '';
    var aggr = riskAggr();                 /* 공격형에서는 모멘텀 Top5를 더 세게 강조(테마가 레드·앰버) */
    return '<i class="mom6' + (aggr ? ' onaggr' : '') + '" title="' + mom6Tip(r) + '">6M Top' + r.k + '</i>';
  }
  function bkLevelTxt(b) { return b.level + '일 신고가'; }
  function bkTip(a) {
    var b = a && a.bk;
    if (!b || !b.hit) return '';
    var v = b.volRatio == null ? '—' : b.volRatio.toFixed(2) + '배';
    return bkLevelTxt(b) + ' 돌파 (최근 ' + (b.recent || 3) + '거래일) — ' + b.date + ' 종가 $' + pxs(b.close) +
      ' > 직전 ' + b.level + '봉 최고가 $' + pxs(b.lvl) + ' (+' + (b.over * 100).toFixed(2) + '%)' +
      ' · 거래량 ' + v + ' (20일 평균 대비)' +
      (b.strong ? ' — 거래량 ' + b.volX + '배 동반' : ' — 거래량 ' + b.volX + '배 미달') +
      ' · 참고용 배지(매매 조건 미적용) · 5년 검증: 거래량 1.5배 동반 시 거짓 돌파 57%→41%';
  }
  function bkBadge(a) {
    var b = a && a.bk;
    if (!b || !b.hit) return '';
    return '<i class="bkb' + (b.strong ? ' strong' : '') + '" title="' + bkTip(a) + '">' +
      (b.strong ? '거래량돌파' : '돌파') + '</i>';
  }
  /* 히어로(상단 카드) 배지 — 거래량까지 동반한 돌파만 띄운다 */
  function bkStripHtml(a) {
    var b = a && a.bk;
    if (!b || !b.strong) return '';
    var when = b.sAge === 0 ? '오늘' : b.sAge + '거래일 전';
    return '<span class="bk-ico" aria-hidden="true">🚀</span>' +
      '<b>' + b.level + '일 거래량 돌파</b><span class="bk-sep">·</span>' +
      '<span class="bk-t">' + b.sDate + ' 종가 <b>$' + pxs(b.sClose) + '</b> — 직전 ' + b.level + '봉 최고가 $' + pxs(b.sLvl) +
      ' 상향 (+' + (b.sOver * 100).toFixed(2) + '%) · 거래량 <b>' + b.sVol.toFixed(2) + '배</b></span>' +
      '<span class="bk-sub">' + when + ' 발생 — 참고용 지표입니다 (매매 조건·5년 백테스트에는 적용하지 않습니다). ' +
      '거래량 1.5배 동반 돌파는 5년 검증에서 거짓 돌파가 57%→41%로 줄었습니다.</span>';
  }
  /* 전략 신호 — 스캐너의 매수/매도 탭과 행 칩은 고정 점수(58/44)가 아니라 전략의 단일 소스
     (trendStatus / swingStatus = 백테스트와 같은 진입 조건)를 기준으로 집계한다.
     · 매수: 전략 진입 조건 충족(진입) 또는 그 전략으로 현재 보유 중(보유)
     · 매도: 보유 중 청산·손절 조건 발동(청산) 또는 진입 제한(시장대기·손절대기)
     key 를 넣지 않으면 현재 선택한 전략(state.strategy) 기준 — 행에는 두 전략을 함께 보여 준다. */
  function sigOf(a, key) {
    var swing = (key || state.strategy) === 'swing';
    var st = swing ? a.swing : a.trendPlan;
    var b = a.strategy && (swing ? a.strategy.swing : a.strategy.trend);
    var live = b && b.live;
    var held = !!live, buy = false, sell = false, waitbuy = false, why = '', kind = '';
    if (st && st.signal) { buy = true; why = swing ? 'RSI·시장 조건 충족' : '점수·시장 조건 충족'; kind = 'entry'; }
    /* 보유는 신규 매수와 별개 상태 — 시장 필터(blocked)가 보유 판정을 덮어쓰지 않는다 */
    if (held) { buy = true; why = why || '전략 보유 중'; kind = kind || 'held'; }
    if (held) {
      if (swing) {
        /* 20일선 아래 2거래일 연속 + 이익 +5% 이상에서만 청산 (하루 이탈은 관망) */
        if (live.exitConfirm) {
          sell = true; why = '보유 중 · 20일선 2일 연속 이탈 청산'; kind = 'exit';
        }
      } else if (live.trailStop != null && live.last != null && live.last <= live.trailStop) {
        sell = true; why = '보유 중 · 트레일 청산가 이탈'; kind = 'exit';
      } else if (live.marketExitPending) {
        sell = true; why = '보유 중 · 시장 필터(QQQ 100일선 아래) — 다음 시가 전량 청산'; kind = 'exit';
      }
    }
    /* 신규 진입 제한 — 청산(매도)과 섞지 않고 '매수대기'로 따로 센다. 보유 중이면 보유가 우선. */
    if (!sell && !held && st && st.state === 'blocked') {
      waitbuy = true; kind = 'blocked';
      why = '진입 조건은 갖췄지만 시장 필터로 신규 매수 제한' +
        (swing ? ' · QQQ 200일선 아래' : ' · QQQ 100일선 아래(비중 0%)');
    }
    /* 손절 후 재진입 금지 기간 — 신규 진입 제한 상태(백테스트와 같은 판정) */
    if (!sell && !held && swing && st && st.state === 'cool') {
      waitbuy = true; kind = 'cool';
      why = '손절 후 재진입 대기 (' + st.coolLeft + '/' + st.coolTotal + '일)' +
        (st.coolFromDate ? ' — ' + st.coolFromDate + ' 손절 이후' : '') + ' · 신규 진입 금지 (W 돌파 포함)';
    }
    return { buy: buy && !sell, sell: sell, waitbuy: waitbuy, held: held, why: why, kind: kind };
  }
  function scanCounts(scoped) {
    var c = { all: 0, buy: 0, entryBuy: 0, hold: 0, wait: 0, sell: 0, waitbuy: 0, entry: 0, held: 0, blocked: 0, cool: 0, fav: 0 };
    uniList().forEach(function (x) {
      var a = A[x.t]; if (!a) return;
      if (scoped && !presetMembers(a)) return;          /* 프리셋 안에서만 집계 */
      c.all++;
      if (isWatch(a.sym)) c.fav++;
      var g = sigOf(a);
      if (g.buy) {
        c.buy++;
        if (g.held) c.hold++; else c.entryBuy++;       /* 신규 진입 매수 / 보유시홀드 */
      }
      if (g.sell) c.sell++;                             /* 보유 중 청산 조건 발동만 */
      if (g.waitbuy) c.waitbuy++;                       /* 신규 진입 제한 — 매도와 분리 */
      if (!g.buy && !g.sell && !g.waitbuy) c.wait++;     /* 관망 — 살 자리도 팔 자리도 아님 */
      var st = state.strategy === 'swing' ? a.swing : a.trendPlan;
      if (st && st.signal) c.entry++;
      if (g.held) c.held++;
      if (st && st.state === 'blocked') c.blocked++;
      if (st && st.state === 'cool') c.cool++;
    });
    return c;
  }
  /* 현재 시장 단계 안내 — 0건일 때 이유를 숨기지 않고 보여준다 */
  function marketNoteHtml() {
    var q = A['QQQ'];
    var tp = q && q.trendPlan, sw = q && q.swing;
    var t1 = tp && tp.qqqMa != null ? 'QQQ $' + pxs(tp.qqq) + ' < 100일선 $' + pxs(tp.qqqMa) +
      (tp.qqqRsi2 != null ? ' · QQQ RSI(2) ' + tp.qqqRsi2.toFixed(1) + (tp.panicEntry ? ' (극단 패닉 예외 적용)' : '') : '') : 'QQQ 100일선 데이터 없음';
    var s1 = '';
    if (sw && sw.qqqMa != null) {
      s1 = sw.marketAbove ? 'QQQ 200일선 위'
        : 'QQQ $' + pxs(sw.qqq) + ' < 200일선 $' + pxs(sw.qqqMa) +
          (sw.qqqRsi2 != null ? ' · QQQ RSI(2) ' + sw.qqqRsi2.toFixed(1) + (sw.marketOs ? ' (극단 패닉 예외 적용)' : '') : '');
    }
    return '<b>' + (state.strategy === 'swing' ? '스윙형(단기)' : '추세형(중기)') + '</b> 오늘 신규 매수 <b>0건</b> — ' +
      (state.strategy === 'swing' ? 'QQQ 200일선 아래' : 'QQQ 100일선 아래 · 진입 제한(비중 0%)') + '이라 신규 진입이 막혀 있습니다 (' +
      t1 + ' · ' + s1 + '). 조건을 갖춘 종목은 <b>매수대기</b> 탭에 모아 두었고, 행의 종합점수는 그대로 표시됩니다.';
  }
  /* 행의 전략 상태 칩 — 선택한 전략(또는 key 로 지정한 전략)의 실제 상태만 쓴다.
     상단 카드의 peState/peSig·매수/매도 탭과 같은 단일 소스라 서로 어긋나지 않는다.
     기술점수 라벨(차트 강세/차트 약세)은 행의 신호 칩으로 쓰지 않는다 — '스윙은 대기인데 종목은 차트 강세'로
     보이던 불일치를 없애고, 기술점수는 숫자로 남겨 툴팁에서 '개별 차트 참고 점수'임을 밝힌다. */
  function sigChip(a, key) {
    var swing = (key || state.strategy) === 'swing';
    var g = sigOf(a, key);
    if (g.sell) return { tx: '매도', cls: 's', why: g.why };
    if (g.waitbuy) return { tx: '매수대기', cls: 'n', why: g.why };
    if (g.buy) return { tx: g.held ? '보유시홀드' : '매수', cls: g.held ? 'b' : 'sb', why: g.why };
    var st = swing ? a.swing : a.trendPlan;
    return { tx: '관망', cls: 'w', why: (st && st.reason) || '진입 조건 미충족 — 신규 진입 신호 없음' };
  }
  /* 행의 전략 상태 표기 — 활성 전략은 채운 칩, 다른 전략은 아래 줄에 작은 글씨로 */
  function stratTagHtml(a, key, active) {
    var c = sigChip(a, key), nm = key === 'swing' ? '스윙' : '추세';
    var why = String(c.why || '').replace(/"/g, '”');
    if (active) return '<span class="chip ' + c.cls + '" title="' + nm + '형 기준 — ' + why + '">' + nm + ' ' + c.tx + '</span>';
    return '<span class="st2 ' + c.cls + '" title="' + nm + '형 기준 — ' + why + '">' + nm + ' ' + c.tx + '</span>';
  }
  function triCounts() {
    if (triCache) return triCache;
    var cnt = { '돌파': 0, '임박': 0, '진행': 0 }, set = {}, total = 0, asOf = M.asOf, list = [];
    uniList().forEach(function (x) {
      var a = A[x.t];
      if (!a || !a.tri) return;
      cnt[a.tri.stage] = (cnt[a.tri.stage] || 0) + 1;
      set[x.t] = 1; total++; list.push(x.t);
    });
    triCache = { cnt: cnt, set: set, total: total, asOf: asOf, list: list };
    return triCache;
  }
  /* ---------------- 필터 · 프리셋 (서로 독립 · AND 교집합) ----------------
     상단 탭 state.filter = all | buy | sell | fav
     프리셋  state.preset = '' | top30 | quality | w | vcp | tri | div | bk | win70 | mom6  (같은 버튼을 다시 누르면 해제)
     둘을 함께 켜면 교집합으로 좁히고, 전략을 바꿔도 이 조합은 유지된다. */
  var PRESET_META = {
    top30: { name: '시총 Top 30' }, quality: { name: '실적 우량주' },
    w: { name: 'W 쌍바닥' }, vcp: { name: 'VCP' }, tri: { name: '삼각수렴' }, div: { name: '다이버전스' },
    bk: { name: '거래량 돌파' }, win70: { name: '승률 70%+' }, mom6: { name: '6M모멘텀 Top 5' }
  };
  function presetActive() { return !!(state.preset && PRESET_META[state.preset]); }
  function presetMembers(a) {
    var p = state.preset;
    if (!p) return true;
    if (p === 'top30' || p === 'quality') return !!presetData()[p][a.sym];
    if (p === 'w') return !!wCounts().set[a.sym];
    if (p === 'vcp') return !!vcpCounts().set[a.sym];
    if (p === 'tri') return !!triCounts().set[a.sym];
    if (p === 'div') return !!divCounts().set[a.sym];
    if (p === 'bk') return !!bkCounts().set[a.sym];
    if (p === 'win70') return !!win70Counts().set[a.sym];
    if (p === 'mom6') return !!mom6Counts().set[a.sym];
    return true;
  }
  function filterMembers(a) {
    var g;
    if (state.filter === 'buy') { g = sigOf(a); return g.buy && !g.held; }   /* 신규 진입 매수 */
    if (state.filter === 'hold') { g = sigOf(a); return g.buy && g.held; }   /* 보유시홀드 */
    if (state.filter === 'wait') { g = sigOf(a); return !g.buy && !g.sell && !g.waitbuy; } /* 관망 */
    if (state.filter === 'waitbuy') return sigOf(a).waitbuy;                 /* 매수대기(시장필터) */
    if (state.filter === 'sell') return sigOf(a).sell;
    if (state.filter === 'fav') return isWatch(a.sym);
    return true;
  }
  function matchesFilter(a) { return filterMembers(a) && presetMembers(a); }
  /* 프리셋 하나의 설명 문구 (필터와 무관한 프리셋 자체 정보) */
  function presetText() {
    var pd = presetData();
    if (state.preset === 'div') {
      var dc = divCounts();
      return '<b>상승 다이버전스</b> · RSI14 · 최근 ' + dc.recent + '거래일 내 <b>' + dc.n + '</b>종목 · ' + dc.asOf + ' 종가 기준' +
        ' · 가격은 10일 신저가인데 RSI(14)는 5~60봉 전 저점보다 높은 자리 · 참고용(매매 조건 미적용)';
    }
    if (state.preset === 'bk') {
      var bc = bkCounts();
      return '<b>거래량 돌파</b> · ' + bc.level + '일 신고가 돌파 + 돌파일 거래량 ' + bc.volX + '배 이상 · 최근 ' + bc.recent +
        '거래일 내 <b>' + bc.n + '</b>종목 · ' + bc.asOf + ' 종가 기준' +
        ' · 같은 기간 거래량 없는 20일 돌파 ' + Math.max(0, bc.softN - bc.n) + '종목은 행 배지로만 표시 · 참고용(매매 조건 미적용)';
    }
    if (state.preset === 'tri') {
      var tc = triCounts();
      return '<b>삼각수렴</b> · 돌파 ' + tc.cnt['돌파'] + ' · 임박 ' + tc.cnt['임박'] + ' · 진행 ' + tc.cnt['진행'] +
        ' · ' + tc.asOf + ' 종가 기준 · 대칭/상승/하락삼각만(쐐기 제외) · 표시 전용(매매 조건 미적용)';
    }
    if (state.preset === 'vcp') {
      var vc = vcpCounts(), c = vc.cnt;
      return '<b>VCP · 대형 우량주 한정</b> · 정배열(TT) + 변동성 축소 임박/돌파 · 시총 Top 30 ∪ 실적 우량주 ' + c.pool + '종목 중' +
        ' TT <b>' + c.tt + '</b> · 돌파 <b>' + c.brk + '</b> · 임박 <b>' + c.near + '</b> · ' + vc.asOf + ' 종가 기준';
    }
    if (state.preset === 'mom6') {
      var m6 = mom6Counts();
      return '<b>6M모멘텀 Top 5</b> · 최근 ' + m6.bars + '거래일 수익률 상위 <b>' + m6.n + '</b>종목/' + m6.pool +
        ' · ' + m6.to + ' 종가 기준 · ' +
        m6.top.map(function (r) { return r.t + ' ' + pct(r.r, 1); }).join(' · ') +
        ' · 참고 필터(매매 규칙 불변)';
    }
    if (state.preset === 'win70') {
      var w7 = win70Counts();
      return '<b>승률 70%+ · ' + w7.name + '</b> · 현재 전략 5년 백테스트 승률 70% 이상 종목 <b>' + w7.n + '</b>/' + w7.total +
        ' · 참고 필터(과거 성과 기반) — 미래 수익을 보장하지 않습니다';
    }
    if (state.preset === 'top30') return '<b>시총 상위 ' + pd.nTop + '종목</b> · ' + pd.asOf + ' 시총 기준';
    if (state.preset === 'quality') return '<b>실적 우량주</b> · EPS 흑자 + 매출성장 5% 초과 + 순이익률 15% 초과 · ' + pd.asOf + ' 실적 기준';
    if (state.preset === 'w') {
      var wc = wCounts();
      return '<b>W 쌍바닥</b> · 넥라인 돌파 ' + wc.cnt['돌파'] + ' · 임박 ' + wc.cnt['임박'] + ' · 진행 ' + wc.cnt['진행'] +
        ' · ' + wc.asOf + ' 종가 기준' +
        (wc.cnt['실패'] ? ' (돌파 후 넥라인 아래로 내려온 ' + wc.cnt['실패'] + '종목 제외)' : '');
    }
    return '';
  }
  function filterName() {
    if (state.filter === 'buy') return '매수';
    if (state.filter === 'hold') return '보유시홀드';
    if (state.filter === 'wait') return '관망';
    if (state.filter === 'sell') return '매도';
    if (state.filter === 'fav') return '관심';
    return '전체';
  }
  function presetNoteHtml(shown) {
    var stratName = state.strategy === 'swing' ? '스윙형(단기)' : '추세형(중기)';
    var c = scanCounts(true);              /* 프리셋이 켜져 있으면 그 안에서만 집계 */
    var bits = [];
    if (presetActive()) {
      bits.push(presetText());
      bits.push('<b>' + stratName + ' 기준</b> · 이 프리셋 안 매수 조건 충족 <b>' + c.entry + '</b>건 · 보유 중 <b>' + c.held +
        '</b>건 → 매수/보유 가능 <b>' + (c.entry + c.held) + '</b>건');
      if (state.filter !== 'all') bits.push(filterName() + ' 교집합 <b>' + shown + '</b>종목');
      return bits.join(' · ');
    }
    if (state.filter === 'buy' || state.filter === 'hold' || state.filter === 'sell') {
      return '<b>' + stratName + ' · ' + filterName() + '</b> — 백테스트와 같은 전략 조건으로 집계 · ' +
        '진입 조건 충족 <b>' + c.entry + '</b> · 보유 중 <b>' + c.held + '</b> · 청산/진입 제한 <b>' + c.blocked + '</b>' +
        (c.cool ? ' · 손절 후 재진입 대기 <b>' + c.cool + '</b>' : '') + ' · 마지막 종가 기준';
    }
    if (state.filter === 'fav') {
      return '<b>관심종목</b> ' + state.watch.length + '종목 · 지금 ' + shown + '종목 표시 · 프리셋을 함께 켜면 교집합으로 좁혀집니다';
    }
    return '상단 탭(전체 · 매수 · 홀드 · 관망 · 매도 · 관심)과 프리셋은 함께 적용됩니다 — 프리셋을 다시 누르면 해제 · 검색·정렬과 함께 적용';
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
  /* ---------------- 전략 추천 순위 (상단 전략 버튼 → 좌측 스캐너 자동 정렬) ----------------
     추세형: 진입 조건 충족/보유 우선 → 종합 기술점수 내림차순
     스윙형: 스윙 진입/보유 우선 → 스윙 적합도(RSI(2) 과매도 깊이 · W 단계 · 종합점수) 내림차순 */
  function trendRankOf(a) {
    var st = a.trendPlan;
    var g = sigOf(a, 'trend');
    var sc = rowOf(a).score;
    /* 3 신규 진입 → 2 보유 → 1.8 매수대기(시장 필터로만 막힌 후보) → 1.4 청산 대기 보유 → 0 대기
       매수 0건인 날 1위가 '매도' 종목이 아니라 '대기 후보'가 되도록 청산 보유를 후보보다 뒤에 둔다 */
    var tier = g.sell ? 1.4 : (g.held ? 2 : (g.buy ? 3 : ((st && st.state === 'blocked') ? 1.8 : (st && st.scoreOk ? 1.2 : 0))));
    return { tier: tier, fit: Math.round(sc), score: sc };
  }
  function swingRankOf(a) {
    var st = a.swing, live = a.strategy && a.strategy.swing && a.strategy.swing.live;
    var sc = rowOf(a).score;
    var thr = (QE.swingParams && QE.swingParams.rsiEntry) || 10;
    var r2 = st ? st.rsi2 : null, w = st ? st.wStage : null;
    var rsiComp = 0;
    if (r2 != null) rsiComp = r2 <= thr ? 45 - Math.max(0, r2) * 0.6 : Math.max(0, 45 - (r2 - thr) * 1.6);
    var wComp = w === '돌파' ? 25 : w === '임박' ? 20 : w === '진행' ? 12 : 0;
    var fit = Math.max(0, Math.min(100, Math.round(rsiComp + wComp + sc * 0.3)));
    var g = sigOf(a, 'swing');
    var tier = g.sell ? 1.4 : (g.held ? 2 : (g.buy ? 3 : ((st && (st.state === 'blocked' || st.state === 'cool')) ? 1.8 : 0)));
    return { tier: tier, fit: fit, score: sc, rsi2: r2, w: w, route: st ? st.route : null,
      cool: (st && st.state === 'cool') ? st.coolLeft : 0, coolTotal: (st && st.coolTotal) || 0 };
  }
  function rankInfo(a) { return state.strategy === 'swing' ? swingRankOf(a) : trendRankOf(a); }
  /* 추천 순위 설명 — 행의 상태 칩(sigChip)과 같은 판정을 그대로 옮긴다(둘이 어긋나지 않게) */
  function rankTierText(a, r) {
    var c = sigChip(a);
    var swing = state.strategy === 'swing';
    if (swing) {
      if (c.tx === '매수') return (r.route === 'W돌파' || (a.swing && a.swing.route === 'W돌파')) ? 'W 넥라인 돌파 진입' : 'RSI(2) 과매도 진입';
      if (c.tx === '보유시홀드') return '스윙 보유시홀드';
      if (c.tx === '매도') return '보유 청산 신호 (시뮬 포지션)';
      if (c.tx === '매수대기') return r.cool ? '손절 후 재진입 대기 (' + r.cool + '/' + (r.coolTotal || 10) + '일)'
        : '진입 조건 충족 · QQQ 200일선 아래로 매수대기';
      return '스윙 신호 대기';
    }
    if (c.tx === '매수') return '진입 조건 충족';
    if (c.tx === '보유시홀드') return '추세 보유시홀드';
    if (c.tx === '매도') return '보유 청산 신호 (시뮬 포지션)';
    if (c.tx === '매수대기') return '점수 충족 · QQQ 100일선 아래로 매수대기';
    return '진입 대기';
  }
  function rankTip(a, r, n) {
    var s = '추천 ' + n + '위 · ' + rankTierText(a, r);
    if (state.strategy === 'swing') {
      s += ' · 스윙 적합도 ' + r.fit + '점';
      if (r.rsi2 != null) s += ' · RSI(2) ' + r.rsi2.toFixed(1);
      if (r.w) s += ' · W ' + r.w;
    }
    s += ' · 종합점수 ' + Math.round(r.score);
    return s;
  }
  function syncSortUi() {
    var ss = $('#sortSel'); if (ss) ss.value = state.sort;
    var h = $('#scanRankHead'); if (h) h.textContent = state.sort === 'rec' ? '추천' : '#';
  }
  function adoptRecSort() {
    state.sort = 'rec';
    syncSortUi();
  }
  /* 스캐너에 지금 보이는 종목(탭·프리셋·검색 적용, 정렬 전) — 자동 선택(topScoreT)도 같은 함수를 쓴다 */
  function scanRows() {
    var q = state.listQ.trim().toLowerCase();
    return uniList().map(function (x) { return A[x.t]; }).filter(function (a) {
      if (!a) return false;
      var rv = rowOf(a);
      if (!matchesFilter(a, rv)) return false;
      if (!q) return true;
      return (a.sym + ' ' + a.meta.n + ' ' + a.meta.nk + ' ' + (a.meta.sk || '') + ' ' + (a.meta.s || '')).toLowerCase().indexOf(q) >= 0;
    });
  }
  /* 추천순 비교 — 선택한 전략(state.strategy) 기준: 진입/보유 단계 → 적합도 → 종합점수 */
  function recCmp(a, b) {
    var ar = rankInfo(a), br = rankInfo(b);
    if (br.tier !== ar.tier) return br.tier - ar.tier;
    if (br.fit !== ar.fit) return br.fit - ar.fit;
    return br.score - ar.score;
  }
  function renderScanner() {
    var rows = scanRows();
    var cmp = {
      mc: function (a, b) { return (b.meta.mc || 0) - (a.meta.mc || 0); },
      rec: recCmp,
      score: function (a, b) { return rowOf(b).score - rowOf(a).score; },
      ret: function (a, b) {
        var av = stratBundle(a), bv = stratBundle(b);
        return ((bv && bv.stats) ? bv.stats.totalReturn : -9) - ((av && av.stats) ? av.stats.totalReturn : -9);
      },
      rsi: function (a, b) { return (a.ind.rsi[idxOf(a)] || 99) - (b.ind.rsi[idxOf(b)] || 99); },
      chg: function (a, b) { return rowOf(b).change - rowOf(a).change; }
    }[state.sort] || function (a, b) { return (b.meta.mc || 0) - (a.meta.mc || 0); };
    rows.sort(cmp);
    syncSortUi();
    var counts = scanCounts(presetActive());
    var scopeTxt = presetActive() ? (PRESET_META[state.preset].name + ' 안에서') : '전체 종목';
    $('#cAll').textContent = counts.all;
    $('#cBuy').textContent = counts.entryBuy;
    $('#cSell').textContent = counts.sell;
    var cHd = $('#cHold'); if (cHd) cHd.textContent = counts.hold;
    var cWt = $('#cWait'); if (cWt) cWt.textContent = counts.wait;
    var cWB = $('#cWaitBuy'); if (cWB) cWB.textContent = counts.waitbuy;
    var cf = $('#cFav'); if (cf) { cf.textContent = counts.fav; cf.title = scopeTxt + ' 관심종목 수'; }
    ['#cAll', '#cBuy', '#cHold', '#cWait', '#cWaitBuy', '#cSell'].forEach(function (sel) {
      var el = $(sel); if (el) el.title = scopeTxt + ' 집계 — 프리셋을 켜면 그 안에서 다시 센다';
    });
    var siSum = $('#siSum');
    if (siSum) siSum.textContent = (presetActive() ? PRESET_META[state.preset].name + ' · ' : '') +
      (state.strategy === 'swing' ? '스윙형' : '추세형') + ' · 매수 ' + counts.entryBuy + ' · 홀드 ' + counts.hold +
      ' · 관망 ' + counts.wait + ' · 매수대기 ' + counts.waitbuy + ' · 매도 ' + counts.sell;
    var pd = presetData();
    var cTop = $('#cTop30'); if (cTop) cTop.textContent = pd.nTop;
    var cQual = $('#cQual'); if (cQual) cQual.textContent = pd.nQual;
    var cW = $('#cW'); if (cW) cW.textContent = wCounts().total;
    var cV = $('#cVcp'); if (cV) cV.textContent = vcpCounts().cnt.total;
    var cT = $('#cTri'); if (cT) cT.textContent = triCounts().total;
    var cDv = $('#cDiv'); if (cDv) cDv.textContent = divCounts().n;
    var cBk = $('#cBk'); if (cBk) cBk.textContent = bkCounts().n;
    var cW70 = $('#cWin70'); if (cW70) cW70.textContent = win70Counts().n;   /* 0건이면 0 그대로 */
    var cM6 = $('#cMom6'); if (cM6) cM6.textContent = mom6Counts().n;
    var pn = $('#presetNote');
    if (pn) {
      pn.innerHTML = presetNoteHtml(rows.length);
      pn.classList.toggle('on', presetActive() || state.filter !== 'all');
    }
    renderPresetGuide();

    var recMode = state.sort === 'rec', recSwing = recMode && state.strategy === 'swing';
    var listHtml = rows.length ? rows.map(function (a, ri) {
      var x = a.meta, rv = rowOf(a), ew = a.elliott;
      var ewb = (ew && ew.ok) ? '<i class="ewb ' + (ew.dir > 0 ? 'up' : 'dn') + '">' + ew.badge + '</i>' : '';
      /* 활성 전략과 반대 전략의 상태를 함께 보여 준다 (예: 스윙 대기 / 추세 보유) */
      var actKey = state.strategy === 'swing' ? 'swing' : 'trend';
      var othKey = actKey === 'swing' ? 'trend' : 'swing';
      var rk = recMode ? rankInfo(a) : null;
      var rkCls = 'rk' + (recMode ? ' rec' + (ri < 3 ? ' top' + (ri + 1) : '') : '');
      var rkTx = recMode ? (ri + 1) : (x.r || '·');
      var rkTt = recMode ? ' title="' + rankTip(a, rk, ri + 1) + '"' : '';
      var scTx = recSwing ? rk.fit : Math.round(rv.score);
      var scTt = recSwing ? ' title="' + rankTip(a, rk, ri + 1) + '"'
        : ' title="종합 기술점수(0~100) — 개별 차트 참고 점수이며 매매 신호가 아닙니다"';
      return '<div class="srow' + (state.cur === x.t ? ' on' : '') + '" data-t="' + x.t + '"' +
        (recMode ? ' data-tier="' + rk.tier + '" data-fit="' + rk.fit + '"' : '') + '>' +
        '<div class="' + rkCls + '"' + rkTt + '>' + rkTx + '</div>' +
        '<div class="tk"><b><i class="fstar' + (isWatch(x.t) ? ' on' : '') + '" data-f="' + x.t + '" role="button" title="' + (isWatch(x.t) ? '관심종목에서 제거' : '관심종목에 추가') + '">' + (isWatch(x.t) ? '★' : '☆') + '</i>' + x.t + mom6Badge(a) + ewb + divBadge(a) + bkBadge(a) + vcpBadge(a) + earnChip(x.t) + '</b><span>' + x.nk + '</span></div>' +
        spark(a, rv.i) +
        '<div class="px"><b>' + (rv.price >= 1000 ? rv.price.toFixed(0) : rv.price.toFixed(2)) + '</b>' +
        '<span class="' + cls(rv.change) + '">' + pct(rv.change, 2) + '</span></div>' +
        '<div class="sg">' + stratTagHtml(a, actKey, true) +
        '<div class="sg2"><span class="sc' + (recSwing ? ' fit' : '') + '"' + scTt + '>' + scTx + '</span>' +
        stratTagHtml(a, othKey, false) + '</div></div>' +
        '</div>';
    }).join('') : ((state.filter === 'buy' || state.filter === 'sell' || state.filter === 'waitbuy')
      ? '<div class="scan-note">' + marketNoteHtml() + '</div>'
      : '<div class="empty">' + (presetActive()
        ? '이 프리셋(' + PRESET_META[state.preset].name + ') 안에 해당 조건의 종목이 없습니다'
        : (state.preset === 'tri' ? '지금 삼각수렴(대칭·상승·하락) 단계인 종목이 없습니다' : '해당 조건의 종목이 없습니다')) + '</div>');
    /* 매수 신호인데 진입 조건 충족이 0건이면(보유 종목만 있는 경우 포함) 시장 단계 안내를 목록 맨 위에 */
    if (state.filter === 'buy' && rows.length) {
      var cc0 = scanCounts(presetActive());
      if (cc0.entry === 0) listHtml = '<div class="scan-note">' + marketNoteHtml() + '</div>' + listHtml;
    }
    $('#scanList').innerHTML = listHtml;
    /* 행 안 배지가 잘리면(좁은 사이드바·모바일) 우선순위대로 양보한다:
       엘리어트 차수 → VCP → 다이버전스 → 돌파 → 6M모멘텀 → 실적 배지 축약('실적 D-3' → 'D-3'). 전략 배지(시장대기·진입·보유·청산)는 끝까지 남긴다. */
    $$('#scanList .srow .tk b').forEach(function (b) {
      if (b.scrollWidth <= b.clientWidth) return;
      ['.ewb', '.vcpb', '.divb', '.bkb', '.mom6'].forEach(function (sel) {
        if (b.scrollWidth <= b.clientWidth) return;
        var e = b.querySelector(sel);
        if (e) e.parentNode.removeChild(e);
      });
      if (b.scrollWidth <= b.clientWidth) return;
      var ed = b.querySelector('.edot');
      if (ed) ed.textContent = ed.textContent.replace(/^실적\s*/, '');
    });
    $$('#scanList .srow').forEach(function (r) {
      r.onclick = function (e) {
        var f = e.target.closest('.fstar');
        if (f) { e.stopPropagation(); watchToggle(f.getAttribute('data-f')); return; }
        select(r.dataset.t);
      };
    });
    renderTodayStrip();
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
  var uniCache = {};          /* '성향|mode|bars' → 종목 성과 분포 */
  var uniRunning = {};        /* 진행 중인 기간 집계 */
  var uniGen = 0;             /* 성향을 바꾸면 진행 중인 집계 결과를 버린다 */
  function uniKey(mode, bars) { return riskProfile() + '|' + mode + '|' + bars; }
  function accNew() { return { rets: [], mdds: [], bhs: [], wrs: [], beat: 0, ntr: 0 }; }
  function accAdd(acc, it, covered, bars) {
    if (!it || !it.stats) return;
    if (covered < bars) return;          /* 선택 기간을 다 채우지 못한 종목(상장 초기) 제외 */
    acc.rets.push(it.stats.totalReturn); acc.mdds.push(it.stats.mdd); acc.bhs.push(it.stats.bhReturn);
    if (it.stats.totalReturn > it.stats.bhReturn) acc.beat++;
    if (it.stats.trades > 0) { acc.wrs.push(it.stats.winRate); acc.ntr += it.stats.trades; }
  }
  function accEnd(acc) {
    return { n: acc.rets.length, mean: meanOf(acc.rets), med: medianOf(acc.rets), beat: acc.beat,
      mdd: meanOf(acc.mdds), bh: meanOf(acc.bhs),
      win: acc.wrs.length ? meanOf(acc.wrs) : null, trades: acc.ntr };
  }
  function uniBundle(t, bars) { return bars >= 1255 ? (A[t] && A[t].strategy) : winOf(t, bars); }
  /* 5년(또는 선택 기간) 백테스트 창을 온전히 채운 종목의 전략 성과 분포 */
  function computeUniNow(mode, bars) {
    var acc = accNew();
    uniList(mode).forEach(function (x) {
      var a = A[x.t];
      if (!a || !a.close) return;
      var b = uniBundle(x.t, bars); if (!b) return;
      var it = b[mode] || b.trend; if (!it) return;
      accAdd(acc, it, a.close.length - it.startIdx, bars);
    });
    return accEnd(acc);
  }
  /* 기간 집계를 8ms 단위로 나눠 계산 — 기간 전환 순간 UI가 멈추지 않게 */
  function startUniJob(bars, done) {
    if (!bootReady) { deferJob('uni', bars, done); return; }   /* 152종목 첫 분석 전에는 기간 집계를 시작하지 않는다 */
    var key = 'job' + bars + '|' + riskProfile();
    if (uniRunning[key]) { if (done) uniRunning[key].push(done); return; }
    var waits = uniRunning[key] = done ? [done] : [];
    var gen = uniGen;
    var order = M.tickers.slice(), idx = 0;        /* 두 전략을 한 번에 — 집계만 유니버스별로 나눈다 */
    var accs = { trend: accNew(), swing: accNew() };
    function step() {
      var t0 = performance.now();
      while (idx < order.length && performance.now() - t0 < 8) {
        var x = order[idx++], a = A[x.t];
        if (!a || !a.close) continue;
        var b = uniBundle(x.t, bars); if (!b) continue;
        ['trend', 'swing'].forEach(function (m) {
          if (!inUniv(x, m)) return;               /* 추세형 집계는 Top 100(102종목)만 */
          var it = b[m]; if (!it) return;
          accAdd(accs[m], it, a.close.length - it.startIdx, bars);
        });
      }
      if (idx < order.length) { setTimeout(step, 0); return; }
      if (gen !== uniGen) { delete uniRunning[key]; return; }   /* 성향이 바뀌어 결과가 무효 — 버린다 */
      uniCache[uniKey('trend', bars)] = accEnd(accs.trend);
      uniCache[uniKey('swing', bars)] = accEnd(accs.swing);
      delete uniRunning[key];
      if (btBars() === bars) renderStrategy();
      waits.forEach(function (f) { try { f(); } catch (e) {} });
    }
    setTimeout(step, 0);
  }
  function universeStats(mode) {
    var bars = btBars();
    var key = uniKey(mode, bars);
    if (uniCache[key]) return uniCache[key];
    if (bars >= 1255) return (uniCache[key] = computeUniNow(mode, bars));
    startUniJob(bars);                     /* 계산 중에는 null — 화면은 '집계 중' 표시 */
    return null;
  }
  /* 부팅 뒤 나머지 기간(3M·6M·1Y·2Y)을 놀고 있는 시간에 미리 계산해 둔다 */
  function prefetchPeriods() {
    var mine = btBars();
    var list = [mine].concat([63, 126, 252, 504].filter(function (b) { return b !== mine; }));
    (function next() {
      if (!list.length) return;
      var bars = list.shift();
      if (uniCache[uniKey('trend', bars)]) { setTimeout(next, 0); return; }
      startUniJob(bars, next);
    })();
  }
  /* ============================================================
     투자 운영 원칙 — 선택형 탭 (📌 기본 원칙 · 🛡️ 안정형 · 🔥 공격형)
     · 길게 나열하지 않고 고른 항목의 핵심만 보여 준다
     · 성향(1️⃣)을 바꾸면 그 성향 탭으로 자동 연동 — 사용자는 언제든 자유롭게 눌러 비교
     ============================================================ */
  var nxTab = 'base';
  function nxHead(txt, tone) {
    return '<div class="nx-lab"><b>' + txt + '</b><span class="nx-pill ' + tone + '">' + (tone === 'safe' ? '🛡️ 안정형' : '🔥 공격형') + '</span></div>';
  }
  function nxPaneHtml(prof) {
    var p = QE.riskParams ? QE.riskParams(prof) : riskParams(), g = riskGuide();
    var aggr = prof === 'aggr';
    var sw = g.swing || {}, tr = g.trend || {};
    var rules = aggr
      ? ['스윙 <b>손절 상한 −' + Math.round((p.swing.stopCap || 0.15) * 100) + '%</b>',
         '손절 후 재진입 금지 <b>' + (p.swing.coolLoss || 0) + '일</b>',
         '추세는 <b>C2 50% + 6M모멘텀 Top5 50%</b> 가이드']
      : ['스윙 <b>손절 상한 −' + Math.round((p.swing.stopCap || 0.10) * 100) + '%</b>',
         '손절 후 재진입 금지 <b>' + (p.swing.coolLoss == null ? 10 : p.swing.coolLoss) + '거래일</b>',
         '추세는 <b>C2 규칙 그대로</b> (모멘텀 가미 없음)'];
    var nums = aggr
      ? ['스윙 S2 <b>5Y ' + pct(sw.ret5, 1) + '</b> · <b>10Y ' + pct(sw.ret10, 1) + '</b>',
         '추세 블렌드 <b>10Y ' + pctK(tr.ret10, 0) + '</b> · MDD <b class="neg">' + pct(tr.mdd10, 1) + '</b> · 2022년 ' + pct(tr.y2022, 1)]
      : ['스윙 <b>5Y +144.9%</b> · <b>10Y +249.4%</b> (S2 비교 기준)',
         '추세 C2 <b>10Y +914.1%</b> · MDD <b class="neg">−21.3%</b> · 샤프 1.45'];
    var note = aggr
      ? '수익 구간이 넓어진 만큼 <b>한 번의 손실폭도 커집니다</b> — 진입 전에 손절가를 먼저 정하세요'
      : '검증된 기본 규칙 그대로 — <b>원금 방어 우선</b>, 신호가 적어 거래 횟수가 줄어듭니다';
    return '<div class="nx-grid nx-grid-1">' +
        '<div class="nx-item ' + (aggr ? 'nx-swing' : 'nx-hold') + '">' +
          nxHead('규칙 차이', aggr ? 'aggr' : 'safe') +
          '<ul class="nx-list">' + rules.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' +
        '</div>' +
        '<div class="nx-item nx-nums">' +
          nxHead('검증 수치 (고정 · 10년/5년)', aggr ? 'aggr' : 'safe') +
          '<ul class="nx-list">' + nums.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' +
        '</div>' +
      '</div>' +
      '<p class="nx-foot">' + note + ' · 지금 화면의 계좌 수치는 아래 <b>계좌 시뮬레이션</b>에서 선택한 성향·전략·기간으로 다시 계산됩니다.</p>';
  }
  /* 전략 탭 — 지금 기간의 유니버스 성과까지 함께(동적) */
  function nxStratHtml(key) {
    var sw = key === 'swing';
    var p = sw ? (QE.swingParams || {}) : (QE.trendParams || {});
    var info = stratInfo(key), u = universeStats(key);
    var rules = sw
      ? ['진입 · <b>RSI(2) ' + (p.rsiEntry || 10) + ' 미만</b> + QQQ ' + (p.qqqMa || 200) + '일선 위 (RSI(2) 5 미만 극단 패닉이면 아래여도 허용)',
         '손절 · <b>' + (p.stopAtr || 4.5) + ' ATR</b>, 최대 <b>−' + Math.round((p.stopCap || 0.10) * 100) + '%</b> · 재진입 ' + (p.coolLoss == null ? 10 : p.coolLoss) + '거래일 금지',
         '청산 · 이익 <b>+' + Math.round((p.ma20Gate || 0.05) * 100) + '%</b> 이상에서 20일선 아래 <b>' + (p.ma20Confirm || 2) + '일</b> 연속 마감 → 다음 날 시가']
      : ['진입 · 종합점수 <b>' + (p.entry == null ? 50 : p.entry) + ' 이상</b> + QQQ 100일선 단계 (RSI(2)<5 극단 패닉 예외)',
         '손절 <b>' + (p.stopAtr || 6) + ' ATR</b> · 트레일 <b>' + (p.trailAtr || 10) + ' ATR</b> 즉시',
         '청산 · 시장약세 전량 청산은 진입 <b>' + (p.minHold || 3) + '거래일</b> 이후 · 보유 중기(수개월)'];
    var perf = '<ul class="nx-list">' +
      '<li>이 기간(<b>' + btTag() + '</b>) <b>' + (u ? u.n : uniList(key).length) + '종목</b> 평균 <b class="' + (u ? cls(u.mean) : '') + '">' + (u ? pct(u.mean, 2) : '집계 중…') + '</b>' +
        ' · 중앙 ' + (u ? pct(u.med, 2) : '—') + '</li>' +
      '<li>평균 MDD <b class="neg">' + (u ? pct(u.mdd, 2) : '—') + '</b> · 승률 <b>' + (u && u.win != null ? (u.win * 100).toFixed(1) + '%' : '—') + '</b> · 보유 초과 ' + (u ? u.beat + '/' + u.n : '—') + '</li>' +
      '<li>유니버스 <b>' + (sw ? 'Top 150 · 152종목' : 'Top 100 · 102종목') + '</b> · 신호 다음 날 시가 매수 · 비용 0.03%</li>' +
      '</ul>';
    return '<div class="nx-grid nx-grid-1">' +
        '<div class="nx-item ' + (sw ? 'nx-swing' : 'nx-hold') + '">' +
          '<div class="nx-lab"><b>' + (sw ? '⚡ 스윙형 (단기)' : '📈 추세형 (중기)') + '</b><span class="nx-pill ' + (sw ? 'aggr' : 'safe') + '">' + (sw ? 'Top 150' : 'Top 100') + '</span></div>' +
          '<ul class="nx-list">' + rules.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' +
        '</div>' +
        '<div class="nx-item nx-nums">' +
          '<div class="nx-lab"><b>지금 기간 성과</b><span class="nx-pill ' + (sw ? 'aggr' : 'safe') + '">' + btName() + '</span></div>' +
          perf +
        '</div>' +
      '</div>' +
      '<p class="nx-foot">' + (sw ? '단기 눌림 매수 — 거래가 잦고 보유가 짧습니다(평균 수주).' : '중기 추세 추종 — 거래가 적고 보유가 깁니다(평균 수개월).') +
      ' 지금 화면의 전략은 <b>3️⃣ 전략</b> 버튼에서 바꿉니다.</p>';
  }
  function renderNotice() {
    var s = $('#nxSafe'), a = $('#nxAggr'), t = $('#nxTrend'), g = $('#nxSwing');
    if (s) s.innerHTML = nxPaneHtml('safe');
    if (a) a.innerHTML = nxPaneHtml('aggr');
    if (t) t.innerHTML = nxStratHtml('trend');
    if (g) g.innerHTML = nxStratHtml('swing');
    $$('#nxTabs button').forEach(function (b) {
      var on = b.getAttribute('data-nx') === nxTab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('#nxBody [data-nx-pane], #noticeCard [data-nx-pane]').forEach(function (pn) {
      pn.hidden = pn.getAttribute('data-nx-pane') !== nxTab;
    });
  }
  function setNxTab(k, fromRisk) {
    nxTab = (k === 'safe' || k === 'aggr' || k === 'trend' || k === 'swing' || k === 'lim' || k === 'base') ? k : 'base';
    renderNotice();
  }

  /* ============================================================
     계좌 포트폴리오 시뮬레이션 — 2️⃣ 투자방식 (집중 1 · 분산 3 · 분산 10)
     ------------------------------------------------------------
     · 고정 숫자를 쓰지 않는다. **지금 화면의 조합** 위에서 매번 계산한다:
         성향(안정/공격) × 전략(추세 Top100 / 스윙 Top150) × 기간(3M·6M·1Y·2Y·5Y) × 슬롯 수
     · 규칙 (REPORT_SLOTS_3_5_10 · REPORT_PORTFOLIO_CAP 실측과 같은 계좌 규칙)
         신호 = 당일 종가 판정 → 다음 거래일 시가 매수 (엔진 거래 기록 그대로)
         슬롯 = N개, 1포지션 목표 = 계좌 equity / N (동일가중, 리밸런싱 없음)
         우선순위 = 시총순위 오름차순 (동률은 유니버스 순서)
         섹터 캡 = 1슬롯 없음 · 3슬롯 1종목 · 10슬롯 3종목
         패닉일(QQQ 200일선 아래 ∧ QQQ RSI(2)<5) 신규 투입 합계 ≤ 계좌 70%
         비용 = 매수·매도 각 0.03% · 현금 잔고 연 4%(일 4/252% 복리)
         미래참조 없음 — 판단은 당일 종가까지, 집행은 다음 날 시가
     · 캐시 '성향|전략|기간' — 기간·성향·전략이 바뀔 때만 다시 계산한다.
     · 8ms 단위로 나눠 계산해 화면이 멈추지 않는다(기간 집계와 같은 방식).
     ============================================================ */
  var ACCT_SLOTS = {
    conc1: { key: 'conc1', n: 1, cap: 0, label: '🎯 집중 1', short: '집중 1', weight: '100%', hold: '1종목 전부' },
    div3: { key: 'div3', n: 3, cap: 1, label: '⚖️ 분산 3', short: '분산 3', weight: '33%', hold: '1종목 33%' },
    div10: { key: 'div10', n: 10, cap: 3, label: '🌐 분산 10', short: '분산 10', weight: '10%', hold: '1종목 10%' }
  };
  var SLOT_KEYS = ['conc1', 'div3', 'div10'];
  var SLOT_STORE = 'apex.slots.v1';
  var ACCT_C = (window.QE_ACCT && QE_ACCT.C) || {};
  var ACCT_FEE = ACCT_C.fee, ACCT_PANIC = ACCT_C.panic, ACCT_RATE = ACCT_C.rate;
  var ACCT_WARM = ACCT_C.warm;   /* 웜스타트 봉 수 — 창 앞 250봉(약 1년)부터 운용한 계좌에서 창만 측정 */
  /* 스트레스 모드(2026-11-28) — 기본 OFF. 켜면 보수적 슬리피지(편도 0.15% · 왕복 0.3%)와
     '보유 전종목 −10% 갭(손절 미작동)' 1회 충격을 넣어 최악의 하루를 견딘다. */
  var ACCT_STRESS_KEY = 'apex.acctStress.v1';
  var ACCT_SLIP = ACCT_C.slip, ACCT_GAP = ACCT_C.gap;
  var acctStress = false;
  try { acctStress = localStorage.getItem(ACCT_STRESS_KEY) === '1'; } catch (e) {}
  function acctStressOn() { return acctStress; }
  function acctStressSet(on) {
    acctStress = !!on;
    try { localStorage.setItem(ACCT_STRESS_KEY, acctStress ? '1' : '0'); } catch (e) {}
  }
  function slotMode() { return ACCT_SLOTS[state.invest] ? state.invest : 'div10'; }
  function slotInfo(k) { return ACCT_SLOTS[k || slotMode()]; }
  function slotRestore() {
    try {
      var v = localStorage.getItem(SLOT_STORE);
      if (ACCT_SLOTS[v]) state.invest = v;
    } catch (e) { /* 저장소 차단 환경에서는 분산 10 */ }
  }
  function slotPersist() { try { localStorage.setItem(SLOT_STORE, slotMode()); } catch (e) {} }
  function slotSecCapText(k) {
    var c = slotInfo(k).cap;
    return c > 0 ? ('동일 섹터 최대 ' + c + '종목') : '섹터 캡 없음(1종목)';
  }
  /* 2️⃣ 투자방식 버튼 — 성향·전략·기간은 그대로 두고 슬롯 수만 바꾼다(재분석 없음) */
  function setAcctSlot(k) {
    if (!ACCT_SLOTS[k] || k === slotMode()) { renderAcct(); return; }
    state.invest = k;
    slotPersist();
    renderAcct();
    renderHeroAcct();
    renderTodayStrip();
  }

  /* ---------------- 계좌 시뮬레이션 엔진 ---------------- */
  var acctCache = {};        /* '성향|전략|기간' → { conc1:{…}, div3:{…}, div10:{…} } */
  var acctRunning = {};      /* 진행 중인 작업(같은 키는 한 번만) */
  var acctGen = 0;           /* 성향이 바뀌면 진행 중인 결과를 버린다 */
  function acctKey(mode, bars) { return riskProfile() + '|' + mode + '|' + bars + '|' + (acctStressOn() ? 'S' : 'n'); }
  /* 동일 기간 QQQ 단순 보유 벤치마크 — **계좌와 같은 진입 시점**으로 맞췄다(2026-11-28).
     계좌는 창 첫날 시가에 신규 진입하므로, 벤치도 창 첫날 **시가**(없으면 그 전날 종가)에서 시작해
     마지막 날 종가로 평가한다. 예전엔 첫날 종가부터라 6M에서 0.6%p 만큼 벤치가 불리하게 잡혔다. */
  var _benchCache = {};
  function qqqBench(bars) {
    var key = bars + '|' + acctStressOn();
    if (_benchCache[key]) return _benchCache[key];
    var s = (M.series && M.series.QQQ) || null;
    if (!s || !s.c || s.c.length < 2) return null;
    var G = M.dates.length, start = Math.max(0, G - bars), off = s.off || 0;
    var i0 = Math.max(0, start - off), first = null, peak = 0, mdd = 0, ret = 0;
    /* 기준가 = 창 첫날 시가(계좌와 같은 순간) · 시가가 없으면 그 전날 종가 */
    first = (s.o && s.o[i0] > 0) ? s.o[i0] : null;
    if (first == null) {
      var prev = (s.c[i0 - 1] > 0) ? s.c[i0 - 1] : null;
      first = prev != null ? prev : (s.c[i0] > 0 ? s.c[i0] : null);
    }
    if (first == null) return null;
    peak = first;
    for (var i = i0; i < s.c.length; i++) {
      var v = s.c[i];
      if (!(v > 0)) continue;
      if (v > peak) peak = v;
      var dd = (v - peak) / peak;
      if (dd < mdd) mdd = dd;
      ret = v / first - 1;
    }
    var out = { ret: ret, mdd: mdd, bars: bars, start: M.dates[start], end: M.dates[G - 1], base: first, baseKind: (s.o && s.o[i0] > 0) ? '시가' : '전일 종가' };
    _benchCache[key] = out;
    return out;
  }
  /* 패닉일 — QQQ 이평선 아래이면서 QQQ RSI(2) < 5.
     **전략별로 정의를 분리한다(2026-11-28)**: 추세형 100일선 · 스윙형 200일선.
     추세 엔진의 시장 위험도 100일선, 스윙 엔진은 200일선을 쓰므로 계좌도 같은 선을 쓴다. */
  var _panicCache = {};
  function acctPanicMa(mode) { return (mode || stratKey()) === 'swing' ? 200 : 100; }
  function acctPanic(mode) {
    var m = (mode || stratKey()) === 'swing' ? 'swing' : 'trend';
    var s = (M.series && M.series.QQQ) || null;
    if (!s || !s.c || !QE.sma || !QE.rsi) return null;
    var stamp = m + '|' + (M.asOf || '') + '|' + s.c.length;
    if (_panicCache[stamp]) return _panicCache[stamp];
    var off = s.off || 0, c = s.c, maP = acctPanicMa(m), ma = QE.sma(c, maP), r2 = QE.rsi(c, 2);
    var map = new Array(M.dates.length).fill(false);
    for (var i = 0; i < c.length; i++) {
      if (ma[i] == null || r2[i] == null) continue;
      map[off + i] = (c[i] < ma[i] && r2[i] < 5);
    }
    _panicCache[stamp] = map;
    return map;
  }
  /* 종목별 전략 거래를 계좌 입력으로 — 지금 성향·기간으로 계산된 엔진 거래를 그대로 쓴다 */
  function acctRow(x, b, mode) {
    var a = A[x.t];
    if (!a || !a.series || !b) return null;
    var it = b[mode]; if (!it || !it.trades || !it.trades.length) return null;
    var off = (M.series[x.t] && M.series[x.t].off) || 0, tr = [], i, t;
    for (i = 0; i < it.trades.length; i++) {
      t = it.trades[i];
      if (t.entryIdx == null || !(t.entry > 0) || t.exitIdx == null || !(t.exit > 0)) continue;
      tr.push({ eG: off + t.entryIdx, xG: t.reason === '보유중' ? -1 : off + t.exitIdx,
        eP: t.entry, xP: t.exit, hold: t.hold || 0,
        /* 트레이드 비중 w — 추세형 시장 주의(caution) 구간은 0.5, 극단 패닉 예외는 1, 스윙형은 늘 1 */
        w: (t.w == null ? 1 : Math.max(0, Math.min(1, t.w))) });
    }
    if (!tr.length) return null;
    return { t: x.t, rank: x.r == null ? 1e9 : x.r, sec: x.sk || x.nk || '기타',
      off: off, c: a.series.c, trades: tr };
  }
  /* 유니버스 전체의 계좌 입력 행 — 화면 계산과 검증 훅(APEX_ACCT.rows)이 같은 함수를 쓴다 */
  function acctRows(mode, bars) {
    var out = [];
    uniList(mode).forEach(function (x) {
      var row = null;
      try { row = acctRow(x, winOf(x.t, bars, ACCT_WARM), mode); } catch (e) { row = null; }
      if (row) out.push(row);
    });
    return out;
  }
  /* 슬롯 하나의 계좌 곡선 — 계산 본체는 acct.js(QE_ACCT.run) 하나뿐이다.
     여기서는 화면 상태(성향·전략)를 읽어 상수·패닉 지도만 채워 넘긴다.
     · 웜스타트: 창 앞 ACCT_WARM(250)봉부터 운용한 계좌에서 창 구간만 측정
     · 패닉일: 추세 100일선 · 스윙 200일선 (acctPanicMa)
     · 스트레스: 편도 슬리피지 + 최대 노출일 −10% 갭 1회 */
  function acctRun(rows, slot, bars, mode, opt) {
    opt = opt || {};
    var stress = (opt.stress == null) ? acctStressOn() : !!opt.stress;
    var G = opt.G || M.dates.length;
    var mkey = mode || opt.mode || stratKey();
    var out = QE_ACCT.run(rows, slot, {
      bars: bars, G: G,
      warm: (opt.warm == null ? ACCT_WARM : opt.warm),
      simStart: opt.simStart,
      dates: opt.dates || M.dates,
      panic: (opt.panic !== undefined) ? opt.panic : acctPanic(mkey),
      stress: stress, fee: ACCT_FEE, rate: ACCT_RATE, panicPct: ACCT_PANIC,
      slip: ACCT_SLIP, gap: ACCT_GAP
    });
    return out;
  }
  /* 성향·전략·기간 조합 하나를 계산 — 두 전략 × 세 슬롯을 한 번에 캐시한다 */
  function startAcctJob(bars, done) {
    if (!bootReady) { deferJob('acct', bars, done); return; }  /* 첫 분석 전에는 계좌 계산을 시작하지 않는다 */
    var key = 'job' + bars + '|' + riskProfile() + '|' + (acctStressOn() ? 'S' : 'n');
    if (acctRunning[key]) { if (done) acctRunning[key].push(done); return; }
    var waits = acctRunning[key] = done ? [done] : [];
    var gen = acctGen, job = [], inputs = { trend: [], swing: [] }, ix = 0;
    ['trend', 'swing'].forEach(function (m) {
      uniList(m).forEach(function (x) { job.push({ m: m, x: x }); });
    });
    function step() {
      var t0 = window.performance && performance.now ? performance.now() : Date.now();
      function now() { return window.performance && performance.now ? performance.now() : Date.now(); }
      while (ix < job.length && now() - t0 < 8) {
        var it = job[ix++], row = null;
        try { row = acctRow(it.x, winOf(it.x.t, bars, ACCT_WARM), it.m); } catch (e) { row = null; }
        if (row) inputs[it.m].push(row);
      }
      if (ix < job.length) { setTimeout(step, 0); return; }
      if (gen !== acctGen) { delete acctRunning[key]; return; }      /* 성향 변경 — 결과 폐기 */
      ['trend', 'swing'].forEach(function (m) {
        var r = {};
        SLOT_KEYS.forEach(function (sk) { r[sk] = acctRun(inputs[m], ACCT_SLOTS[sk], bars, m, {}); });
        acctCache[acctKey(m, bars)] = r;
      });
      delete acctRunning[key];
      if (btBars() === bars) { renderAcct(); renderHeroAcct(); renderTodayStrip(); }
      waits.forEach(function (f) { try { f(); } catch (e) {} });
    }
    setTimeout(step, 0);
  }
  /* 검증용 훅 — 화면과 같은 계산 결과를 외부 스크립트가 읽는다(APEX_DIAG 과 같은 방식) */
  try {
    window.APEX_ACCT = { stats: acctStats, cache: acctCache, panic: acctPanic, slot: slotMode,
      run: acctRun, bench: qqqBench, key: acctKey, stress: acctStressOn, panicMa: acctPanicMa, warm: ACCT_WARM,
      toggleStress: acctToggleStress,
      rows: function (m, bars) { return acctRows(m, bars); } };
  } catch (e) { /* file:// 등에서 막히면 무시 */ }
  /* 지금 화면 조합의 슬롯 결과 — 없으면 계산을 걸어 두고 null(화면은 '계산 중') */
  function acctStats(sk) {
    var bars = btBars(), c = acctCache[acctKey(stratKey(), bars)];
    if (c && c[sk]) return c[sk];
    startAcctJob(bars);
    return null;
  }
  /* ------------------------------------------------------------
     손절 1회 충격 — 종목 1개 손절이 계좌에서 잃는 비율 (계산값 · 하드코딩 금지)
       · 스윙형: 성향별 손절 상한(안정형 −10% · 공격형 −15%). 4.5 ATR 손절선이 그보다 멀면 상한에서 청산
       · 추세형: 고정 퍼센트 상한이 없고 6 ATR이 손절폭 — 지금 유니버스의 6 ATR/현재가 평균을 쓴다
     계좌 충격 = 종목 손실률 ÷ 슬롯 수 (동일가중). 갭 하락이면 손절가보다 더 밀릴 수 있다.
     ------------------------------------------------------------ */
  var stopWidthCache = null;
  function trendStopWidth() {
    if (stopWidthCache && stopWidthCache.asOf === M.asOf && stopWidthCache.risk === riskProfile()) return stopWidthCache.v;
    var mul = (QE.trendParams && QE.trendParams.stopAtr) || 6;
    var arr = [];
    uniList('trend').forEach(function (x) {
      var a = A[x.t]; if (!a || !(a.price > 0) || !(a.atr > 0)) return;
      arr.push((a.atr * mul) / a.price);
    });
    arr.sort(function (p1, p2) { return p1 - p2; });
    var v = arr.length ? arr[Math.floor(arr.length / 2)] : 0.09;   /* 중앙값 — 한 종목 이상치(DELL 등)에 휘둘리지 않게 */
    stopWidthCache = { asOf: M.asOf, risk: riskProfile(), v: v };
    return v;
  }
  function swingCapNow() {
    var p = (riskParams() && riskParams().swing) || {};
    return p.stopCap != null ? p.stopCap : 0.10;   /* 성향별 — QE.swingParams(안정형 상수)를 쓰지 않는다 */
  }
  function stopLossPct() {
    if (stratKey() === 'swing') return swingCapNow();
    return trendStopWidth();
  }
  function stopLossWhy() {
    if (stratKey() === 'swing') {
      return '스윙형 손절 상한 −' + Math.round(swingCapNow() * 100) + '% (' +
        (riskAggr() ? '공격형' : '안정형') + ') — 4.5 ATR 손절선이 그보다 멀면 이 상한에서 청산합니다';
    }
    return '추세형은 고정 퍼센트 상한이 없고 6 ATR이 손절폭입니다 — 지금 유니버스 ' +
      uniList('trend').length + '종목의 6 ATR/현재가 중앙값 ' + pct(-trendStopWidth(), 1) + ' (종목마다 ATR이 달라 다릅니다)';
  }
  function stopImpact(k) { return stopLossPct() / slotInfo(k).n; }
  /* 계좌 시뮬레이션 요약·카드·히어로 가이드를 한 번에 다시 그린다 */
  function renderAcct() {
    var cur = slotMode(), mode = stratKey(), bars = btBars();
    var now = acctStats(cur), base = acctStats('conc1'), big = acctStats('div10');
    /* 2️⃣ 버튼 안의 핵심 수치 — 지금 성향·전략·기간 기준 */
    $$('#topSlotSeg button[data-slot]').forEach(function (b) {
      var k = b.getAttribute('data-slot'), r = acctStats(k), on = (k === cur);
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      var n = b.querySelector('.sl-n');
      if (n) n.textContent = r ? (pct(r.ret, 0) + ' / ' + pct(r.mdd, 0)) : '—';
      /* 손절 1회 충격도 버튼 툴팁에 계산값으로 — 고정 −10% 문구를 두지 않는다 */
      var si = ACCT_SLOTS[k];
      b.title = si.label + ' — ' + si.hold + ' · ' + slotSecCapText(k) +
        ' · 손절 1회 충격 = 계좌 −' + (stopImpact(k) * 100).toFixed(1) + '% (종목 −' + (stopLossPct() * 100).toFixed(1) + '% ÷ ' + si.n + '슬롯)' +
        (r ? '\n이 기간(' + btTag() + ') 수익 ' + pct(r.ret, 1) + ' · 최악 MDD ' + pct(r.mdd, 1) : '');
    });
    /* 요약(선택 효과) — 컨트롤러 바로 아래 */
    var pe = $('#pickEffect');
    if (pe) {
      var head = '<span class="pe-k">선택 효과</span>' +
        '<b class="pe-p">' + (riskAggr() ? '🔥 공격형' : '🛡️ 안정형') + '</b>' +
        '<b class="pe-p">' + slotInfo(cur).label + '</b>' +
        '<b class="pe-p">' + (mode === 'swing' ? '⚡ 스윙형' : '📈 추세형') + '</b>' +
        '<b class="pe-p pe-per">' + btTag() + '</b>';
      if (!now) {
        pe.innerHTML = head + '<span class="pe-wait"><i></i>계좌 계산 중… (' + btName() + ' · ' + uniList(mode).length + '종목)</span>';
        pe.title = '지금 성향·전략·기간 조합으로 계좌 포트폴리오(집중1/분산3/분산10)를 계산하고 있습니다';
      } else {
        pe.innerHTML = head +
          '<span class="pe-v">수익 <b class="' + cls(now.ret) + '">' + pct(now.ret, 1) + '</b></span>' +
          '<span class="pe-v">최악 MDD <b class="neg">' + pct(now.mdd, 1) + '</b></span>' +
          '<span class="pe-v">승률 <b>' + (now.win == null ? '—' : (now.win * 100).toFixed(1) + '%') + '</b></span>' +
          '<span class="pe-v">거래 <b>' + now.closed + '건</b></span>' +
          '<span class="pe-d">' + acctDeltaText(now, base, big, cur) + '</span>';
        pe.title = '이 숫자는 계좌(포트폴리오) 기준입니다 — 왼쪽 스캐너의 종목별 수익률과는 다른 값입니다.\n' +
          '계산: ' + btName() + ' · ' + uniList(mode).length + '종목 · ' + slotInfo(cur).hold + ' · ' + slotSecCapText(cur) +
          ' · 시총순 우선 · 패닉 바스켓 70% · 현금 연 4% · 비용 왕복 0.06%';
      }
    }
    /* 계좌 카드(1·3·10 나란히) */
    var grid = $('#acGrid');
    if (grid) {
      grid.innerHTML = SLOT_KEYS.map(function (k) {
        var r = acctCache[acctKey(mode, bars)] ? acctCache[acctKey(mode, bars)][k] : null;
        var s = SLOT_KEYS.indexOf(k) === SLOT_KEYS.indexOf(cur) ? ' on' : '';
        return '<button type="button" class="ac-cell' + s + '" data-slot="' + k + '" aria-pressed="' + (s ? 'true' : 'false') + '"' +
          ' title="' + ACCT_SLOTS[k].label + ' — ' + ACCT_SLOTS[k].hold + ' · ' + slotSecCapText(k) +
          (r ? ('\n수익 ' + pct(r.ret, 1) + ' · 최악 MDD ' + pct(r.mdd, 1) + ' · 승률 ' + (r.win == null ? '—' : (r.win * 100).toFixed(1) + '%') +
               ' · 거래 ' + r.closed + '건 · 노출 ' + (r.exposure * 100).toFixed(0) + '% · 평균 보유 ' + (r.avgHold == null ? '—' : Math.round(r.avgHold) + '일')) : '') + '">' +
          '<span class="ac-t">' + ACCT_SLOTS[k].label + '</span>' +
          '<span class="ac-r">수익 <b class="' + (r ? cls(r.ret) : '') + '">' + (r ? pct(r.ret, 1) : '—') + '</b></span>' +
          '<span class="ac-r">MDD <b class="neg">' + (r ? pct(r.mdd, 1) : '—') + '</b></span>' +
          '<span class="ac-r ac-w">승률 <b>' + (r && r.win != null ? (r.win * 100).toFixed(1) + '%' : '—') + '</b> <i>거래 ' + (r ? r.closed : '—') + '</i></span>' +
          '</button>';
      }).join('');
    }
    var an = $('#acNow');
    if (an) an.innerHTML = (riskAggr() ? '🔥 공격형' : '🛡️ 안정형') + ' · ' + (mode === 'swing' ? '⚡ 스윙형' : '📈 추세형') +
      ' · <b>' + btTag() + '</b>(' + btName() + ') · ' + uniList(mode).length + '종목';
    var as = $('#acSrc');
    if (as) {
      as.innerHTML = now
        ? ('시총순 우선 · 패닉(QQQ ' + acctPanicMa(mode) + '일선·RSI2<5) 투입 ≤70% · 현금 연 4% · 웜스타트 250봉 · 평균 보유 <b>' + now.avgPos.toFixed(1) + '/' + now.slots + '종목</b>')
        : '계산 중…';
      as.title = '계좌 규칙 — 웜스타트: 창 시작 250봉 전부터 운용한 계좌에서 출발해 이 기간만 측정(창 시작일 종가 = 100)\n' +
        '패닉일 = QQQ ' + acctPanicMa(mode) + '일선 아래이면서 QQQ RSI(2)<5 (' + (mode === 'swing' ? '스윙형 정의' : '추세형 정의') + ') → 그날 신규 투입 합계 ≤ 계좌 70%';
    }
    /* 가정·한계 상시 고지 — 숫자와 같은 카드 안에 둔다 */
    var aam = $('#acAssume');
    if (aam) {
      aam.innerHTML = '<b>가정</b> 왕복 수수료 0.06%' + (acctStressOn() ? ' + 슬리피지 0.30%' : '') +
        ' · 현금 연 4% 이자 · 패닉일 투입 ≤70% · 동일가중(리밸런싱 없음) · 배당 미포함 · ' +
        (acctStressOn() ? '보유 전종목 −10% 갭 1회 반영 · ' : '') +
        '유니버스 = 지금 시총 Top150(<b>생존편향</b>) · 웜스타트 250봉 후 이 기간만 측정';
      aam.title = '이 카드의 숫자가 서 있는 가정입니다. 빠진 것은 실제 성과를 더 좋게 보이게 할 수 있습니다.\n' +
        '· 수수료: 매수·매도 각 0.03%(왕복 0.06%)' + (acctStressOn() ? ' + 슬리피지 편도 0.15%' : '') + '\n' +
        '· 현금: 연 4% 단순 이자(예수금에만)\n' +
        '· 패닉일(QQQ ' + acctPanicMa(mode) + '일선 아래 ∧ RSI(2)<5): 신규 투입 ≤ 계좌 70%\n' +
        '· 동일가중·리밸런싱 없음 · 배당·분할 미반영 · 세금 미반영\n' +
        '· 유니버스는 현재 시총 Top150(상장폐지·퇴출 종목 미포함) → 생존편향으로 수익이 과대할 수 있습니다';
    }
    /* 계좌 카드 1줄 고정 요약 — 폰에서도 툴팁 없이 읽힌다 (값은 전부 계산값) */
    var al = $('#acLine');
    if (al) {
      var sl = slotInfo(cur), mdd = now ? pct(now.mdd, 1) : '—';
      al.innerHTML =
        '<span><b>1종목 비중</b> ' + sl.weight + '</span>' +
        '<span><b>동일 섹터</b> ' + (sl.cap > 0 ? '최대 ' + sl.cap + '종목' : '캡 없음') + '</span>' +
        '<span><b>손절 1회 충격</b> <b class="neg">−' + (stopImpact(cur) * 100).toFixed(1) + '%</b></span>' +
        '<span><b>MDD(최대 낙폭)</b> <b class="neg">' + mdd + '</b></span>';
      al.title = '지금 고른 투자방식(' + sl.label + ')의 계좌 규칙 한 줄 요약\n' +
        '· 1종목 비중 ' + sl.weight + ' — 동일가중(리밸린싱 없음)\n' +
        '· ' + slotSecCapText(cur) + ' — 시총순 우선으로 채웁니다\n' +
        '· 손절 1회 충격 −' + (stopImpact(cur) * 100).toFixed(1) + '% = 종목 손실률 ' + (stopLossPct() * 100).toFixed(1) + '% ÷ ' + sl.n + '슬롯\n' +
        '   ' + stopLossWhy() + '\n' +
        '· MDD(최대 낙폭) ' + mdd + ' = 이 기간(' + btTag() + ') 계좌 고점 대비 가장 깊게 떨어졌던 폭';
    }
    var ad = $('#acDetail');
    if (ad) {
      if (!now) ad.innerHTML = '<span class="ac-w">같은 기간·성향·전략 위에서 1·3·10슬롯 계좌를 계산하고 있습니다…</span>';
      else {
        var st = slotInfo(cur), other = cur === 'conc1' ? big : base;
        ad.innerHTML =
          '<span><b>종목 손절률</b> −' + (stopLossPct() * 100).toFixed(1) + '% <i>(' + (stratKey() === 'swing' ? '스윙 손절 상한' : '6 ATR 중앙값') + ')</i></span>' +
          '<span><b>노출</b> ' + (now.exposure * 100).toFixed(0) + '% <i>(보유 ' + now.avgPos.toFixed(1) + '/' + st.n + ')</i></span>' +
          '<span><b>평균 보유</b> ' + (now.avgHold == null ? '—' : Math.round(now.avgHold) + '거래일') + '</span>' +
          '<span class="ac-tip">' + acctTip(cur) + '</span>';
      }
    }
    renderAcctBench(now);
    renderWF();
    if (acPanelOpen()) renderAcctPanel(now);
  }

  /* ============================================================
     🔬 표본외 워크포워드 · 연도별 성적표 (2026-11-28)
     ------------------------------------------------------------
     · 데이터 `window.WF` = `scripts/wf_build.py` 가 **엔진·계좌 엔진을 그대로 돌려** 만든 정적 결과
       (2017~2026 연도 + 2017~2021 표본외 + 2022 폭락장 + 2022~2026 최근 5년, QQQ·SPY 벤치 병기)
     · 2017~2021은 전략을 만든 기간이 아닌 **표본외**다 — 같은 규칙을 그대로 굴렸을 때의 성적.
     · 지금 화면의 **상향·전략**을 따르고, 슬롯은 패널 안에서 따로 고를 수 있다(기본 = 화면 슬롯).
     ============================================================ */
  var wfSlotSel = null;
  function wfData() { return (window.WF && window.WF.years && window.WF.years.length) ? window.WF : null; }
  function wfKeyOf() { return riskProfile() + '|' + stratKey(); }
  function wfOf(win, sk) { var r = win && win.r ? win.r[wfKeyOf() + '|' + sk] : null; return r || null; }
  function wfSlotOn() { return wfSlotSel || slotMode(); }
  function wfPct(v, d) { return (v == null || !isFinite(v)) ? '—' : pct(v, d === undefined ? 1 : d); }
  function renderWF() {
    var host = $('#wfCard');
    if (!host) return;
    var W = wfData();
    var sub = $('#wfSub'), blocks = $('#wfBlocks'), tb = $('#wfTable'), foot = $('#wfFoot'), slotBox = $('#wfSlot');
    if (!W) {
      if (sub) sub.textContent = '표본외 데이터가 없습니다 — scripts/wf_build.py 로 생성합니다';
      if (blocks) blocks.innerHTML = '';
      if (tb) tb.innerHTML = '';
      return;
    }
    var sk = wfSlotOn(), mo = stratKey();
    if (slotBox) {
      slotBox.innerHTML = SLOT_KEYS.map(function (k) {
        var on = k === sk;
        return '<button type="button" data-wfslot="' + k + '" class="' + (on ? 'on' : '') + '" aria-pressed="' + (on ? 'true' : 'false') +
          ' title="' + ACCT_SLOTS[k].label + ' 기준 표본외·연도별 성과">' + ACCT_SLOTS[k].short + '</button>';
      }).join('');
    }
    if (sub) {
      sub.textContent = (riskAggr() ? '🔥 공격형' : '🛡️ 안정형') + ' · ' + (mo === 'swing' ? '⚡ 스윙형' : '📈 추세형') +
        ' · ' + ACCT_SLOTS[sk].label + ' · ' + W.meta.from + ' ~ ' + W.meta.to + ' · 웜스타트 ' + W.meta.warm + '봉';
      sub.title = '표본외: 2017~2021은 이 전략을 만든 기간이 아니므로 같은 규칙을 그대로 돌린 검증입니다.\n' +
        '각 해는 그 해 첫 거래일부터 앞 250봉으로 계좌를 미리 굴린 뒤 그 해만 측정합니다(웜스타트).\n' +
        '벤치 QQQ·SPY는 계좌와 같은 진입 시점(창 첫날 시가)에서 출발합니다 — 배당 미포함 단순 보유.';
    }
    /* 3블록 요약 */
    if (blocks) {
      blocks.innerHTML = W.blocks.map(function (b) {
        var r = wfOf(b, sk), q = b.bench && b.bench.qqq;
        var lb = b.k === 'oos' ? '표본외 2017~2021' : (b.k === 'crash' ? '2022 폭락장' : '최근 5년 2022~2026');
        var tag = b.k === 'oos' ? 'oos' : (b.k === 'crash' ? 'crash' : 'now');
        var d = (r && q) ? (r.ret - q.ret) : null;
        return '<div class="wf-bl ' + tag + '">' +
          '<div class="wf-bl-h">' + lb + '<i>' + b.from.slice(0, 7) + '~' + b.to.slice(0, 7) + ' · ' + b.bars + '봉</i></div>' +
          '<div class="wf-bl-v"><b class="' + cls(r ? r.ret : 0) + '">' + (r ? wfPct(r.ret) : '—') + '</b><span>계좌</span></div>' +
          '<div class="wf-bl-r"><span>QQQ <b class="' + cls(q ? q.ret : 0) + '">' + (q ? wfPct(q.ret) : '—') + '</b></span>' +
          '<span>차이 <b class="' + (d >= 0 ? 'pos' : 'neg') + '">' + (d == null ? '—' : (d > 0 ? '+' : '') + (d * 100).toFixed(1) + '%p') + '</b></span></div>' +
          '</div>';
      }).join('');
    }
    /* 연도별 표 */
    if (tb) {
      var head = '<thead><tr><th>연도</th><th>계좌</th><th>MDD</th><th>QQQ</th><th>SPY</th><th title="계좌 수익 − QQQ 수익(%p)">QQQ 대비</th></tr></thead>';
      var rows = W.years.map(function (y) {
        var r = wfOf(y, sk), q = y.bench && y.bench.qqq, s = y.bench && y.bench.spy;
        var d = (r && q) ? (r.ret - q.ret) : null;
        var crash = y.y === '2022';
        return '<tr' + (crash ? ' class="crash"' : '') + '>' +
          '<td class="wf-y">' + y.y + (crash ? '<i>폭락장</i>' : '') + '</td>' +
          '<td><b class="' + cls(r ? r.ret : 0) + '">' + (r ? wfPct(r.ret) : '—') + '</b></td>' +
          '<td class="neg">' + (r ? wfPct(r.mdd) : '—') + '</td>' +
          '<td>' + (q ? wfPct(q.ret) : '—') + '</td>' +
          '<td>' + (s ? wfPct(s.ret) : '—') + '</td>' +
          '<td><b class="' + (d >= 0 ? 'pos' : 'neg') + '">' + (d == null ? '—' : (d > 0 ? '+' : '') + (d * 100).toFixed(1) + '%p') + '</b></td>' +
          '</tr>';
      }).join('');
      tb.innerHTML = head + '<tbody>' + rows + '</tbody>';
    }
    if (foot) {
      var wins = 0, n = 0, worst = null;
      W.years.forEach(function (y) {
        var r = wfOf(y, sk), q = y.bench && y.bench.qqq;
        if (!r || !q) return;
        n++; if (r.ret > q.ret) wins++;
        if (!worst || r.ret < worst.ret) worst = { y: y.y, ret: r.ret };
      });
      var oos = W.blocks.filter(function (b) { return b.k === 'oos'; })[0];
      var rec = W.blocks.filter(function (b) { return b.k === 'recent'; })[0];
      var oo = oos ? wfOf(oos, sk) : null, rr = rec ? wfOf(rec, sk) : null;
      foot.innerHTML = '<b>요약</b> 10개 해 중 QQQ를 이긴 해 <b>' + wins + '/' + n + '</b>' +
        ' · 가장 나쁜 해 <b>' + (worst ? worst.y + ' ' + wfPct(worst.ret) : '—') + '</b>' +
        ' · 표본외(2017~2021) <b>' + (oo ? wfPct(oo.ret) : '—') + '</b> → 최근 5년 <b>' + (rr ? wfPct(rr.ret) : '—') + '</b>' +
        '<br><b>한계</b> 배당 미포함 · 현재 시총 Top ' + (mo === 'swing' ? 150 : 100) + '(' + (W.meta.universe[mo] || 0) + '종목) 유니버스의 <b>생존편향</b> · 무슬리피지 · 각 연도 첫 거래일부터 250봉 웜스타트 · 과거 성과는 미래를 보장하지 않습니다';
    }
  }
  /* ---- 동일 기간 QQQ 벤치마크 칩 (계좌 수치 바로 옆에서 나란히 비교) ----
     · 벤치는 계좌와 같은 **창 첫날 시가** 기준(2026-11-28 정렬)
     · 스트레스 모드가 켜져 있으면 그 사실을 배지로 알리고, 벤치 수익도 슬리피지·갭 조건을 맞춰 안내한다 */
  function renderAcctBench(now) {
    var el = $('#acBench'); if (!el) return;
    var stress = acctStressOn();
    var b = qqqBench(btBars());
    var tg = $('#acStress');
    if (tg) {
      tg.classList.toggle('on', stress);
      tg.setAttribute('aria-pressed', stress ? 'true' : 'false');
      tg.title = stress
        ? '스트레스 모드 ON — 편도 슬리피지 0.15%(왕복 0.3%) + 최대 노출일에 보유 전종목 −10% 갭(손절 미작동)을 넣었습니다. 다시 누르면 기본으로 돌아갑니다.'
        : '🛡️ 스트레스 테스트 켜기 — 보수적 슬리피지(왕복 0.3%) + 보유 전종목 −10% 갭(손절 미작동) 1회를 넣은 최악의 하루를 계산합니다';
    }
    if (!b) {
      el.innerHTML = '<span class="ab-k">QQQ 동일기간</span><span class="ab-v">데이터 없음</span>';
      el.title = 'QQQ 시계열을 읽지 못했습니다';
      return;
    }
    var html = '<span class="ab-k">QQQ 동일기간<i>단순 보유 · ' + b.baseKind + ' 기준</i></span>' +
      '<span class="ab-v">수익 <b class="' + cls(b.ret) + '">' + pct(b.ret, 1) + '</b></span>' +
      '<span class="ab-v">MDD <b class="neg">' + pct(b.mdd, 1) + '</b></span>';
    if (now) {
      var dr = (now.ret - b.ret) * 100, dm = (now.mdd - b.mdd) * 100;   /* dm > 0 = 계좌 낙폭이 더 작다 */
      html += '<span class="ab-d">계좌 <b class="' + (dr >= 0 ? 'pos' : 'neg') + '">' + (dr > 0 ? '+' : '') + dr.toFixed(1) + '%p</b>' +
        ' · 낙폭 <b class="' + (dm >= 0 ? 'pos' : 'neg') + '">' + (dm >= 0 ? Math.abs(dm).toFixed(1) + '%p 작음' : Math.abs(dm).toFixed(1) + '%p 큼') + '</b></span>';
    }
    if (stress) html += '<span class="ab-mode">🛡️ 스트레스 ON</span>';
    el.innerHTML = html;
    el.title = 'QQQ 단순 보유(배당·비용 없이 종가 기준) 벤치마크 — 계좌 시뮬레이션과 같은 기간입니다\n' +
      '기간 ' + b.start + ' ~ ' + b.end + ' (' + btTag() + ') · 기준가 = ' + b.baseKind + ' ' + b.base.toFixed(2) + '(계좌가 진입하는 같은 시점)\n' +
      (now ? '지금 계좌(' + slotInfo().label + ') ' + pct(now.ret, 1) + ' / MDD ' + pct(now.mdd, 1) + '\n' : '') +
      '계좌는 수수료 왕복 0.06% · 현금 연 4% 이자를 반영하므로 QQQ와 조건이 같지 않습니다(참고용).' +
      (stress ? '\n스트레스 모드: 계좌만 편도 슬리피지 0.15% + −10% 갭 충격이 들어가므로 QQQ보다 불리하게 잡힙니다.' : '');
  }
  /* 🛡️ 스트레스 토글 — 기본값 OFF, 켜면 계좌 전체를 같은 조건으로 다시 계산한다 */
  function acctToggleStress() {
    acctStressSet(!acctStressOn());
    _benchCache = {};
    _panicCache = {};
    renderAcct();
    renderHeroAcct();
  }
  function acPanelOpen() {
    var p = $('#acPanel');
    return !!(p && !p.hidden);
  }
  function acPairDate(g, lastDate) {
    if (g == null || g < 0) return lastDate;
    return M.dates[g] || lastDate;
  }
  /* ---- '보유·체결 내역 보기' — 지금 시뮬 계좌의 실제 보유 비중 + 최근 체결 ---- */
  function renderAcctPanel(now) {
    var hold = $('#acHold'), fill = $('#acFill'), hn = $('#acHoldN'), fn = $('#acFillN'), note = $('#acpNote');
    if (!hold) return;
    var lastDate = M.dates[M.dates.length - 1] || M.asOf || '';
    if (!now) {
      hold.innerHTML = '<div class="acp-empty">계좌 계산 중…</div>';
      if (fill) fill.innerHTML = '<div class="acp-empty">—</div>';
      if (hn) hn.textContent = '—';
      if (fn) fn.textContent = '—';
      if (note) note.textContent = '같은 성향·전략·기간으로 계좌를 계산하고 있습니다.';
      return;
    }
    var st = slotInfo(), hs = now.holds || [];
    if (hn) hn.textContent = hs.length + '/' + st.n + '종목 · 현금 ' + (now.cashW * 100).toFixed(0) + '%';
    if (!hs.length) {
      hold.innerHTML = '<div class="acp-empty">보유 없음 — 마지막 날 현금 100%입니다(빈 슬롯 ' + st.n + ')</div>';
    } else {
      hold.innerHTML = '<table class="acp-tb"><thead><tr><th>종목</th><th>비중</th><th>평단</th><th>현재</th><th>평가손익</th></tr></thead><tbody>' +
        hs.map(function (h) {
          return '<tr><td class="acp-tk">' + h.t + '<em>' + (h.sec || '—') + '</em></td>' +
            '<td>' + (h.weight * 100).toFixed(1) + '%</td>' +
            '<td>$' + pxs(h.entry) + '</td>' +
            '<td>' + (h.last == null ? '—' : '$' + pxs(h.last)) + '</td>' +
            '<td><b class="' + cls(h.pnl) + '">' + pct(h.pnl, 1) + '</b></td></tr>';
        }).join('') + '</tbody></table>';
    }
    var fs = (now.fills || []).slice().reverse();
    if (fn) fn.textContent = fs.length ? ('최근 ' + fs.length + '건') : '체결 없음';
    if (!fs.length) {
      fill.innerHTML = '<div class="acp-empty">이 기간 체결이 없습니다</div>';
    } else {
      fill.innerHTML = '<table class="acp-tb"><thead><tr><th>날짜</th><th>종목</th><th>구분</th><th>가격</th><th>수익률</th></tr></thead><tbody>' +
        fs.map(function (f) {
          return '<tr><td>' + String(acPairDate(f.g, lastDate)).slice(5) + '</td>' +
            '<td class="acp-tk">' + f.t + '</td>' +
            '<td><span class="acp-side ' + (f.side === '매수' ? 'b' : 's') + '">' + f.side + '</span></td>' +
            '<td>$' + pxs(f.px) + '</td>' +
            '<td>' + (f.side === '매도' && f.ret != null ? '<b class="' + cls(f.ret) + '">' + pct(f.ret, 1) + '</b>' : '—') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    if (note) note.textContent = '마지막 날 ' + lastDate + ' 종가 평가 기준 · ' + st.label + ' · ' + btTag() + ' 계좌 시뮬레이션입니다(실제 보유 아님).';
  }
  function acPanelToggle(force) {
    var p = $('#acPanel'), btn = $('#acOpen');
    if (!p) return;
    var open = force == null ? p.hidden : !!force;
    p.hidden = !open;
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) renderAcctPanel(acctStats(slotMode()));
  }
  /* 지금 조합에서 어느 슬롯의 낙폭이 가장 작은지 — 문구를 계산값으로 만든다(하드코딩 금지) */
  function acctTip(cur) {
    var c = acctCache[acctKey(stratKey(), btBars())];
    if (!c) return '';
    var best = null;
    SLOT_KEYS.forEach(function (k) { if (c[k] && (best == null || c[k].mdd > c[best].mdd)) best = k; });
    var label = function (k) { return ACCT_SLOTS[k].short; };
    if (cur === 'conc1') {
      return '집중 1은 한 종목이 곧 계좌입니다 — 규칙으로 줄일 수 있는 위험이 아니라 구조적 위험 (손절 1회가 계좌 −' +
        (stopImpact('conc1') * 100).toFixed(0) + '%)';
    }
    if (best === cur) return '권장 — 이 조합(' + btTag() + ')에서 세 슬롯 중 낙폭이 가장 작습니다';
    return '이 조합(' + btTag() + ')에서는 ' + label(best) + '의 낙폭이 가장 작습니다 (' + pct(c[best].mdd, 1) + ') — 짧은 기간은 순서가 흔들립니다';
  }
  /* 기준 대비 변화 — 지금 선택이 집중1(또는 분산10)보다 수익·낙폭에서 얼마나 다른가 */
  function acctDeltaText(now, base, big, cur) {
    if (cur === 'conc1') {
      if (!big) return '<i>분산 10과 비교 계산 중…</i>';
      var dr = (now.ret - big.ret) * 100, dm = (now.mdd - big.mdd) * 100;   /* dm > 0 = 분산 10이 낙폭을 그만큼 방어 */
      return '분산 10 대비 수익 <b class="' + (dr > 0 ? 'pos' : 'neg') + '">' + (dr > 0 ? '+' : '') + dr.toFixed(1) + '%p</b>' +
        ' · <b class="neg">낙폭 ' + Math.abs(dm).toFixed(1) + '%p 더 큼</b>';
    }
    if (!base) return '<i>집중 1과 비교 계산 중…</i>';
    var dr2 = (now.ret - base.ret) * 100, dm2 = (now.mdd - base.mdd) * 100;  /* dm2 > 0 = 지금 선택이 낙폭을 방어 */
    return '집중 1 대비 수익 <b class="' + (dr2 > 0 ? 'pos' : 'neg') + '">' + (dr2 > 0 ? '+' : '') + dr2.toFixed(1) + '%p</b>' +
      ' · <b class="' + (dm2 > 0 ? 'pos' : 'neg') + '">낙폭 ' + (dm2 > 0 ? dm2.toFixed(1) + '%p 방어' : Math.abs(dm2).toFixed(1) + '%p 악화') + '</b>';
  }
  /* 히어로 — 지금 고른 투자방식의 계좌 배분·위험 안내 */
  function renderHeroAcct() {
    var el = $('#heroAcct');
    if (!el) return;
    var cur = slotMode(), st = slotInfo(cur), a = A[state.cur] || null, now = acctStats(cur);
    var sec = a ? (a.meta.sk || '—') : '—';
    var mine = (now && now.endSec && now.endSec[sec]) || 0;
    var stopPer = stopImpact(cur), perStock = stopLossPct();
    var cash = 1000 / st.n;
    var cashTxt = cash >= 100 ? Math.round(cash).toLocaleString('en-US') : cash.toFixed(cash >= 10 ? 0 : 1);
    el.innerHTML =
      '<span class="ha-k">계좌 배분</span>' +
      '<span class="ha-i">' + st.label + ' · <b>계좌의 ' + st.weight + '</b></span>' +
      '<span class="ha-i">' + (st.cap > 0 ? '<b>섹터 ' + st.cap + '종목</b> · ' : '') + '시총순 우선</span>' +
      (st.cap > 0
        ? '<span class="ha-i">섹터 <b>' + sec + '</b> <i>보유 ' + mine + '/' + st.cap + '</i></span>'
        : '') +
      '<span class="ha-warn">손절 1회 = 계좌 <b>−' + (stopPer * 100).toFixed(1) + '%</b>' +
      (now ? ' · 계좌 MDD <b>' + pct(now.mdd, 1) + '</b>' : '') + '</span>' +
      '<span class="ha-ex">1,000만원 → <b>' + cashTxt + '만원</b></span>';
    el.title = '이 화면의 투자방식(' + st.label + ') 기준 계좌 배분입니다 — 백테스트 계좌 규칙과 같은 슬롯 수를 씁니다.\n' +
      '손절 1회 계좌 충격 = 종목 손실률 ' + (perStock * 100).toFixed(1) + '% ÷ ' + st.n + '슬롯 = −' + (stopPer * 100).toFixed(1) + '%\n' +
      stopLossWhy() + '\n' +
      '갭 하락이면 손절가보다 더 밀릴 수 있어 실제 손실은 이보다 커질 수 있습니다 (스윙 검증 최악 −11.1%).';
  }
  /* ============================================================
     🔥 공격형 · 추세 전략 바 성과 줄
     · 공격형 + 추세형일 때만: 'C2 50% + 6M모멘텀 Top5 50%'(월간 리밸런싱) 계좌 성과를
       상단 유니버스 비교 옆에 함께 보여 준다(10년 계좌 10슬롯 검증 · 참고용).
     · 안정형으로 돌아가면 숨겨져 기존 C2 수치만 남는다.
     ============================================================ */
  function renderStratBlend(key) {
    var el = $('#stratBlend');
    if (!el) return;
    var show = riskAggr() && key === 'trend';
    el.hidden = !show;
    el.classList.toggle('on', show);
    if (!show) { el.innerHTML = ''; return; }
    var g = riskGuide().trend;
    el.innerHTML =
      '<span class="sb-k">🔥 공격형 블렌드</span>' +
      '<span class="sb-t">추세 C2 <b>50%</b> + 6M모멘텀 Top5 <b>50%</b> · 월간 리밸런싱</span>' +
      '<span class="sb-v">5년 <b>' + pctK(g.ret5, 1) + '</b></span>' +
      '<span class="sb-v">10년 <b>' + pctK(g.ret10, 0) + '</b></span>' +
      '<span class="sb-v">MDD <b class="neg">' + pct(g.mdd10, 1) + '</b></span>' +
      '<span class="sb-v">샤프 <b>' + (g.sharpe10 || 0).toFixed(2) + '</b></span>' +
      '<span class="sb-n">계좌 10슬롯 10년 검증 · 종목별 수익률이 아닌 포트폴리오 기준 · 참고용</span>';
    el.title = '공격형 추세형 = C2 신호 그대로 + 6개월 모멘텀 Top5 바스켓을 절반 섞는 운용 가이드\n' +
      '같은 10년에서 C2 단독 +914.1% / MDD −21.3% / 샤프 1.45 → 블렌드 ' + pctK(g.ret10, 0) + ' / MDD ' + pct(g.mdd10, 1) + ' / 샤프 ' + (g.sharpe10 || 0).toFixed(2) + '\n' +
      '리밸런싱 시작일을 0~20일 옮기면 10년 총수익 ' + pctK(g.phaseMin, 0) + '~' + pctK(g.phaseMax, 0) + '(샤프 1.30~1.56) · 2022년 ' + pct(g.y2022, 1) + '\n' +
      '샤프 정점은 C2 70% + 모멘텀 30%(1.52) — 50:50은 수익을 더 원할 때의 선택';
  }
  /* ---------------- 오늘 요약 스트립 ----------------
     성향·전략 컨트롤 바로 아래 한 줄: 오늘 신규 매수 N건 · QQQ 해제 조건(+X.X% / RSI(2)<5) · 대기 후보.
     숫자는 모두 스캐너 탭과 같은 sigOf/scanCounts 집계를 쓴다(안내문과 탭이 어긋나지 않게). */
  function renderTodayStrip() {
    var el = $('#todayStrip'); if (!el) return;
    var sw = state.strategy === 'swing';
    var counts = scanCounts(presetActive());
    var buy = counts.entryBuy;
    /* 계좌 빈 슬롯 — 지금 투자방식(집중1/분산3/분산10)에서 오늘 실제로 살 수 있는 수(시뮬레이션 마지막 날 보유 기준) */
    var b1 = $('#tsBuy');
    if (b1) {
      var st = slotInfo(), ar = acctStats(slotMode());
      var openN = ar ? ar.open : null, freeN = openN == null ? null : Math.max(0, st.n - openN);
      b1.innerHTML = '<span class="ts-lbl">신규 매수</span> <b class="' + (buy > 0 ? 'pos' : '') + '">' + buy + '</b>건' +
        '<i> · 전략 보유 ' + counts.hold + ' · 매수대기 ' + counts.waitbuy + ' · 매도 ' + counts.sell + '</i>' +
        '<span class="ts-slot" title="' + st.label + ' 기준 — 오늘 실제로 살 수 있는 수(시뮬레이션 보유 ' + (openN == null ? '—' : openN) + '/' + st.n + ')">' +
        '· 계좌 빈 슬롯 <b>' + (freeN == null ? '—' : freeN) + '</b></span>';
      b1.title = '계좌 빈 슬롯은 선택 기간(' + btTag() + ') 계좌 시뮬레이션의 마지막 날 보유 기준입니다 — 실제 계좌 보유가 아닙니다.\n' +
        '같은 날 신호가 여러 개 떠도 빈 슬롯(' + (freeN == null ? '—' : freeN) + '자리)만큼만 살 수 있고, ' +
        (st.cap > 0 ? '같은 섹터는 최대 ' + st.cap + '종목까지입니다.' : '1종목이면 섹터 캡이 의미가 없습니다.');
    }

    /* 2️⃣ 투자방식 — 지금 계좌가 몇 자리 비었는지(백테스트 가상 보유 기준, 표시 전용) */
    var q = A['QQQ'] || {};
    var plan = (sw ? q.swing : q.trendPlan) || {};
    var qqq = plan.qqq != null ? plan.qqq : null, ma = plan.qqqMa != null ? plan.qqqMa : null;
    var maLbl = sw ? (plan.qqqMaN || 200) : 100;
    var qq = $('#tsQqq');
    if (qq) {
      if (qqq != null && ma != null) {
        var need = ma / qqq - 1;
        qq.innerHTML = need > 0
          ? '<span class="ts-lbl">QQQ 해제 조건</span> <b class="neg">+' + (need * 100).toFixed(1) + '%</b> <i>(' + maLbl + '일선 ' + usd(ma) + ' · 현재 ' + usd(qqq) + ' · 또는 RSI(2)&lt;5 극단 패닉)</i>'
          : '<span class="ts-lbl">QQQ ' + maLbl + '일선</span> <b class="pos">위</b> <i>(' + usd(qqq) + ' · ' + maLbl + '일선 ' + usd(ma) + ' · 진입 허용)</i>';
      } else {
        qq.innerHTML = 'QQQ ' + maLbl + '일선 <i>데이터 없음</i>';
      }
    }

    /* 대기 후보 — 오늘 신규 매수가 0건일 때, **선택한 전략**의 매수대기 종목만 보여 준다.
       · 스윙형: RSI(2) 루트는 RSI 값, W 넥라인 보조 루트는 'W넥라인'으로 구분 표기
       · 손절 후 재진입 대기(cool)는 뒤로 보내 '재진입 N일'로 함께 표시
       · 후보가 없으면 stale 문구를 남기지 않고 비운다(전략을 바꿔도 이전 전략의 후보가 남지 않게) */
    var sep = $('#tsCandSep'), cd = $('#tsCand');
    var cands = [];
    if (buy === 0) {
      uniList().forEach(function (x) {
        var a = A[x.t]; if (!a) return;
        var g = sigOf(a);
        if (!g.waitbuy) return;
        var st = sw ? a.swing : a.trendPlan;
        var r2 = st && st.rsi2 != null ? st.rsi2 : null;
        var rsiRoute = !!(sw && st && st.rsiOk);
        var wRoute = !!(sw && st && (st.wBreak || st.route === 'W돌파' || st.wStage === '돌파'));
        cands.push({ t: x.t, r2: r2, rsiRoute: rsiRoute, wRoute: wRoute,
          cool: g.kind === 'cool' ? ((st && st.coolLeft) || 0) : 0,
          fit: rankInfo(a).fit, score: rowOf(a).score });
      });
      cands.sort(function (p1, p2) {
        if (!!p1.cool !== !!p2.cool) return p1.cool ? 1 : -1;       /* 재진입 대기 종목은 뒤로 */
        if (sw) {
          var k1 = p1.rsiRoute ? 0 : (p1.wRoute ? 1 : 2), k2 = p2.rsiRoute ? 0 : (p2.wRoute ? 1 : 2);
          if (k1 !== k2) return k1 - k2;                            /* RSI 루트 → W 넥라인 루트 → 기타 */
          if (p1.rsiRoute && p1.r2 != null && p2.r2 != null) return p1.r2 - p2.r2;
          return p2.fit - p1.fit;
        }
        return p2.score - p1.score;
      });
    }
    if (sep) sep.hidden = !cands.length;
    if (cd) {
      cd.hidden = !cands.length;
      cd.innerHTML = !cands.length ? '' : ('<span class="ts-lbl">대기 후보</span> <b>' + cands.slice(0, 3).map(function (c) {
        var tag;
        if (!sw) tag = '점수 ' + Math.round(c.score);
        else if (c.rsiRoute && c.r2 != null) tag = 'RSI(2) ' + c.r2.toFixed(1);
        else if (c.wRoute) tag = 'W넥라인';
        else tag = c.r2 != null ? 'RSI(2) ' + c.r2.toFixed(1) : '점수 ' + Math.round(c.score);
        return c.t + ' <i>' + tag + (c.cool ? ' · 재진입 ' + c.cool + '일' : '') + '</i>';
      }).join(' · ') + '</b>' + (cands.length > 3 ? ' <i>외 ' + (cands.length - 3) + '종목</i>' : ''));
      cd.title = sw
        ? '선택한 전략(스윙형)의 매수대기 종목 — RSI(2) 과매도 루트와 W 넥라인 보조 루트를 구분해 표시합니다.\n재진입 N일은 손절 뒤 재진입 금지 기간이 남은 종목입니다 · 왼쪽 [매수대기] 탭과 같은 집합'
        : '선택한 전략(추세형)의 매수대기 종목 — 종합점수는 기준을 넘었는데 QQQ 100일선 아래라 신규 매수가 막힌 종목입니다 · 왼쪽 [매수대기] 탭과 같은 집합';
    }
  }

  /* 전략별 유니버스 머리글 — 왼쪽 제목·분석 종목 수·상단 로고 부제를 지금 전략의 집합에 맞춘다
     (본문-제목 일치: 추세형 Top 100 = 102종목 / 스윙형 Top 150 = 152종목) */
  var UNIV_HEAD = {
    trend: { title: '시가총액 Top 100', logo: 'US Top 100 Analyzer' },
    swing: { title: '시가총액 Top 150', logo: 'US Top 150 Analyzer' }
  };
  function renderUnivHead() {
    var m = uniMode(), h = UNIV_HEAD[m], n = uniList(m).length;
    var t = $('#uniTitle'); if (t) t.textContent = h.title;
    var c = $('#uniCount'); if (c) c.textContent = String(n);
    var b = $('#brandSub'); if (b) b.textContent = h.logo;
    /* 캡슐 브랜드에는 부제 자리가 없으므로 'Top 100/150'은 캡슐 툴팁이 알린다(제목-집합 일치 유지) */
    var br = document.querySelector('.topbar .brand');
    if (br) br.title = h.logo + ' · 분석 ' + n + '종목 — ' + h.title;
    /* 상단 통합 컨트롤 오른쪽 — 지금 무엇으로 보고 있는지 한 줄로 (제목·본문 일치 확인용) */
    var now = $('#tcNow');
    if (now) now.innerHTML = '<b>' + (riskAggr() ? '🔥 공격형' : '🛡️ 안정형') + '</b> · <b>' +
      (m === 'swing' ? '⚡ 스윙형' : '📈 추세형') + '</b> · ' + h.title.replace('시가총액 ', '') + ' · 분석 ' + n + '종목';
  }
  function renderStrategy() {
    renderUnivHead();
    renderTodayStrip();
    var info = stratInfo(stratKey());
    var bar = $('#stratBar'); if (bar) bar.setAttribute('data-m', info.key);
    $$('.strat-seg button').forEach(function (b) {          /* 상단 통합 컨트롤 + 하단 전략 바 두 곳을 함께 동기화 */
      var on = b.getAttribute('data-m') === info.key;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var ti = $('#stratTitle'); if (ti) ti.textContent = info.title + ' (' + info.sub + ')';
    var de = $('#stratDesc'); if (de) de.textContent = info.desc;
    var el = $('#stratUni'), u = universeStats(info.key), ua = A[state.cur];
    var meta = $('#bpMeta');
    if (el && u && u.n) {
      el.innerHTML =
        '<span class="uni-per">' + btTag() + '</span>' +
        '<span><b>' + u.n + '종목 평균</b> <b class="' + cls(u.mean) + '">' + pct(u.mean, 2) + '</b></span>' +
        '<span>중앙 <b class="' + cls(u.med) + '">' + pct(u.med, 2) + '</b></span>' +
        '<span>보유 초과 <b>' + u.beat + '/' + u.n + '</b></span>' +
        '<span>평균 MDD <b class="neg">' + pct(u.mdd, 2) + '</b></span>' +
        '<span>승률 <b class="' + (u.win >= 0.5 ? 'pos' : '') + '">' + (u.win == null ? '—' : (u.win * 100).toFixed(1) + '%') + '</b></span>';
      el.title = u.n + '종목 단순보유 평균 ' + pct(u.bh, 2) + ' · ' + btName() + '(' + btBars() + '거래일) 구간 · 워밍업 250거래일' +
        (ua ? ' (' + (ua.close.length - ua.startIdx) + '거래일)' : '');
      if (meta) meta.innerHTML = '전략 비교 · 같은 종목·같은 기간·거래비용 <b>0.03%</b> · 체결 <b>신호 다음 날 시가</b> · 집계 <b>' +
        u.n + '종목</b>(' + btTag() + ' 기간 충족) · 거래 ' + u.trades + '건';
    } else if (el) {
      el.innerHTML = '<span class="uni-calc"><i></i>' + btName() + ' · ' + uniList(info.key).length + '종목 집계 중…</span>';
      if (meta) meta.innerHTML = '전략 비교 · 같은 종목·같은 기간·거래비용 <b>0.03%</b> · 체결 <b>신호 다음 날 시가</b> · ' + btTag() + ' 종목 집계 중…';
    }
    renderPresetGuide();          /* 전략을 바꾸면 스캐너 3줄 가이드도 그 전략 것으로 */
    renderStratBlend(info.key);   /* 🔥 공격형 — 추세는 50:50 모멘텀 블렌드 성과를 전략 바에 함께 */
    renderAcct();                 /* 2️⃣ 투자방식(집중1/분산3/분산10) 계좌 시뮬레이션 — 이 전략·기간 기준 */
    mhRender();                   /* 💼 실전 보유 진단도 이 전략(스윙/추세) 규칙으로 다시 */
    renderNotice();               /* 운영 원칙 탭의 '지금 기간 성과'도 이 기간 기준 */
  }
  /* 전략 버튼(추세형 ↔ 스윙형) — 누를 때마다 그 전략의 추천 1위 종목으로 자동 전환한다.
     앞서 다른 종목을 직접 골라 두었어도 그 전략 기준 1위(= 좌측 스캐너 추천순 1행)를 보여 준다.
     자동 전환이므로 주소창에 #종목·?t=를 남기지 않는다(북마크에 옛 종목이 굳지 않도록 기존 딥링크도 정리). */
  function setStrategy(mode) {
    if (mode !== 'swing' && mode !== 'trend') return;
    state.strategy = mode;
    stratPersist();
    uniReset();                                               /* 전략별 유니버스가 바뀌니 목록·카운트 캐시를 버린다 */
    adoptRecSort();                                           /* 전략 버튼 → 좌측 스캐너 추천 순위로 자동 전환 */
    var top = topScoreT();                                    /* 바뀐 전략 기준 1위 */
    if (top) { state.cur = top; autoPick = true; clearDeepLink(); }
    renderStrategy();
    renderScanner();                                          /* 좌측 스캐너 신호·순위를 새 전략 기준으로 즉시 재집계 */
    renderAggrCard();                                         /* 공격형 카드(추세 50:50 / 스윙 S2)도 선택 전략에 맞춰 */
    setNxTab(mode);                                           /* 투자 운영 원칙 탭도 그 전략으로 (자유롭게 다시 고를 수 있음) */
    if (state.cur && A[state.cur]) select(state.cur, true);    /* 위에서 고른 1위 종목을 그대로 표시 (기간 유지) */
  }
  /* 자동 선택 시 주소에 박힌 종목(#종목 · ?t=종목)을 지운다 — 화면(전략 1위)과 주소가 어긋나지 않게 */
  function clearDeepLink() {
    try {
      var s = location.search || '', cleaned = '';
      if (s) {
        var parts = s.replace(/^\?/, '').split('&').filter(function (kv) { return kv && !/^t=/.test(kv); });
        cleaned = parts.length ? '?' + parts.join('&') : '';
      }
      if (location.hash || cleaned !== s) history.replaceState(null, '', location.pathname + cleaned);
    } catch (e) { /* file:// 등 replaceState가 막힌 환경에서는 그냥 둔다 */ }
  }
  /* 기간 변경 → 아래 KPI·자산곡선·트레이드 로그·종목 평균·히어로·계좌 카드를 같은 기간으로 재계산
     (setPeriod 가 차트 기간까지 함께 맞춘다. 히어로 ①②③·손익비도 이 기간 기준으로 즉시 갱신) */
  function applyBtPeriod() {
    var t = state.cur;
    if (!t || !A[t]) return;
    var v = stratView(viewOf(t));
    renderKpis(v); renderBtPeriod(v); renderEquity(v); renderTrades(v); renderRecent(v);
    renderHero(v);                 /* ①②③ 행동 요약·손익비·계좌 배분 가이드까지 기간에 맞춰 */
    renderAcct();                  /* 계좌 시뮬레이션(집중1/3/10)도 이 기간으로 — 새 기간 캐시가 없으면 '계산 중'으로 */
    renderStrategy();
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
    renderBtPeriod(v);
    renderScoreExplain(v);
    renderElliott(v);
    renderEquity(v);
    renderRecent(v);
    renderTrades(v);
    chart.setAnalysis(v);
    chart.setRange(btBars());
    ptRender();
    if (window.innerWidth <= 900) closeDrawer();
    /* 자동 선택(첫 접속 기본 종목)은 주소에 #종목을 남기지 않는다 — 북마크·주소창에 그 종목이 굳어
       다음 접속에 점수 1위가 아니라 옛 종목이 뜨는 일을 막는다. 직접 고른 종목은 지금처럼 링크가 된다. */
    if (!autoPick) {
      try { history.replaceState(null, '', '#' + t); } catch (e) {}
    }
    autoPick = false;
  }

  /* ============================================================
     초보자 가이드 (2026-11-27)
     · 상단 '초보자 3단계 보는 법' — 접기/펼치기(localStorage)
     · 좌측 스캐너 '기법별 매수·손절·익절 3줄 가이드'
     · 종목 카드(hero) '한눈 행동 요약 3줄' (+ 데드캣/실적 위험)
     매매 신호 로직은 건드리지 않는다 — 전부 표시 전용이다.
     ============================================================ */
  var BEGIN_KEY = 'apex.begin.v1';
  var beginOpen = true;
  function beginApply() {
    var card = $('#beginCard'), btn = $('#beginToggle');
    if (!card) return;
    card.classList.toggle('collapsed', !beginOpen);
    if (btn) {
      btn.setAttribute('aria-expanded', beginOpen ? 'true' : 'false');
      btn.title = beginOpen ? '초보자 3단계 보는 법 — 누르면 접습니다' : '초보자 3단계 보는 법 — 누르면 펼칩니다';
      var cv = btn.querySelector('.bg-cv');
      if (cv) cv.textContent = beginOpen ? '접기' : '펼치기';
    }
  }
  function beginInit() {
    try {
      var v = localStorage.getItem(BEGIN_KEY);
      if (v === '0') beginOpen = false;
      else if (v === '1') beginOpen = true;
    } catch (e) { /* 저장소 차단 환경 — 기본 펼침 */ }
    beginApply();
    var btn = $('#beginToggle');
    if (btn) btn.onclick = function () {
      beginOpen = !beginOpen;
      beginApply();
      try { localStorage.setItem(BEGIN_KEY, beginOpen ? '1' : '0'); } catch (e) {}
    };
  }

  /* ---- 전략 3줄 가이드 (엔진 파라미터에서 생성 — 상단 카드와 같은 단일 소스) ---- */
  function strategyGuide(key) {
    if (key === 'swing') {
      var p = effSwingP();
      var rsiIn = p.rsiEntry || 10, ma = p.qqqMa || 200, exc = p.mktRsiExc == null ? 5 : p.mktRsiExc;
      var stopAtr = p.stopAtr || 4.5, cap = Math.round((p.stopCap || 0.1) * 100);
      var gate = Math.round((p.ma20Gate || 0.05) * 100), cfm = p.ma20Confirm || 2, cool = p.coolLoss || 0;
      var aggr = riskAggr();
      return {
        key: 'swing', name: '스윙형(단기)' + (aggr ? ' · 공격형' : ''), live: true,
        buy: 'RSI(2) ' + rsiIn + ' 미만(단기 과매도) + QQQ ' + ma + '일선 위 — 다음 날 시가 매수. QQQ가 ' + ma +
          '일선 아래여도 QQQ RSI(2)가 ' + exc + ' 미만인 극단 패닉 날은 허용(W 쌍바닥 넥라인 돌파는 보조 루트)',
        stop: '진입가 − ' + stopAtr + ' ATR(변동성 기준 손절폭) 또는 −' + cap + '% 중 가까운 쪽 · ' +
          (cool ? '손절 뒤 ' + cool + '거래일 재진입 금지' : '손절 뒤 재진입 금지 없음(공격형 — 같은 종목 연속 손절 가능)'),
        sell: '이익 +' + gate + '% 이상일 때 종가가 20일선 아래로 ' + cfm + '거래일 연속 마감하면 다음 날 시가 청산 (고정 보유기간 없음)',
        foot: '기준선은 20일선, 손절선은 ' + stopAtr + ' ATR과 −' + cap + '% 중 가까운 쪽입니다.' +
          (aggr ? ' 공격형은 손절 상한만 −15%로 넓혔을 뿐 진입·청산 신호는 안정형과 같습니다.' : '')
      };
    }
    var t = QE.trendParams || {};
    var e = t.entry != null ? t.entry : 50;
    var exTh = t.panicEntryRsi == null ? 5 : t.panicEntryRsi;
    var exDf = t.panicExitRsi == null ? 15 : t.panicExitRsi;
    return {
      key: 'trend', name: '추세형(중기)' + (riskAggr() ? ' · 공격형' : ''), live: true,
      buy: '종합 기술점수 ' + e + ' 이상 + ' + trendMktRule() + ' 100/50% — 다음 날 시가 매수. QQQ 100일선 아래(진입 제한)여도 RSI(2)가 ' +
        exTh + ' 미만인 극단 패닉 날은 전액 비중으로 허용',
      stop: '진입가 − ' + (t.stopAtr || 6) + ' ATR(변동성 기준 손절폭) — 진입 직후부터 즉시 적용',
      sell: '진입 +' + (t.trailStartAtr || 6) + ' ATR 이후 트레일링 ' + (t.trailAtr || 10) + ' ATR 청산 · QQQ 100일선 아래면 진입 ' +
        (t.minHold || 3) + '거래일 뒤 전량 청산 (단, QQQ RSI(2)<' + exDf + '인 패닉일은 그날 청산을 보류하고 다음 날 재판정)',
      foot: '점수는 차트 참고 점수이고, 실제 매매는 이 신호 기준입니다.' +
        (riskAggr() ? ' 공격형 추세형은 C2 신호를 그대로 두고 계좌를 ‘C2 50% + 6M모멘텀 Top5 50%(월간 리밸런싱)’로 섮는 가이드를 함께 보여 줍니다 — 아래 공격형 카드 참고.' : '')
    };
  }

  /* ---- 기법(프리셋) 3줄 가이드 — w 만 실제 진입 규칙, 나머지는 참고용 ---- */
  var TGUIDE = {
    w: { name: 'W 쌍바닥', live: true,
      buy: '두 번째 바닥에서 반등해 넥라인(두 바닥 사이 고점)을 종가로 넘을 때 — 다음 날 시가 매수 (QQQ ' +
        ((QE.swingParams && QE.swingParams.qqqMa) || 200) + '일선 위 또는 RSI(2)<' + ((QE.swingParams && QE.swingParams.mktRsiExc) || 5) + ' 극단 패닉 필요)',
      get stop() {                                   /* 읽을 때 그 성향·전략 파라미터로 — 고정 −10% 금지 */
        var rp = (riskParams() && riskParams().swing) || {};
        return '진입가 − ' + (rp.stopAtr || 4.5) + ' ATR 또는 −' + Math.round(swingCapNow() * 100) +
          '% 중 가까운 쪽 · ' + (rp.coolLoss ? '손절 뒤 ' + rp.coolLoss + '거래일 재진입 금지' : '손절 뒤 재진입 금지 없음(공격형)');
      },
      sell: '이익 +5% 이상에서 20일선 아래 2거래일 연속 마감 → 다음 날 시가 청산',
      foot: 'W 돌파는 스윙형의 보조 진입 루트입니다 — 시장 조건까지 맞아야 실제 신호가 됩니다.' },
    vcp: { name: 'VCP (변동성 축소)', live: false,
      buy: '변동성이 점점 줄어드는 베이스에서 피벗(최근 고점)을 거래량과 함께 넘을 때 — 돌파 확인 뒤 진입',
      stop: '피벗 아래 5~7% 또는 20일선 이탈 — 돌파가 바로 밀리면 미련 없이 정리',
      sell: '+20~25% 이익 뒤 상승이 꺾이거나 20일선 아래로 마감할 때 (분할 익절 권장)',
      foot: '표시 전용 기법입니다 — 실제 진입·청산은 스윙형/추세형 신호로 판단하세요.' },
    tri: { name: '삼각수렴', live: false,
      buy: '수렴 끝에서 상단 추세선을 거래량과 함께 넘을 때 — 돌파 방향으로만 진입',
      stop: '하단 추세선 아래 — 돌파 실패(속임수)면 그 자리에서 손절',
      sell: '삼각형 폭만큼 오른 지점(측정 목표)에 닿거나 하단을 다시 이탈할 때',
      foot: '표시 전용 기법입니다 — 실제 진입·청산은 스윙형/추세형 신호로 판단하세요.' },
    div: { name: '상승 다이버전스', live: false,
      buy: '가격은 신저가인데 RSI(14)가 전 저점보다 높을 때 — 반전 양봉이 확인된 다음 날 진입',
      stop: '신저가 아래 — 한 번 더 깨지면 신호가 무효이므로 바로 정리',
      sell: '직전 고점·저항에 닿거나 20일선에서 막힐 때',
      foot: '표시 전용 기법입니다 — 실제 진입·청산은 스윙형/추세형 신호로 판단하세요.' },
    bk: { name: '거래량 돌파', live: false,
      buy: '종가가 20일 최고가를 넘고 그날 거래량이 20일 평균의 1.5배 이상일 때 — 다음 날 시가 진입',
      stop: '돌파한 기준선(직전 20봉 고점) 아래 — 다시 아래로 내려오면 거짓 돌파',
      sell: '+5~10% 뒤 20일선 아래로 마감하거나, 거래량이 급감하며 밀릴 때',
      foot: '표시 전용 기법입니다 — 실제 진입·청산은 스윙형/추세형 신호로 판단하세요.' },
    mom6: { name: '6M 모멘텀 Top 5', live: false,
      buy: '최근 126거래일(약 6개월) 수익률 상위 5종목 — 위성 10~15% 비중의 참고 후보로만 봅니다',
      stop: '진입·손절·청산은 지금 선택한 추세형/스윙형 신호 그대로 — 이 필터는 매매 규칙을 바꾸지 않습니다',
      sell: '상위 5에서 밀려나면 목록에서 빠집니다 (보유 중이라면 전략 청산 조건까지 그대로 유지)',
      foot: '' }   /* 요청 문구(6M모멘텀 5: 최근 126거래일 …)는 가이드 아래 상시 한 줄 안내(#momNote)에 있다 */
  };
  function renderPresetGuide() {
    var el = $('#presetGuide');
    if (!el) return;
    var p = state.preset, g = null;
    if (p && TGUIDE[p]) g = TGUIDE[p];
    else g = strategyGuide(state.strategy);        /* 전체 · Top 30 · 실적 우량주 · 승률 70%+ → 선택한 전략 가이드 */
    if (p === 'w' && g) {                          /* W 돌파는 스윙형 보조 루트 — 손절·쿨다운은 지금 성향의 실효 파라미터 */
      var wp = effSwingP();
      g = { name: g.name, live: g.live, buy: g.buy, sell: g.sell, foot: g.foot,
        stop: '진입가 − ' + (wp.stopAtr || 4.5) + ' ATR 또는 −' + Math.round((wp.stopCap || 0.1) * 100) + '% 중 가까운 쪽 · ' +
          (wp.coolLoss ? '손절 뒤 ' + wp.coolLoss + '거래일 재진입 금지' : '손절 뒤 재진입 금지 없음(공격형)') };
    }
    if (!g) { el.className = 'pguide'; el.innerHTML = ''; return; }
    var isWin = p === 'win70', isMom = p === 'mom6';
    var w7 = isWin ? win70Counts() : null;
    var m6 = isMom ? mom6Counts() : null;
    var tag = isWin ? '<span class="pg-tag">참고 필터 · 5년 승률 70%+</span>'
      : isMom ? '<span class="pg-tag mom">참고 필터 · 6개월 모멘텀</span>'
      : (g.live ? '<span class="pg-tag live">실제 진입 규칙</span>' : '<span class="pg-tag">참고용 기법</span>');
    var head = isWin ? ('현재 전략 · ' + w7.name + ' — 5년 승률 70% 이상 ' + w7.n + '종목')
      : isMom ? ('6M모멘텀 Top ' + m6.n + ' · ' + m6.top.map(function (r) { return r.t + ' ' + pct(r.r, 1); }).join(' · '))
      : ((p && TGUIDE[p] ? '이 기법' : '지금 전략') + ' · ' + g.name);
    var foot = isWin
      ? ('현재 전략 5년 백테스트 승률 70% 이상 종목 · 참고 필터(과거 성과 기반) — 승률이 높아도 손익비·최대낙폭은 따로 봐야 하고, 미래 수익을 보장하지 않습니다. ' + (g.foot || ''))
      : g.foot;
    el.className = 'pguide on';
    el.innerHTML =
      '<div class="pg-h"><span>' + head + '</span>' + tag + '</div>' +
      '<div class="pg-row buy"><b>매수</b><span>' + g.buy + '</span></div>' +
      '<div class="pg-row stop"><b>손절</b><span>' + g.stop + '</span></div>' +
      '<div class="pg-row sell"><b>익절·매도</b><span>' + g.sell + '</span></div>' +
      (foot ? '<div class="pg-foot">' + foot + '</div>' : '');
  }

  /* ---- 데드캣(추가 하락) 위험 — REPORT_V_REBOUND.md 사건 연구 기반 표시 전용 ----
     전일 RSI(2)<15(캐피츌레이션) 또는 5봉 낙폭 −8% 이하의 급락 중,
     당일 +3% 양봉(종가가 봉 상위 30%) + 거래량 1.3배가 나오면 '반등 확인', 아니면 '데드캣 위험'. */
  function deadCatInfo(a) {
    var c = a.close, S = a.series, n = c.length;
    if (!S || n < 30) return null;
    var i = n - 1;
    var r2 = QE.rsi(c, 2);
    var hh = 0, k;
    for (k = Math.max(0, i - 5); k <= i - 1; k++) if (S.h[k] > hh) hh = S.h[k];
    var dd5 = hh > 0 ? c[i - 1] / hh - 1 : 0;
    var prevR2 = r2[i - 1];
    var drop = (prevR2 != null && prevR2 < 15) || dd5 <= -0.08;
    if (!drop) return { drop: false, dd5: dd5, prevR2: prevR2 };
    var chg = c[i] / c[i - 1] - 1;
    var rng = S.h[i] - S.l[i];
    var pos = rng > 0 ? (c[i] - S.l[i]) / rng : 0;
    var vavg = a.ind && a.ind.volSma ? a.ind.volSma[i] : null;
    var vx = vavg > 0 ? S.v[i] / vavg : null;
    var up3 = chg >= 0.03 && pos >= 0.7;
    var vol = chg > 0 && vx != null && vx >= 1.3;
    if (up3 && vol) return { drop: true, ok: true, dd5: dd5, prevR2: prevR2, chg: chg, vx: vx };
    if (up3) return { drop: true, ok: true, partial: true, dd5: dd5, prevR2: prevR2, chg: chg, vx: vx };
    return { drop: true, ok: false, dd5: dd5, prevR2: prevR2, chg: chg, vx: vx };
  }

  /* ---- 종목 카드 한눈 행동 요약 3줄 ---- */
  function heroSumHtml(a) {
    var swing = state.strategy === 'swing';
    var plan = (swing ? a.swing : a.trendPlan) || {};
    var bundle = a.strategy && a.strategy[swing ? 'swing' : 'trend'];
    var live = bundle ? bundle.live : null;
    var g = sigOf(a);
    var price = a.price;

    /* ① 지금 할 일 */
    var act, tone, sub;
    if (g.sell && g.kind === 'exit') {
      act = '매도 — 다음 날 시가 청산';
      tone = 'sell';
      sub = swing ? '이익 구간에서 20일선 아래로 <b>2일 연속</b> 마감했습니다'
        : '트레일 청산가를 종가가 이탈했습니다';
    } else if (g.waitbuy && g.kind === 'blocked') {
      act = '대기 — 오늘은 신규 매수 없음';
      tone = 'wait';
      sub = swing ? '진입 조건은 갖췄지만 시장(QQQ)이 200일선 아래라 스윙 매수를 막고 있습니다'
        : '진입 조건은 갖췄지만 QQQ가 100일선 아래 · 진입 제한(비중 0%) 상태입니다';
    } else if (g.waitbuy && g.kind === 'cool') {
      act = '관망 — 손절 후 ' + (plan.coolLeft != null ? plan.coolLeft : '?') + '거래일 대기';
      tone = 'wait';
      sub = '같은 종목에서 손절이 이어지지 않게 쉬는 구간입니다';
    } else if (g.held) {
      act = '홀드 — 보유 유지';
      tone = 'buy';
      sub = '청산 조건이 나오기 전까지 손절가만 지킵니다' + (live ? ' (평가 ' + pct(live.ret, 1) + ')' : '');
    } else if (g.buy) {
      act = '매수 — 진입 조건 충족';
      tone = 'buy';
      sub = '다음 거래일 <b>시가</b>에 사는 기준입니다 (참고가 ' + usd(price) + ')';
    } else {
      act = '관망 — 아직 살 자리가 아닙니다';
      tone = 'wait';
      sub = swing
        ? 'RSI(2) ' + (plan.rsi2 != null ? plan.rsi2.toFixed(1) : '—') + ' (기준 ' + (QE.swingParams.rsiEntry || 10) + ' 미만) — 과매도가 더 깊어져야 신호가 납니다'
        : '종합점수·시장 조건이 아직 충족되지 않았습니다';
    }

    /* ② 손절가 / 기준선 */
    var stopPx = plan.stopPrice != null ? plan.stopPrice : (swing ? price * 0.9 : a.stop);
    var dStop = stopPx ? stopPx / price - 1 : null;
    var refLab, refPx;
    if (swing) { refLab = '20일선'; refPx = plan.ma20 != null ? plan.ma20 : (a.ind && a.ind.ma20 ? a.ind.ma20[a.close.length - 1] : null); }
    else { refLab = '트레일 기준'; refPx = live && live.trailStop != null ? live.trailStop : null; }
    var l2v = stopPx ? '<span class="big neg">' + usd(stopPx) + '</span>' + (dStop != null ? ' <b class="neg">(' + pct(dStop, 1) + ')</b>' : '') : '—';
    var l2n = (live ? '보유 포지션 기준 · ' : '신규 진입 기준 · ') +
      (swing ? (plan.stopAtr || 4.5) + ' ATR과 −' + Math.round(((plan.stopCap != null ? plan.stopCap : 0.1)) * 100) + '% 중 가까운 쪽'
        : '진입가 − ' + ((a.trendPlan && a.trendPlan.stopAtr) || 6) + ' ATR') +
      (refPx != null && refLab ? ' · ' + refLab + ' <b>' + usd(refPx) + '</b>' : '');

    /* ③ 주의할 점 — 실적 D-3 · 데드캣(추가 하락) 위험 (제목 한 줄 + 설명) */
    var vHead = [], wTxt = [], wTone = 'wait';
    var e = earnDays(a.meta.t);
    if (e && e.dd >= 0 && e.dd <= 3) {
      vHead.push('실적 ' + earnLabel(e.dd) + ' 주의');
      wTxt.push('<b>실적 발표가 ' + e.dd + '일 앞</b> — 밤사이 갭하락으로 −' +
        Math.round(swingCapNow() * 100) + '% 손절 상한을 넘길 수 있습니다. 신규 진입은 발표 뒤가 안전합니다');
      wTone = 'warn';
    }
    var dc = deadCatInfo(a);
    if (dc && dc.drop) {
      if (dc.ok && !dc.partial) {
        vHead.push('반등 확인됨');
        wTxt.push('전일 급락 뒤 <b>+' + (dc.chg * 100).toFixed(1) + '% 양봉 + 거래량 ' +
          (dc.vx != null ? dc.vx.toFixed(1) + '배</b>' : '동반</b>') + ' — 저점을 다시 깨는 위험이 46%로 크게 줄었습니다');
        if (wTone !== 'warn') wTone = 'good';
      } else if (dc.ok && dc.partial) {
        vHead.push('반등 조짐(미확인)');
        wTxt.push('+' + (dc.chg * 100).toFixed(1) + '% 양봉은 나왔지만 <b>거래량이 부족</b>합니다 — 확인 전에는 비중을 줄여 접근하세요');
        if (wTone !== 'warn') wTone = 'warn';
      } else {
        vHead.push('데드캣(추가 하락) 위험');
        wTxt.push('급락 중인데 <b>반등 확인(+3% 양봉·거래량)</b>이 없습니다 — 5년 사건 연구에서 반등 확인이 없는 급락 뒤에는 저점을 다시 깨는 경우가 다수였습니다. 확인 전에는 비중을 줄여 접근하세요');
        wTone = 'warn';
      }
    }
    if (!vHead.length) {
      vHead.push('특별한 경고 없음');
      wTxt.push('지금은 실적·급락 경고가 없습니다 — 그래도 손절가는 먼저 정하세요');
    }

    return '<div class="bs-cell tone-' + tone + '">' +
        '<div class="bs-k"><i>①</i>지금 할 일</div>' +
        '<div class="bs-v' + (tone === 'buy' ? ' pos' : tone === 'sell' ? ' neg' : ' dim') + '">' + act + '</div>' +
        '<span class="bs-n">' + sub + '</span></div>' +
      '<div class="bs-cell">' +
        '<div class="bs-k"><i>②</i>' + (live ? '손절가 <em>보유 포지션</em>' : '손절가 <em>신규 진입 기준</em>') + '</div>' +
        '<div class="bs-v">' + l2v + '</div>' +
        '<span class="bs-n">' + l2n + '</span></div>' +
      '<div class="bs-cell tone-' + wTone + '">' +
        '<div class="bs-k"><i>③</i>주의할 점</div>' +
        '<div class="bs-v ' + (wTone === 'warn' ? 'warnv' : (wTone === 'good' ? 'pos' : 'dim')) + '">' + vHead.join(' · ') + '</div>' +
        '<span class="bs-n">' + wTxt.join('<br>') + '</span></div>';
  }
  function renderHeroSum(a) {
    var el = $('#heroSum');
    if (!el) return;
    el.innerHTML = heroSumHtml(a);
    el.classList.add('on');
  }

  /* ---------------- hero ---------------- */
  function renderHero(a) {
    var ew = $('#earnSlot');
    if (ew) ew.innerHTML = earnWarnHtml(a.meta.t);
    var dvs = $('#divStrip');
    if (dvs) {
      dvs.innerHTML = divStripHtml(a);
      dvs.classList.toggle('on', !!(a.div && a.div.hit));
    }
    var bks = $('#bkStrip');
    if (bks) {
      bks.innerHTML = bkStripHtml(a);
      bks.classList.toggle('on', !!(a.bk && a.bk.strong));
    }
    $('#heroRank').textContent = a.meta.r ? '#' + a.meta.r : '관심';
    $('#heroTicker').textContent = a.sym;
    $('#heroName').textContent = a.meta.nk;
    $('#heroSector').textContent = a.meta.sk;
    var ha = $('#heroAsOf'); if (ha) ha.textContent = a.dates[a.dates.length - 1] + ' 종가';
    /* 시뮬 기준 — 이 화면의 보유·청산은 백테스트 가상 포지션(실계좌 아님) */
    var hsim = $('#heroSim');
    if (hsim) {
      var simLive = !!(a.strat && a.strat.live);
      hsim.hidden = !simLive;
      if (simLive) hsim.title = '이 종목은 ' + (a.stratKey === 'swing' ? '스윙형' : '추세형') + ' 백테스트에서 ' +
        a.strat.live.entryDate + ' $' + pxs(a.strat.live.entry) + '에 진입한 것으로 계산된 가상 포지션입니다 — 실제 계좌 보유가 아닙니다';
    }
    /* 데이터 지연 — 원천(Yahoo) 결측으로 같은 봉이 반복된 종목 */
    var hst = $('#heroStale');
    if (hst) {
      var sr = (M.series && M.series[a.sym]) || {};
      var sn = sr.staleN || 0, mn = sr.miss10 || 0;
      var warn = (sn >= 2 || mn >= 2);
      hst.hidden = !warn;
      if (warn) {
        hst.textContent = sn >= 2 ? ('데이터 지연 ' + sn + '거래일') : ('데이터 결측 ' + mn + '/10봉');
        hst.title = '원천(Yahoo) 데이터에 빠진 봉이 있어 직전 봉 값으로 채워 표시했습니다' +
          (sr.lastReal ? ' — 마지막 실제 봉 ' + sr.lastReal : '') +
          ' · 최근 10봉 중 ' + mn + '봉 결측. 이 종목의 지표·신호는 실제 가격과 다를 수 있으니 참고용으로만 보세요.';
      } else hst.textContent = '';
    }
    /* 공격형 · 6M모멘텀 Top5 강조 칩 (추세형에서 특히 — 블렌드 가이드의 모멘텀 슬리브 후보) */
    var hm = $('#heroMom');
    if (hm) {
      var m6 = mom6Counts(), mr = m6.byT[a.sym];
      var showMom = riskAggr() && mr && mr.k <= MOM6_TOP;
      hm.hidden = !showMom;
      hm.className = 'hero-mom' + (showMom ? ' on' : '');
      if (showMom) {
        hm.innerHTML = '🔥 6M모멘텀 ' + mr.k + '위 <b>' + pct(mr.r, 1) + '</b>';
        hm.title = mom6Tip(mr) + (state.strategy === 'swing' ? '' : ' — 공격형 추세 블렌드의 모멘텀 50% 후보');
      } else hm.innerHTML = '';
    }
    $('#heroPrice').textContent = usd(a.price);
    var c = $('#heroChg');
    c.className = 'chg ' + cls(a.change);
    c.textContent = (a.change > 0 ? '▲ ' : a.change < 0 ? '▼ ' : '') + Math.abs(a.changeAbs).toFixed(2) + ' (' + pct(a.change) + ')';
    $('#sigName').textContent = a.label.ko;
    $('#sigName').style.color = a.label.color;
    $('#sigSub').textContent = '차트 참고 점수 ' + a.score.toFixed(1) + ' / 100';
    $('#sigSub').title = '점수 구간 — 75점↑ 차트 강세 · 58~74 차트 양호 · 45~57 차트 중립 · 35~44 차트 약세 · 35점 미만 차트 극약세 (매매 지시 아님)';
    var circ = 2 * Math.PI * 27;
    var arc = $('#gaugeArc');
    arc.style.strokeDasharray = circ;
    arc.style.strokeDashoffset = circ * (1 - a.score / 100);
    arc.style.stroke = a.label.color;
    $('#gaugeVal').textContent = Math.round(a.score);
    $('#gaugeVal').style.color = a.label.color;

    renderPlan(a);
    renderHeroSum(a);
    renderHeroAcct();
  }

  /* ============================================================
     상단 매매 카드 — 신규 진입 / 보유 중 관리 / 손익비
     판정·손절·트레일 값은 엔진(trendStatus · swingStatus · 백테스트 live)에서만 받는다
     ============================================================ */
  /* 손절가 라벨 — 보유 포지션의 손절가와 신규 진입 기준 손절가를 문구로 구분한다 */
  function pbStopLabel(live, isSwing) {
    var k = $('#phStopK'); if (!k) return;
    k.innerHTML = live
      ? '손절가 <em class="tm" title="백테스트에서 실제로 진입한 가상 포지션의 손절가입니다 — 보유 중에는 이 가격이 기준입니다">보유 포지션</em>'
      : '손절가 <em class="tm" title="아직 보유하지 않은 상태의 신규 진입 기준 손절가입니다 — 진입하면 이 가격이 기준이 됩니다">신규 진입 기준</em>';
  }
  function pbState(el, kind, text) {
    if (!el) return;
    el.className = 'pb-state ' + kind;
    el.textContent = text;
  }
  function techCls(lab) {
    var k = lab && lab.key;
    return (k === 'strongbuy' || k === 'buy') ? 'pos' : ((k === 'sell' || k === 'strongsell') ? 'neg' : 'warn');
  }
  /* 목표 참고가 — 엘리어트 1차 목표 또는 52주 고점 중 진입가 바로 위(가장 가까운) 것 */
  function refTarget(a, entry) {
    if (!(entry > 0)) return null;
    var out = [];
    var ew = a.elliott && a.elliott.plan && a.elliott.plan.targets;
    if (ew && ew.length) {
      ew.forEach(function (t) {
        if (!t || t.bad || t.hi == null) return;
        var px = (t.lo != null && t.lo > entry * 1.005) ? t.lo : (t.hi > entry * 1.005 ? t.hi : null);
        if (px != null) out.push({ price: px, name: '엘리어트 1차 목표', d: px / entry - 1 });
      });
    }
    if (a.hi52 && a.hi52 > entry * 1.005) out.push({ price: a.hi52, name: '52주 고점', d: a.hi52 / entry - 1 });
    if (!out.length) return null;
    out.sort(function (x, y) { return x.d - y.d; });
    return out[0];
  }
  function pbWhy(rows) {
    var el = $('#peWhy');
    if (!el) return;
    el.innerHTML = rows.map(function (r) {
      return '<li class="' + r.cls + '">' + r.html + '</li>';
    }).join('');
  }
  function renderPlan(a) {
    var isSwing = a.stratKey === 'swing';
    var bundle = a.strat || (a.strategy && a.strategy[a.stratKey]) || null;
    /* 보유 포지션의 단일 소스 = 전체 이력 전략(a.strategy) — 스캐너·상태 탭의 sigOf() 와 같은 곳을 본다.
       기간 창(stratView)에는 포지션이 없는데 스캐너는 '매도/보유'인 경우(예: 6M 창에는 없지만 5Y 시뮬은 보유 중인 종목)
       카드가 '포지션 없음'으로 어긋나던 문제를 없앤다. */
    var heldB = a.strategy && a.strategy[a.stratKey];
    var live = (heldB && heldB.live) || (bundle ? bundle.live : null) || null;
    var mode = isSwing ? '스윙형 (단기)' : '추세형 (중기)';
    var tech = $('#peTech');
    if (!tech) return;
    $('#peMode').textContent = mode;
    $('#phMode').textContent = mode;
    $('#pbHold').title = '선택한 전략(' + mode + ')의 백테스트 포지션 기준 — 보유 중이 아니면 신규 진입 계획값입니다 (실제 계좌 보유와 다를 수 있음)';

    /* ---- 기술평가(종합점수 · 라벨) — 전략과 분리해 그대로 보여준다 ---- */
    tech.className = techCls(a.label);
    tech.textContent = a.score.toFixed(1) + '점 · ' + a.label.ko;

    var entryRef = a.price, stopPrice = null;

    if (isSwing) {
      /* ================= 스윙형 ================= */
      var sp = a.plan || a.swing || {};
      entryRef = sp.entryRef != null ? sp.entryRef : a.price;
      stopPrice = sp.stopPrice != null ? sp.stopPrice : entryRef * 0.9;
      var sCool = sp.state === 'cool';
      var sKind = sp.state === 'ready' ? 'ready' : ((sp.state === 'blocked' || sCool) ? 'blocked' : 'wait');
      pbState($('#peState'), sKind, sp.state === 'ready' ? '매수' : (sCool ? '손절대기' : (sp.state === 'blocked' ? '시장대기' : '관망')));
      $('#peSigK').textContent = '스윙형 진입';
      var sig = $('#peSig');
      var spMa = (QE.swingParams && QE.swingParams.qqqMa) || 200;
      sig.className = (sp.rsiOk || sp.wBreak) && !sCool ? 'pos' : 'dim';
      sig.textContent = (sCool ? '재진입 금지 ' + sp.coolLeft + '/' + sp.coolTotal + '일' :
        (sp.rsiOk ? 'RSI 과매도 충족' : (sp.wBreak ? 'W 돌파 신호' : 'RSI 조건 미달'))) +
        ' / QQQ ' + spMa + '일선 ' + (sp.marketOk ? (sp.marketAbove === false ? '아래·RSI(2) 패닉 예외 적용' : '위') : '아래');
      var swWhy = [];
      if (sp.coolActive) swWhy.push({ cls: 'wait', html: '손절 후 재진입 대기 <b>' + sp.coolLeft + '/' + sp.coolTotal + '일</b>' +
        (sp.coolFromDate ? ' — ' + sp.coolFromDate + ' 손절 청산 이후' : '') + ' · 이 종목 신규 진입 금지 (W 돌파 포함)' });
      swWhy.push(
        { cls: sp.rsiOk ? 'on' : 'off', html: 'RSI(2) <b>' + (sp.rsi2 == null ? '—' : sp.rsi2.toFixed(1)) + '</b> / 기준 ' + (sp.rsiEntry || 10) + ' 미만 — ' + (sp.rsiOk ? '충족' : '미달') + ' <em class="tm">(단기 과매도 점수)</em>' },
        { cls: sp.marketOk ? (sp.marketAbove === false ? 'wait' : 'on') : 'off',
          html: 'QQQ ' + spMa + '일선 <b>' + (sp.marketOk ? (sp.marketAbove === false ? '아래 — 극단 패닉 예외' : '위') : '아래') + '</b>' +
            (sp.qqq != null && sp.qqqMa != null ? ' — $' + pxs(sp.qqq) + (sp.marketAbove === false ? ' < ' : ' > ') + '$' + pxs(sp.qqqMa) : '') +
            (sp.qqqRsi2 != null ? ' · QQQ RSI(2) <b>' + sp.qqqRsi2.toFixed(1) + '</b>' + (sp.marketOs ? ' (기준 5 미만 — 허용)' : '') : '') },
        { cls: sp.wBreak ? 'on' : (sp.wStage ? 'wait' : ''), html: 'W 쌍바닥 <b>' + (sp.wStage || '없음') + '</b>' + (sp.wNeck != null ? ' — 넥라인 $' + pxs(sp.wNeck) : '') }
      );
      pbWhy(swWhy);
      $('#peZoneK').textContent = '진입 시점';
      $('#peZone').textContent = '다음 시가 (참고 ' + usd(entryRef) + ')';
      $('#peCond').textContent = '실제 진입 조건 · ' + (sp.entryRule || 'RSI(2) 10 미만 · QQQ 200일선 위(또는 QQQ RSI(2)<5 극단 패닉) → 다음 날 시가 매수 · 손절 후 10거래일 재진입 금지') +
        (live ? ' — 홀드 중에는 신규 진입 신호를 쓰지 않습니다' : '');

      /* 보유 중 관리 */
      if (live) {
        pbState($('#phState'), 'live', '보유시홀드');
        pbStopLabel(true, isSwing);
        $('#phStop').className = 'neg';
        $('#phStop').textContent = usd(live.stop);
        $('#phStopSub').textContent = '진입 ' + usd(live.entry) + ' (' + live.entryDate + ') · ' + sp.stopAtr + ' ATR(변동성 기준 손절폭) / -' +
          Math.round((sp.stopCap || 0.1) * 100) + '% 중 가까운 값';
        $('#phTrail').className = 'mute';
        $('#phTrail').textContent = '해당 없음';
        $('#phTrailSub').textContent = '스윙형은 트레일링 스톱을 쓰지 않습니다 — 고정 손절 · 이익 중 20일선 2일 연속 이탈 청산';
        var swNeed = live.ma20Need || (sp.ma20Confirm || 2);
        var swBelow = live.ma20Below || 0;
        var swExit = (live.exitActive && live.ma20 != null) ? usd(live.ma20) : null;
        $('#phExit').className = swExit ? '' : 'mute';
        $('#phExit').textContent = swExit || '미발동';
        $('#phExitSub').textContent = !swExit
          ? '이익 +' + Math.round((sp.ma20Gate || 0.05) * 100) + '% 도달 전 — 손절가만 유효 (현재 ' + pct(live.ret) + ')'
          : (live.exitConfirm
            ? '평가이익 ' + pct(live.ret) + ' · 20일선 아래 ' + swNeed + '일 연속 — 다음 날 시가 청산'
            : '평가이익 ' + pct(live.ret) + ' · 20일선 아래 ' + swBelow + '/' + swNeed + '일 — 내일도 아래로 마감해야 청산');
      } else {
        pbState($('#phState'), 'none', '포지션 없음');
        pbStopLabel(false, isSwing);
        $('#phStop').className = 'neg';
        $('#phStop').textContent = usd(stopPrice);
        $('#phStopSub').textContent = '신규 진입 기준 ' + usd(entryRef) + ' − ' + (sp.stopAtr || 4.5) + ' ATR(변동성 기준 손절폭) / -' + Math.round((sp.stopCap || 0.1) * 100) + '% 상한';
        $('#phTrail').className = 'mute';
        $('#phTrail').textContent = '해당 없음';
        $('#phTrailSub').textContent = '스윙형은 트레일링 스톱을 쓰지 않습니다 — 고정 손절로 관리';
        $('#phExit').className = 'mute';
        $('#phExit').textContent = '미발동';
        $('#phExitSub').textContent = '보유 후 이익 +' + Math.round((sp.ma20Gate || 0.05) * 100) + '% 이상에서 20일선 아래 ' +
          (sp.ma20Confirm || 2) + '거래일 연속 마감이 청산 기준이 됩니다';
      }
    } else {
      /* ================= 추세형 ================= */
      var tp = a.trendPlan || {};
      entryRef = tp.entryRef != null ? tp.entryRef : a.price;
      stopPrice = tp.stopPrice != null ? tp.stopPrice : a.stop;
      var tKind = tp.state === 'ready' ? 'ready' : (tp.state === 'blocked' ? 'blocked' : 'wait');
      pbState($('#peState'), tKind, tp.state === 'ready' ? '매수'
        : (tp.state === 'blocked' ? '시장대기' : '관망'));
      $('#peSigK').textContent = '추세형 진입';
      var sig2 = $('#peSig');
      sig2.className = tp.scoreOk ? 'pos' : 'dim';
      sig2.textContent = (tp.scoreOk ? '점수 조건 충족' : '점수 조건 미달') + ' / 시장 ' +
        (tp.marketOk ? tp.marketStage : ('QQQ 100일선 아래 · 진입 제한(비중 0%)'));
      var why = [
        { cls: tp.scoreOk ? 'on' : 'off', html: '종합점수 <b>' + (tp.score == null ? '—' : tp.score.toFixed(1)) + '</b> / 기준 ' + tp.need + ' — ' + (tp.scoreOk ? '충족' : '미달') },
        { cls: tp.marketOk ? (tp.tw < 1 ? 'wait' : 'on') : 'off', html: '시장 단계 <b>' + tp.marketStage + '</b> — ' + (tp.marketNote || '') }
      ];
      if (!tp.atrOk) why.push({ cls: 'off', html: 'ATR 계산 불가 — 진입 보류' });
      pbWhy(why);
      $('#peZoneK').textContent = '진입 후보 구간';
      var z = tp.entryZone || [entryRef, entryRef];
      $('#peZone').textContent = usd(z[0]) + ' ~ ' + usd(z[1]);
      $('#peCond').textContent = '실제 진입 조건 · ' + (tp.entryRule || '종합점수 50 이상 + ' + trendMktRule() + ' → 다음 날 시가 매수') +
        ' (참고가 ' + usd(entryRef) + ')' +
        (live ? ' — 홀드 중이라 추가 진입 대신 비중 조정만 반영' : '');

      /* 보유 중 관리 */
      if (live) {
        pbState($('#phState'), 'live', '보유시홀드');
        pbStopLabel(true, isSwing);
        $('#phStop').className = 'neg';
        $('#phStop').textContent = usd(live.stop);
        $('#phStopSub').textContent = '진입 ' + usd(live.entry) + ' (' + live.entryDate + ') · ' + tp.stopAtr + ' ATR 손절';
        $('#phTrail').className = live.trailArmed ? '' : 'mute';
        $('#phTrail').textContent = live.trailArmed ? '발동' : '미발동';
        $('#phTrailSub').textContent = '진입가 +' + tp.trailStartAtr + ' ATR ' + usd(live.trailArm) + ' 도달 후 고점 - ' + tp.trailAtr + ' ATR' +
          (live.peakH ? ' · 고점 ' + usd(live.peakH) : '') + ' · 손절·트레일은 즉시 작동';
        var tMin = live.minHold != null ? live.minHold : (tp.minHold || 3);
        var tHold = live.holdDays != null ? live.holdDays : 0;
        var tTw = live.twNow != null ? live.twNow : null;
        var tr = live.trailStop != null ? Math.max(live.trailStop, live.stop) : null;
        if (live.marketExitPending) {
          $('#phExit').className = 'neg';
          $('#phExit').textContent = '다음 시가';
          $('#phExitSub').textContent = 'QQQ 100일선 아래(진입 제한·비중 0%) — 보유 ' + tHold + '거래일 · 다음 시가 전량 청산';
        } else if (live.marketExitDeferred) {
          $('#phExit').className = 'warn';
          $('#phExit').textContent = '청산 보류';
          $('#phExitSub').textContent = 'QQQ 100일선 아래지만 RSI(2) ' + (live.qqqRsi2 == null ? '—' : live.qqqRsi2.toFixed(1)) +
            ' < ' + (live.panicExitRsi || 15) + ' 극단 패닉 — 오늘은 팔지 않고 다음 날 다시 판정합니다 (손절·트레일은 계속 작동)';
        } else if (tTw === 0 && !live.marketExitArmed) {
          $('#phExit').className = 'warn';
          $('#phExit').textContent = '유예 ' + tHold + '/' + tMin + '일';
          $('#phExitSub').textContent = 'QQQ 100일선 아래지만 최소 보유 ' + tMin + '거래일 전 — 시장약세 청산 보류, 손절·트레일만 작동';
        } else {
          $('#phExit').className = tr != null ? '' : 'mute';
          $('#phExit').textContent = tr != null ? usd(tr) : '미발동';
          $('#phExitSub').textContent = tr != null
            ? '고점 - ' + tp.trailAtr + ' ATR (손절가보다 높을 때 적용) · 평가 ' + pct(live.ret) +
              ' · 시장약세 청산은 보유 ' + tMin + '거래일 이후 발동'
            : '고점이 발동선 ' + usd(live.trailArm) + '을 넘으면 표시됩니다 · 시장약세 청산은 보유 ' + tMin + '거래일 이후 발동';
        }
      } else {
        pbState($('#phState'), 'none', '포지션 없음');
        pbStopLabel(false, isSwing);
        $('#phStop').className = 'neg';
        $('#phStop').textContent = usd(stopPrice);
        $('#phStopSub').textContent = '신규 진입 기준 ' + usd(entryRef) + ' - ' + tp.stopAtr + ' ATR';
        $('#phTrail').className = 'mute';
        $('#phTrail').textContent = '발동선 ' + usd(tp.trailArmPrice);
        $('#phTrailSub').textContent = '기준 진입가 +' + tp.trailStartAtr + ' ATR 도달 후 고점 - ' + tp.trailAtr + ' ATR';
        $('#phExit').className = 'mute';
        $('#phExit').textContent = '미발동';
        $('#phExitSub').textContent = '발동 전에는 손절가만 유효 — 트레일 발동 후 청산 기준가가 표시됩니다 · 시장약세 청산은 보유 ' +
          (tp.minHold || 3) + '거래일 이후 발동';
      }
    }

    /* ---- 손익비 — 52주 고점을 무조건 목표로 잡던 모순 수정 ----
       · 계획 R:R = 손절폭 대비 1.2~8R 구간에 있는 가장 가까운 목표(엘리어트 1차 목표 · 최근 20일 고점)
       · 그런 목표가 없으면(신고가 부근 등) 5년 백테스트의 실현 R:R(평균 이익 ÷ 평균 손실)로 대체 */
    var risk0 = (entryRef > 0 && stopPrice != null) ? entryRef - stopPrice : null;
    var tgt = null, rr = null;
    if (risk0 > 0) {
      var cands = [];
      var ewT = a.elliott && a.elliott.plan && a.elliott.plan.targets;
      if (ewT && ewT.length) ewT.forEach(function (t) {
        if (!t || t.bad || t.hi == null) return;
        var px = (t.lo != null && t.lo > entryRef * 1.005) ? t.lo : (t.hi > entryRef * 1.005 ? t.hi : null);
        if (px != null) cands.push({ price: px, name: '엘리어트 1차 목표' });
      });
      var hs = a.series && a.series.h;
      if (hs && hs.length >= 20) {
        var h20 = 0;
        for (var q20 = hs.length - 20; q20 < hs.length; q20++) if (hs[q20] > h20) h20 = hs[q20];
        if (h20 > entryRef * 1.01) cands.push({ price: h20, name: '최근 20일 고점' });
      }
      cands.forEach(function (c) { c.rr = (c.price - entryRef) / risk0; c.d = c.price / entryRef - 1; });
      var ok = cands.filter(function (c) { return c.rr >= 1.2 && c.rr <= 8; });
      ok.sort(function (x, y) { return x.d - y.d; });
      if (ok.length) { tgt = ok[0]; rr = tgt.rr; }
      else {
        /* 목표 여지가 손절폭보다 작은 경우 — 참고로 가장 가까운 목표만 문구에 남긴다 */
        cands.sort(function (x, y) { return x.d - y.d; });
        if (cands.length) { tgt = cands[0]; rr = tgt.rr; }
      }
    }
    var rrEl = $('#rrVal'), rrK = $('#rrK');
    var stats0 = a.stats;
    var realized = (stats0 && stats0.avgWin > 0 && stats0.avgLoss < 0) ? stats0.avgWin / Math.abs(stats0.avgLoss) : null;
    var planOk = (rr != null && rr >= 1.2 && rr <= 8);
    if (planOk) {
      rrEl.className = 'rr-v';
      rrEl.textContent = '1 : ' + rr.toFixed(2);
      if (rrK) rrK.textContent = '계획 R:R (목표까지 이익 ÷ 손절폭)';
      rrEl.title = '목표까지 ' + pct(tgt.d, 1) + ' ÷ 손절폭 ' + Math.abs(risk0 / entryRef * 100).toFixed(1) + '%';
    } else if (realized != null) {
      rrEl.className = 'rr-v';
      rrEl.textContent = '1 : ' + realized.toFixed(2);
      if (rrK) rrK.textContent = '실현 R:R (' + btTag() + ' 평균 이익 ÷ 평균 손실)';
      rrEl.title = '계획 손익비(1.2~8R)로 쓰기 어려운 자리라 청산 완료 거래의 실현 손익비(' + btTag() + ' 기간)를 표시합니다';
    } else {
      rrEl.className = 'rr-v mute';
      rrEl.textContent = '—';
      if (rrK) rrK.textContent = '신규 진입 기준 R : R';
    }
    var stopLab = isSwing ? (sp.stopAtr || 4.5) + ' ATR' : (a.trendPlan ? a.trendPlan.stopAtr : 6) + ' ATR';
    var tgtTxt = tgt
      ? '<b>' + usd(tgt.price) + '</b> <i>(' + tgt.name + ' · ' + pct(tgt.d, 1) + ' · 계획 1:' + (rr != null ? rr.toFixed(2) : '—') + ')</i>'
      : '<b>—</b> <i>(위쪽 목표 여지 없음 — 52주 고점 부근)</i>';
    var rrNote = planOk ? ''
      : (tgt && rr != null && rr > 8
          ? ' — 목표가 손절폭의 8배를 넘어 계획 손익비(1.2~8R)에서 벗어납니다 — 실현 손익비로 표시'
          : (tgt && rr != null && rr >= 1.2
              ? ''
              : (tgt ? ' — 목표가 손절폭보다 가까워 계획 손익비 1:' + (rr != null ? rr.toFixed(2) : '—') + ' (1.2R 미만)'
                     : ' — 위쪽 저항이 없어 계획 손익비 대신 실현 손익비로 표시')));
    $('#rrBasis').innerHTML = '기준 진입 <b>' + usd(entryRef) + '</b> · 손절 <b>' + usd(stopPrice) + '</b> <i>(' + stopLab + ')</i> · 목표 ' + tgtTxt +
      (rrNote ? ' <i class="rr-note">' + rrNote + '</i>' : '');
  }

  /* ---------------- 백테스트 집계 기간 표시 ---------------- */
  function renderBtPeriod(a) {
    var el = $('#btPeriod');
    if (!el) return;
    if (!a || !a.stats || !a.dates) { el.classList.remove('on'); return; }
    el.classList.add('on');
    var bars = a.replay ? 0 : btBars();
    var i0 = a.startIdx, i1 = a.dates.length - 1, cov = i1 - i0 + 1;
    var tag = $('#bpTag'); if (tag) tag.textContent = a.replay ? '리플레이' : btTag();
    var nm = $('#bpName'); if (nm) nm.textContent = a.replay ? '시점 리플레이' : btName();
    var rg = $('#bpRange'); if (rg) rg.textContent = a.dates[i0] + ' ~ ' + a.dates[i1];
    var bs = $('#bpBars'); if (bs) bs.textContent = cov.toLocaleString('en-US') + '거래일';
    var nt = $('#bpNote');
    if (nt) {
      var short = bars && !a.replay && cov < bars - 2;
      nt.innerHTML = short
        ? '<b class="warn">이 종목은 ' + cov + '거래일 이력</b> — 선택 기간(' + btTag() + ')보다 짧아 있는 만큼만 집계'
        : '위 차트와 <b>같은 ' + btTag() + ' 기간</b> · 지표 워밍업은 전체 이력 사용 · 미래참조 없음';
    }
    el.title = '아래 KPI·자산곡선·전략 비교·트레이드 로그가 모두 이 기간으로 다시 계산됩니다 — 차트 기간 버튼과 같은 값이라 어느 쪽을 눌러도 함께 움직입니다';
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
  /* 지표 객체(현재·전일·스파크) 기반 칩 — US 2Y · 금리차처럼 시계열이 아닌 값용 */
  function mchipFillData(id, o, d) {
    var chip = $('#mchip' + id);
    if (!chip) return;
    var valEl = $('#' + o.key + 'Val'), chgEl = $('#' + o.key + 'Chg');
    if (!d || d.v == null) {
      if (valEl) valEl.textContent = '—';
      if (chgEl) { chgEl.className = 'mc-c'; chgEl.textContent = '—'; chgEl.title = ''; }
      return;
    }
    var last = d.v, prev = d.prev;
    var diff = (prev == null) ? 0 : last - prev;
    var chg = prev ? last / prev - 1 : 0;
    if (valEl) valEl.textContent = o.fmt(last);
    var arrow = diff > 0 ? '▲' : (diff < 0 ? '▼' : '–');
    if (chgEl) {
      chgEl.className = 'mc-c ' + (diff === 0 ? '' : (o.invert ? (diff > 0 ? 'neg' : 'pos') : (diff > 0 ? 'warn' : 'pos')));
      chgEl.textContent = arrow + ' ' + o.chgFmt(Math.abs(diff)) +
        (o.showPct === false ? '' : ' (' + (chg >= 0 ? '+' : '−') + Math.abs(chg * 100).toFixed(1) + '%)');
      chgEl.title = '전일 대비 ' + o.deltaTitle(diff);
    }
    chip.setAttribute('data-load', '1');
    if (d.asOf) chip.title = (chip.getAttribute('title') || '').split(' · 기준')[0] + ' · 기준 ' + d.asOf;
    if (d.spark) sparkDraw($('#' + o.key + 'Spark'), d.spark, diff >= 0 ? (o.invert ? '#FB7185' : '#FBBF24') : '#34D399');
  }
  function bpTxt(d) { return Math.round(d * 100) + 'bp'; }
  function bpTips(d) { return (d >= 0 ? '+' : '−') + Math.round(Math.abs(d) * 100) + 'bp'; }
  function pct2(v) { return v.toFixed(2) + '%'; }
  function spreadFmt(v) {
    var s = Math.abs(v).toFixed(2) + '%p';
    return (v > 0 ? '+' : (v < 0 ? '−' : '')) + s;
  }
  function fedRange(f) {
    if (!f) return '—';
    if (f.targetLow == null && f.targetHigh == null) return '—';
    var lo = f.targetLow == null ? f.targetHigh : f.targetLow;
    var hi = f.targetHigh == null ? f.targetLow : f.targetHigh;
    return lo.toFixed(2) + '~' + hi.toFixed(2) + '%';
  }
  /* 주요 발표 일정 — D-day·직전 수치 */
  var WD_KO = ['일', '월', '화', '수', '목', '금', '토'];
  /* 거시 발표일 계산 전용 (기존 ymdNum/todayNum 은 일수(숫자) 반환 — 이름 충돌 방지) */
  function macroDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function macroToday() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function evPrevText(k, mc) {
    if (k === 'FOMC') return (mc.fed && mc.fed.targetHigh != null) ? '기준금리 ' + fedRange(mc.fed) : '';
    if (k === 'CPI') return (mc.cpi && mc.cpi.yoy != null) ? '전년비 ' + mc.cpi.yoy.toFixed(1) + '%' : '';
    if (k === 'PCE') return (mc.pce && mc.pce.core != null) ? '근원 ' + mc.pce.core.toFixed(1) + '%' :
      ((mc.pce && mc.pce.yoy != null) ? '전년비 ' + mc.pce.yoy.toFixed(1) + '%' : '');
    if (k === 'JOBS') return (mc.jobs && mc.jobs.unemp != null) ? '실업률 ' + mc.jobs.unemp.toFixed(1) + '%' : '';
    return '';
  }
  function renderMacroEvents() {
    var box = $('#macroEvents');
    if (!box) return;
    var mc = M.macro || {}, evs = mc.events || [];
    var today = macroToday(), first = {};
    evs.forEach(function (e) {
      if (!e || !e.d) return;
      var ed = macroDate(e.d);
      if (!ed || ed < today) return;
      if (!first[e.k]) first[e.k] = e;
    });
    var ORDER = ['FOMC', 'CPI', 'PCE', 'JOBS'];
    var LAB = { FOMC: 'FOMC', CPI: 'CPI', PCE: 'PCE', JOBS: '고용' };
    var list = ORDER.filter(function (k) { return first[k]; });
    if (!list.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<span class="me-l">다음 발표</span>' + list.map(function (k) {
      var e = first[k], d = macroDate(e.d);
      var dd = Math.round((d - today) / 86400000);
      var pv = evPrevText(k, mc);
      var dateTx = (d.getMonth() + 1) + '.' + ('0' + d.getDate()).slice(-2) + '(' + WD_KO[d.getDay()] + ')';
      return '<span class="mei' + (dd <= 3 ? ' soon' : '') + '" title="' + (e.n || LAB[k]) + ' · ' + e.d +
        ' (미 동부 기준) · ' + (dd === 0 ? '오늘 발표' : dd + '일 남음') + '">' +
        '<b>' + LAB[k] + '</b>' +
        '<span class="mei-d">' + dateTx + '</span>' +
        '<em class="mei-dd' + (dd === 0 ? ' today' : '') + '">' + (dd === 0 ? '오늘' : 'D-' + dd) + '</em>' +
        (pv ? '<span class="mei-v">' + pv + '</span>' : '') +
        '</span>';
    }).join('');
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
    mchipFill('Dxy', indexSeries('DXY'), {
      key: 'dxy',
      fmt: function (v) { return v.toFixed(2); },
      chgFmt: function (d) { return d.toFixed(2); },
      deltaTitle: function (d) { return (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(2) + 'pt'; }
    });
    var mc = M.macro || {}, rt = mc.rates || {};
    mchipFillData('U2', { key: 'u2', fmt: pct2, chgFmt: bpTxt, deltaTitle: bpTips, showPct: false }, rt.us2y);
    mchipFillData('Spr', { key: 'spr', fmt: spreadFmt, chgFmt: bpTxt, deltaTitle: bpTips, showPct: false }, rt.spread);
    var fed = mc.fed, fv = $('#fedVal'), fc = $('#fedChg');
    if (fed && fed.targetHigh != null) {
      if (fv) fv.textContent = fedRange(fed);
      if (fc) {
        fc.className = 'mc-c';
        fc.textContent = fed.effr != null ? 'EFFR ' + fed.effr.toFixed(2) + '%' : '목표 범위';
        fc.title = '실효 연방기금금리(EFFR)' + (fed.effr != null ? ' ' + fed.effr.toFixed(2) + '%' : '') +
          (fed.asOf ? ' · ' + fed.asOf : '');
      }
      var fchip = $('#mchipFed');
      if (fchip) {
        fchip.setAttribute('data-load', '1');
        fchip.title = '연준 기준금리 목표 범위 ' + fedRange(fed) +
          (fed.effr != null ? ' · EFFR ' + fed.effr.toFixed(2) + '%' : '') +
          (fed.asOf ? ' (' + fed.asOf + ' 기준)' : '') + ' — NY Fed / 연준';
      }
    }
    renderMacroEvents();
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
      out.push('<path d="' + fgArc(fgAng(x.min), fgAng(x.max)) + '" fill="' + (on ? x.fill : (isLightTheme() ? '#E6EDF5' : '#151f32')) +
        '" stroke="' + (on ? x.color : (isLightTheme() ? '#C3CFDD' : '#233046')) + '" stroke-width="' + (on ? 2 : 1.2) + '"' +
        (on ? ' filter="url(#fgG' + i + ')"' : '') + '/>');
    });
    /* 구간 이름 */
    FG_BANDS.forEach(function (x, i) {
      var on = i === bi, narrowSeg = (x.max - x.min) < 20;
      out.push('<text fill="' + (on ? x.color : '#5c6a80') + '" font-size="' + (narrowSeg ? 10.5 : 11) +
        '" font-weight="' + (on ? 600 : 500) + '" letter-spacing=".02em" text-anchor="middle">' +
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
      out.push('<text x="' + q[0].toFixed(1) + '" y="' + q[1].toFixed(1) + '" fill="#64748b" font-size="11.5"' +
        ' font-weight="500" text-anchor="middle" dominant-baseline="middle">' + n[1] + '</text>');
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
    out.push('<text x="' + FGG.cx + '" y="200" fill="#f8fafc" font-size="31" font-weight="700" text-anchor="middle"' +
      ' style="font-variant-numeric:tabular-nums;letter-spacing:-.02em">' + Math.round(score) + '</text>');
    out.push('<text x="' + FGG.cx + '" y="219" fill="' + b.color + '" font-size="9" font-weight="600" text-anchor="middle"' +
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
  var fgLast = null, fgLastLive = false;
  function renderFearGreed(fg, live) {
    var card = $('#fgCard'); if (!card || !fg) return;
    fgLast = fg; fgLastLive = !!live;
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
      badge.style.color = thColor(b.color);
      badge.style.borderColor = thColor(b.color) + '88';
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
          '<span class="s" style="color:' + (sb ? thColor(sb.color) : 'var(--txt3)') + '">' + (sb ? sb.ko : '—') + '</span></div>' +
          '<i class="fg-dots"></i>' +
          '<b class="fg-b"' + (has ? ' title="' + v + '점 · ' + sb.ko + '"' : '') + ' style="color:' + thColor(
          (sb ? sb.color : 'var(--txt3)')) + ';border-color:' + (sb ? thColor(sb.color) + '99' : 'var(--line)') +
          ';background:' + (sb ? sb.fill : 'transparent') + '">' + (has ? fgShow(v) : '—') + '</b></div>';
      }).join('');
    }
    var guide = $('#fgGuide');
    if (guide) {
      var trend = fgTrendText(score, fg);
      guide.style.borderLeftColor = b.color;
      guide.innerHTML = '<div class="fg-gh" style="color:' + thColor(b.color) + '">현재 심리 해석 · ' + b.ko +
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
    return '<span class="fund-pill earn' + (soon ? (dd <= 3 ? ' soon crit' : ' soon') : (dd < 0 ? ' past' : '')) + '"' +
      ' title="' + (soon ? '실적 발표가 ' + dd + '일 앞으로 다가왔습니다 · ' : '다음 실적 발표일 ') +
      f.earningsDate + '">다음 실적발표 <b>' + mmdd + '</b><em class="earn-dd">' + lab + '</em></span>';
  }
  /* 실적 발표 임박 경고 — D-0~D-3 이면 스윙 진입 시 밤사이 갭하락 위험을 표시 (표시 전용) */
  function earnDays(t) {
    var f = fundOf(t);
    if (!f) return null;
    if (String(f.quoteType || '').toUpperCase() === 'ETF') return null;   /* ETF 는 실적 발표 없음 */
    var ed = ymdNum(f.earningsDate);
    if (!ed) return null;
    return { dd: Math.round((ed - earnBase()) / 86400000), date: f.earningsDate };
  }
  function earnLabel(dd) { return dd === 0 ? 'D-DAY' : 'D-' + dd; }
  function earnChip(t) {                     /* 스캐너 행의 앰버 배지 — 발표 3일 내(0~3) */
    var e = earnDays(t);
    if (!e || e.dd < 0 || e.dd > 3) return '';
    return '<i class="edot" title="실적 ' + earnLabel(e.dd) + ' (' + e.date + ') · 발표 전 갭하락 주의">실적 ' + earnLabel(e.dd) + '</i>';
  }
  function earnWarnHtml(t) {                 /* 히어로 영역의 앰버 경고 배지 */
    var e = earnDays(t);
    if (!e || e.dd < 0 || e.dd > 3) return '';
    return '<div class="earn-warn on">' +
      '<span class="ew-ico" aria-hidden="true">⚠</span>' +
      '<b>실적 ' + earnLabel(e.dd) + '</b>' +
      '<span class="ew-sep">·</span>' +
      '<span class="ew-t">갭하락 주의</span>' +
      '<span class="ew-sub">' + e.date + ' 실적 발표 — 발표 전날 밤사이 갭으로 −' +
        Math.round(swingCapNow() * 100) + '% 손절 상한을 넘길 수 있습니다. 스윙 신규 진입은 발표 이후로 미루는 편이 안전합니다.</span>' +
      '</div>';
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
      var want = a.btBars || 1255;
      /* 선택 기간을 다 못 채운 종목은 실제 거래일 기준 라벨로 */
      var tagTxt = a.replay ? '리플레이'
        : (bars < want - 2 ? periodTag(bars) : (BT_TAG[want] || periodTag(bars)));
      tagEl.textContent = (a.stratKey === 'swing' ? '스윙 ' : '') + tagTxt;
      tagEl.title = '백테스트 구간 ' + bars + '거래일' + (a.dates && a.dates[a.startIdx] ? ' · ' + a.dates[a.startIdx] + ' ~ ' + a.dates[a.dates.length - 1] : '') +
        (a.dates && a.dates[a.startIdx] && a.dates[a.startIdx] <= '2022-12-30' && a.dates[a.dates.length - 1] >= '2022-01-03'
          ? ' · 2022년 하락장 포함' : '');
    }
    if (a.limited || !s) {
      $('#k1').textContent = '—'; $('#k2').textContent = '—'; $('#k3').textContent = '—';
      var kn0 = $('#k2n'); if (kn0) kn0.textContent = '—회';
      $('#k1s').innerHTML = '<span>상장 초기 · 백테스트 표본 부족</span>';
      $('#k1t').textContent = ''; $('#k2t').textContent = ''; $('#k3t').textContent = '';
      ['#m1', '#m2', '#m3'].forEach(function (sel) { var cc = $(sel); if (cc) { var g2 = cc.getContext('2d'); g2.clearRect(0, 0, cc.width, cc.height); } });
      $('#k2s').innerHTML = '<span>' + a.close.length + '거래일 데이터</span>';
      $('#k3s').innerHTML = '<span>—</span>';
    } else {
      /* 승률·PF는 청산 완료 거래만(엔진 stats) — 미청산 '보유중'은 아래 줄에 따로 표시 */
      var wins0 = (a.trades || []).filter(function (t) { return t.ret > 0 && t.reason !== '보유중'; }).length;
      var losses0 = s.trades - wins0;
      $('#k1').textContent = pct(s.totalReturn, 1);
      $('#k1').className = cls(s.totalReturn);
      $('#k1s').innerHTML = '<span>보유 <b class="' + cls(s.bhReturn) + '">' + pct(s.bhReturn, 1) + '</b></span>' +
        '<span>초과 <b class="' + cls(s.alpha) + '">' + (s.alpha >= 0 ? '+' : '') + (s.alpha * 100).toFixed(1) + '%p</b></span>';
      $('#k2').textContent = s.trades > 0 ? (s.winRate * 100).toFixed(0) + '%' : '—';
      $('#k2').className = s.trades === 0 ? 'neu' : (s.winRate >= 0.5 ? 'pos' : (s.winRate >= 0.4 ? '' : 'neu'));
      var kn = $('#k2n'); if (kn) kn.textContent = s.trades + '회';
      $('#k2s').innerHTML = '<span>승 <b class="pos">' + wins0 + '</b> · 패 <b class="neg">' + losses0 + '</b></span>' +
        '<span>평균 보유 <b>' + s.avgHold.toFixed(0) + '일</b></span>' +
        (s.openTrade ? '<span class="k2o" title="마지막 봉 기준 아직 청산되지 않은 가상 포지션 — 승률·PF에서 제외">보유중 1건 제외 (평가 <b class="' + cls(s.openTrade.ret) + '">' + pct(s.openTrade.ret, 1) + '</b>)</span>' : '');
      $('#k3').textContent = pct(s.mdd, 1);
      $('#k3').className = 'neg';
      $('#k3s').innerHTML = '<span title="PF(Profit Factor) = 총이익 ÷ 총손실 — 1.5 이상이면 양호 · 청산 완료 거래 기준">손익비 <b class="' +
        (s.profitFactor == null ? 'neu' : (s.profitFactor >= 1.5 ? 'pos' : (s.profitFactor >= 1 ? '' : 'neg'))) + '">' +
        (s.profitFactor == null ? '—' : s.profitFactor.toFixed(2)) + '</b></span>' +
        '<span>보유 MDD <b style="color:#6B7689">' + pct(s.bhMdd, 1) + '</b></span>';
      $('#k1t').textContent = '연율화 ' + pct(s.cagr, 1) + ' · 샤프 ' + s.sharpe.toFixed(2);
      var eqv = [];
      for (var q = a.startIdx; q < a.equity.length; q++) if (a.equity[q] != null) eqv.push(a.equity[q]);
      miniLine($('#m1'), eqv, 'rgba(56,189,248,ALPHA)', 1);
      miniBars($('#m2'), (a.trades || []).slice(-14).map(function (tr) { return tr.ret; }));
      miniDrawdown($('#m3'), eqv);
      $('#k2t').textContent = '평균 수익 ' + pct(s.avgWin, 1) + ' / 평균 손실 ' + pct(s.avgLoss, 1) + ' (청산 완료 ' + s.trades + '건 기준)';
      $('#k3t').textContent = '시장 노출 ' + (s.exposure * 100).toFixed(0) + '% · 비용 0.03% · 익일 시가 체결 · PF=총이익÷총손실';
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
        '<span class="v" style="color:' + thColor(r0 > 0.05 ? '#34D399' : r0 < -0.05 ? '#FDA4AF' : '#6B7689') + '">' + (v > 0 ? '+' : '') + v.toFixed(0) + '</span></div>';
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
    { t: '차트 강세', r: '75+', c: '#10B981' },
    { t: '차트 양호', r: '58~74', c: '#34D399' },
    { t: '차트 중립', r: '45~57', c: '#F59E0B' },
    { t: '차트 약세', r: '35~44', c: '#FB7185' },
    { t: '차트 극약세', r: '<35', c: '#F43F5E' }
  ];
  function toneColor(t) { return thColor(t === 'bull' ? '#10B981' : (t === 'bear' ? '#F43F5E' : '#6B7689')); }
  function buildScoreExplain() {
    var sc = $('#seScale');
    if (sc) sc.innerHTML = SCALE.map(function (s) {
      return '<span class="se-pill" style="color:' + thColor(s.c) + ';border-color:' + thColor(s.c) + '55;background:' + s.c + '14">' +
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
    $('#seSummary').innerHTML = '종합 <b style="color:' + thColor(a.label.color) + ';font-family:var(--mono)">' + a.score.toFixed(1) + '점 · ' + a.label.ko + '</b>' +
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
      var st0 = $('#ewSteps'); if (st0) st0.innerHTML = '';
      var sw = $('#ewSwitch'); if (sw) sw.innerHTML = '';
      var cm = $('#ewComment'); if (cm) cm.textContent = '';
      return;
    }
    card.classList.remove('ew-no');
    var arr = (e0.scenarios && e0.scenarios.length) ? e0.scenarios : [e0];
    state.ewMode = Math.min(state.ewMode, arr.length - 1);
    var e = arr[state.ewMode];
    /* 색은 '지금 진행 중인 파동'의 방향 — 상승 임펄스 안의 C파(하락)를 초록으로 칠하지 않는다 */
    var curUp = e.leg ? e.leg.dir > 0 : e.dir > 0;
    var wcl = curUp ? 'up' : 'dn';
    card.classList.toggle('ew-alt', state.ewMode === 1);

    /* 신뢰도 */
    $('#ewConf').innerHTML = '<span class="lbl">신뢰도</span><div class="bar"><i style="width:' + e.conf + '%;' +
      (e.valid ? '' : 'background:linear-gradient(90deg,rgba(244,63,94,.45),#FB7185)') + '"></i></div>' +
      '<b style="color:' + thColor(e.valid ? '#C4B5FD' : '#FDA4AF') + '">' + e.conf + '</b>';

    /* 기본 / 대안 시나리오 전환 — 세그먼트 토글: 방향·목표 힌트 + 신뢰도 배지 + 활성 점/'보는 중' */
    var sw2 = $('#ewSwitch');
    if (sw2) {
      sw2.innerHTML = arr.map(function (s, i) {
        var on = i === state.ewMode, alt = i > 0, up = s.leg ? s.leg.dir > 0 : s.dir > 0;
        var tg = '';
        if (s.targets && s.targets.length) {
          var t = s.targets[0], tlo = t.lo, thi = t.hi;
          var nf = function (v) { return v >= 100 ? v.toFixed(0) : v.toFixed(2); };
          if (tlo != null && thi != null && isFinite(tlo) && isFinite(thi)) {
            tg = (Math.abs(thi - tlo) < 0.005) ? '$' + nf(thi) : '$' + nf(tlo) + '~' + nf(thi);
          }
        }
        var lbl = String(s.label || '').replace(' (규칙 위반)', '');
        var dirTxt = up ? '상승' : '하락';
        var hint = (s.leg ? s.leg.name + ' ' : '') + dirTxt + (tg ? ' · 목표 ' + tg : '');
        var full = (alt ? '대안' : '기본') + ' 시나리오 · ' + lbl + ' · 신뢰도 ' + s.conf +
          (tg ? ' · 1차 목표 ' + tg : '') + (s.next ? ' · ' + s.next : '');
        return '<button type="button" data-i="' + i + '" role="tab" aria-selected="' + (on ? 'true' : 'false') +
          '" class="esb' + (on ? ' on' : '') + (alt ? ' alt' : '') + '" title="' + full.replace(/"/g, '”') + '">' +
          '<span class="es-top"><i class="es-dot" aria-hidden="true"></i>' +
          '<b class="es-t">' + (alt ? '대안' : '기본') + ' 시나리오</b>' +
          '<span class="es-c">' + s.conf + '</span>' +
          (on ? '<span class="es-now">보는 중</span>' : '') + '</span>' +
          '<span class="es-h"><i class="' + (up ? 'up' : 'dn') + '" aria-hidden="true">' + (up ? '▲' : '▼') + '</i>' +
          hint.replace(/"/g, '”') + '</span></button>';
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
      '<span>' + (e.leg ? '지금 <b style="display:inline;font-size:inherit">' + e.leg.name + ' ' + e.leg.dirWord + '</b> · ' : '') +
      e.from.d + ' ' + usd(e.from.p) + ' 기점 · ' + e.kindTxt +
      ' · 스윙 임계 ' + (e.thr * 100).toFixed(1) + '%' + (e.diag ? ' · 대각(Diagonal)' : '') + '</span></div>';

    /* 현재 파동 → 다음 예상 방향 → 확인 가격 → 무효화 가격 (엔진 산출값 그대로) */
    var cfm = e.confirm, iv = e.inv;
    var nextTxt = e.next || (e.scenario ? e.scenario.main : '');
    var stepHtml =
      '<div class="ew-step"><span class="k">① 현재 파동</span><b>' + e.label.replace(' (규칙 위반)', '') + '</b>' +
        '<i>' + e.from.d + ' ' + usd(e.from.p) + ' 기점 · ' + (e.leg ? e.leg.name : e.kindTxt) + '</i></div>' +
      '<div class="ew-step nx"><span class="k">② 다음 예상 방향</span><b>' + nextTxt + '</b>' +
        '<i>' + (e.scenario ? e.scenario.main : '') + '</i></div>' +
      '<div class="ew-step cf"><span class="k">③ 확인 가격</span><b>' +
        (cfm ? usd(cfm.price) + ' <em>' + cfm.side + '</em>' : '—') + '</b>' +
        '<i>' + (cfm ? cfm.text : '확인 레벨 미산정') + '</i></div>' +
      '<div class="ew-step inv"><span class="k">④ 무효화 가격</span><b>' +
        (iv ? usd(iv.price) + ' <em>' + (iv.side || '이탈') + '</em>' : '—') + '</b>' +
        '<i>' + (iv ? iv.name + ' ' + (iv.side || '이탈') + ' 시 카운트 폐기' : '무효화 레벨 미산정') + '</i></div>';
    var steps = $('#ewSteps');
    if (steps) steps.innerHTML = stepHtml;

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
      var val = t.bad ? '계산 불가(하락폭 초과)' : (t.floor ? '$0' : usd(t.lo)) + ' ~ ' + usd(t.hi);
      var note = t.name + (t.floor ? ' · 하락 목표 하한 $0' : '');
      rows.push('<div class="ew-fib-row tgt"><div class="k"><i></i>' + (i === 0 ? '다음 목표가 구간' : '2차 목표 구간') + '</div>' +
        '<div class="v">' + val + '</div><div class="s">' + note + '</div></div>');
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
  var eqMarks = [];        /* 자산곡선 진입·청산 마커 — 클릭하면 트레이드 로그 행으로 이동 */
  function focusTrade(ti) {
    var tr = $('#tradeBody tr[data-ti="' + ti + '"]');
    if (!tr) return false;
    var card = $('#logCard');
    if (card && card.classList.contains('acc-closed') && typeof accSet === 'function') {
      accSet(card, false, false);
      if (typeof accState === 'object' && accState) { accState['logCard'] = false; if (typeof accSave === 'function') accSave(); }
    }
    $$('#tradeBody tr.hl').forEach(function (r) { r.classList.remove('hl'); });
    tr.classList.add('hl');
    try { tr.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { tr.scrollIntoView(); }
    setTimeout(function () { tr.classList.remove('hl'); }, 2600);
    return true;
  }
  function renderEquity(a) {
    var cv = $('#equity'), wrap = cv.parentNode;
    var w = cv.clientWidth || wrap.clientWidth, h = 168;
    var dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = h * dpr;
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var padL = 4, padR = 46, padT = 10, padB = 16;
    eqMarks = [];
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

    /* 진입·청산 마커 — 누르면 아래 트레이드 로그의 해당 거래로 스크롤·하이라이트 */
    eqMarks = [];
    var di = a.dindex || null;
    var idxOfDate = function (ds) {
      if (di && di[ds] != null) return di[ds];
      return a.dates.indexOf(ds);
    };
    (a.trades || []).forEach(function (tr, ti) {
      var bi = tr.entryIdx != null ? tr.entryIdx : idxOfDate(tr.entryDate);
      var si = tr.exitIdx != null ? tr.exitIdx : idxOfDate(tr.exitDate);
      var ev, ex;
      if (bi != null && bi >= i0 && bi <= i1) {
        ev = eq[bi] != null ? eq[bi] : (cl[bi] / cl[i0]);
        var mx = X(bi), my = Y(ev) + 11;
        if (my > h - padB - 3) my = Y(ev) - 11;
        ctx.beginPath();
        ctx.moveTo(mx, my - 4.2); ctx.lineTo(mx - 4, my + 2.6); ctx.lineTo(mx + 4, my + 2.6); ctx.closePath();
        ctx.fillStyle = '#38BDF8'; ctx.fill();
        ctx.strokeStyle = 'rgba(11,14,20,.85)'; ctx.lineWidth = 1; ctx.stroke();
        eqMarks.push({ x: mx, y: my, ti: ti, kind: 'in' });
      }
      if (si != null && si >= i0 && si <= i1 && tr.reason !== '보유중') {
        ex = eq[si] != null ? eq[si] : (cl[si] / cl[i0]);
        var nx = X(si), ny = Y(ex) - 11;
        if (ny < padT + 3) ny = Y(ex) + 11;
        ctx.beginPath();
        ctx.moveTo(nx, ny + 4.2); ctx.lineTo(nx - 4, ny - 2.6); ctx.lineTo(nx + 4, ny - 2.6); ctx.closePath();
        ctx.fillStyle = tr.ret >= 0 ? '#34D399' : '#FB7185'; ctx.fill();
        ctx.strokeStyle = 'rgba(11,14,20,.85)'; ctx.lineWidth = 1; ctx.stroke();
        eqMarks.push({ x: nx, y: ny, ti: ti, kind: 'out' });
      }
    });
    /* x labels */
    ctx.fillStyle = '#4A5468'; ctx.font = '9px ui-monospace,monospace'; ctx.textAlign = 'left';
    ctx.fillText(a.dates[i0], padL + 2, h - 4);
    ctx.textAlign = 'right';
    ctx.fillText(a.dates[i1], w - padR - 2, h - 4);
    $('#eqSub').innerHTML = (a.replay ? '리플레이' : btName()) + ' · 전략 <b class="' + cls(lastEq - 1) + '">' + pct(lastEq - 1, 1) + '</b> vs 보유 <b style="color:#8B95A8">' + pct(cl[i1] / cl[i0] - 1, 1) + '</b>' +
      ' · 초과 <b class="' + cls(lastEq - cl[i1] / cl[i0]) + '">' + (lastEq - cl[i1] / cl[i0] >= 0 ? '+' : '') + ((lastEq - cl[i1] / cl[i0]) * 100).toFixed(1) + '%p</b>' +
      (a.stats ? ' · MDD <b class="neg">' + pct(a.stats.mdd, 1) + '</b>' : '') +
      (window.innerWidth > 640 ? ' · ' + a.dates[i0] + ' ~ ' + a.dates[i1] : '');
  }

  /* ---------------- recent + trades ---------------- */
  function renderRecent(a) {
    var t = (a.trades || []).slice(-4).reverse();
    $('#recentList').innerHTML = t.length ? t.map(function (x) {
      var open = x.reason === '보유중';
      return '<div class="it"><span class="d">' + x.exitDate.slice(2) + '</span>' +
        '<div class="m"><b style="color:' + thColor(open ? '#38BDF8' : (x.reason === '손절' ? '#FB7185' : (x.reason === '이익보전' || x.reason === '트레일') ? '#34D399' : '#9BA6BA')) + '">' +
        (open ? '보유 중' : x.reason) + '</b>' +
        '<span>' + usd(x.entry) + (x.kind === 'W돌파' ? '<i class="wtag" title="W 쌍바닥 보조 루트">W</i>' : '') + ' → ' + usd(x.exit) + ' · ' + Math.round(x.hold || 0) + '일</span></div>' +
        '<span class="r ' + cls(x.ret) + '">' + pct(x.ret, 1) + '</span></div>';
    }).join('') : '<div class="empty">거래 내역이 없습니다</div>';
  }
  function renderTrades(a) {
    $('#logTicker').textContent = a.sym;
    var sub = $('#logSub');
    if (sub) {
      var per = a.replay ? '리플레이'
        : (btName() + ' · ' + a.dates[a.startIdx] + ' ~ ' + a.dates[a.dates.length - 1] + ' · ' + (a.dates.length - a.startIdx) + '거래일');
      sub.innerHTML = stratInfo(a.stratKey || 'trend').logSub + ' · <b class="bt-chip">' + per + '</b>';
    }
    var s = a.stats;
    $('#logStats').innerHTML = s && !a.limited ?
      '<span>' + s.trades + ' trades</span><span>평균 보유 ' + s.avgHold.toFixed(0) + '일</span><span>노출 ' + (s.exposure * 100).toFixed(0) + '%</span>' : '';
    var rows = (a.trades || []).slice().reverse();
    var ntr = (a.trades || []).length;
    $('#tradeBody').innerHTML = rows.length ? rows.map(function (x, k) {
      var ti = ntr - 1 - k;                 /* 원본 트레이드 인덱스 — 자산곡선 마커 클릭 연동 */
      var open = x.reason === '보유중';
      var hold = Math.round(x.hold || 0);   /* 거래일 기준 — 상단 '평균 보유'와 같은 값 */
      return '<tr data-ti="' + ti + '">' +
        '<td data-l="진입일">' + x.entryDate + '</td>' +
        '<td data-l="진입가">' + usd(x.entry) + (x.kind === 'W돌파' ? '<i class="wtag" title="W 쌍바닥 넥라인 돌파 보조 루트 진입">W</i>' : '') + '</td>' +
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
      chip.classList.toggle('on', vis('ichi'));
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
    /* Y축 자유 이동 — 자동 맞춤 위에 얹는 사용자 보정값(픽셀 오프셋 · 세로 배율). 기본은 0 / 1 = 자동. */
    this.yOffPx = 0; this.yZoomF = 1; this.axisDrag = null; this.hoverY = null;
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
    this.resetY();                       /* 기간·종목·더블클릭 → Y축도 자동 맞춤으로 복귀 */
    this.draw();
  };
  /* Y축 보정 초기화 — 수직 오프셋 0, 세로 배율 1(=자동 맞춤, 상단 15% 여백) */
  Chart.prototype.resetY = function () {
    this.yOffPx = 0; this.yZoomF = 1; this.axisDrag = null;
  };
  /* Y축 보정값 클램프 — 가격 범위의 ±150%까지만 밀리고, 배율은 0.35~4배 */
  Chart.prototype.clampY = function () {
    var p = this._pt || (this._L && this._L.price);
    if (!p) return;
    this.yZoomF = QE.clamp(this.yZoomF || 1, 0.35, 4);
    var lim = 1.5 * this.yZoomF * p.h;
    /* 2026-11-27 사용자 요청 "Y축 잠금 반대로" — 위로만(음수 오프셋) 민다.
       위로 끌면 차트가 올라가 아래쪽에 빈 공간이 열리고, 아래로 끌면(양수) 멈춘다.
       (직전 커밋 4a6a8f7 은 반대로 [0, lim] 이었다) */
    this.yOffPx = QE.clamp(this.yOffPx || 0, -lim, 0);
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
    var priceW = 3.5;
    var subs = [{ k: 'vol', w: 0.78 }];
    if (state.show.rsi) subs.push({ k: 'rsi', w: 1.0 });
    if (state.show.macd) subs.push({ k: 'macd', w: 1.05 });
    var panels = [{ k: 'price', w: priceW }].concat(subs);
    var usable = this.H - padT - padB - gap * (subs.length);
    /* PC(폭 900px 초과)에서는 거래량·RSI·MACD 세로를 33% 줄이고, 남는 높이를 전부 메인 캔들로 넘긴다.
       모바일(<=900px)은 기존 비율 그대로 — 작은 화면에서 보조 패널이 너무 얇아지지 않게. */
    var subW = subs.reduce(function (a, b) { return a + b.w; }, 0);
    var baseSub = usable * subW / (subW + priceW);        /* 기존 배분에서 보조 패널이 받던 높이 */
    var subTotal = window.innerWidth > 900 ? baseSub * 0.67 : baseSub;
    var minSub = 34 * subs.length;
    if (subTotal < minSub) subTotal = Math.min(minSub, baseSub);
    var priceH = usable - subTotal;
    var y = padT, out = {};
    out.price = { y: y, h: priceH };
    y += priceH + gap;
    subs.forEach(function (p) {
      var h = subTotal * p.w / (subW || 1);
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
      var px = e.clientX - r.left, py = e.clientY - r.top, L = self._L;
      /* 오른쪽 가격 눈금을 위아래로 끌면 세로 가격폭(배율)이 바뀐다 — 트레이딩뷰 방식 */
      if (self.axisDrag) {
        self.yZoomF = self.axisDrag.zoom * Math.exp((self.axisDrag.y - e.clientY) / 180);
        self.clampY();
        self.draw();
        return;
      }
      if (self.drag) {
        var bw = self._L.plotW / (self.i1 - self.i0 + 1);
        var shift = Math.round((self.drag.x - px) / bw);
        /* 좌우(X)와 위아래(Y)를 같은 드래그로 함께 민다 — 아래로 끌면 위쪽에 빈 공간이 열린다 */
        self.yOffPx = self.drag.yOff + (e.clientY - self.drag.y0);
        self.clampY();
        self.drag.moved = true;
        if (shift !== 0) self.slide(self.drag.i0 + shift, self.drag.i1 + shift);
        else self.draw();
        return;
      }
      if (L) {
        var onAxis = px > L.padL + L.plotW - 1;
        cv.style.cursor = onAxis ? 'ns-resize' : 'crosshair';
        self.hoverY = (py >= L.price.y && py <= L.price.y + L.price.h) ? py : null;
      }
      self.hover = self.idxAt(px);
      self.hudPos(e);
      self.draw();
    });
    cv.addEventListener('mouseleave', function () {
      if (state.tool !== 'cursor') return;
      self.hover = null; self.hoverY = null; self.hud.classList.remove('on'); self.draw();
    });
    cv.addEventListener('mousedown', function (e) {
      if (state.tool !== 'cursor') { e.preventDefault(); drawDown(e); return; }
      var r = cv.getBoundingClientRect();
      var px = e.clientX - r.left, py = e.clientY - r.top, L = self._L;
      /* 가격 눈금 영역에서 시작한 드래그는 좌우 팬이 아니라 세로 배율 조절로 */
      if (L && px > L.padL + L.plotW - 1 && py >= L.price.y - 4 && py <= L.price.y + L.price.h) {
        self.axisDrag = { y: e.clientY, zoom: self.yZoomF };
        cv.style.cursor = 'ns-resize';
        e.preventDefault();
        return;
      }
      self.drag = { x: px, y0: e.clientY, yOff: self.yOffPx, i0: self.i0, i1: self.i1, moved: false };
      cv.style.cursor = 'grabbing';
    });
    window.addEventListener('mouseup', function (e) {
      if (state.tool !== 'cursor') { drawUp(e); return; }
      if (self.axisDrag) { self.axisDrag = null; cv.style.cursor = 'ns-resize'; }
      if (self.drag) { self.drag = null; cv.style.cursor = 'crosshair'; }
    });
    cv.addEventListener('dblclick', function () {
      if (state.tool !== 'cursor') return;
      self.setRange(btBars());           /* X 기간·Y 배율·오프셋 모두 기본(자동 맞춤)으로 */
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
        self.drag = { x: e.clientX - r.left, y0: e.clientY, yOff: self.yOffPx, i0: self.i0, i1: self.i1, moved: false };
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
        self.yOffPx = self.drag.yOff + (e.clientY - self.drag.y0);   /* 터치도 세로로 함께 이동 */
        self.clampY();
        if (Math.abs(shift) > 0) { self.slide(self.drag.i0 + shift, self.drag.i1 + shift); self.drag.moved = true; }
        else self.draw();
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
  /* 오른쪽(미래) 여백 상한 — 지금 보이는 봉 수의 40%(80봉 이상 볼 땐 최소 30봉, 최대 140봉).
     i1 은 마지막 봉(n-1)을 넘어 이만큼까지 미래 빈 칸으로 열린다.
     창 크기(size) 기준이라 드래그 중에는 값이 고정돼 경계에서 떨리지 않는다. */
  Chart.prototype.futureMax = function (size) {
    var S = Math.max(1, size || (this.i1 - this.i0 + 1));
    var m = Math.round(S * 0.40);
    if (S >= 80) m = Math.max(m, 30);
    return Math.round(QE.clamp(m, 6, 140));
  };
  Chart.prototype.slide = function (n0, n1) {
    var total = this.a.dates.length;
    var size = QE.clamp(Math.round(n1) - Math.round(n0) + 1, 24, total + this.futureMax(total));
    var maxI1 = total - 1 + this.futureMax(size);   /* 미래 여백을 포함한 오른쪽 끝 */
    n1 = Math.min(Math.round(n1), maxI1);
    n0 = n1 - size + 1;
    if (n0 < 0) { n0 = 0; n1 = Math.min(maxI1, size - 1); }
    this.i0 = n0; this.i1 = n1;
    this.draw();
  };
  Chart.prototype.zoom = function (f, anchor) {
    var total = this.a.dates.length;
    var size = QE.clamp(Math.round((this.i1 - this.i0 + 1) * f), 24, total + this.futureMax(total));
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
    var n = a.dates.length, i1d = Math.min(i1, n - 1);   /* 실제 데이터가 있는 마지막 봉 */
    var bw = L.plotW / nBars;
    ctx.clearRect(0, 0, W, H);

    /* background grid + price range
       ── 먼저 '지금 보이는 캔들'(i0~i1)의 고가·저가로 범위를 잡고, 보조 지표는 그 범위를 일정 폭 넘게 늘리지 못하게 막는다.
          확대(줌인)했을 때 이평선·구름대·볼린저·목표/무효화 레벨이 Y축을 잡아늘려 캔들이 납작해지는 것을 막고,
          캔들이 메인 패널 세로를 최대한 채우게 한다. */
    var p = L.price;
    var cLo = Infinity, cHi = -Infinity, i;
    for (i = Math.max(i0, 0); i <= i1d; i++) {
      if (hh[i] > cHi) cHi = hh[i];
      if (ll[i] < cLo) cLo = ll[i];
    }
    /* 화면이 통째로 미래 여백이면(데이터 0봉) 마지막 실제 봉 기준으로 축을 잡는다 */
    if (!(cHi > cLo) && n) { cHi = hh[n - 1]; cLo = ll[n - 1]; }
    if (!(cHi > cLo)) return;
    var spanC = cHi - cLo;
    var zoomed = nBars <= 90;                              /* 3M(64봉)·그 이하 확대 구간 */
    var room = spanC * (zoomed ? 0.10 : 0.35);             /* 축을 늘릴 수 있는 여유 — 보조 지표가 캔들을 찌그러뜨리지 않게 */
    var lo = cLo, hi = cHi;
    var grow = function (v) {                              /* 캔들 범위에서 너무 먼 값은 축에서 제외(선은 패널 밖으로 잘림) */
      if (v == null || !isFinite(v)) return;
      if (v < cLo - room || v > cHi + room) return;
      if (v > hi) hi = v;
      if (v < lo) lo = v;
    };
    for (i = i0; i <= i1d; i++) {
      if (state.show.ma) {
        MA.forEach(function (m) {
          if (!maVisible(m.p)) return;
          grow(maSeries(a, m.p)[i]);
        });
      }
      if (vis('ichi')) {
        grow(ind.spanA[i]); grow(ind.spanB[i]);
      }
      if (vis('bb')) { grow(ind.bb.up[i]); grow(ind.bb.lo[i]); }
      if (vis('env') && ind.env) { grow(ind.env.up[i]); grow(ind.env.lo[i]); }
    }

    /* 엘리어트 목표·무효화 레벨도 같은 규칙으로 (너무 멀면 축에서 제외) */
    if (vis('ew') && a.elliott && a.elliott.ok) {
      var ewa = (typeof ewScnOf === 'function' ? ewScnOf(a) : a.elliott) || a.elliott;
      if (ewa.targets && ewa.targets[0] && !ewa.targets[0].bad) { grow(ewa.targets[0].lo); grow(ewa.targets[0].hi); }
      if (ewa.supports && ewa.supports[0]) grow(ewa.supports[0].price);
      if (ewa.inv) grow(ewa.inv.price);
    }

    /* 세로 여유 — 위쪽은 넉넉하게(고점 라벨·추세선·다이버전스 라벨이 천장에 붙지 않게),
       아래쪽은 기존과 같은 비율로 둔다. '차트 이동(팬·줌) 시 위쪽 여백' 요청 반영. */
    var padB = (hi - lo) * (zoomed ? 0.045 : 0.06);
    var padT = (hi - lo) * (zoomed ? 0.155 : 0.15);
    lo -= padB; hi += padT;
    /* Y축 자유 이동 — 자동 맞춤 범위(위 15% 여백) 위에 사용자가 얹은 세로 배율·오프셋만 더한다.
       기간·종목이 바뀌면 이 기준값이 새로 계산되므로 보정이 화면 밖으로 캔들을 밀어내지 않는다. */
    var baseLo = lo, baseHi = hi, baseSpan = Math.max(hi - lo, 1e-9), baseMid = (lo + hi) / 2;
    var spanY = baseSpan / QE.clamp(this.yZoomF || 1, 0.35, 4);
    var midY = baseMid + (this.yOffPx || 0) * (spanY / Math.max(p.h, 1));
    var limY = baseSpan * 1.5;
    if (midY - baseMid > limY) midY = baseMid + limY;
    if (baseMid - midY > limY) midY = baseMid - limY;
    lo = midY - spanY / 2; hi = midY + spanY / 2;
    if (lo < 0) lo = 0;                       /* 주가축이 음수로 내려가지 않게 (5년 장기 범위) */
    if (!(hi > lo)) { lo = baseLo; hi = baseHi; }   /* 어떤 경우에도 축이 뒤집히지 않게 */
    var Y = function (v) { return p.y + (1 - (v - lo) / (hi - lo)) * p.h; };
    this._lo = lo; this._hi = hi; this._pt = p;
    this._cLo = cLo; this._cHi = cHi; this._zoomed = zoomed;
    this._yBaseLo = baseLo; this._yBaseHi = baseHi;

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

    /* 일목균형표 구름대 (선행스팬 A·B) — 옅은 면(약 11%) + 미세한 테두리
       볼린저는 채움 없이 점선으로 그려 둘이 겹쳐도 한눈에 구분되게 한다 */
    if (vis('ichi')) {
      for (i = Math.max(i0, 1); i <= i1d; i++) {
        var a0 = ind.spanA[i - 1], b0 = ind.spanB[i - 1], a1 = ind.spanA[i], b1 = ind.spanB[i];
        if (a0 == null || b0 == null || a1 == null || b1 == null) continue;
        ctx.beginPath();
        ctx.moveTo(this.x(i - 1), Y(a0));
        ctx.lineTo(this.x(i), Y(a1));
        ctx.lineTo(this.x(i), Y(b1));
        ctx.lineTo(this.x(i - 1), Y(b0));
        ctx.closePath();
        /* 상승 구름대(양운)는 빨강, 하락 구름대(음운)는 파랑 */
        if (a1 >= b1) { ctx.fillStyle = 'rgba(239,68,68,.105)'; ctx.strokeStyle = 'rgba(239,68,68,.17)'; }
        else { ctx.fillStyle = 'rgba(59,130,246,.115)'; ctx.strokeStyle = 'rgba(96,165,250,.19)'; }
        ctx.fill();
        ctx.lineWidth = 0.6; ctx.stroke();
      }
    }

    /* 엔벨로프 — 20일 이동평균 ±8% 상단/하단 밴드 (점선 · 상단은 과열 참고로 강조) */
    if (vis('env') && ind.env) {
      var envLine = function (arr, color, wd, dash) {
        ctx.save();
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath(); var st2 = false;
        for (var j = i0; j <= i1d; j++) {
          if (arr[j] == null) continue;
          var ex = this.x(j), ey = Y(arr[j]);
          if (!st2) { ctx.moveTo(ex, ey); st2 = true; } else ctx.lineTo(ex, ey);
        }
        ctx.strokeStyle = color; ctx.lineWidth = wd; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.restore();
      }.bind(this);
      envLine(ind.env.up, 'rgba(251,146,60,.8)', 1.25, [6, 4]);
      envLine(ind.env.lo, 'rgba(56,189,248,.55)', 1.05, [4, 4]);
      envLine(ind.env.mid, 'rgba(251,191,36,.38)', 0.9, [2, 5]);
    }

    /* bollinger — 채움 없는 점선 테두리(1.1px) · 구름대와 겹쳐도 구분된다 */
    if (vis('bb')) {
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(129,140,248,.72)'; ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (i = i0; i <= i1d; i++) { if (ind.bb.up[i] == null) continue; i === i0 ? ctx.moveTo(this.x(i), Y(ind.bb.up[i])) : ctx.lineTo(this.x(i), Y(ind.bb.up[i])); }
      ctx.stroke();
      ctx.beginPath();
      for (i = i0; i <= i1d; i++) { if (ind.bb.lo[i] == null) continue; i === i0 ? ctx.moveTo(this.x(i), Y(ind.bb.lo[i])) : ctx.lineTo(this.x(i), Y(ind.bb.lo[i])); }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    /* candles — 몸통을 조금 더 넓고 선명하게 */
    var cw = Math.max(1.2, Math.min(bw * 0.7, 14));
    for (i = i0; i <= i1d; i++) {
      var up = c[i] >= oo[i];
      var col = up ? '#10B981' : '#F43F5E';
      var x = this.x(i);
      ctx.strokeStyle = up ? 'rgba(16,185,129,.95)' : 'rgba(244,63,94,.95)';
      ctx.lineWidth = bw >= 3 ? 1.2 : 1;
      ctx.beginPath(); ctx.moveTo(x, Y(hh[i])); ctx.lineTo(x, Y(ll[i])); ctx.stroke();
      var yo = Y(oo[i]), yc = Y(c[i]);
      var top = Math.min(yo, yc), hgt = Math.max(Math.abs(yc - yo), 1);
      ctx.fillStyle = col;
      if (bw < 2.2) { ctx.fillRect(x - 0.6, top, 1.2, hgt); }
      else ctx.fillRect(x - cw / 2, top, cw, hgt);
    }

    /* 이동평균선 5·20·60·120·240 — 가는 선(5·60·120)을 먼저 깔고, 굵은 20·240일선을 위에 */
    if (state.show.ma) {
      var drawLine = function (arr, color, wd, alpha, halo) {
        if (!arr) return;
        var path = function () {
          ctx.beginPath(); var st = false;
          for (var j = i0; j <= i1d; j++) {
            if (arr[j] == null) continue;          /* 240일선은 앞쪽 240봉이 모자라면 값이 없다 → 선을 끊지 않고 시작점부터 */
            var px2 = this.x(j), py2 = Y(arr[j]);
            if (!st) { ctx.moveTo(px2, py2); st = true; } else ctx.lineTo(px2, py2);
          }
        }.bind(this);
        ctx.save();
        ctx.globalAlpha = alpha == null ? 1 : alpha;
        path();
        ctx.strokeStyle = 'rgba(11,14,20,.62)'; ctx.lineWidth = wd + (halo ? 2.2 : 1.1);   /* 캔들 위에서도 선이 묻히지 않게 어두운 테두리 */
        ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
        path();
        ctx.strokeStyle = color; ctx.lineWidth = wd; ctx.stroke();
        ctx.restore();
      }.bind(this);
      var order = [5, 60, 120, 20, 240];
      order.forEach(function (pp) {
        var m = null;
        for (var q2 = 0; q2 < MA.length; q2++) if (MA[q2].p === pp) m = MA[q2];
        if (!m || !maVisible(m.p)) return;
        drawLine(maSeries(a, m.p), m.color, m.w, m.a, m.heavy);
      });
    }

    /* 일목균형표 라인 */
    if (vis('ichi')) {
      var ichiLine = function (arr, color, wd, dash) {
        ctx.save();
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath(); var st = false;
        for (var j = i0; j <= i1d; j++) {
          if (arr[j] == null) continue;
          var px4 = this.x(j), py4 = Y(arr[j]);
          if (!st) { ctx.moveTo(px4, py4); st = true; } else ctx.lineTo(px4, py4);
        }
        ctx.strokeStyle = color; ctx.lineWidth = wd; ctx.lineJoin = 'round'; ctx.stroke();
        ctx.restore();
      }.bind(this);
      ICHI.forEach(function (x) { ichiLine(ind[x.k], x.color, x.w, x.dash); });
    }

    /* 파라볼릭 SAR — 캔들 위/아래 작은 점 (상승 추세 = 아래 · 하락 추세 = 위) */
    if (vis('sar') && ind.sar) {
      var sv = ind.sar.v, sd = ind.sar.dir;
      var dotR = bw > 4 ? 2.0 : (bw > 2.6 ? 1.6 : 1.2);
      for (i = i0; i <= i1d; i++) {
        if (sv[i] == null) continue;
        var sx = this.x(i), sy = Y(sv[i]);
        if (sy < p.y - 2 || sy > p.y + p.h + 2) continue;
        ctx.beginPath(); ctx.arc(sx, sy, dotR, 0, Math.PI * 2);
        ctx.fillStyle = sd[i] > 0 ? 'rgba(45,212,191,.95)' : 'rgba(251,113,133,.95)';
        ctx.fill();
      }
    }

    /* last price tag */
    this.drawWBottom(ctx, a, L, Y, i0, i1d, bw, 'line');
    this.drawTri(ctx, a, L, Y, i0, i1d, bw, 'line');
    if (vis('ew')) this.drawWave(ctx, a, L, Y, i0, i1, bw);   /* 투영선은 미래 여백까지 연장 */
    this.drawUser(ctx, a, L, Y, i0, i1);                     /* 작도도 미래 여백에 그릴 수 있다 */
    this.drawWBottom(ctx, a, L, Y, i0, i1d, bw, 'label');   /* W 라벨은 맨 위 — 다른 라벨을 피해서 마지막에 */
    this.drawTri(ctx, a, L, Y, i0, i1d, bw, 'label');
    this.drawDiv(ctx, a, L, Y, i0, i1d);                    /* 상승 다이버전스 — 참고용 라벨 */
    ctx.restore();
    var lastC = c[i1d], lastY = Y(lastC);
    ctx.fillStyle = c[i1d] >= oo[i1d] ? '#10B981' : '#F43F5E';
    var tag = usd(lastC);
    ctx.font = '600 9.5px ui-monospace,monospace';
    /* 미래 여백이 열려 있으면 마지막 종가 레벨을 오른쪽 끝까지 점선으로 이어 준다 */
    if (i1 > i1d) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(148,163,184,.30)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(this.x(i1d) + cw / 2, lastY); ctx.lineTo(L.padL + L.plotW, lastY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
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


    /* 보이는 구간 고점·저점 수익% 라벨 — 캔들·신호 마커 위에 마지막으로 */
    this.drawExtremes(ctx, a, L, Y, i0, i1d, hh, ll);

    /* volume panel */
    var vp = L.vol;
    ctx.fillStyle = 'rgba(255,255,255,.03)';
    ctx.fillRect(L.padL, vp.y, L.plotW, vp.h);
    var vmax = 0;
    for (i = i0; i <= i1d; i++) if (vv[i] > vmax) vmax = vv[i];
    for (i = i0; i <= i1d; i++) {
      var vh = (vv[i] / (vmax || 1)) * (vp.h - 4);
      ctx.fillStyle = c[i] >= oo[i] ? 'rgba(16,185,129,.5)' : 'rgba(244,63,94,.5)';
      if (bw < 2.2) ctx.fillRect(this.x(i) - .5, vp.y + vp.h - vh, 1, vh);
      else ctx.fillRect(this.x(i) - cw / 2, vp.y + vp.h - vh, cw, vh);
    }
    var vlab = '거래량 ' + vol(vv[i1d] * 1000);
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
      for (i = i0; i <= i1d; i++) {
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
      ctx.fillText(ind.rsi[i1d] != null ? ind.rsi[i1d].toFixed(1) : '—', L.padL + L.plotW + 6, yR(ind.rsi[i1d] || 50));
    }

    /* MACD */
    if (L.macd) {
      var mp = L.macd;
      ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(L.padL, mp.y, L.plotW, mp.h);
      var mlo = 0, mhi = 0;
      for (i = i0; i <= i1d; i++) {
        [ind.macd.line[i], ind.macd.signal[i], ind.macd.hist[i]].forEach(function (v) { if (v != null) { if (v > mhi) mhi = v; if (v < mlo) mlo = v; } });
      }
      var mpad = (mhi - mlo) * 0.12 || 1; mlo -= mpad; mhi += mpad;
      var yM = function (v) { return mp.y + (1 - (v - mlo) / (mhi - mlo)) * mp.h; };
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.beginPath(); ctx.moveTo(L.padL, yM(0)); ctx.lineTo(L.padL + L.plotW, yM(0)); ctx.stroke();
      for (i = i0; i <= i1d; i++) {
        if (ind.macd.hist[i] == null) continue;
        var hv = ind.macd.hist[i];
        var y0 = yM(0), y1 = yM(hv);
        ctx.fillStyle = hv >= 0 ? 'rgba(16,185,129,.5)' : 'rgba(244,63,94,.5)';
        var hw = Math.max(1, Math.min(bw * 0.6, 10));
        ctx.fillRect(this.x(i) - hw / 2, Math.min(y0, y1), hw, Math.max(Math.abs(y1 - y0), 0.6));
      }
      var mline = function (arr, color, lw) {
        ctx.beginPath(); var st3 = false;
        for (var j = i0; j <= i1d; j++) {
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
    for (i = i0; i <= i1d; i += step) {
      var dt = a.dates[i];
      var lab = nBars > 300 ? dt.slice(2, 7).replace('-', '/') : dt.slice(5).replace('-', '/');
      var lx0 = this.x(i);
      if (lx0 - ctx.measureText(lab).width / 2 < L.padL + 2) continue;   /* 왼쪽 축에 잘리는 첫 라벨은 생략 */
      ctx.fillText(lab, lx0, H - 6);
    }

    /* crosshair — 미래 여백 위에서는 세로선만 그린다(데이터·날짜 없음) */
    if (this.hover != null && this.hover >= i0 && this.hover <= i1) {
      var hi2 = this.hover, cx = this.x(hi2), hovData = hi2 <= i1d;
      ctx.save();
      ctx.strokeStyle = hovData ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.13)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(cx, L.price.y); ctx.lineTo(cx, H - L.padB); ctx.stroke();
      ctx.setLineDash([]);
      /* 가로 크로스헤어 + 오른쪽 축 가격 라벨 — Y축을 옮기거나 배율을 바꿔도 커서 밑의 실제 가격을 그대로 보여준다 */
      if (this.hoverY != null && this.hoverY >= L.price.y && this.hoverY <= L.price.y + L.price.h) {
        var hy = this.hoverY, hpv = this.priceAt(hy);
        ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(L.padL, hy); ctx.lineTo(L.padL + L.plotW, hy); ctx.stroke();
        ctx.setLineDash([]);
        if (hpv != null) {
          var htx = hpv >= 1000 ? hpv.toFixed(0) : hpv.toFixed(2);
          ctx.font = '600 9.5px ui-monospace,SFMono-Regular,monospace';
          var htw = ctx.measureText(htx).width + 10;
          ctx.fillStyle = 'rgba(30,41,59,.92)';
          ctx.strokeStyle = 'rgba(203,213,225,.38)'; ctx.lineWidth = 1;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(L.padL + L.plotW + 3, hy - 7.5, htw, 15, 3);
          else ctx.rect(L.padL + L.plotW + 3, hy - 7.5, htw, 15);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#E2E8F0'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(htx, L.padL + L.plotW + 8, hy);
          ctx.textBaseline = 'alphabetic';
        }
      }
      if (hovData) {
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
      }
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

    /* 이동평균 범례 — 크로스헤어 위치(없으면 최근 봉)의 실제 값을 표시 (미래 여백은 마지막 봉 기준) */
    updateMaLegend(a, this.hover != null ? Math.min(this.hover, i1d) : i1d);

    /* HUD — 미래 여백 위에서는 숨긴다(없는 봉의 시·고·저·종을 보여주지 않게) */
    if (this.hover != null && this.hover <= i1d) this.updateHud(a, s, this.hover);
    else if (this.hover != null) this.hud.classList.remove('on');
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
      '<div class="h-s" style="color:' + thColor(l2.color) + '">' + l2.ko + ' ' + Math.round(sc) + '</div>';
    h.classList.add('on');
  };
  Chart.prototype.hudPos = function () {};

  /* ---------------- 가격 ↔ 픽셀 ---------------- */
  Chart.prototype.priceAt = function (py) {
    if (this._lo == null || this._hi == null || !this._pt) return null;
    var r = QE.clamp((py - this._pt.y) / Math.max(this._pt.h, 1e-6), 0, 1);
    return this._hi - r * (this._hi - this._lo);
  };
  /* 라벨 사각형을 '겹치지 않는 자리'에 배치한다 — 우선 후보 → 세로 밀어내기 → 패널 전체 탐색.
     반환값은 실제로 그린 사각형(없으면 null). 그린 사각형은 _tagRects 에 쌓여 다음 라벨이 피해 간다. */
  Chart.prototype.freeRect = function (w, h, pref) {
    var pt = this._pt, L = this._L;
    if (!pt || !L) return null;
    var top = pt.y + 2, bot = pt.y + pt.h - h - 2;
    var minX = L.padL + 1, maxX = L.padL + L.plotW - w - 1;
    if (maxX < minX || bot < top) return null;
    var list = this._tagRects || (this._tagRects = []);
    var hits = function (r) {
      for (var k = 0; k < list.length; k++) {
        var b = list[k];
        if (r.x + r.w < b.x + 1 || r.x > b.x + b.w - 1 || r.y + r.h < b.y + 1 || r.y > b.y + b.h - 1) continue;
        return true;
      }
      return false;
    };
    for (var i = 0; i < pref.length; i++) {
      var q = pref[i];
      var r = { x: Math.max(minX, Math.min(q.x, maxX)), y: Math.max(top, Math.min(q.y, bot)), w: w, h: h };
      if (!hits(r)) return r;
    }
    /* 마지막 수단: 패널을 훑어 '가장 가까운' 빈 자리 — 여기서도 자리가 없을 때만 라벨을 생략한다 */
    var best = null, bestD = Infinity, y0 = pref.length ? pref[0].y : (top + bot) / 2;
    for (var yv = top; yv <= bot; yv += 3) {
      for (var xi = 0; xi < 3; xi++) {
        var rr = { x: xi === 1 ? (minX + maxX) / 2 : (xi === 0 ? minX : maxX), y: yv, w: w, h: h };
        if (hits(rr)) continue;
        var d = Math.abs(yv - y0);
        if (d < bestD) { bestD = d; best = rr; if (d < 2) return rr; }
      }
    }
    return best;
  };
  /* 진단용 — 화면에 그린 라벨끼리 겹친 쌍의 수 (검증·디버깅) */
  Chart.prototype.tagOverlaps = function () {
    var rs = this._tagRects || [], n = 0, pairs = [];
    for (var i = 0; i < rs.length; i++) {
      for (var j = i + 1; j < rs.length; j++) {
        var a = rs[i], b = rs[j];
        if (a.x + a.w <= b.x + 1 || a.x >= b.x + b.w - 1 || a.y + a.h <= b.y + 1 || a.y >= b.y + b.h - 1) continue;
        n++; pairs.push([i, j, a, b]);
      }
    }
    return { count: n, total: rs.length, pairs: pairs };
  };
  Chart.prototype.pillTag = function (ctx, x, y, text, color, bg, align) {
    ctx.save();
    ctx.font = '600 9.5px ui-monospace,SFMono-Regular,monospace';
    ctx.textBaseline = 'middle';
    var w = ctx.measureText(text).width + 10;
    var ax = align === 'right' ? x - w : (align === 'center' ? x - w / 2 : x);
    var pref = [{ x: ax, y: y - 7.5 }], k;
    for (k = 1; k <= 40; k++) pref.push({ x: ax, y: y - 7.5 + k * 16 });
    for (k = 1; k <= 12; k++) pref.push({ x: ax, y: y - 7.5 - k * 16 });
    var rect = this.freeRect(w, 15, pref);
    if (!rect) { ctx.restore(); return; }
    this._tagRects.push(rect);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 3); else ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.09)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = color; ctx.textAlign = 'left';
    ctx.fillText(text, rect.x + 5, rect.y + 8);
    ctx.restore();
  };

  /* ---------------- W 쌍바닥 오버레이 (L1 → 넥라인 N → L2 → 돌파/현재) ----------------
     'line' 단계는 캔들·지표 위, 라벨 단계는 엘리어트 라벨 뒤(위)에서 그려
     서로의 라벨 사각형(_wBoxes / _ewBoxes / _tagRects)을 피해 배치한다. */
  Chart.prototype.drawWBottom = function (ctx, a, L, Y, i0, i1, bw, phase) {
    var self = this, xr = L.padL + L.plotW;
    var pTop = L.price.y + 1, pBot = L.price.y + L.price.h;

    if (phase !== 'label') {
      this._wBoxes = [];
      this._wGeo = null;
      if (!vis('w')) return;
      var w = a.w;
      if (!w || !w.stage || w.stage === '실패') return;
      var q = w.pat;
      if (!q) return;
      var c = a.close, n = c.length, last = n - 1;
      var endI = (q.brk != null) ? q.brk : last;
      var endP = (q.brk != null) ? c[q.brk] : c[last];
      if (this.x(Math.max(q.p1, q.p3)) > xr + 2) return;        /* 패턴이 화면 오른쪽 밖 */
      if (this.x(endI) < L.padL - 2) return;                    /* 패턴이 화면 왼쪽 밖 */
      var g = {
        x0: this.x(q.p1), x1: this.x(q.p2), x2: this.x(q.p3), x3: this.x(endI),
        yL1: Y(q.L1), yN: Y(q.neck), yL2: Y(q.L2), yE: Y(endP),
        neck: q.neck, brk: q.brk != null, p3i: q.p3,
        col: '#E2E8F0',                                   /* 구조선은 중립 색 — 이동평균·엘리어트와 구분 */
        stageCol: w.stage === '돌파' ? '#34D399' : (w.stage === '임박' ? '#FBBF24' : '#38BDF8'),
        stage: w.stage
      };
      g.spanPx = g.x3 - g.x0;
      g.nx0 = Math.max(L.padL, Math.min(g.x1, g.x2) - bw * 0.6);
      g.nx1 = Math.min(xr, Math.max(g.x3, g.x2) + Math.max(bw * 2, 10));
      this._wGeo = g;
      this._wBoxes = [];

      ctx.save();
      /* 넥라인(N) 수평 점선 — L2 오른쪽에서 돌파 지점까지 연장 */
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(203,213,225,.55)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(g.nx0, g.yN); ctx.lineTo(g.nx1, g.yN); ctx.stroke();
      ctx.setLineDash([]);
      /* W자 폴리라인 — 어두운 테두리 위에 단계별 색 */
      var pts = [[g.x0, g.yL1], [g.x1, g.yN], [g.x2, g.yL2], [g.x3, g.yE]];
      var drawPath = function () {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
      };
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      drawPath(); ctx.strokeStyle = 'rgba(11,14,20,.85)'; ctx.lineWidth = 4.8; ctx.stroke();
      drawPath(); ctx.strokeStyle = g.col; ctx.lineWidth = 2.1; ctx.stroke();
      /* 변곡점 L1 · N · L2 */
      [[g.x0, g.yL1], [g.x1, g.yN], [g.x2, g.yL2]].forEach(function (pt) {
        ctx.beginPath(); ctx.arc(pt[0], pt[1], 2.8, 0, Math.PI * 2);
        ctx.fillStyle = '#0B0E14'; ctx.fill();
        ctx.strokeStyle = g.col; ctx.lineWidth = 1.6; ctx.stroke();
      });
      /* 넥라인 돌파 봉 — 단계 색으로 채운 점 */
      if (g.brk) {
        ctx.beginPath(); ctx.arc(g.x3, g.yE, 3.4, 0, Math.PI * 2);
        ctx.fillStyle = g.stageCol; ctx.fill();
        ctx.strokeStyle = '#0B0E14'; ctx.lineWidth = 1.2; ctx.stroke();
      }
      ctx.restore();
      return;
    }

    /* ---- 라벨 ---- */
    var gg = this._wGeo;
    if (!gg || !vis('w') || this._wLabeled === gg) return;
    this._wLabeled = gg;
    var boxes = (this._ewBoxes || []).concat(this._tagRects || []).concat(this._wBoxes || []);
    var hit = function (r) {
      for (var k = 0; k < boxes.length; k++) {
        var b = boxes[k];
        if (!(r.x + r.w < b.x - 2 || r.x > b.x + b.w + 2 || r.y + r.h < b.y - 2 || r.y > b.y + b.h + 2)) return true;
      }
      return false;
    };
    var tag = function (px, py, text, align, tone) {
      ctx.font = '600 9px ui-monospace,SFMono-Regular,monospace';
      var tw = Math.round(ctx.measureText(text).width) + 9;
      var baseX = align === 'right' ? px - tw : (align === 'center' ? px - tw / 2 : px);
      baseX = Math.max(L.padL + 1, Math.min(baseX, xr - tw - 1));
      var dy = [py - 7, py + 2, py - 21, py + 16, py - 35, py + 30];
      var cands = [];
      dy.forEach(function (y) { [0, -46, -92, 46].forEach(function (dx) { cands.push([baseX + dx, y]); }); });
      for (var k = 0; k < cands.length; k++) {
        var tx = Math.max(L.padL + 1, Math.min(cands[k][0], xr - tw - 1));
        if (cands[k][1] + 14 < pTop || cands[k][1] > pBot - 2) continue;
        var rect = { x: tx, y: Math.max(pTop, Math.min(cands[k][1], pBot - 15)), w: tw, h: 14 };
        if (hit(rect)) continue;
        boxes.push(rect);
        if (!self._tagRects) self._tagRects = [];
        self._tagRects.push(rect);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 3); else ctx.rect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = 'rgba(11,14,20,.92)'; ctx.fill();
        ctx.strokeStyle = tone; ctx.globalAlpha = .6; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = tone; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(text, rect.x + 4.5, rect.y + 7.5);
        return true;
      }
      return false;
    };
    var stageTxt = gg.stage === '돌파' ? 'W돌파' : (gg.stage === '임박' ? 'W임박' : 'W진행');
    var neutral = '#DDE3EC';
    /* 패턴이 화면에서 충분히 넓을 때만 변곡점 라벨 (5년 전체 보기에서는 배지만) */
    if (gg.spanPx >= 58) {
      if (gg.x0 >= L.padL - 2) tag(gg.x0, gg.yL1 + 14, 'L1', 'center', neutral);
      tag(gg.x2, gg.yL2 + 14, 'L2', 'center', neutral);
      tag((gg.x1 + gg.x2) / 2, gg.yN - 3, '넥라인', 'center', neutral);
    }
    tag(gg.x3, (gg.brk ? Math.min(gg.yE, gg.yN) - 9 : gg.yE + 14), stageTxt, 'center', gg.stageCol);
  };

  /* ---------------- 보이는 구간 고점·저점 라벨 ----------------
     현재 차트에 보이는 구간(i0~i1)의 최고가·최저가를 찾아 현재가 대비 등락률과 날짜를
     캔들·다른 라벨과 겹치지 않는 자리에 표시한다. */
  Chart.prototype.drawExtremes = function (ctx, a, L, Y, i0, i1, hh, ll) {
    if (i1 <= i0) return;
    var self = this;
    var iHi = i0, iLo = i0, i;
    for (i = i0; i <= i1; i++) {
      if (hh[i] > hh[iHi]) iHi = i;
      if (ll[i] < ll[iLo]) iLo = i;
    }
    var price = a.close[i1];
    var hi = hh[iHi], lo = ll[iLo];
    if (!(hi > 0) || !(lo > 0)) return;
    var ds = function (d) { return d ? d.slice(2).replace(/-/g, '.') : ''; };
    var pc = function (v) { var q = (price / v - 1) * 100; return (q >= 0 ? '+' : '') + q.toFixed(2) + '%'; };
    var txtHi = '최고 ' + usd(hi) + ' (' + ds(a.dates[iHi]) + ') ' + pc(hi);
    var txtLo = '최저 ' + usd(lo) + ' (' + ds(a.dates[iLo]) + ') ' + pc(lo);
    var pTop = L.price.y + 1, pBot = L.price.y + L.price.h - 1;
    var xr = L.padL + L.plotW;
    var put = function (txt, px0, py0, col, bg, laneFirst) {
      if (isLightTheme()) bg = '#FFFFFF';   /* 화이트 모드 — 칩을 흰 바탕으로 (흰색 rgba 는 자동 변환 대상이라 헥스로) */
      ctx.font = '600 9.5px ui-monospace,SFMono-Regular,monospace';
      var tw = Math.round(ctx.measureText(txt).width) + 10, th = 15;
      var cands = [
        [px0 - tw / 2, py0 - th - 9], [px0 - tw / 2, py0 + 9],
        [px0 - tw / 2, py0 - th - 24], [px0 - tw / 2, py0 + 24],
        [px0 + 7, py0 - th / 2], [px0 - tw - 7, py0 - th / 2]
      ];
      /* 상·하단 레인 — 라벨이 몰린 구간에서도 자리를 찾도록 가로로 밀어 본다.
         고점은 위쪽 레인을, 저점은 아래쪽 레인을 먼저 시도한다. */
      var lanes = laneFirst === 'bottom' ? [pBot - th - 1, pTop + 1] : [pTop + 1, pBot - th - 1];
      lanes.forEach(function (ly) {
        [0, -70, 70, -140, 140, -210, 210].forEach(function (dx) { cands.push([px0 - tw / 2 + dx, ly]); });
      });
      /* 우선 후보가 모두 막히면 freeRect 가 패널을 훑어 빈 자리를 잡는다 — 오른쪽 가격 태그와도 겹치지 않는다 */
      var rect = self.freeRect(tw, th, cands.map(function (c) { return { x: c[0], y: c[1] }; }));
      if (!rect) return;
      self._tagRects.push(rect);
      ctx.beginPath();
      ctx.moveTo(px0, py0); ctx.lineTo(Math.max(rect.x, Math.min(px0, rect.x + rect.w)), rect.y + rect.h / 2);
      ctx.strokeStyle = bg.indexOf('56,10,22') >= 0 ? 'rgba(251,113,133,.45)' : 'rgba(52,211,153,.45)';
      ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 3); else ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = bg; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, rect.x + 4.5, rect.y + 7.5);
    };
    /* 고점 표시 */
    var xH = this.x(iHi), yH = Y(hi);
    ctx.beginPath(); ctx.arc(xH, yH, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = '#FB7185'; ctx.fill();
    put(txtHi, xH, yH, '#FECDD3', 'rgba(56,10,22,.92)', 'top');
    /* 저점 표시 */
    var xL = this.x(iLo), yL = Y(lo);
    ctx.beginPath(); ctx.arc(xL, yL, 2.6, 0, Math.PI * 2);
    ctx.fillStyle = '#34D399'; ctx.fill();
    put(txtLo, xL, yL, '#A7F3D0', 'rgba(6,40,30,.92)', 'bottom');
  };

  /* ---------------- 삼각수렴 오버레이 (표시 전용) ----------------
     엔진 triDetect 결과의 상단·하단 수렴 추세선을 그리고, 4개 피벗과 단계를 라벨로 표시.
     매매 전략 진입·청산 조건에는 쓰지 않는다. */
  Chart.prototype.drawTri = function (ctx, a, L, Y, i0, i1, bw, phase) {
    if (!vis('tri')) return;
    var t = a.tri;
    if (!t) return;
    var self = this, xr = L.padL + L.plotW;
    var lin = function (i0p, i1p, v0, v1, j) { return v0 + (v1 - v0) * (j - i0p) / (i1p - i0p); };
    var uAt = function (j) { return lin(t.ha, t.hb, t.hva, t.hvb, j); };
    var lAt = function (j) { return lin(t.la, t.lb, t.lva, t.lvb, j); };
    var phaseCol = t.stage === '돌파' ? '#34D399' : (t.stage === '임박' ? '#FBBF24' : '#7DD3FC');
    if (phase !== 'label') {
      var j0 = Math.max(t.t0, i0), j1 = Math.min(Math.ceil(t.apex), i1);
      if (j1 <= j0) return;
      ctx.save();
      /* 수렴 구간 옅은 면 */
      ctx.beginPath();
      ctx.moveTo(self.x(j0), Y(uAt(j0)));
      ctx.lineTo(self.x(j1), Y(uAt(j1)));
      ctx.lineTo(self.x(j1), Y(lAt(j1)));
      ctx.lineTo(self.x(j0), Y(lAt(j0)));
      ctx.closePath();
      ctx.fillStyle = 'rgba(251,191,36,.055)';
      ctx.fill();
      /* 상단·하단 추세선 */
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.35; ctx.lineJoin = 'round';
      [[uAt, '#FBBF24'], [lAt, '#60A5FA']].forEach(function (q) {
        ctx.beginPath();
        ctx.moveTo(self.x(j0), Y(q[0](j0)));
        ctx.lineTo(self.x(j1), Y(q[0](j1)));
        ctx.strokeStyle = 'rgba(11,14,20,.7)'; ctx.lineWidth = 3.4; ctx.stroke();
        ctx.strokeStyle = q[1]; ctx.lineWidth = 1.35; ctx.stroke();
      });
      ctx.setLineDash([]);
      /* 네 피벗 */
      [[t.ha, 'H'], [t.hb, 'H'], [t.la, 'L'], [t.lb, 'L']].forEach(function (q) {
        var pj = q[0];
        if (pj < i0 || pj > i1) return;
        var v = q[1] === 'H' ? uAt(pj) : lAt(pj);
        ctx.beginPath(); ctx.arc(self.x(pj), Y(v), bw > 4 ? 3.4 : 2.6, 0, Math.PI * 2);
        ctx.fillStyle = '#0B0E14'; ctx.fill();
        ctx.strokeStyle = q[1] === 'H' ? '#FBBF24' : '#60A5FA'; ctx.lineWidth = 1.6; ctx.stroke();
      });
      ctx.restore();
      return;
    }
    /* 라벨 */
    var ty = Y((uAt(i1) + lAt(i1)) / 2);
    if (!(ty > L.price.y) || ty > L.price.y + L.price.h) return;
    var txt = '삼각수렴 ' + t.typKo + ' · ' + t.stage;
    self.pillTag(ctx, xr - 4, Math.max(L.price.y + 10, Math.min(ty, L.price.y + L.price.h - 10)), txt, phaseCol,
      'rgba(10,16,24,.94)', 'right');
  };

  /* ---------------- 상승 다이버전스 오버레이 (표시 전용) ----------------
     엔진 divScan 결과의 두 저점(직전 저점 → 최근 저점)을 점선으로 잇고 라벨을 단다.
     최근 3거래일 안에 성립한 건만 그리며, '깔끔 보기'에서는 다른 보조 오버레이와 함께 숨는다. */
  Chart.prototype.drawDiv = function (ctx, a, L, Y, i0, i1) {
    if (!vis('div')) return;
    var d = a.div;
    if (!d || !d.hit || !d.prev) return;
    var pi = d.idx, pj = d.prev.idx;
    if (pi < i0 || pi > i1) return;                 /* 최근 저점이 화면 밖이면 그리지 않는다 */
    var self = this, xr = L.padL + L.plotW;
    var x0 = this.x(pj), x1 = this.x(pi);
    var y0 = Y(d.prev.low), y1 = Y(d.low);
    var pTop = L.price.y + 1, pBot = L.price.y + L.price.h - 1;
    var col = '#2DD4BF';
    ctx.save();
    ctx.beginPath();
    if (ctx.rect) ctx.rect(L.padL, L.price.y, L.plotW, L.price.h);
    ctx.clip();
    /* 두 저점을 잇는 점선 — 캔들 위에서도 보이도록 어두운 테두리를 깐다 */
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.strokeStyle = 'rgba(11,14,20,.85)'; ctx.lineWidth = 3.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(45,212,191,.92)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([]);
    /* 두 저점 마커 */
    [[x0, y0], [x1, y1]].forEach(function (pt) {
      ctx.beginPath(); ctx.arc(pt[0], pt[1], 3.1, 0, Math.PI * 2);
      ctx.fillStyle = '#0B0E14'; ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.7; ctx.stroke();
    });
    ctx.restore();
    /* 라벨 — 최근 저점 아래쪽 빈 자리 */
    if (x1 < L.padL - 1 || x1 > xr + 1) return;
    var txt = '다이버전스 · RSI ' + d.prev.rsi.toFixed(0) + '→' + d.rsi.toFixed(0);
    var ly = Math.max(pTop + 9, Math.min(y1 + 15, pBot - 9));
    self.pillTag(ctx, x1, ly, txt, '#5EEAD4', 'rgba(6,40,36,.94)', 'center');
  };

  /* ---------------- 엘리어트 파동 오버레이 ---------------- */
  Chart.prototype.drawWave = function (ctx, a, L, Y, i0, i1, bw) {
    if (!vis('ew')) return;
    var e = ewScnOf(a);
    if (!e) return;
    var self = this, up = e.dir > 0;
    var impC = up ? '#2DD4BF' : '#FB7185';
    var corC = '#C4B5FD';
    var colOf = function (s) { return (s === 'cor' || s === 'subcor') ? corC : impC; };
    var xr = L.padL + L.plotW;
    var path = e.path || [];
    var boxes = (this._wBoxes || []).slice();
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
      ctx.font = '600 10.5px ui-monospace,SFMono-Regular,monospace';
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
        ctx.font = '600 9px ui-monospace,SFMono-Regular,monospace';
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
      if (t.bad) return;
      var yl = Y(t.lo), yh = Y(t.hi);
      var py0 = L.price.y, py1 = L.price.y + L.price.h;
      if (Math.min(yl, yh) > py1 || Math.max(yl, yh) < py0) return;
      /* 구간이 패널 밖으로 나가도(하한 $0 클램프 등) 패널 안으로 잘라서 그린다 */
      var ra = Math.max(Math.min(yl, yh), py0), rb = Math.min(Math.max(yl, yh), py1);
      ctx.fillStyle = 'rgba(16,185,129,.085)';
      ctx.fillRect(gx0, ra, xr - gx0, Math.max(rb - ra, 1));
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(52,211,153,.5)'; ctx.lineWidth = 1;
      [t.lo, t.hi].forEach(function (v) {
        var yy = Math.min(Math.max(Y(v), py0), py1);
        ctx.beginPath(); ctx.moveTo(gx0, yy); ctx.lineTo(xr, yy); ctx.stroke();
      });
      ctx.setLineDash([]);
      tags.push({ y: (ra + rb) / 2, text: '목표 ' + pxs(t.lo) + '~' + pxs(t.hi), c: '#6EE7B7', bg: 'rgba(6,44,34,.92)' });
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

    this._ewBoxes = boxes;
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
    /* 실전 보유 탭에서는 카드 제목·배지를 mhTab 이 관리한다 — select()→ptRender() 가 덮어쓰지 않도록 */
    if (myhold.tab !== 'hold') {
      badge.textContent = replay ? 'REPLAY' : 'LIVE DAY';
      badge.classList.toggle('replay', replay);
    }

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
    /* 테마 전환 버튼 — 저장된 설정은 첫 페인트 전 인라인 스크립트가 이미 적용했다 */
    var thb = $('#themeBtn');
    if (thb) thb.onclick = function () { applyTheme(!isLightTheme(), true); };
    themeLabel(isLightTheme());
    /* 진단용 — 검증 스크립트가 라벨 겹침·Y축 스케일을 그대로 읽어 갈 수 있게 (읽기 전용) */
    window.APEX_DIAG = {
      overlaps: function () { return chart.tagOverlaps(); },
      labels: function () { return (chart._tagRects || []).slice(); },
      axis: function () {
        var L = chart._L || {};
        return {
          i0: chart.i0, i1: chart.i1, bars: chart.i1 - chart.i0 + 1,
          dataBars: Math.min(chart.i1, (chart.a ? chart.a.dates.length : 1) - 1) - chart.i0 + 1,
          future: Math.max(0, chart.i1 - ((chart.a ? chart.a.dates.length : 1) - 1)),
          futureMax: chart.futureMax ? chart.futureMax() : null,
          lo: chart._lo, hi: chart._hi, cLo: chart._cLo, cHi: chart._cHi,
          zoomed: !!chart._zoomed, priceH: L.price ? L.price.h : null,
          avgBodyPx: (function () {
            var a = chart.a; if (!a || chart._hi == null) return null;
            var c = a.close, oo = (a.series || {}).o, iEnd = Math.min(chart.i1, a.dates.length - 1), n = iEnd - chart.i0 + 1, sum = 0;
            for (var i = chart.i0; i <= iEnd; i++) sum += Math.abs(c[i] - (oo && oo[i] != null ? oo[i] : c[i]));
            return sum / Math.max(n, 1) / (chart._hi - chart._lo) * (L.price ? L.price.h : 0);
          })(),
          volH: L.vol ? L.vol.h : null, rsiH: L.rsi ? L.rsi.h : null, macdH: L.macd ? L.macd.h : null
        };
      },
      /* Y축 자유 이동 검증용 — 사용자 보정(오프셋·배율)과 실제 축 범위 */
      yaxis: function () {
        var L = chart._L || {};
        return { offPx: chart.yOffPx, zoom: chart.yZoomF, lo: chart._lo, hi: chart._hi,
          baseLo: chart._yBaseLo, baseHi: chart._yBaseHi, priceH: L.price ? L.price.h : null,
          priceY: L.price ? L.price.y : null,
          axisW: L.padR || 0, plotR: (L.padL || 0) + (L.plotW || 0), W: chart.W,
          dragging: !!chart.drag, axisDragging: !!chart.axisDrag };
      },
      priceAt: function (py) { return chart.priceAt(py); },
      state: function () { return { clean: !!state.clean, show: JSON.parse(JSON.stringify(state.show)), cur: state.cur, range: state.range }; },
      /* 성향(🛡️ 안정형 / 🔥 공격형) 검증용 — 프로필·실효 파라미터·배지·카드·모멘텀 Top5 (읽기 전용) */
      risk: function () {
        var b = $('#riskBanner'), c = $('#aggrCard');
        var m6 = mom6Counts();
        return {
          profile: riskProfile(), attr: document.documentElement.getAttribute('data-risk'),
          strategy: stratKey(), swing: riskParams().swing, trend: riskParams().trend,
          bannerShown: b ? !b.hidden : null, cardShown: c ? !c.hidden : null,
          cardText: c && !c.hidden ? c.innerText.replace(/\s+/g, ' ').slice(0, 600) : '',
          stratUni: ($('#stratUni') || {}).innerText || '',
          mom: m6.top.map(function (r) { return { t: r.t, k: r.k, r: r.r }; })
        };
      },
      /* 유니버스(99종목) 평균 — 성향·전략별 즉시 계산 (검증 스크립트용) */
      uni: function (mode, bars) { return computeUniNow(mode === 'swing' ? 'swing' : 'trend', bars || 1255); },
      /* 선택 종목의 전략 성과 스냅숏 (캐시가 성향별로 갈리는지 확인용) */
      ticker: function (t) {
        var a = A[t || state.cur]; if (!a || !a.strategy) return null;
        function pick(b) { return b ? { ret: b.stats.totalReturn, win: b.stats.winRate, mdd: b.stats.mdd, trades: b.stats.trades } : null; }
        return { sym: a.sym, trend: pick(a.strategy.trend), swing: pick(a.strategy.swing), plan: a.swing ? { coolLeft: a.swing.coolLeft, coolTotal: a.swing.coolTotal, stopCap: a.swing.stopCap, exitRule: a.swing.exitRule } : null };
      },
      /* 💼 실전 보유 관리 검증용 — 모드·종목별 기준·자동 최고 조합·추천 (읽기 전용) */
      myhold: function () {
        return {
          mode: myhold.mode,
          items: myhold.items.map(function (it) {
            var b = mhBasisOf(it), opt = mhBestPeek(it.t) || null;
            var row = $('#mhList .mh-row[data-t="' + it.t + '"]');
            return { t: it.t, rule: mhRuleOf(it), basis: b ? b.mode : '', ko: b ? b.ko : '', pend: !!(b && b.pend),
              best: opt && opt.best ? { rule: opt.best.rule, ret: opt.best.ret, period: opt.best.period, fair: opt.best.fair,
                sharpe: opt.best.sharpe, mdd: opt.best.mdd, trades: opt.best.trades } : null,
              all: opt ? opt.all.map(function (r) { return { rule: r.rule, ko: r.ko, ret: r.ret, period: r.period, bars: r.bars,
                fair: r.fair, sharpe: r.sharpe, mdd: r.mdd, trades: r.trades }; }) : null,
              reco: mhRecoOf(it), row: row ? row.innerText.replace(/\s+/g, ' ') : '' };
          }),
          sumBasis: (($('#mhSum') || {}).innerText || '').replace(/\s+/g, ' '),
          faqOpen: $('#mhFaq') ? !$('#mhFaq').hidden : null,
          cache: { bt: Object.keys(mhBtCache).length, opt: Object.keys(mhOptCache).length }
        };
      },
      /* 엔벨로프 검증용 — 마지막 봉의 20일선·상/하한과 배율(±8% 인지) */
      env: function () {
        var a = chart.a; if (!a || !a.ind || !a.ind.env) return null;
        var n = a.close.length - 1, e = a.ind.env;
        if (e.mid[n] == null) return null;
        return { pct: e.pct, i: n, date: a.dates[n], mid: e.mid[n], up: e.up[n], lo: e.lo[n], close: a.close[n],
          upRatio: e.up[n] / e.mid[n], loRatio: e.lo[n] / e.mid[n] };
      }
    };
    buildMaLegend();
    buildScoreExplain();
    wirePaper();
    wireDraw();
    setTool('cursor');
    drawCount();

    /* ---- 전략 전환 탭 (추세형 ↔ 스윙형) ---- */
    $$('.strat-seg').forEach(function (seg) {               /* 상단(1·2 통합 컨트롤)과 하단 전략 바가 같은 전환 함수를 쓴다 */
      seg.onclick = function (e) {
        var b = e.target.closest('button[data-m]'); if (!b) return;
        setStrategy(b.getAttribute('data-m'));
      };
    });

    /* ---- 투자 운영 원칙 탭 (📌 기본 원칙 · 🛡️ 안정형 · 🔥 공격형) ---- */
    var nxt = $('#nxTabs');
    if (nxt) {
      nxt.onclick = function (e) {
        var b = e.target.closest('button[data-nx]'); if (!b) return;
        setNxTab(b.getAttribute('data-nx'));
      };
    }
    renderNotice();

    /* ---- 투자방식 전환 (🎯 집중 1 · ⚖️ 분산 3 · 🌐 분산 10) — 상단 컨트롤 + 계좌 카드 두 곳 ---- */
    $$('.slot-seg, #acGrid').forEach(function (box) {
      box.onclick = function (e) {
        var b = e.target.closest('[data-slot]'); if (!b) return;
        setAcctSlot(b.getAttribute('data-slot'));
      };
    });
    /* ---- 계좌 카드 '보유·체결 내역 보기' 펼침 (2026-11-28 2단계 · 투명성) ---- */
    var ao = $('#acOpen');
    if (ao) ao.onclick = function () { acPanelToggle(); };
    /* ---- 🛡️ 스트레스 테스트 토글 (슬리피지 + −10% 갭) ---- */
    var asg = $('#acStress');
    if (asg) asg.onclick = function () { acctToggleStress(); };
    /* ---- 🔬 표본외 성적표 — 슬롯 선택·표 접기 ---- */
    var wfs = $('#wfSlot');
    if (wfs) wfs.onclick = function (e) {
      var b = e.target.closest('[data-wfslot]'); if (!b) return;
      wfSlotSel = b.getAttribute('data-wfslot'); renderWF();
    };
    var wfo = $('#wfOpen');
    if (wfo) wfo.onclick = function () {
      var bd = $('#wfBody'); if (!bd) return;
      bd.hidden = !bd.hidden;
      wfo.setAttribute('aria-expanded', bd.hidden ? 'false' : 'true');
      wfo.textContent = bd.hidden ? '표 펼치기' : '표 접기';
    };

    /* ---- 성향 전환 (🛡️ 안정형 ↔ 🔥 공격형) — 상단 헤더·전략 바 두 곳이 같은 상태를 공유 ---- */
    $$('.risk-switch').forEach(function (seg) {
      seg.onclick = function (e) {
        var b = e.target.closest('button[data-risk-btn]'); if (!b) return;
        setRisk(b.getAttribute('data-risk-btn'));
      };
    });
    var rbOff = $('#riskBannerOff');
    if (rbOff) rbOff.onclick = function () { setRisk('safe'); };

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
    function syncScanTabs() {
      $$('#filterTabs button').forEach(function (x) {
        var on = x.dataset.f === state.filter;
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      $$('#presetTabs button').forEach(function (x) {
        var on = !!state.preset && x.dataset.f === state.preset;
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var pt = $('#presetTabs'); if (pt) pt.setAttribute('data-on', presetActive() ? '1' : '0');
    }
    function setScanFilter(f) {
      state.filter = f;                 /* 상단 탭 — 프리셋은 그대로 유지 (교집합) */
      syncScanTabs();
      renderScanner();
    }
    function toggleScanPreset(f) {
      state.preset = (state.preset === f) ? '' : f;   /* 같은 버튼을 다시 누르면 해제 */
      syncScanTabs();
      renderScanner();
    }
    var fTabs = $('#filterTabs');
    if (fTabs) fTabs.onclick = function (e) {
      var b = e.target.closest('button');
      if (!b || !b.dataset.f) return;
      setScanFilter(b.dataset.f);
    };
    var pTabs = $('#presetTabs');
    if (pTabs) pTabs.onclick = function (e) {
      var b = e.target.closest('button');
      if (!b || !b.dataset.f) return;
      toggleScanPreset(b.dataset.f);
    };
    syncScanTabs();   /* 초기 상태(전체 · 프리셋 없음)를 aria·data 속성에도 반영 */
    /* 설명란(전략 가이드 · 프리셋 안내)은 종목 목록 아래 접기/펼치기 — 상태는 브라우저에 저장 */
    var siT = $('#siToggle'), siBox = $('#sideInfo');
    if (siT && siBox) {
      var siApply = function (open, save) {
        siBox.classList.toggle('open', !!open);
        siT.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (save) { try { localStorage.setItem('apex.side.info.v1', open ? '1' : '0'); } catch (e) {} }
      };
      var siStart = false;
      try { siStart = localStorage.getItem('apex.side.info.v1') === '1'; } catch (e) {}
      siApply(siStart, false);
      siT.onclick = function () {
        var open = !siBox.classList.contains('open');
        siApply(open, true);
        if (!open) return;
        /* 펼쳤을 때 내용이 사이드바 밑으로 잘리지 않게 — 본문은 맨 위부터, 바는 화면 안으로 */
        var siB = $('#siBody');
        if (siB) siB.scrollTop = 0;
        try { siT.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
        catch (e) { try { siT.scrollIntoView(); } catch (e2) {} }
      };
    }
    $('#sortSel').onchange = function () { state.sort = this.value; renderScanner(); };
    $('#listSearch').oninput = function () { state.listQ = this.value; renderScanner(); };
    $('#tf').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      setPeriod(b.dataset.n);        /* 차트 + 아래 자료(KPI·자산곡선·로그) 같은 기간으로 */
    };
    var tp = $('#topPeriod');
    if (tp) tp.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      setPeriod(b.dataset.n);        /* 4️⃣ 상단 기간 바 → 차트·백테스트·계좌·히어로가 함께 */
    };
    var btf = $('#btf');
    if (btf) btf.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      setPeriod(b.dataset.n);        /* 아래에서 눌러도 위 차트가 같은 기간으로 */
    };
    /* 자산곡선 마커 클릭 → 트레이드 로그 해당 거래로 이동 */
    var eqCv = $('#equity');
    if (eqCv) {
      var hitMark = function (e) {
        var r = eqCv.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        var best = null, bd = 1e9;
        eqMarks.forEach(function (m) {
          var dx = Math.abs(m.x - x), dy = Math.abs(m.y - y);
          var d = dx + dy * 0.6;
          if (dx <= 9 && dy <= 11 && d < bd) { best = m; bd = d; }
        });
        return best;
      };
      eqCv.onclick = function (e) {
        var m = hitMark(e);
        if (m) focusTrade(m.ti);
      };
      eqCv.onmousemove = function (e) {
        eqCv.style.cursor = hitMark(e) ? 'pointer' : 'default';
      };
      eqCv.onmouseleave = function () { eqCv.style.cursor = 'default'; };
    }
    $('#toggles').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var k = b.dataset.t;
      if (!k) return;
      state.show[k] = !state.show[k];
      b.classList.toggle('on', state.show[k]);
      if (k === 'w') wPersist();
      if (k === 'sar' || k === 'env' || k === 'tri') xtogPersist();
      chart.resize(); chart.draw();
    };
    /* 깔끔 보기 — 구름대·볼린저·엘리어트·패턴을 잠시 숨기고 캔들 + 20·240일선 + 고저점만 */
    var cleanBtn = $('#cleanToggle');
    if (cleanBtn) cleanBtn.onclick = function () {
      state.clean = !state.clean;
      cleanPersist(); cleanSync();
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
    ['paperCard', '보유 관리 · 모의투자'],
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

  /* ============================================================
     오늘의 주식 공부 & 검색기 팁 — 날짜로 매일 자동 변경 (33편 순환)
     ============================================================ */
  var EDU_KEY = 'apex.edu.closed.v1';
  var EDU_PREV = '‹', EDU_NEXT = '›';
  var EDU = [
    { c: '차트·기법', t: 'W 쌍바닥과 넥라인 돌파', s: '비슷한 두 저점 + 넥라인 돌파 + 거래량',
      b: '<p>W 쌍바닥(이중바닥)은 <b>두 번 바닥을 확인한 뒤</b> 하락 추세를 끝내는 대표적인 반전 패턴입니다. 두 저점의 가격대가 비슷하고, 그 사이에 솟은 고점을 <em>넥라인</em>이라고 부릅니다.</p>' +
         '<p>매수 신호는 <b>넥라인을 종가로 돌파할 때</b>입니다. 돌파 봉의 거래량이 20일 평균의 1.5~2배 이상 늘어나면 신뢰도가 크게 올라갑니다. 넥라인을 되돌려 이탈하면 실패한 W로 보고 손절합니다.</p>' +
         '<p>이 검색기의 <b>W 쌍바닥</b> 오버레이는 넥라인(점선)과 두 바닥을 차트에 그려 줍니다. 쌍바닥 프리셋은 돌파·임박·진행 단계로 후보를 좁혀 줍니다.</p>',
      tip: '넥라인까지의 상승 여력보다, 돌파 후 지지로 바뀌는지가 실제 승부처입니다.' },
    { c: '차트·기법', t: 'RSI(2) 과매도 스윙', s: '아주 짧은 과매도만 골라 반등을 먹는 단기 기법',
      b: '<p>RSI(2)는 <b>최근 2일</b>만으로 과매수·과매도를 계산합니다. 14일 RSI보다 훨씬 민감해서, 정상적인 상승 추세에서도 잠깐씩 10 아래로 떨어지는 자리가 생깁니다.</p>' +
         '<p>이 검색기의 스윙형 전략은 <em>RSI(2) &lt; 10 + QQQ가 200일선 위</em>일 때 다음 날 시가 매수(단, QQQ RSI(2)가 <b>5 미만</b>인 극단 패닉 날은 200일선 아래여도 허용), 이익이 난 상태에서 20일선 아래로 2거래일 연속 마감하면 다음 날 시가 청산하는 구조입니다. 손절로 끝난 종목은 <b>10거래일 동안 다시 사지 않습니다</b>(같은 종목에서 손절이 연달아 나는 것을 막는 규칙). 99종목 5년 백테스트 승률 55%대·패배 732건이 나온 이유는 <b>자연스러운 상승장에서만 진입</b>하고 손실 뒤에는 쉬기 때문입니다.</p>' +
         '<p>RSI(2)는 하락장에서 5 아래로도 계속 내려갑니다. 시장 필터 없이 쓰면 물타기가 됩니다.</p>',
      tip: '지표가 낮다는 이유만으로 사지 말고, 시장이 200일선 위인지 먼저 봅니다.' },
    { c: '차트·기법', t: '240일선, 장기 기준선 읽기', s: '연간 흐름을 정하는 가장 굵은 선',
      b: '<p>240일 단순이동평균은 약 1년치 평균입니다. 차트에서 <b>가장 굵게</b> 그린 주황색 선이 그것입니다. 가격이 240일선 위에 있으면 장기 상승, 아래면 장기 하락으로 보는 가장 단순하고 강한 기준입니다.</p>' +
         '<p>중요한 것은 선의 <b>기울기</b>입니다. 가격이 240일선 근처에 있는데 선이 우상향이면 지지 가능성이 크고, 선이 꺾여 내려오면 반등은 저항에 부딪히기 쉽습니다.</p>' +
         '<p>단기 매매에서도 “240일선 아래에서는 비중을 줄인다”는 규칙 하나만 지켜도 큰 손실을 크게 줄일 수 있습니다.</p>',
      tip: '240일선은 매매 신호라기보다 비중을 정하는 기준선으로 쓰면 좋습니다.' },
    { c: '차트·기법', t: '일목균형표 구름대', s: '구름 위는 강세, 구름 두께가 지지의 두께',
      b: '<p>구름대(운명대)는 9·26·52일의 중간값을 26봉 앞으로 당겨 그린 띠입니다. 가격이 구름 <b>위</b>에 있으면 상승 우위(양운), <b>아래</b>면 하락 우위(음운)로 해석합니다.</p>' +
         '<p>구름이 두꺼울수록 그 가격대를 뚫기가 어렵습니다. 조정이 와도 구름 상단에서 멈추는 경우가 많아 손절·재진입 자리를 잡기에 좋습니다.</p>' +
         '<p>이 검색기는 선행스팬 A·B와 구름대만 남기고 전환선·기준선·후행스팬은 차트에서 뺐습니다. 선이 많으면 캔들이 가려지기 때문입니다.</p>',
      tip: '구름 안에서는 방향을 알기 어렵습니다. 구름 밖으로 나온 뒤에 판단하세요.' },
    { c: '차트·기법', t: '엘리어트 파동의 3대 규칙', s: '1-2-3-4-5 상승과 A-B-C 조정',
      b: '<p>추세는 <b>5개의 충격파</b>와 <b>3개의 조정파</b>로 움직인다는 이론입니다. 규칙은 세 가지로 요약됩니다. ① 2파는 1파의 출발점을 되돌리지 않는다 ② 3파는 1파보다 짧을 수 없다 ③ 4파는 1파의 영역을 침범하지 않는다.</p>' +
         '<p>하락 추세는 이 그림의 거울상입니다. 2026-11-26에 배운 마이크로소프트 하락 1-5파동이 그 예입니다.</p>' +
         '<p>파동은 <b>사후에 확정</b>되는 경우가 많습니다. 그래서 이 검색기는 대안 시나리오와 무효화 가격을 함께 보여 줍니다. 파동 라벨이 틀릴 수 있다는 전제로 읽어야 합니다.</p>',
      tip: '파동 카운트는 매매 근거가 아니라 “지금 어느 구간인지”를 정리하는 지도로 쓰세요.' },
    { c: '차트·기법', t: '파라볼릭 SAR 사용법', s: '추세 전환점을 점으로 표시하는 지표',
      b: '<p>SAR은 가속계수(0.02, 최대 0.20)로 가격을 따라가며 <b>캔들 아래(상승) 또는 위(하락)</b>에 점을 찍습니다. 점이 캔들 반대편으로 넘어가면 추세가 바뀌었다는 신호입니다.</p>' +
         '<p>장점은 <b>손절선을 자동으로 그려 준다</b>는 것입니다. 상승 추세에서 점이 아래에서 따라 올라오므로, 점 아래로 종가가 내려가면 청산 기준으로 쓸 수 있습니다.</p>' +
         '<p>단점은 횡보장에서 점이 위아래로 자주 뒤집혀 신호가 남발된다는 것입니다. 이동평균과 함께 써서 추세가 뚜렷한 종목에만 적용하세요.</p>',
      tip: '지표 토글의 SAR을 켜면 점이 나타납니다. 기본은 꺼 둔 상태입니다.' },
    { c: '차트·기법', t: '엔벨로프 상단 = 단기 과열', s: '20일선 ±8% 밴드의 의미',
      b: '<p>엔벨로프는 20일 이동평균에서 <b>±8%</b> 떨어진 상·하단 밴드입니다. 통계적인 볼린저 밴드(±2 표준편차)와 달리 폭이 고정되어 있어, <b>얼마나 오래·많이 이격됐는지</b>를 보는 데 적합합니다.</p>' +
         '<p>가격이 상단에 닿으면 단기 과열로 봅니다. 다만 강한 상승 초입에서는 상단에 붙어 오래 올라가는 경우가 많아, 상단 도달 자체를 매도 신호로 쓰면 안 됩니다.</p>' +
         '<p>실전에서는 <b>상단 이탈 후 20일선으로 복귀하는지</b>를 확인하는 편이 안전합니다. 하단은 낙폭과대 판단에 참고합니다.</p>',
      tip: '엔벨로프 상단은 “팔 자리”보다 “추격 매수를 멈출 자리”로 쓰세요.' },
    { c: '차트·기법', t: 'VCP 변동성 축소', s: '조정이 점점 얇아지면 매물이 사라진 것',
      b: '<p>미너비니의 VCP(Volatility Contraction Pattern)는 상승 뒤 조정의 <b>폭과 기간이 점점 줄어드는</b> 모양입니다. 조정폭이 20% → 10% → 5%로 줄고 거래량도 마르면, 싸게 팔 사람이 없어졌다는 뜻입니다.</p>' +
         '<p>이 검색기의 <b>VCP 프리셋</b>은 시총 Top 30·실적 우량주 중에서 정배열과 변동성 축소를 모두 만족하고, 피벗 돌파 또는 피벗 -5% 이내인 종목만 골라 줍니다.</p>' +
         '<p>돌파 시 거래량이 평소보다 1.5배 이상 터지면 성공 확률이 올라갑니다. 실패하면 피벗 아래를 손절선으로 둡니다.</p>',
      tip: 'VCP는 “살 때”를 알려 주지만, 시장이 약할 때는 돌파가 잘 실패합니다.' },
    { c: '차트·기법', t: '달러(DXY)와 빅테크', s: '달러 강세는 해외 매출 큰 기업에 역풍',
      b: '<p>DXY는 유로·엔 등 주요 6개 통화 대비 달러의 세기를 나타냅니다. 달러가 강해지면 미국 기업이 해외에서 번 돈을 달러로 바꿀 때 <b>원화·유로 기준 매출이 줄어</b> 실적에 부담이 됩니다.</p>' +
         '<p>애플·마이크로소프트·엔비디아처럼 해외 매출 비중이 큰 빅테크는 DXY와 <b>반대로</b> 움직이는 경향이 있습니다. 반면 내수 중심 기업은 영향이 작습니다.</p>' +
         '<p>DXY가 단기간에 급등하면 실적 발표를 앞둔 수출주에서 경계 신호로 볼 수 있습니다. 다만 상관관계는 시기마다 달라지므로 절대 규칙은 아닙니다.</p>',
      tip: '거시 바의 DXY와 실적 D-day 배지를 함께 보면 위험 구간이 보입니다.' },
    { c: '차트·기법', t: '장단기 금리차(10Y−2Y)', s: '역전은 경기 둔화의 선행 신호',
      b: '<p>10년물 금리에서 2년물 금리를 뺀 값입니다. 정상은 플러스(장기가 더 높음)이고, 마이너스가 되면 <b>수익률 곡선 역전</b>이라고 부릅니다.</p>' +
         '<p>역전은 과거 여러 차례 경기 침체에 선행했습니다. 다만 <b>몇 달~2년</b> 앞서 나오므로 주가 하락 신호로 바로 쓰기는 어렵습니다. 2년물은 연준 금리 기대에 민감해서, 인하 기대가 커지면 2년물이 먼저 내려와 차이가 벌어집니다.</p>' +
         '<p>거시 바의 <b>10Y−2Y</b> 칩이 이 값을 보여 줍니다. 플러스로 벌어지는지, 다시 역전되는지 추세를 보세요.</p>',
      tip: '역전보다 중요한 것은 역전이 풀린 뒤입니다. 침체는 역전 해소 국면에 오는 경우가 많았습니다.' },
    { c: '차트·기법', t: '돌파에는 거래량이 필요하다', s: '가격만 오르는 돌파는 속임수가 많다',
      b: '<p>저항을 뚫는 날 거래량이 평소보다 <b>1.5~2배</b> 늘어야 진짜 돌파로 봅니다. 거래량 없이 슬금슬금 넘어가면 세력이 아닌 소수 주문으로 만든 가짜 돌파일 수 있습니다.</p>' +
         '<p>반대로 <b>하락에는 거래량이 적어도 됩니다</b>. 매도는 이유 없이도 나오지만, 큰 매수는 반드시 힘이 필요하기 때문입니다.</p>' +
         '<p>스캐너의 등락률·거래량 배수(volRatio)를 함께 보면 돌파의 질을 가늠할 수 있습니다.</p>',
      tip: '돌파 후 2~3일 안에 거래량이 줄고 가격이 넥라인 아래로 돌아오면 실패로 처리합니다.' },
    { c: '차트·기법', t: 'ATR로 손절 거리 정하기', s: '종목 변동성에 맞춘 손절이 생존을 만든다',
      b: '<p>ATR(평균 진폭)은 그 종목이 하루에 얼마나 움직이는지를 나타냅니다. 손절을 <b>가격이 아니라 ATR 배수</b>로 정하면 변동성이 큰 종목에서 억울하게 털리는 일을 줄일 수 있습니다.</p>' +
         '<p>이 분석기의 추세형은 6 ATR 손절·10 ATR 트레일, 스윙형은 4.5 ATR 손절에 <b>최대 -10%</b>(🔥 공격형은 −15%) 상한을 두었습니다. 엔비디아처럼 ATR이 큰 종목에서 손절이 -20%까지 벌어지는 것을 막기 위해서입니다.</p>' +
         '<p>손절 폭을 좁히면 승률은 떨어지고, 넓히면 한 번의 손실이 커집니다. 두 전략을 나눠 쓰는 이유입니다.</p>',
      tip: '손절가는 진입 전에 정합니다. 사고 나서 정하면 대부분 못 지킵니다.' },
    { c: '차트·기법', t: '볼린저 밴드와 스퀴즈', s: '20일선 ±2 표준편차의 압축과 확장',
      b: '<p>볼린저 밴드는 20일 이동평균 ±2 표준편차입니다. 밴드 폭이 <b>좁아지면(스퀴즈)</b> 변동성이 줄었다는 뜻이고, 곧 큰 움직임이 나오는 경우가 많습니다.</p>' +
         '<p>밴드 상단을 타고 올라가는 <b>밴드 워크</b>는 강한 추세의 표시입니다. 상단 터치를 과열로 보고 바로 매도하면 큰 상승을 놓칩니다.</p>' +
         '<p>중심선(20일선)은 추세의 기준으로, 종가가 중심선 아래로 내려가면 단기 흐름이 꺾였다고 봅니다.</p>',
      tip: '스퀴즈는 방향을 알려 주지 않습니다. 돌파 방향을 확인한 뒤 따라가세요.' },
    { c: '차트·기법', t: 'MACD 다이버전스', s: '가격은 신고가, 모멘텀은 약해질 때',
      b: '<p>가격은 더 높은 고점을 만드는데 MACD 히스토그램이나 선은 더 낮은 고점을 만들면 <b>약세 다이버전스</b>입니다. 상승의 힘이 빠지고 있다는 신호입니다.</p>' +
         '<p>반대로 가격은 더 낮은 저점인데 MACD가 높아지면 <b>강세 다이버전스</b>로, 하락 반전의 실마리로 봅니다.</p>' +
         '<p>다이버전스는 <b>타이밍 지표가 아닙니다</b>. 몇 달씩 유지되며 계속 신고가가 나오기도 합니다. 추세선 이탈이나 20일선 이탈 같은 확인 신호와 함께 쓰세요.</p>',
      tip: '다이버전스만 보고 역추세 매매를 하면 추세장에서 크게 다칩니다.' },
    { c: '차트·기법', t: '52주 신고가 근처가 더 강하다', s: '싸게 사는 것보다 강한 것을 사는 편이 낫다',
      b: '<p>52주 신고가 부근의 종목은 위에 <b>물린 매물이 없어</b> 저항이 적습니다. 반대로 52주 저가 부근은 반등할 때마다 본전 매물이 쏟아집니다.</p>' +
         '<p>그래서 상승장에서는 신고가 근처 종목이 계속 강한 경우가 많습니다. “많이 빠진 종목”을 고르는 것과 “강한 종목”을 고르는 것은 다른 전략입니다.</p>' +
         '<p>스캐너의 등락률·추세 열과 차트의 52주 범위 위치를 함께 보세요. 고점 대비 얼마나 떨어졌는지도 참고가 됩니다.</p>',
      tip: '신고가 종목은 손절선을 피벗 아래로 짧게 잡을 수 있어 손익비가 좋아집니다.' },
    { c: '차트·기법', t: '지지와 저항은 매물대에서 나온다', s: '선이 아니라 사람의 기억',
      b: '<p>지지·저항은 이전에 <b>거래가 많이 쌓인 가격대</b>에서 생깁니다. 그 가격에 사둔 사람이 많으면, 다시 그 가격에 오면 본전 심리로 팔거나 추가 매수가 들어옵니다.</p>' +
         '<p>이평선·52주 고저·전고점이 겹치는 자리는 저항이 특히 두껍습니다. 차트의 수평선 도구로 그 가격대를 직접 표시해 두면 판단이 빨라집니다.</p>' +
         '<p>저항을 뚫고 올라간 뒤 그 가격이 <b>지지로 바뀌는지</b> 확인하는 것이 재진입 자리입니다.</p>',
      tip: '지지선은 “깨지면 손절” 기준과 함께 정해야 의미가 생깁니다.' },
    { c: '차트·기법', t: '손익비(R:R) 1:2의 힘', s: '승률 40%로도 남는 구조',
      b: '<p>손익비가 1:2라면 10번 중 4번만 맞아도 기대값은 플러스입니다. 반대로 1:0.5라면 7번 맞아도 한 번의 큰 손실에 밀립니다.</p>' +
         '<p>그래서 진입 전에 <b>목표가와 손절가를 먼저 그리고</b>, 손익비가 1.5 미만이면 매매를 건너뛰는 규칙이 유효합니다.</p>' +
         '<p>히어로 카드의 <b>손익비 (R:R)</b> 값이 이 계산을 대신 해 줍니다. 손절은 6 ATR, 목표는 10 ATR 기준입니다.</p>',
      tip: '손익비가 좋아도 승률 20%짜리 자리는 오래 버티기 어렵습니다. 둘을 함께 보세요.' },
    { c: '차트·기법', t: '추세선은 세 번째 접점에서', s: '두 점은 누구나 긋는다, 세 번째가 확인',
      b: '<p>추세선은 저점(또는 고점) 두 개를 이어 긋습니다. 하지만 두 점만으로는 아무 선이나 그을 수 있어, <b>세 번째로 닿아 반등하는지</b>가 진짜 추세선의 조건입니다.</p>' +
         '<p>추세선을 긋고 나면 “닿았을 때 사고, 이탈하면 판다”는 규칙이 자연스럽게 생깁니다. 작도 도구의 추세선 버튼으로 직접 그려 보세요.</p>' +
         '<p>너무 많은 선은 판단을 흐립니다. 한 차트에 2~3개면 충분합니다.</p>',
      tip: '추세선 이탈 후 다시 올라와도, 이탈한 선을 저항으로 되돌려보는 경우가 많습니다.' },
    { c: '차트·기법', t: '실적 D-3, 갭 하락을 조심', s: '손절선을 건너뛰는 유일한 구멍',
      b: '<p>실적 발표는 장 마감 후나 개장 전에 나오고, 다음 날 주가는 <b>갭</b>으로 출발합니다. 아무리 -10% 손절을 걸어 두어도 갭으로 -20% 시가가 나오면 그 가격에 체결됩니다.</p>' +
         '<p>그래서 실적이 3일 안으로 다가온 종목은 신규 진입을 피하거나 비중을 줄이는 편이 좋습니다. 이 검색기는 히어로 카드와 트레이드 로그에 <b>실적 D-day 배지</b>를 표시합니다.</p>' +
         '<p>발표 전에 줄이고, 발표 후 반응을 확인한 뒤 다시 들어가는 것이 리스크 관리입니다.</p>',
      tip: '백테스트에도 갭은 시가 체결로 반영되어, 손절보다 큰 손실이 나올 수 있습니다.' },
    { c: '차트·기법', t: '수익률보다 최대낙폭(MDD)', s: '버틸 수 있는 하락인가',
      b: '<p>연 30% 수익도 중간에 -60%를 버티지 못하면 실현되지 않습니다. 실제 계좌에서는 <b>최대낙폭(MDD)</b>이 수익률보다 중요합니다.</p>' +
         '<p>이 분석기의 KPI 카드에 전략별 최대낙폭이 나옵니다. 스윙형은 거래가 짧아 MDD가 작고, 단순보유는 2022년 같은 해에 크게 빠졌습니다.</p>' +
         '<p>내 계좌가 -30%에서 버틸 수 있는지 먼저 정하고, 그에 맞는 전략과 비중을 고르세요.</p>',
      tip: 'MDD의 절반쯤이 실제로 겪게 되는 심리적 고통이라고 생각하면 대략 맞습니다.' },
    { c: '차트·기법', t: '분할 매수와 분할 익절', s: '타이밍을 맞히지 않아도 되는 유일한 방법',
      b: '<p>한 번에 전부 사면 고점에 살 위험이 커집니다. 3~4회로 나눠 사면 평균 단가가 완만해지고, 판단이 틀렸을 때 수정할 여지가 남습니다.</p>' +
         '<p>매도도 마찬가지입니다. 목표가 1차에서 절반, 2차에서 나머지처럼 나누면 “너무 일찍 팔았다”는 후회를 줄일 수 있습니다.</p>' +
         '<p>모의매매 기능에서 수량과 비중(10·25·50·100%) 버튼으로 이 과정을 미리 연습해 보세요.</p>',
      tip: '분할은 감정 관리 도구입니다. 규칙을 정해 두고 기계적으로 실행하세요.' },
    { c: '차트·기법', t: '시장 레짐 필터', s: '개별 종목보다 시장이 먼저다',
      b: '<p>아무리 좋은 종목도 시장이 무너지면 같이 빠집니다. 그래서 전략에는 <b>시장 필터</b>가 필요합니다. 추세형은 <b>QQQ 100일선 단계 (또는 QQQ RSI(2)&lt;5 극단 패닉 예외 · RSI(2)&lt;15 패닉일 청산 보류)</b>를 씁니다 — QQQ 100일선 아래(진입 제한)여도 QQQ RSI(2)가 5 미만인 극단 공포일에는 전액 비중으로 진입하고, 반대로 시장약세 청산 판정일의 QQQ RSI(2)가 15 미만이면 그날은 팔지 않고 다음 날 다시 판정합니다.</p>' +
         '<p>스윙형은 QQQ가 200일선 위일 때만 진입하되, 같은 극단 공포일(RSI(2) 5 미만)에는 200일선 아래여도 진입을 허용합니다(폭락일의 눌림 매수).</p>' +
         '<p>필터가 없으면 하락장에서 RSI(2) 신호가 계속 떠서 물타기만 반복하게 됩니다. 99종목 5년 백테스트에서 추세형에 공포 예외를 넣자 평균 +118.89% → <b>+133.90%</b>, 84/99종목이 개선됐습니다(2022년 −6.94% → −4.40%).</p>' +
         '<p>필터는 “수익을 늘리는 장치”라기보다 <b>큰 손실을 막는 장치</b>입니다.</p>',
      tip: 'QQQ가 100일선 아래면 스윙 신호는 참고만 하고 비중을 줄이세요.' },
    { c: '검색기 활용법', t: '시총 Top 30 + 실적 우량주 조합', s: '큰 회사 중에서 돈을 잘 버는 곳만',
      b: '<p>프리셋 <b>시총 Top 30</b>은 유동성이 풍부한 대형주만 남깁니다. 여기에 <b>실적 우량주</b>(EPS 흑자 · 매출성장 5% 초과 · 순이익률 15% 초과)를 겹쳐 보면 “크고 잘 버는 회사”가 남습니다.</p>' +
         '<p>두 프리셋은 동시에 켜지지 않으므로, 하나씩 눌러 목록을 비교하는 식으로 씁니다. 정렬을 <b>점수 높은순</b>이나 <b>RSI 낮은순</b>으로 바꾸면 후보가 더 빨리 줄어듭니다.</p>' +
         '<p>거른 뒤에는 반드시 차트를 열어 240일선과 거래량을 확인하세요. 스캐너는 후보를 줄이는 도구입니다.</p>',
      tip: '프리셋은 “사도 되는 목록”이 아니라 “더 볼 목록”입니다.' },
    { c: '검색기 활용법', t: '실적 D-3 배지로 갭 피하기', s: '히어로 카드와 로그의 작은 배지',
      b: '<p>종목을 고르면 히어로 카드 아래에 <b>다음 실적 발표 D-day</b>가 표시됩니다. D-3 이내면 노란 경고가 뜹니다.</p>' +
         '<p>백테스트·모의매매 화면의 트레이드 로그에도 보유 중인 거래의 실적 일정이 함께 나옵니다. 실적을 앞두고 있으면 청산 시점을 조정하는 판단에 쓰세요.</p>' +
         '<p>실적 직전에는 신규 진입을 미루고, 이미 보유 중이면 비중을 줄이는 것이 일반적인 대응입니다.</p>',
      tip: '배지는 “위험하다”가 아니라 “갭이 날 수 있다”는 뜻입니다.' },
    { c: '검색기 활용법', t: '추세형 ↔ 스윙형 전환 시점', s: '같은 종목도 장세에 따라 전략이 달라진다',
      b: '<p>전략 탭에서 <b>추세형(중기)</b>과 <b>스윙형(단기)</b>을 바꿀 수 있습니다. 추세형은 점수 50 이상 매수 후 6 ATR 손절·10 ATR 트레일로 오래 들고, 스윙형은 RSI(2) 과매도에서 짧게 진입합니다.</p>' +
         '<p>시장이 100일선 위에서 완만히 오르면 추세형이 편하고, 변동성이 크고 방향이 자주 바뀌면 스윙형이 유리합니다. 백테스트 기간을 1Y·2Y로 바꿔 두 전략의 승률·MDD를 비교해 보세요.</p>' +
         '<p>전환은 “지금 시장이 어느 쪽인가”를 보고 정합니다. 최근 3개월 성과가 좋은 쪽을 따라가는 것도 방법입니다.</p>',
      tip: '전략을 자주 바꾸면 비용만 늘어납니다. 최소 몇 주는 유지해 보세요.' },
    { c: '검색기 활용법', t: '기간 버튼(3M~5Y)으로 장세 점검', s: '차트 기간이 곧 백테스트 기간',
      b: '<p>차트 위의 <b>3M·6M·1Y·2Y·5Y</b> 버튼은 차트 범위와 아래 백테스트 기간을 동시에 바꿉니다. 5Y에는 2022년 하락장이 포함되어, 전략이 하락장에서 어떻게 버텼는지 볼 수 있습니다.</p>' +
         '<p>3M으로 보면 최근 장세에서 그 종목의 신호가 얼마나 잘 맞았는지 알 수 있습니다. 다만 거래 수가 적어 통계적 의미는 약해집니다.</p>' +
         '<p>기간을 바꿔도 지표는 전체 이력을 써서 계산하므로 미래참조는 없습니다.</p>',
      tip: '5Y에서 MDD를, 1Y에서 최근 성과를 확인하는 식으로 나눠 보세요.' },
    { c: '검색기 활용법', t: '트레이드 로그 읽는 법', s: '보유기간과 청산 사유의 분포',
      b: '<p>로그에는 진입·청산 가격, <b>보유기간</b>, 수익률, <b>청산 사유</b>가 나옵니다. 청산 사유 분포를 보면 전략이 의도대로 작동하는지 알 수 있습니다.</p>' +
         '<p>손절이 대부분이면 진입 조건이 너무 느슨하고, 추세 청산이 대부분이면 오래 들고 가는 구조입니다. 평균 보유기간이 짧으면 수수료(0.03%)의 영향이 커집니다.</p>' +
         '<p>수익 거래만 따로 보지 말고 <b>연속 손실 구간</b>을 찾아보세요. 내가 버틸 수 있는 길이인지 판단하는 데 도움이 됩니다.</p>',
      tip: '로그는 “과거 실적”이 아니라 “전략의 성격”을 읽는 자료입니다.' },
    { c: '검색기 활용법', t: '모의매매로 규칙 먼저 검증', s: '실제 돈을 넣기 전에 손버릇부터',
      b: '<p>가상투자 화면은 실제 일봉 종가로 체결됩니다. 시드($10K 등)를 정하고, 시점 리플레이로 과거 어느 날로 돌아가 <b>그때 알 수 있었던 정보만으로</b> 매매를 연습할 수 있습니다.</p>' +
         '<p>목표는 수익을 내는 것이 아니라 <b>규칙을 지키는 연습</b>입니다. 손절선을 지켰는지, 추격 매수를 했는지 기록해 보세요.</p>' +
         '<p>실제 주문이 아니므로 부담 없이 반복할 수 있습니다. 계좌 초기화로 언제든 처음부터 다시 시작합니다.</p>',
      tip: '모의매매에서 20번 이상 같은 규칙을 반복하면 실제 계좌에서 덜 흔들립니다.' },
    { c: '검색기 활용법', t: '종합 기술점수, 근거까지 읽기', s: '50점이 차트 중립, 5개 팩터의 합',
      b: '<p>점수는 추세·모멘텀·반전·거래량·가격구조 <b>5개 팩터</b>를 가중 합산해 50을 기준으로 만든 값입니다. 50이 차트 중립, 75점 이상이면 차트 강세입니다.</p>' +
         '<p>이 점수는 <b>개별 종목 차트만 본 참고값</b>입니다. 실제 진입·청산은 위 ‘신규 진입’ 카드의 전략 신호(추세형·스윙형)가 정하므로, 점수가 차트 강세여도 시장대기·손절대기라면 진입하지 않습니다.</p>' +
         '<p>중요한 것은 점수 자체보다 <b>어느 팩터가 점수를 만들었는지</b>입니다. 점수는 높은데 거래량 팩터가 마이너스라면, 힘없이 오른 것일 수 있습니다.</p>' +
         '<p>“종합 기술점수 산출 근거·해설” 카드에서 팩터별 배점과 현재 값을 함께 보세요.</p>',
      tip: '점수 하나로 사지 말고, 반대 팩터가 무엇인지 확인하는 습관을 들이세요.' },
    { c: '검색기 활용법', t: '관심종목은 5개면 충분', s: '많이 담으면 관리가 안 된다',
      b: '<p>관심종목은 상단의 ★로 추가합니다. 5개 안팎으로 유지하면 실적 일정과 차트를 매일 확인할 수 있습니다.</p>' +
         '<p>목록 내 정렬을 <b>RSI 낮은순</b>으로 바꾸면 단기 과매도 후보가 위로 올라오고, <b>점수 높은순</b>은 추세 후보를 보여 줍니다.</p>' +
         '<p>관심종목은 이 브라우저(localStorage)에만 저장됩니다. 다른 기기와 공유되지 않습니다.</p>',
      tip: '관심종목을 자주 갈아치우면 비교가 안 됩니다. 최소 한 달은 유지해 보세요.' },
    { c: '검색기 활용법', t: '공포·탐욕 시계와 매수 타이밍', s: '극단적 공포는 분할 매수 구간',
      b: '<p>CNN 공포·탐욕 지수는 시장 심리를 0~100으로 보여 줍니다. 25 이하 극단적 공포는 투매 구간, 75 이상 극단적 탐욕은 과열 구간입니다.</p>' +
         '<p>공포 구간에서는 <b>한 번에 사지 말고 분할</b>로 접근하고, 탐욕 구간에서는 추격 매수를 줄이고 손절선을 올리는 식으로 씁니다.</p>' +
         '<p>지수는 매일 자동 갱신되며, 실시간 API 연결에 성공하면 ‘실시간’ 배지가 켜집니다.</p>',
      tip: '심리 지표는 타이밍을 정확히 맞히지 못합니다. 비중 조절 도구로 쓰세요.' },
    { c: '검색기 활용법', t: 'W 프리셋으로 후보 3단계 압축', s: '돌파 · 임박 · 진행',
      b: '<p>W 쌍바닥 프리셋은 넥라인 <b>돌파(최근 5봉)</b>, <b>임박(넥라인 5% 이내)</b>, <b>진행(바닥 형성)</b> 세 단계로 종목을 보여 줍니다.</p>' +
         '<p>보통 “임박”에서 미리 지켜보다가 “돌파”에서 진입 여부를 판단합니다. “진행”은 아직 시간이 필요한 후보다.</p>' +
         '<p>프리셋을 켠 뒤 차트의 W 오버레이로 넥라인과 두 바닥이 실제로 그려지는지 확인하세요. 모양이 어긋나면 신호를 믿지 않는 편이 좋습니다.</p>',
      tip: '돌파 목록은 장 마감 기준입니다. 다음 날 갭으로 출발하면 손익비가 달라집니다.' },
    { c: '차트·기법', t: '거래량과 OBV, 매집의 흔적', s: '가격이 안 움직여도 거래량이 말한다',
      b: '<p>OBV(누적 거래량)는 오른 날의 거래량을 더하고 내린 날을 빼서 만든 선입니다. 가격이 횡보하는데 OBV가 우상향하면 <b>조용한 매집</b> 가능성이 있습니다.</p>' +
         '<p>가격 신고가인데 OBV가 따라오지 못하면 상승의 힘이 약해지고 있다는 신호입니다.</p>' +
         '<p>거래량 지표는 방향을 확정해 주지 않습니다. 돌파의 신뢰도를 높이는 보조 자료로 쓰세요.</p>',
      tip: '거래량은 “확인”용이고, 가격이 먼저 움직입니다.' }
  ];
  var eduOff = 0;
  function eduTodayNum() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function eduFmt(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) +
      ' (' + WD_KO[d.getDay()] + ')';
  }
  function eduIdx(off) {
    var d = new Date(eduTodayNum().getTime() + off * 86400000);
    var n = EDU.length;
    var k = Math.floor((d - new Date(2026, 0, 1)) / 86400000);
    return { i: ((k % n) + n) % n, d: d };
  }
  function eduRender() {
    var card = $('#eduCard');
    if (!card) return;
    var r = eduIdx(eduOff), it = EDU[r.i], n = EDU.length;
    $('#eduDay').textContent = 'Day ' + (r.i + 1);
    $('#eduCat').textContent = it.c;
    $('#eduTopic').textContent = it.t;
    $('#eduMeta').textContent = eduFmt(r.d) + (eduOff === 0 ? ' · 오늘의 팁' : ' · 다른 날 팁') + ' · ' + it.s;
    $('#eduTxt').innerHTML = it.b;
    $('#eduTip').innerHTML = it.tip ? '<b>실전 포인트</b> · ' + it.tip : '';
    $('#eduProg').textContent = (r.i + 1) + '/' + n + ' · ' + n + '일 순환 · 매일 자동 변경';
    /* 도해(SVG) — 편이 바뀌면 그림도 즉시 교체 */
    var fig = $('#eduFig'), box = $('#eduFigSvg'), cap = $('#eduFigCap');
    if (fig && box && cap && typeof EDUFIG !== 'undefined' && EDUFIG.get) {
      var f = EDUFIG.get(r.i);
      if (f) {
        box.innerHTML = f.svg;
        cap.innerHTML = f.cap;
        fig.setAttribute('data-fig', String(r.i + 1));
      }
    }
    var body = $('#eduBody');
    if (body && !card.classList.contains('closed')) body.style.height = '';
  }
  function eduCollapse(closed) {
    var card = $('#eduCard'), btn = $('#eduToggle');
    if (!card) return;
    card.classList.toggle('closed', !!closed);
    if (btn) {
      btn.setAttribute('aria-expanded', closed ? 'false' : 'true');
      var tx = btn.querySelector('.edu-tx');
      if (tx) tx.textContent = closed ? '펼치기' : '접기';
    }
    try { localStorage.setItem(EDU_KEY, closed ? '1' : '0'); } catch (e) {}
  }
  function eduInit() {
    var card = $('#eduCard');
    if (!card) return;
    var closed = false;
    try { closed = localStorage.getItem(EDU_KEY) === '1'; } catch (e) {}
    eduRender();
    eduCollapse(closed);
    var pv = $('#eduPrev'), nx = $('#eduNext'), td = $('#eduToday'), tg = $('#eduToggle');
    if (pv) pv.onclick = function () { eduOff -= 1; eduRender(); };
    if (nx) nx.onclick = function () { eduOff += 1; eduRender(); };
    if (td) td.onclick = function () { eduOff = 0; eduRender(); };
    if (tg) tg.onclick = function () { eduCollapse(!card.classList.contains('closed')); };
  }

  /* ============================================================
     백업 · 복원 — 가상투자(모의매매) · 관심종목 · 차트 작도 · 전략/토글 설정
     localStorage 의 apex.* 키만 하나의 JSON 으로 내보내고, 같은 형식의
     파일을 검증한 뒤 되돌린다. 다른 사이트·앱의 키는 건드리지 않는다.
     ============================================================ */
  var BK_TAG = 'apex-quant-backup', BK_VER = 1;
  function apexKeys() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('apex.') === 0) out.push(k);
      }
    } catch (e) { /* 저장소 차단 환경 */ }
    return out.sort();
  }
  var bkTimer = null;
  function bkMsg(txt, kind) {
    var el = $('#bkMsg');
    if (!el) return;
    el.textContent = txt || '';
    el.className = 'bk-msg' + (kind ? ' ' + kind : '');
    clearTimeout(bkTimer);
    if (txt) bkTimer = setTimeout(function () { el.textContent = ''; el.className = 'bk-msg'; }, 12000);
  }
  function bkDate() {                          /* 한국시간 기준 YYYY-MM-DD (파일 이름) */
    var d = new Date(Date.now() + 9 * 3600000);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  function bkSummary(data) {
    var p = null, w = null, dr = null;
    try { p = JSON.parse(data['apex.paper.v1'] || 'null'); } catch (e) {}
    try { w = JSON.parse(data['apex.watchlist.v1'] || 'null'); } catch (e) {}
    try { dr = JSON.parse(data['apex.draw.v1'] || '{}'); } catch (e) {}
    var mh = null;
    try { mh = JSON.parse(data['apex.myhold.v1'] || 'null'); } catch (e) {}
    var fills = (p && Array.isArray(p.fills)) ? p.fills.length : 0;
    var nw = Array.isArray(w) ? w.length : ((w && Array.isArray(w.t)) ? w.t.length : 0);
    var nd = 0;
    if (dr && typeof dr === 'object') Object.keys(dr).forEach(function (t) { if (Array.isArray(dr[t])) nd += dr[t].length; });
    var nh = (mh && Array.isArray(mh.items)) ? mh.items.length : 0;
    return { fills: fills, watch: nw, draw: nd, hold: nh };
  }
  function backupExport() {
    var data = {};
    apexKeys().forEach(function (k) { try { data[k] = localStorage.getItem(k); } catch (e) {} });
    var pack = {
      app: 'APEX QUANT', tag: BK_TAG, version: BK_VER,
      title: '미국주식 차트분석기 백업 (가상투자 · 관심종목 · 차트 작도 · 전략/토글 설정)',
      exportedAt: new Date().toISOString(), exportedAtKST: bkDate() + ' ' + new Date(Date.now() + 9 * 3600000).toISOString().slice(11, 16),
      keys: Object.keys(data), data: data
    };
    var name = BK_TAG + '-' + bkDate() + '.json';
    try {
      var blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} if (a.parentNode) a.remove(); }, 2000);
      var sm = bkSummary(data);
      bkMsg('백업 내려받음 · ' + name + ' — 실전 보유 ' + sm.hold + '종목 · 가상투자 체결 ' + sm.fills + '건 · 관심종목 ' + sm.watch + '개 · 작도 ' + sm.draw + '개 · 설정 ' + apexKeys().length + '항목', 'ok');
    } catch (e) {
      bkMsg('백업 파일을 만들지 못했습니다 — ' + (e && e.message ? e.message : '브라우저 저장소 제한'), 'err');
    }
  }
  function bkValidate(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return 'JSON 최상위가 객체가 아닙니다';
    if (o.tag !== BK_TAG && o.app !== 'APEX QUANT') return '이 분석기의 백업 파일이 아닙니다';
    if (!o.data || typeof o.data !== 'object' || Array.isArray(o.data)) return 'data 항목이 없습니다';
    var keys = Object.keys(o.data);
    if (!keys.length) return '복원할 항목이 없습니다';
    if (keys.length > 60) return '항목 수가 너무 많습니다';
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], v = o.data[k];
      if (k.indexOf('apex.') !== 0) return '허용되지 않는 키: ' + k;
      if (typeof v !== 'string') return k + ' 값이 문자열이 아닙니다';
      if (v.length > 4e6) return k + ' 값이 너무 큽니다';
      if (v.length <= 64) continue;                      /* 'trend' 같은 짧은 설정 문자열은 그대로 허용 */
      try { JSON.parse(v); } catch (e) { return k + ' 값이 JSON 이 아닙니다'; }
    }
    return '';
  }
  function bkApply(o) {
    /* 백업에 담긴 항목만 되돌린다 — 백업 이후에 새로 만든 다른 기록은 건드리지 않는다 */
    Object.keys(o.data).forEach(function (k) { try { localStorage.setItem(k, o.data[k]); } catch (e) {} });
  }
  function bkReloadState() {
    /* 저장소에서 메모리 상태를 다시 읽고 화면을 그대로 다시 그린다 */
    paper = { seed: 10000, fills: [], sim: null, simDate: null };
    ptLoad();
    state.watch = [];
    watchRestore();
    drawStore = {};
    drawLoad();
    mhLoad();                                    /* 백업에 담긴 실전 보유 기록도 되돌린다 */
    state.show = { ma: true, ichi: true, bb: true, sig: true, rsi: true, macd: true, ew: true, w: true, sar: false, env: false, tri: false };
    state.maOn = { 5: true, 20: true, 60: true, 120: true, 240: true };
    state.clean = false;
    state.strategy = 'trend';
    wRestore(); xtogRestore(); cleanRestore(); stratRestore();
    var last = lastIdx();
    var sdi = paper.simDate ? M.dates.indexOf(paper.simDate) : -1;
    state.simIdx = sdi >= 0 ? sdi : (paper.sim != null ? Math.max(0, Math.min(last, Math.round(paper.sim))) : last);
    $$('#toggles .tg').forEach(function (b) { var k = b.dataset.t; if (k && k in state.show) b.classList.toggle('on', !!state.show[k]); });
    wSyncToggle(); xtogSync(); cleanSync();
    drawCount();
    renderFavs(); renderScanner(); renderStrategy(); ptRender();
    mhRender();
    /* 저장된 라이트 테마면 교육 도해(SVG) 색도 라이트 팔레트로 맞춘다 */
    if (isLightTheme()) {
      if (window.EDUFIG && EDUFIG.setTheme) EDUFIG.setTheme(true);
      eduRender();
    }
    var fc = $('#favCount'); if (fc) fc.textContent = '관심 ' + state.watch.length + '종목';
    var cf = $('#cFav'); if (cf) cf.textContent = state.watch.length;
    select(state.cur, true);
    chart.resize(); chart.draw();
  }
  function backupInit() {
    var ex = $('#bkExport'), im = $('#bkImport'), fi = $('#bkFile');
    if (!ex || !im || !fi) return;
    ex.onclick = function () { backupExport(); };
    im.onclick = function () { fi.value = ''; fi.click(); };
    fi.onchange = function () {
      var f = fi.files && fi.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onerror = function () { bkMsg('파일을 읽지 못했습니다', 'err'); };
      rd.onload = function () {
        var o = null;
        try { o = JSON.parse(String(rd.result)); } catch (e) {
          bkMsg('JSON 파일이 아닙니다 — 이 분석기에서 내보낸 백업 파일을 선택해 주세요', 'err');
          return;
        }
        var bad = bkValidate(o);
        if (bad) { bkMsg('복원할 수 없습니다 — ' + bad, 'err'); return; }
        var sm = bkSummary(o.data || {});
        var at = o.exportedAtKST ? (' (' + o.exportedAtKST + ' 백업)') : '';
        var ok = window.confirm(
          '백업 파일' + at + '을 복원합니다.\n\n' +
          '· 실전 보유 종목 ' + sm.hold + '개\n' +
          '· 가상투자 체결 ' + sm.fills + '건\n' +
          '· 관심종목 ' + sm.watch + '개\n' +
          '· 차트 작도 ' + sm.draw + '개\n' +
          '· 전략·토글 설정 ' + Object.keys(o.data || {}).length + '항목\n\n' +
          '백업에 담긴 항목만 이 내용으로 덮어씁니다(백업 이후 새로 만든 다른 기록은 그대로). 계속할까요?'
        );
        if (!ok) { bkMsg('복원을 취소했습니다 — 저장된 내용은 그대로입니다'); return; }
        try {
          bkApply(o);
          bkReloadState();
          bkMsg('복원 완료 — 실전 보유 ' + sm.hold + '종목 · 가상투자 ' + sm.fills + '건 · 관심종목 ' + sm.watch + '개 · 작도 ' + sm.draw + '개 · 설정 ' + Object.keys(o.data).length + '항목을 되돌렸습니다', 'ok');
        } catch (e) {
          bkMsg('복원 중 오류 — ' + (e && e.message ? e.message : '저장소에 쓸 수 없습니다'), 'err');
        }
      };
      rd.readAsText(f, 'utf-8');
    };
  }

  /* ============================================================
     💼 내 실전 보유 관리 (MY HOLD) — 2026-11-28
     ------------------------------------------------------------
     · 내가 실제로 보유한 종목(평단·수량·매수일·메모)을 그대로 기록하면
       지금 고른 성향(안정형/공격형) × 전략(추세형/스윙형)의 **실제 규칙**으로
       오늘 판단·자동 손절가·청산 기준을 매일 장마감(최근 종가) 기준으로 계산한다.
     · 계산은 백테스트와 같은 규칙에서만 나온다
         스윙: 손절 max(평단 − 4.5 ATR, 평단 − 손절상한 −10%/−15%)
               이익 +5% 이상 & 20일선 2거래일 연속 이탈 → 청산
         추세: 손절 평단 − 6 ATR · 진입가 +6 ATR 도달 후 고점 − 10 ATR 트레일
               QQQ 100일선 아래(시장 위험) → 전량 청산(최소 보유 3거래일 · 패닉일 보류)
     · 매수 기준은 종목마다 고른다 — item.rule: 'auto' | 'safe_trend' | 'aggr_trend' | 'safe_swing' | 'aggr_swing'
         'auto' = 안정·공격 × 추세·스윙 4조합 백테스트(engine.js 실제 함수) 중 최고를 그 종목에 적용
                  (추세 1Y · 스윙 1M — 전략 고유 기간의 실제 백테스트 수익률 · 배지에 고유 수치 표기)
         승자는 **연환산(CAGR) 수익률**로 가린다 — 추세 1Y는 그 자체가 연 수익률이고, 스윙 1M은
                  21거래일 수익률을 1년으로 환산해 견주므로 기간이 다른 두 전략을 왜곡 없이 비교한다
         직접 고른 기준이 연환산으로 5%p 이상 앞서면 💡 추천 칩(누르면 그 기준으로 전환)
         상단 모드 '내 성향 기준'은 저장된 기준을 무시하고 지금 내 성향(성향·전략 버튼) 규칙을 전 종목에 적용
     · 주문·결제 기능은 없다. 실제 계좌·증권사와 연동하지 않는 기록·진단 전용.
     · 저장: localStorage['apex.myhold.v1']
     ============================================================ */
  var MH_KEY = 'apex.myhold.v1';
  var MH_MAX = 30;
  var myhold = { v: 1, tab: 'hold', mode: 'auto', items: [] };
  var mhEdit = '';

  /* ---------------- 매수 기준(전략) 5택 ---------------- */
  var MH_RULES = {
    auto: { ko: '⚡ 수익최적 자동', tag: '⚡ 자동', profile: '', strat: '', auto: true },
    safe_trend: { ko: '🛡️ 안정·추세', tag: '🛡️ 안정·추세', profile: 'safe', strat: 'trend', auto: false },
    aggr_trend: { ko: '🔥 공격·추세', tag: '🔥 공격·추세', profile: 'aggr', strat: 'trend', auto: false },
    safe_swing: { ko: '🛡️ 안정·스윙', tag: '🛡️ 안정·스윙', profile: 'safe', strat: 'swing', auto: false },
    aggr_swing: { ko: '🔥 공격·스윙', tag: '🔥 공격·스윙', profile: 'aggr', strat: 'swing', auto: false }
  };
  var MH_RULE_KEYS = ['auto', 'safe_trend', 'aggr_trend', 'safe_swing', 'aggr_swing'];
  var MH_COMBOS = ['safe_trend', 'aggr_trend', 'safe_swing', 'aggr_swing'];
  function mhRuleOf(it) {
    var r = it && it.rule;
    return (r && r !== 'auto' && MH_RULES[r]) ? r : 'auto';
  }

  function mhEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function mhLoad() {
    myhold = { v: 1, tab: 'hold', mode: 'auto', items: [] };
    try {
      var raw = localStorage.getItem(MH_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object' || Array.isArray(o)) return;
      if (o.tab === 'paper' || o.tab === 'hold') myhold.tab = o.tab;
      if (o.mode === 'auto' || o.mode === 'screen') myhold.mode = o.mode;
      var seen = {};
      myhold.items = (Array.isArray(o.items) ? o.items : []).map(function (it) {
        if (!it || typeof it.t !== 'string') return null;
        var t = it.t.toUpperCase().trim();
        var avg = Number(it.avg), qty = Number(it.qty);
        if (!t || !isFinite(avg) || !(avg > 0) || !isFinite(qty) || !(qty > 0)) return null;
        if (seen[t]) return null;
        seen[t] = 1;
        return { t: t, avg: avg, qty: qty, rule: (it.rule && MH_RULES[it.rule]) ? it.rule : 'auto',
          d: (typeof it.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.d)) ? it.d : '',
          memo: (typeof it.memo === 'string' ? it.memo.slice(0, 40) : '') };
      }).filter(Boolean).slice(0, MH_MAX);
    } catch (e) { /* 저장소가 막힌 환경에서는 메모리 상태로만 동작 */ }
  }
  function mhSave() {
    try {
      localStorage.setItem(MH_KEY, JSON.stringify({ v: 1, tab: myhold.tab, mode: myhold.mode, items: myhold.items }));
    } catch (e) {}
  }
  function mhMsg(txt, kind) {
    var el = $('#mhMsg');
    if (!el) return;
    el.textContent = txt || '';
    el.className = 'mf-msg' + (kind ? ' ' + kind : '');
  }
  function mhItem(t) {
    for (var i = 0; i < myhold.items.length; i++) if (myhold.items[i].t === t) return myhold.items[i];
    return null;
  }
  /* 매수일 → 봉 인덱스 (휴장일이면 그 다음 거래일 · 없으면 마지막 봉) */
  function mhBarIdx(a, d) {
    var last = a.close.length - 1;
    if (!d) return last;
    var i = a.dates.indexOf(d);
    if (i >= 0) return i;
    for (var k = 0; k < a.dates.length; k++) if (a.dates[k] >= d) return k;
    return last;
  }

  /* ============================================================
     ⚡ 수익최적화 — 종목별 4조합 백테스트 (2026-11-28)
     ------------------------------------------------------------
     · engine.js 의 실제 함수를 그대로 호출한다 (임의 추정 금지)
         추세형: QE.backtest(a.series, a.ind, a.scoreSeries, {...riskOpts, bars: 252})
         스윙형: QE.swingBacktest(a.series, a.ind, {...riskOpts, bars: 21}, a.wsig)
     · **기간은 전략 고유 기준** — 추세 1Y(최근 252거래일) · 스윙 1M(최근 21거래일)
         추세는 몇 달~1년 끌고 가는 중기 전략, 스윙은 RSI(2) 과매도로 들어가 몇 주 안에
         20일선 이탈로 끝나는 초단기 전략이라 같은 창으로 재면 한쪽이 늘 불리하다.
         그래서 배지·추천 숫자도 추세 `1Y +XX%` · 스윙 `1M +XX%` 로 각각 적는다.
     · 4조합(안정·공격 × 추세·스윙) 전체에서 고른다 — 성향 제한 없음(2026-11-28 확정).
     · 승부는 **연환산(CAGR) 수익률**로 가린다 (2026-11-28) — 추세끼리(1Y vs 1Y)·스윙끼리(1M vs 1M)는
         기간이 같아 순서가 누적 수익률과 같고, 추세 ↔ 스윙은 스윙 1M을 연환산해 같은 잣대로 견준다.
         (1Y +50% 대 1M +4%를 그대로 비교하면 스윙이 늘 지므로, 배지에는 고유 수치와 연환산을 함께 적는다)
     · 같은 종목·같은 기준일은 다시 돌리지 않는다 — 메모리 캐시
         mhBtCache['티커|asOf|기준'] → { ret, cagr, sharpe, mdd, win, trades, period }
         mhOptCache['티커|asOf']     → { best, all, asOf }
     · 계산은 16ms 타임슬라이스로 2종목씩 — 첫 렌더에서 화면이 멈추지 않게
     ============================================================ */
  var mhBtCache = Object.create(null);
  var mhOptCache = Object.create(null);
  var mhOptQueue = [];
  var mhOptTimer = 0;
  /* 전략 고유 기간 — 추세 1Y(252) 하나 · 스윙은 **다중 창 21·63·126** (2026-11-28 표본 안정화)
     · 21거래일 한 창만 보면 1등이 '청산 0건(미실현 평가)'이나 한 달의 우연으로 결정된다.
       그래서 스윙은 1M·3M·6M 세 창의 **연환산(CAGR) 중앙값**으로 1등을 가리고,
       청산 표본이 없는 조합은 1등 후보에서 뺀다(있으면 '표본 부족'으로 표시). */
  var MH_WINS = { trend: [252], swing: [21, 63, 126] };
  var MH_BARS = { trend: ((QE.BT_PERIODS && QE.BT_PERIODS['1Y']) || 252), swing: 21 };
  var MH_PERIOD = { trend: '1Y', swing: '1M' };
  var MH_WIN_TAG = { 21: '1M', 63: '3M', 126: '6M', 252: '1Y' };
  var MH_SAMPLE_MIN = 1;      /* 1등 후보 최소 청산 표본 */
  var MH_RECO_SAMPLE = 2;     /* 💡 추천 칩 최소 청산 표본 */
  var MH_RECO_AGREE = 2;      /* 다중 창 중 앞서야 하는 창 수(합의) */
  /* 공정 비교값 — 연환산(CAGR). 추세 1Y는 그대로 연 수익률, 스윙 1M은 252/21 로 1년 환산.
     추천 칩은 연환산으로 5%p 이상 앞설 때만 띄운다 (1M 1%p 차이는 연환산으로 12%p가 넘어 과민해진다) */
  var MH_RECO_GAP = 0.05;
  function mhCagr(ret, bars) {
    var n = bars > 0 ? bars : 252, x = 1 + (isFinite(ret) ? ret : 0);
    if (!(x > 0)) return -1;
    return Math.pow(x, 252 / n) - 1;
  }
  function mhFairOf(r) {
    if (!r) return null;
    if (r.fair != null && isFinite(r.fair)) return r.fair;
    return mhCagr(r.ret, r.bars);
  }
  /* 화면 표기용 연환산 — 21거래일 수익을 1년으로 환산하면 작은 달 수익도 세 자리가 되므로 999%에서 자른다 */
  function mhFairPct(v, d) {
    if (v == null || !isFinite(v)) return '—';
    if (v > 9.99) return '+999%↑';
    return pct(v, d === undefined ? 1 : d);
  }
  function mhAsOf(t) {
    var a = A[t];
    return (a && a.dates && a.close && a.close.length) ? a.dates[a.close.length - 1] : '';
  }
  function mhBacktestOf(t, rule, bars0) {
    var spec = MH_RULES[rule], a = A[t];
    if (!spec || spec.auto || !a || !a.series || !a.ind || !a.scoreSeries) return null;
    var bars = bars0 || MH_BARS[spec.strat] || 252;
    var key = t + '|' + mhAsOf(t) + '|' + rule + '|' + bars;
    if (key in mhBtCache) return mhBtCache[key];
    var out = null;
    try {
      var r = null, cur = a.strategy && a.strategy[spec.strat];
      /* 화면 성향·같은 기간으로 analyze() 가 이미 돌린 결과가 있으면 그대로 쓴다 */
      if (cur && cur.stats && cur.stats.totalReturn != null && spec.profile === riskProfile() && btBars() === bars) r = cur;
      else {
        var o = QE.riskOpts(spec.profile) || {};
        o.bars = bars;                                   /* 추세 1Y · 스윙 1M/3M/6M — 전략 고유 기간 */
        if (spec.strat === 'swing') r = QE.swingBacktest(a.series, a.ind, o, a.wsig);
        else r = QE.backtest(a.series, a.ind, a.scoreSeries, o);
      }
      if (r && r.stats) out = { ret: r.stats.totalReturn, cagr: r.stats.cagr, sharpe: r.stats.sharpe,
        mdd: r.stats.mdd, win: r.stats.winRate, trades: r.stats.trades, bars: bars, period: MH_WIN_TAG[bars] || MH_PERIOD[spec.strat],
        fair: (r.stats.cagr != null && isFinite(r.stats.cagr)) ? r.stats.cagr : mhCagr(r.stats.totalReturn, bars) };
    } catch (e) { out = null; }
    mhBtCache[key] = out;
    return out;
  }
  /* 한 조합의 행 — 창마다 실제 백테스트 값을 모으고, 1등 판정은 **청산 표본이 있는 창의 연환산 중앙값**으로 한다. */
  function mhComboRow(t, rule) {
    var spec = MH_RULES[rule];
    if (!spec) return null;
    var wins = [];
    MH_WINS[spec.strat].forEach(function (b) {
      var w = mhWinStats(t, rule, b);
      if (w) wins.push(w);
    });
    if (!wins.length) return null;
    var prim = wins[0], closed = 0;
    wins.forEach(function (w) { closed += w.closed; });
    /* 1등 잣대 = 세 창 연환산의 **중앙값**(창을 가리지 않는다 — 표본이 없는 창도 한 표).
       다만 청산 표본이 전혀 없는 조합은 1등 후보에서 뺀다. */
    var med = mhMedian(wins.map(function (w) { return w.fair; }));
    return { rule: rule, ko: spec.tag, strat: spec.strat,
      wins: wins, med: med, closed: closed, samples: wins.filter(function (w) { return w.closed >= MH_SAMPLE_MIN; }).length,
      ret: prim.ret, period: prim.tag, bars: prim.bars, fair: prim.fair,
      sharpe: prim.sharpe, mdd: prim.mdd, win: prim.win, trades: prim.closed,
      noSample: closed < MH_SAMPLE_MIN };
  }
  /* a 가 b 보다 나은가 — 중앙 연환산으로 비교, 표본 없는 조합은 뒤로 (동률이면 표본 → 샤프 → 1Y 근거) */
  function mhBetter(a, b) {
    if (!b) return true;
    var fa = a.med, fb = b.med;
    if (fa != null && fb == null) return true;
    if (fa == null && fb != null) return false;
    if (fa != null && fb != null) {
      if (fa > fb + 1e-4) return true;
      if (fb > fa + 1e-4) return false;
    }
    if (a.closed > 0 && !(b.closed > 0)) return true;      /* 거래가 아예 없던 조합보다 실제로 매매한 조합 */
    if (b.closed > 0 && !(a.closed > 0)) return false;
    if (a.sharpe > b.sharpe + 1e-6) return true;
    if (b.sharpe > a.sharpe + 1e-6) return false;
    return a.period === '1Y' && b.period !== '1Y';
  }
  function mhBestOf(t) {
    var asOf = mhAsOf(t);
    if (!asOf) return null;
    var key = t + '|' + asOf;
    if (key in mhOptCache) return mhOptCache[key];
    var all = [], best = null;
    MH_COMBOS.forEach(function (rule) {
      var row = mhComboRow(t, rule);
      if (!row) return;
      all.push(row);
      if (row.noSample) return;                                 /* 청산 표본 0건 — 1등 후보 제외 */
      if (mhBetter(row, best)) best = row;
    });
    /* 모든 조합의 표본이 0건이면(신규 상장 등) 고유 창 연환산 1위를 '표본 부족'으로만 보여 준다 */
    var short = false;
    if (!best) {
      short = true;
      all.forEach(function (row) { if (mhBetter(row, best)) best = row; });
    }
    var out = best ? { best: best, all: all, asOf: asOf, short: short }
      : { best: null, all: all, asOf: asOf, short: true };
    mhOptCache[key] = out;
    return out;
  }
  function mhBestPeek(t) {
    var asOf = mhAsOf(t);
    if (!asOf) return undefined;
    var key = t + '|' + asOf;
    return (key in mhOptCache) ? mhOptCache[key] : undefined;
  }
  /* 배지 툴팁용 공정 비교 근거 — 4조합 각각의 고유 기간 수익률과 연환산 */
  /* 창 하나의 백테스트 — 청산 표본(stats.trades)까지 함께 담는다 */
  function mhWinStats(t, rule, bars) {
    var r = mhBacktestOf(t, rule, bars);
    if (!r) return null;
    var closed = (typeof r.trades === 'number' && isFinite(r.trades)) ? r.trades : 0;
    return { bars: bars, tag: MH_WIN_TAG[bars] || (bars + '봉'), ret: r.ret, closed: closed,
      fair: mhFairOf(r), win: r.win, mdd: r.mdd, sharpe: r.sharpe };
  }
  function mhMedian(arr) {
    var a = arr.filter(function (v) { return v != null && isFinite(v); }).sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  /* 배지·툴팁용 공정 비교 근거 — 4조합 × 각자의 창(추세 1Y · 스윙 1M/3M/6M) 수익률과 연환산·표본 */
  function mhFairTable(t) {
    var opt = mhBestPeek(t);
    if (!opt || !opt.all || !opt.all.length) return '계산 중';
    return opt.all.map(function (r) {
      return r.ko + ' ' + r.wins.map(function (w) {
        return w.tag + ' ' + pct(w.ret, 1) + '(연 ' + mhFairPct(w.fair, 0) + '·' + w.closed + '건)';
      }).join('/') + ' → 중앙 연 ' + mhFairPct(r.med, 0);
    }).join(' · ');
  }
  function mhOptAsk(t) {
    if (!mhAsOf(t) || mhBestPeek(t) !== undefined) return;
    if (mhOptQueue.indexOf(t) < 0) mhOptQueue.push(t);
    if (!mhOptTimer) mhOptTimer = setTimeout(mhOptDrain, 16);
  }
  function mhOptDrain() {
    mhOptTimer = 0;
    var n = 0;
    while (mhOptQueue.length && n < 2) {
      var t = mhOptQueue.shift();
      if (mhBestPeek(t) === undefined) { mhBestOf(t); n++; }
    }
    if (bootReady) mhRender();
  }
  /* 한 종목의 실제 적용 기준 — 모드·item.rule·캐시를 여기서 하나로 결정한다 */
  function mhBasisOf(it) {
    var rule = mhRuleOf(it);
    if (myhold.mode !== 'auto') {
      return { mode: 'screen', rule: rule, profile: riskProfile(), strat: stratKey(),
        ko: (riskAggr() ? '🔥 공격형' : '🛡️ 안정형') + ' · ' + (stratKey() === 'swing' ? '스윙형' : '추세형') };
    }
    if (rule !== 'auto') {
      var s = MH_RULES[rule];
      return { mode: 'pick', rule: rule, profile: s.profile, strat: s.strat, ko: s.tag };
    }
    var b = mhBestPeek(it.t);
    if (b === undefined) { mhOptAsk(it.t); return { mode: 'auto', rule: 'auto', pend: true }; }
    if (!b) return { mode: 'auto', rule: 'auto', pend: true };       /* 데이터 없음 → 진단도 없음 */
    if (!b.best) return { mode: 'auto', rule: 'auto', pend: true };
    return { mode: 'auto', rule: 'auto', best: b, short: !!b.short, profile: MH_RULES[b.best.rule].profile,
      strat: MH_RULES[b.best.rule].strat, ko: b.best.ko, ret: b.best.ret, period: b.best.period,
      fair: mhFairOf(b.best), med: b.best.med, closed: b.best.closed, samples: b.best.samples };
  }
  /* 💡 추천 — 4조합 1등이 지금 기준보다 **중앙 연환산(CAGR)**으로 5%p 이상 앞설 때만
     · 2026-11-28 강화: 1등은 청산 표본 2건 이상이어야 하고, 1등 조합의 다중 창(1M·3M·6M) 중
       **2창 이상에서도 현재 기준을 앞서야** 띄운다(한 달 우연으로 바뀌는 추천 방지). */
  function mhRecoOf(it) {
    var rule = mhRuleOf(it);
    if (rule === 'auto') return null;
    var opt = mhBestPeek(it.t);
    if (opt === undefined) { mhOptAsk(it.t); return null; }
    if (!opt || !opt.best || opt.best.rule === rule) return null;
    var curRow = null;
    opt.all.forEach(function (r) { if (r.rule === rule) curRow = r; });
    if (!curRow) return null;
    var fb = opt.best.med, fc = curRow.med;
    if (fb == null) return null;                              /* 후보 표본 없음 → 추천 금지 */
    if (fc == null) fc = mhFairOf(curRow);                     /* 현재 기준 표본 없음 → 고유 창 연환산으로 대신 */
    if (!(fb - fc >= MH_RECO_GAP)) return null;
    if (opt.best.closed < MH_RECO_SAMPLE) return null;         /* 청산 표본 2건 미만 → 추천 금지 */
    /* 합의 — 후보 조합의 각 창에서 현재 기준보다 앞섰는지 센다 */
    var agree = 0, need = Math.min(MH_RECO_AGREE, opt.best.wins.length);
    opt.best.wins.forEach(function (w) {
      var cw = null;
      curRow.wins.forEach(function (x) { if (x.bars === w.bars) cw = x; });
      var cf = cw && cw.fair != null ? cw.fair : fc;
      if (w.fair != null && w.fair > cf) agree++;
    });
    if (agree < need && opt.best.wins.length > 1) return null;
    return { rule: opt.best.rule, ko: opt.best.ko, best: opt.best.ret, cur: curRow.ret,
      bestFair: fb, curFair: fc, gap: fb - fc, agree: agree, wins: opt.best.wins.length,
      closed: opt.best.closed, period: opt.best.period, curPeriod: curRow.period };
  }

  /* 한 종목 진단 — 평단·수량·매수일 + 기준(성향·전략) 규칙 → 배지·자동 손절·청산 기준 */
  function mhDiag(it, basis) {
    if (!basis || basis.pend) return null;
    var a = A[it.t];
    if (!a || !a.close || a.close.length < 2 || !a.ind) return null;
    var n = a.close.length, i = n - 1;
    var price = a.close[i], asof = a.dates[i];
    var rp = riskParams(basis.profile);
    var sw = rp.swing || {}, tr = rp.trend || {};
    var swing = basis.strat === 'swing';
    var ei = mhBarIdx(a, it.d);
    var atrS = a.ind.atr || [];
    var atr0 = (ei > 0 && atrS[ei - 1] > 0) ? atrS[ei - 1] : (atrS[ei] > 0 ? atrS[ei] : price * 0.02);
    var atrNow = atrS[i] > 0 ? atrS[i] : atr0;
    var avg = it.avg, qty = it.qty;
    var val = price * qty, cost = avg * qty, pnlUsd = val - cost, pnl = price / avg - 1;
    var holdDays = Math.max(0, i - ei);
    var ma20 = a.ind.ma20 ? a.ind.ma20[i] : null;
    var below = 0;                                    /* 20일선 아래 연속 종가 일수 */
    if (ma20 != null && a.ind.ma20) {
      for (var k = i; k >= 0; k--) {
        var m = a.ind.ma20[k];
        if (m == null || a.close[k] >= m) break;
        below++;
      }
    }
    var d = { price: price, asof: asof, val: val, cost: cost, pnlUsd: pnlUsd, pnl: pnl,
      holdDays: holdDays, atr: atrNow, ma20: ma20, below: below, swing: swing,
      dateGap: (it.d && a.dates.indexOf(it.d) < 0) ? ('매수일 ' + it.d + '은(는) 거래일이 아니어서 ' + a.dates[ei] + ' 종가 기준으로 계산했습니다') : '' };
    var stopAtr = swing ? (sw.stopAtr == null ? 4.5 : sw.stopAtr) : (tr.stopAtr == null ? 6 : tr.stopAtr);
    var stopCap = sw.stopCap == null ? 0.10 : sw.stopCap;

    if (swing) {
      /* 스윙 — 두 손절선 중 더 가까운(높은) 가격 */
      var stop = Math.max(avg - stopAtr * atr0, avg * (1 - stopCap));
      var gate = sw.ma20Gate == null ? 0.05 : sw.ma20Gate;
      var need = sw.ma20Confirm > 0 ? sw.ma20Confirm : 2;
      var gap = (price - stop) / price;
      d.stop = stop;
      d.exit = [
        { k: pnl >= gate ? 'ok' : 'no', t: '+' + Math.round(gate * 100) + '% ' + (pnl >= gate ? '도달' : '미달') + (pnl >= gate ? '' : ' (' + pct(pnl, 1) + ')') },
        { k: ma20 == null ? 'neu' : (price >= ma20 ? 'ok' : (below >= need ? 'no' : 'neu')),
          t: ma20 == null ? '20일선 —' : (price >= ma20 ? '20일선 위' : '20일선 아래 ' + below + '일') }
      ];
      if (price <= stop) {
        d.badge = 'sell';
        d.reason = '현재가 ' + usd(price) + '가 자동 손절 <b>' + usd(stop) + '</b> 아래 — 평단 −' + stopAtr + ' ATR과 −' + Math.round(stopCap * 100) + '% 중 가까운 선에 닿았습니다. 규칙대로면 <b>다음 시가 청산</b>입니다.';
      } else if (pnl >= gate && below >= need) {
        d.badge = 'sell';
        d.reason = '이익 ' + pct(pnl, 1) + '(＋' + Math.round(gate * 100) + '% 이상) 상태에서 <b>20일선 아래 ' + below + '거래일 연속</b> — 스윙 청산 조건(' + need + '일 확인)이 충족됐습니다.';
      } else if (pnl >= gate && below >= 1) {
        d.badge = 'warn';
        d.reason = '이익 ' + pct(pnl, 1) + ' 상태에서 20일선 아래 <b>' + below + '거래일째</b> — 내일도 20일선 아래로 마감하면 청산 신호입니다.';
      } else if (gap <= 0.03) {
        d.badge = 'warn';
        d.reason = '자동 손절 ' + usd(stop) + '까지 <b>' + (gap * 100).toFixed(1) + '%</b> — 손절선에 근접했습니다.';
      } else {
        d.badge = 'hold';
        d.reason = '자동 손절 ' + usd(stop) + ' 위 <b>' + (gap * 100).toFixed(1) + '%</b> 여유' +
          (pnl >= gate ? ' · 20일선도 위 — 청산 조건 미발동' : ' · 이익 +' + Math.round(gate * 100) + '% 미만이라 20일선 청산 규칙은 아직 적용 전') + '.';
      }
    } else {
      /* 추세 — 평단 −6 ATR 손절 + (진입가 +6 ATR 도달 후) 고점 −10 ATR 트레일 */
      var stop0 = avg - stopAtr * atr0;
      var arm = avg + (tr.trailStartAtr == null ? 6 : tr.trailStartAtr) * atr0;
      var trailAtr = tr.trailAtr == null ? 10 : tr.trailAtr;
      var peak = a.series.h[ei] == null ? price : a.series.h[ei], trail = null;
      for (var j = ei; j < n; j++) {
        var hj = a.series.h[j]; if (hj > peak) peak = hj;
        if (peak > arm) {
          var an = atrS[j] > 0 ? atrS[j] : atr0, t2 = peak - trailAtr * an;
          if (trail == null || t2 > trail) trail = t2;
        }
      }
      var stop = trail != null ? Math.max(stop0, trail) : stop0;
      var minHold = tr.minHold == null ? 3 : tr.minHold;
      var tp = a.trendPlan || {};
      var mktRisk = tp.tw === 0, mktCaution = tp.tw != null && tp.tw > 0 && tp.tw < 1;
      var panicDay = tp.qqqRsi2 != null && tp.panicExitRsi != null && tp.qqqRsi2 < tp.panicExitRsi;
      var gap2 = (price - stop) / price;
      d.stop = stop;
      d.exit = [
        { k: trail == null ? 'neu' : 'ok', t: trail == null ? '트레일 대기 (고점 ' + usd(peak) + ')' : '트레일 ' + usd(trail) },
        { k: tp.qqqMa == null ? 'neu' : (mktRisk ? 'no' : (mktCaution ? 'neu' : 'ok')),
          t: tp.qqqMa == null ? 'QQQ 100일선 —' : ('QQQ 100일선 ' + (mktRisk ? '아래' : (mktCaution ? '이탈 주의' : '위'))) }
      ];
      if (price <= stop0) {
        d.badge = 'sell';
        d.reason = '현재가 ' + usd(price) + '가 손절 <b>' + usd(stop0) + '</b>(평단 −' + stopAtr + ' ATR) 아래 — 추세형 손절 조건입니다.';
      } else if (trail != null && price <= trail) {
        d.badge = 'sell';
        d.reason = '현재가 ' + usd(price) + '가 트레일 스탑 <b>' + usd(trail) + '</b>(고점 ' + usd(peak) + ' − ' + trailAtr + ' ATR) 아래 — 추세형 청산 조건입니다.';
      } else if (mktRisk) {
        /* 매수일을 모르면 최소 보유 예외를 적용하지 않는다 — 예외가 영원히 걸려 청산 신호를
           가리는 것보다, 규칙대로 청산 신호를 보여 주고 매수일 입력을 권하는 편이 정직하다. */
        if (holdDays < minHold && it.d) {
          d.badge = 'warn';
          d.reason = 'QQQ가 100일선 아래(시장 위험)지만 보유 <b>' + holdDays + '/' + minHold + '거래일</b> — 최소 보유 규칙 때문에 청산은 아직 보류입니다.';
        } else if (panicDay) {
          d.badge = 'warn';
          d.reason = 'QQQ 100일선 아래지만 QQQ RSI(2) <b>' + tp.qqqRsi2.toFixed(1) + '</b> 극단 공포일 — 규칙상 청산을 다음 날로 미룹니다.';
        } else {
          d.badge = 'sell';
          d.reason = 'QQQ가 100일선 아래 — 추세형 시장 필터에 따라 <b>전량 청산</b> 규칙이 발동했습니다.';
        }
      } else if (gap2 <= 0.03) {
        d.badge = 'warn';
        d.reason = '손절·트레일 ' + usd(stop) + '까지 <b>' + (gap2 * 100).toFixed(1) + '%</b> — 청산선에 근접했습니다.';
      } else {
        d.badge = 'hold';
        d.reason = '손절·트레일 ' + usd(stop) + ' 위 <b>' + (gap2 * 100).toFixed(1) + '%</b> 여유' +
          (trail == null ? ' · 트레일은 진입가 +' + (tr.trailStartAtr == null ? 6 : tr.trailStartAtr) + ' ATR($' + arm.toFixed(2) + ') 도달 후 작동' : '') +
          (mktCaution ? ' · 다만 시장은 주의(절반 비중) 단계입니다' : '') + '.';
      }
    }
    return d;
  }

  function mhStats() {
    var st = { n: myhold.items.length, dn: 0, mv: 0, cost: 0, pnl: 0, ret: 0, red: 0, yel: 0, grn: 0,
      pend: 0, autoN: 0, pickN: 0, rows: [] };
    myhold.items.forEach(function (it) {
      var b = mhBasisOf(it);
      var d = mhDiag(it, b);
      var r = { it: it, d: d, b: b, pend: false, reco: null };
      if (!d && b && b.pend && A[it.t]) { r.pend = true; st.pend++; }
      if (b && !b.pend) { if (b.mode === 'auto') st.autoN++; else if (b.mode === 'pick') st.pickN++; }
      r.reco = mhRecoOf(it);
      st.rows.push(r);
      if (!d) return;
      st.dn++;
      st.mv += d.val; st.cost += d.cost;
      if (d.badge === 'sell') st.red++; else if (d.badge === 'warn') st.yel++; else st.grn++;
    });
    st.pnl = st.mv - st.cost;
    st.ret = st.cost ? st.mv / st.cost - 1 : 0;
    return st;
  }

  function mhSumHtml(st) {
    var have = st.dn > 0;
    var judge = have ? ('🟢 ' + st.grn + ' · 🟡 ' + st.yel + ' · 🔴 ' + st.red + (st.pend ? ' · ⏳ ' + st.pend : '')) : '—';
    var auto = myhold.mode === 'auto';
    var basisV = auto ? '⚡ 수익최적 자동' : '🎛️ 내 성향 기준';
    var basisS = auto ? '종목별 설정 (자동 포함)'
      : ('내 성향 기준 · ' + (riskAggr() ? '공격형' : '안정형') + ' · ' + (stratKey() === 'swing' ? '스윙형' : '추세형'));
    var basisT = auto
      ? ('⚡ 자동 ' + st.autoN + '종목 · 직접 지정 ' + st.pickN + '종목 — 자동은 4조합(추세 1Y · 스윙 1M/3M/6M)을 연환산(CAGR) 중앙값으로 비교하고, 청산 표본이 있는 조합 중 가장 앞선 것을 적용합니다. 카드 옆 표본 N건(청산)은 1등 판정에 쓰인 청산 거래 수입니다')
      : '내 성향(성향·전략 버튼)의 규칙을 모든 종목에 똑같이 적용합니다 (카드에 저장된 매수 기준은 그대로 유지)';
    return '<div class="c"><div class="k">총 평가금액</div><div class="v">' + (have ? usd(st.mv, 2) : '—') + '</div>' +
      '<div class="s">' + (st.n ? '보유 ' + st.n + '종목 · 매입 ' + usd(st.cost, 2) : '아직 등록한 종목이 없습니다') + '</div></div>' +
      '<div class="c"><div class="k">총 손익</div><div class="v ' + (have ? cls(st.pnl) : '') + '">' + (have ? sgn(st.pnl) : '—') + '</div>' +
      '<div class="s">' + (have ? pct(st.ret, 2) + ' (매입 대비)' : '평가손익 합계') + '</div></div>' +
      '<div class="c"><div class="k">오늘 판단</div><div class="v sm">' + judge + '</div>' +
      '<div class="s">' + (have ? '홀드 ' + st.grn + ' · 주의 ' + st.yel + ' · 매도·청산 ' + st.red : '등록하면 자동 계산') + '</div></div>' +
      '<div class="c"><div class="k">적용 기준</div><div class="v sm" title="' + mhEsc(basisT) + '">' + basisV + '</div>' +
      '<div class="s" title="기준일 ' + M.asOf + ' 종가">' + basisS + '</div></div>';
  }

  /* ---------------- 카드 — 기준 배지·인라인 기준 변경·💡 추천 칩 ---------------- */
  function mhRuleSelect(t, cur) {
    return '<select class="mh-rsel" data-mhr="' + mhEsc(t) + '" title="이 종목의 매수 기준(전략)을 바꿉니다 — 바꾸면 바로 다시 진단합니다" aria-label="' + mhEsc(t) + ' 매수 기준">' +
      MH_RULE_KEYS.map(function (k) {
        return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + MH_RULES[k].ko + '</option>';
      }).join('') + '</select>';
  }
  function mhBasisCell(r) {
    var it = r.it, b = r.b, cur = mhRuleOf(it), cls2 = 'none', txt = '기준 없음', tip = '', samp = '';
    var opt = mhBestPeek(it.t);
    function sampOf(rule) {
      if (!opt || !opt.all) return null;
      var row = null;
      opt.all.forEach(function (x) { if (x.rule === rule) row = x; });
      if (!row) return null;
      var short = row.closed < MH_SAMPLE_MIN;
      return '<i class="mh-samp' + (short ? ' short' : '') + '" title="1등 판정에 쓰인 청산 거래 수 — 21·63·126일 창의 합계(청산 0건 조합은 1등 후보에서 제외)">' +
        (short ? '표본 부족' : ('표본 ' + row.closed + '건(청산)')) + '</i>';
    }
    if (r.pend) { cls2 = 'pend'; txt = '⏳ 4조합 계산 중…'; tip = '4조합(안정·공격 × 추세·스윙)을 돌리는 중입니다 — 추세 1Y · 스윙 1M/3M/6M 중앙값'; }
    else if (!b) { cls2 = 'none'; txt = '기준 없음'; }
    else if (b.mode === 'screen') { cls2 = 'screen'; txt = '🎛️ 내 성향 기준 · ' + b.ko; tip = '내 성향(성향·전략 버튼) 규칙을 따릅니다 — 저장된 매수 기준: ' + MH_RULES[cur].ko; }
    else if (b.mode === 'auto') {
      cls2 = 'auto';
      txt = '⚡ 자동 → ' + b.ko + ' (' + (b.period || '1Y') + ' ' + pct(b.ret, 1) + ' · 중앙 연 ' + mhFairPct(b.med == null ? b.fair : b.med, 0) + ')';
      tip = '4조합을 연환산(CAGR)으로 공정 비교한 1등 — ' + b.ko + ' · ' + (b.period || '1Y') + ' ' + pct(b.ret, 2) +
        ' · 중앙 연 ' + mhFairPct(b.med == null ? b.fair : b.med, 1) +
        ' (스윙은 1M·3M·6M 세 창의 중앙값 · 청산 표본 ' + (b.closed == null ? '—' : b.closed) + '건)' +
        (b.short ? ' · ⚠️ 청산 표본이 0건이라 1등 판정이 미실현 평가에만 근거합니다(표본 부족)' : '') +
        ' · 비교 근거: ' + mhFairTable(it.t);
      samp = sampOf(b.best && b.best.best ? b.best.best.rule : cur);
    }
    else { cls2 = 'pick'; txt = '매수 기준: ' + b.ko; tip = '직접 고른 기준 — ' + (b.strat === 'swing' ? '스윙형' : '추세형') + ' · ' + (b.profile === 'aggr' ? '공격형' : '안정형') + ' 규칙으로 진단합니다'; samp = sampOf(cur); }
    return '<div class="mhbasis">' + mhRuleSelect(it.t, cur) +
      '<span class="mhb-badge ' + cls2 + '" title="' + mhEsc(tip) + '">' + txt + '</span>' + samp + '</div>';
  }

  function mhRowHtml(r) {
    var it = r.it, t = it.t, d = r.d, meta = info(t) || {};
    var head = '<div class="mh-row' + (state.cur === t ? ' on' : '') + '" data-t="' + t + '" role="button" tabindex="0" aria-label="' + t + ' 차트 열기">';
    var act = '<div class="mhact"><button type="button" data-mh="chart" title="위 메인 차트를 이 종목으로 엽니다">차트</button>' +
      '<button type="button" data-mh="edit" title="평단·수량·매수일·메모·매수 기준을 고칩니다">수정</button>' +
      '<button type="button" data-mh="del" title="이 종목을 목록에서 지웁니다">삭제</button></div>';
    var tk = '<div class="mhtk"><b>' + mhEsc(t) + '</b><i>' + mhEsc(meta.n || '') + ' · ' + qty2(it.qty) + '주' +
      (it.d ? ' · ' + it.d.slice(5) + ' 매수' : '') + '</i>' + (it.memo ? '<em>' + mhEsc(it.memo) + '</em>' : '') + '</div>';
    var basis = mhBasisCell(r);
    /* 계산 대기 — 종목은 있는데 4조합 백테스트를 아직 돌리는 중 */
    if (r.pend) {
      var pen = A[t] ? A[t].close[A[t].close.length - 1] : null;
      return head +
        '<div class="mhb"><span class="mh-badge pend">⏳ 계산 중</span></div>' + tk + basis +
        '<div class="mhc mh-px"><span class="lbl">현재가</span><b>' + usd(pen) + '</b><i>평단 ' + usd(it.avg) + '</i></div>' +
        '<div class="mhc mh-pnl"><span class="lbl">평가손익</span><b>—</b><i>계산 중</i></div>' +
        '<div class="mhc mh-stp"><span class="lbl">자동 손절</span><b>—</b><i>—</i></div>' +
        '<div class="mhrule"><span class="neu">⏳ 4조합 백테스트 계산 중</span></div>' + act +
        '<div class="mh-why">선택한 기준의 백테스트(추세 1Y · 스윙 1M/3M/6M)를 돌려 손절·청산 기준을 계산하는 중입니다. 잠시 뒤 자동으로 채워집니다.</div>' +
        '</div>';
    }
    if (!d) {
      return head +
        '<div class="mhb"><span class="mh-badge warn">데이터 없음</span></div>' + tk + basis +
        '<div class="mhc mh-px"><span class="lbl">평단</span><b>' + usd(it.avg) + '</b><i>현재가 —</i></div>' +
        '<div class="mhc mh-pnl"><span class="lbl">평가손익</span><b>—</b><i>계산 불가</i></div>' +
        '<div class="mhc mh-stp"><span class="lbl">자동 손절</span><b>—</b><i>—</i></div>' +
        '<div class="mhrule"><span class="neu">진단 없음</span></div>' + act +
        '<div class="mh-why">이 종목은 분석기 데이터(Top 150)에 없어 손절·청산 기준을 계산할 수 없습니다. 목록에서 지우고 목록에 있는 종목으로 다시 등록해 주세요.</div>' +
        '</div>';
    }
    var bd = { hold: ['hold', '🟢 홀드'], warn: ['warn', '🟡 손절 주의'], sell: ['sell', '🔴 매도·청산 신호'] }[d.badge] || ['hold', '🟢 홀드'];
    var chips = d.exit.map(function (c) { return '<span class="' + c.k + '">' + c.t + '</span>'; }).join('');
    var reco = r.reco ? '<div class="mh-why-reco"><button type="button" class="mh-reco" data-mh="reco" data-rule="' + r.reco.rule + '" title="이 종목의 매수 기준을 ' + r.reco.ko + '으로 바꿉니다 — 중앙 연환산 공정 비교 연 ' + mhFairPct(r.reco.bestFair, 1) + ' vs 연 ' + mhFairPct(r.reco.curFair, 1) + ' · 청산 표본 ' + r.reco.closed + '건 · ' + r.reco.wins + '창 중 ' + r.reco.agree + '창 우위">' +
      '💡 추천: ' + r.reco.ko + ' (' + r.reco.period + ' ' + pct(r.reco.best, 1) + ' ≒ 중앙 연 ' + mhFairPct(r.reco.bestFair, 0) + ' vs 현재 ' + r.reco.curPeriod + ' ' + pct(r.reco.cur, 1) + ' · 표본 ' + r.reco.closed + '건) 전환</button></div>' : '';
    var why = (r.b && r.b.mode === 'auto' ? '⚡ 4조합 중 최고(' + r.b.ko + ' · ' + (r.b.period || '1Y') + ' ' + pct(r.b.ret, 1) + ' · 중앙 연 ' + mhFairPct(r.b.med == null ? r.b.fair : r.b.med, 1) + ')' + (r.b.short ? ' ※청산 표본 0건 — 표본 부족' : '') + ' 기준 — ' : '') + d.reason;
    return head +
      '<div class="mhb"><span class="mh-badge ' + bd[0] + '">' + bd[1] + '</span></div>' + tk + basis +
      '<div class="mhc mh-px"><span class="lbl">현재가</span><b>' + usd(d.price) + '</b><i>평단 ' + usd(it.avg) + '</i></div>' +
      '<div class="mhc mh-pnl ' + cls(d.pnlUsd) + '"><span class="lbl">평가손익</span><b>' + sgn(d.pnlUsd) + '</b><i>' + pct(d.pnl, 2) + ' · ' + usd(d.val) + '</i></div>' +
      '<div class="mhc mh-stp"><span class="lbl">자동 손절</span><b>' + usd(d.stop) + '</b><i title="평단 대비 ' + pct(d.stop / it.avg - 1, 1) + ' · 현재가 대비 ' + pct(d.stop / d.price - 1, 1) + '">' +
        (d.stop >= d.price ? '이탈 · ' : (d.stop >= it.avg ? '이익보호 · ' : '')) + '현재가 ' + pct(d.stop / d.price - 1, 1) + '</i></div>' +
      '<div class="mhrule">' + chips + '</div>' + act +
      '<div class="mh-why">' + reco + why + (d.dateGap ? ' <b>' + d.dateGap + '</b>' : '') + '</div>' +
      '</div>';
  }

  function mhFootHtml() {
    var auto = myhold.mode === 'auto';
    var head = '<b>' + (auto ? '종목별 매수 기준'
      : '내 성향 기준 · ' + (riskAggr() ? '공격형' : '안정형') + ' · ' + (stratKey() === 'swing' ? '스윙형' : '추세형')) +
      '</b>으로 ' + M.asOf + ' 종가 기준 계산 — ';
    var body = auto
      ? '<b>⚡ 수익최적 자동</b>은 <b>추세형 1Y(최근 1년·252거래일)</b>와 <b>스윙형 1M·3M·6M(21·63·126거래일)</b> 백테스트를 돌려, 4조합을 <b>연환산(CAGR) 중앙값</b>으로 같은 잣대에서 견줘 가장 앞선 조합을 그 종목에 적용합니다 — <b>청산 거래가 0건인 조합은 1등 후보에서 제외</b>하고, 카드 옆에 <b>표본 N건(청산)</b>을 항상 적습니다. 스윙 수치는 <b>1M 수익률을 그대로 1년으로 환산한 ‘이번 달 속도’</b>이므로 한 달 표본의 우연을 줄이라고 1M·3M·6M 중앙값으로 판정합니다. 카드의 <b>기준 선택</b>으로 직접 고르면 그 규칙을 따르고, 1등이 중앙 연환산으로 <b>5%p 이상</b> 앞서고 <b>청산 표본 2건 이상 · 3창 중 2창 합의</b>가 있을 때만 <b>💡 추천</b> 칩이 뜹니다.'
      : '지금 화면에서 고른 <b>내 성향(성향·전략 버튼)</b>의 규칙을 모든 종목에 똑같이 적용합니다 — 카드에 저장된 매수 기준은 그대로 남아 있어 <b>⚡ 수익최적 자동</b>으로 돌아오면 다시 쓰입니다.';
    return head + body + ' <b>매수·매도 주문은 하지 않고</b> 실제 계좌·증권사와 연동하지 않는 참고용 진단입니다.';
  }

  function mhBasisSync() {
    var box = $('#mhBasis');
    if (!box) return;
    $$('button[data-mbmode]', box).forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-mbmode') === myhold.mode);
      b.setAttribute('aria-pressed', b.getAttribute('data-mbmode') === myhold.mode ? 'true' : 'false');
    });
    var nt = $('#mhBasisNote');
    if (nt) nt.textContent = myhold.mode === 'auto' ? '종목별 4조합 최고 · 표본은 청산 기준' : '내 성향 그대로';
    var sp = $('#mhSpeedNote');
    if (sp) sp.innerHTML = '스윙 1M은 <b>‘이번 달 속도’</b> — 21·63·126일 중앙값으로 판정 · 추세 1Y는 252일 고유 창';
  }

  function mhRender() {
    var host = $('#mhList');
    if (!host) return;
    var st = mhStats();
    var sum = $('#mhSum');
    if (sum) sum.innerHTML = mhSumHtml(st);
    var tn = $('#mhTabN');
    if (tn) tn.textContent = String(myhold.items.length);
    var foot = $('#mhFoot');
    if (foot) foot.innerHTML = mhFootHtml();
    mhBasisSync();
    if (!bootReady) {
      host.innerHTML = '<div class="mh-empty">데이터를 계산하는 중입니다…</div>';
      return;
    }
    if (!myhold.items.length) {
      host.innerHTML = '<div class="mh-empty">아직 등록한 종목이 없습니다.<br>위에서 <b>종목 · 평균단가 · 보유 수량</b>을 넣고 <kbd>＋ 추가</kbd>를 누르거나,<br><b>예시 채우기</b>로 먼저 둘러보세요. 등록한 종목은 이 브라우저에만 저장됩니다.</div>';
      return;
    }
    host.innerHTML = st.rows.map(mhRowHtml).join('');
  }

  /* ---------------- 탭 전환 ---------------- */
  function mhTab(which, persist) {
    var tab = which === 'paper' ? 'paper' : 'hold';
    myhold.tab = tab;
    var hold = tab === 'hold';
    var hp = $('#mhPane'), pp = $('#ptPane');
    if (hp) hp.hidden = !hold;
    if (pp) pp.hidden = hold;
    $$('#mhTabs button[data-mtab]').forEach(function (b) {
      var on = b.getAttribute('data-mtab') === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var ti = $('#pcTitle'), bp = $('#ptBadge'), s1 = $('#pcSubPaper'), s2 = $('#pcSubHold'), ac = $('#ptAcct'), note = $('#mhTabNote');
    if (ti) ti.textContent = hold ? '실전 보유 관리' : '가상투자 · 모의매매';
    if (bp && hold) { bp.textContent = 'MY HOLD'; bp.classList.remove('replay'); }
    if (s1) s1.hidden = hold;
    if (s2) s2.hidden = !hold;
    if (ac) ac.hidden = hold;
    if (note) note.textContent = hold ? '실전 기록 · 자동 진단' : '체결 시뮬레이션 · 실제 주문 아님';
    if (!hold && bootReady) ptRender();
    if (persist !== false) mhSave();
  }

  /* ---------------- 등록 · 수정 · 삭제 ---------------- */
  function mhResetForm(clearMsg) {
    mhEdit = '';
    ['#mhSym', '#mhAvg', '#mhQty', '#mhDate', '#mhMemo'].forEach(function (s) { var el = $(s); if (el) el.value = ''; });
    var rl = $('#mhRule'); if (rl) rl.value = 'auto';
    var add = $('#mhAdd'), cx = $('#mhCancel');
    if (add) add.textContent = '＋ 추가';
    if (cx) cx.hidden = true;
    if (clearMsg) mhMsg('');
  }
  function mhEditStart(t) {
    var it = mhItem(t);
    if (!it) return;
    mhEdit = t;
    $('#mhSym').value = it.t;
    $('#mhAvg').value = String(it.avg);
    $('#mhQty').value = String(it.qty);
    $('#mhDate').value = it.d || '';
    $('#mhMemo').value = it.memo || '';
    var rl = $('#mhRule'); if (rl) rl.value = mhRuleOf(it);
    var add = $('#mhAdd'), cx = $('#mhCancel');
    if (add) add.textContent = '수정 저장';
    if (cx) cx.hidden = false;
    mhMsg(t + ' 수정 중 — 값을 고치고 [수정 저장]을 누르세요');
    var f = $('#mhForm');
    if (f && f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var av = $('#mhAvg'); if (av) av.focus();
  }
  function mhSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    var t = String(($('#mhSym') || {}).value || '').trim().toUpperCase();
    var avg = Number(($('#mhAvg') || {}).value);
    var qty = Number(($('#mhQty') || {}).value);
    var d = String(($('#mhDate') || {}).value || '').slice(0, 10);
    var memo = String(($('#mhMemo') || {}).value || '').trim().slice(0, 40);
    var rule = String(($('#mhRule') || {}).value || 'auto');
    if (!MH_RULES[rule]) rule = 'auto';
    if (!t) return mhMsg('종목을 입력해 주세요 — 목록에서 고르거나 티커를 직접 넣습니다 (예: MSFT)', 'err');
    if (!A[t] || !info(t)) return mhMsg('"' + mhEsc(t) + '"은(는) Top 150 목록에 없습니다 — 티커를 확인해 주세요', 'err');
    if (!isFinite(avg) || !(avg > 0)) return mhMsg('매수 평균단가를 $0보다 크게 입력해 주세요', 'err');
    if (!isFinite(qty) || !(qty > 0)) return mhMsg('보유 수량을 0보다 크게 입력해 주세요', 'err');
    var cur = mhItem(mhEdit);
    var dup = mhItem(t);
    if (mhEdit && cur) {
      if (dup && dup !== cur) {                      /* 티커까지 바뀌어 이미 있는 종목과 겹치면 합산 */
        var nq0 = dup.qty + qty;
        dup.avg = (dup.avg * dup.qty + avg * qty) / nq0;
        dup.qty = nq0;
        dup.rule = rule;
        if (d && (!dup.d || d < dup.d)) dup.d = d;
        if (memo) dup.memo = memo;
        myhold.items = myhold.items.filter(function (x) { return x !== cur; });
        mhSave(); mhRender(); mhResetForm(true);
        return mhMsg(t + ' 기존 보유와 합산했습니다 — ' + qty2(dup.qty) + '주 · 평단 ' + usd(dup.avg), 'ok');
      }
      cur.t = t; cur.avg = avg; cur.qty = qty; cur.d = d; cur.memo = memo; cur.rule = rule;
      mhSave(); mhRender(); mhResetForm(true);
      return mhMsg(t + ' 수정을 저장했습니다 — ' + qty2(qty) + '주 · 평단 ' + usd(avg) + ' · ' + MH_RULES[rule].ko, 'ok');
    }
    if (dup) {                                        /* 같은 종목을 또 등록하면 평단 가중평균으로 합산 */
      var nq = dup.qty + qty;
      var na = (dup.avg * dup.qty + avg * qty) / nq;
      dup.avg = na; dup.qty = nq;
      if (d && (!dup.d || d < dup.d)) dup.d = d;
      if (memo) dup.memo = memo;
      mhSave(); mhRender(); mhResetForm(true);
      return mhMsg(t + ' 기존 보유와 합산 — ' + qty2(dup.qty) + '주 · 평단 ' + usd(dup.avg) + ' (가중평균)', 'ok');
    }
    if (myhold.items.length >= MH_MAX) return mhMsg('한 번에 ' + MH_MAX + '종목까지 등록할 수 있습니다 — 쓰지 않는 종목을 지우고 다시 시도해 주세요', 'err');
    myhold.items.push({ t: t, avg: avg, qty: qty, rule: rule, d: d, memo: memo });
    mhSave(); mhRender(); mhResetForm(true);
    mhMsg(t + ' ' + qty2(qty) + '주 · 평단 ' + usd(avg) + ' · ' + MH_RULES[rule].ko + ' 등록 완료 — 아래에서 오늘 진단을 확인하세요', 'ok');
  }
  function mhDelete(t) {
    var it = mhItem(t);
    if (!it) return;
    if (!window.confirm(t + ' ' + qty2(it.qty) + '주 · 평단 ' + usd(it.avg) + ' 기록을 목록에서 지웁니다.\n(실제 계좌·증권사에는 아무 영향이 없습니다)')) return;
    myhold.items = myhold.items.filter(function (x) { return x.t !== t; });
    if (mhEdit === t) mhResetForm(true);
    mhSave(); mhRender();
    mhMsg(t + ' 기록을 지웠습니다', 'ok');
  }
  function mhResetAll() {
    if (!myhold.items.length) return mhMsg('지울 기록이 없습니다');
    if (!window.confirm('등록한 보유 종목 ' + myhold.items.length + '개를 모두 지웁니다. 계속할까요?')) return;
    myhold.items = [];
    mhResetForm(true); mhSave(); mhRender();
    mhMsg('등록한 보유 종목을 모두 지웠습니다', 'ok');
  }
  /* 예시 채우기 — 시연용 2종목: 이익 중 1(🟢) + 손절선 아래 1(🔴).
     실제 계산값으로 상태를 만들기 위해 평단을 현재 규칙의 손절선에서 역산한다. */
  function mhSample() {
    if (!bootReady) return mhMsg('데이터 계산이 끝난 뒤에 다시 눌러 주세요', 'err');
    if (myhold.items.length && !window.confirm('지금 등록된 ' + myhold.items.length + '종목을 예시 2종목으로 바꿉니다. 계속할까요?')) return;
    var cands = M.tickers.filter(function (x) { return x.r != null && x.r <= 12 && A[x.t] && A[x.t].close.length > 700 && A[x.t].ind; });
    var good = null, bad = null, i;
    for (i = 0; i < cands.length && !good; i++) {
      var a = A[cands[i].t], li = a.close.length - 1, mm = a.ind.ma20[li];
      if (mm != null && a.close[li] > mm * 1.02) good = a;
    }
    for (i = 0; i < cands.length && !bad; i++) {
      var b = A[cands[i].t];
      if (good && b.sym === good.sym) continue;
      if (b.close.length > 700) bad = b;
    }
    var list = [];
    var swingNow = stratKey() === 'swing';
    var ruleNow = (riskProfile() === 'aggr' ? 'aggr_' : 'safe_') + (swingNow ? 'swing' : 'trend');
    if (good) {
      var gi = good.close.length - 1;
      /* 스윙은 40거래일 전 매수(🟢 홀드 예시), 추세는 1거래일 전 매수(최소 보유 3거래일 → 🟡 예시) */
      list.push({ t: good.sym, avg: Math.round(good.close[gi] * 0.93 * 100) / 100, qty: 20, rule: ruleNow,
        d: good.dates[Math.max(0, gi - (swingNow ? 40 : 1))],
        memo: swingNow ? '장기 보유 · 실적 발표 전 일부 매수' : '막 매수 — 최소 보유 규칙 확인용' });
    }
    if (bad) {
      var bi = bad.close.length - 1, bei = Math.max(0, bi - 20);
      var batr = (bad.ind.atr[bei > 0 ? bei - 1 : bei] > 0 ? bad.ind.atr[bei > 0 ? bei - 1 : bei] : bad.close[bi] * 0.02);
      var bp = bad.close[bi], bavg;
      if (stratKey() === 'swing') {
        var capS = (riskParams().swing || {}).stopCap; capS = capS == null ? 0.10 : capS;
        bavg = bp / 0.98 / (1 - capS);                 /* −상한 손절선의 2% 아래 현재가 */
      } else {
        var stA = (riskParams().trend || {}).stopAtr; stA = stA == null ? 6 : stA;
        bavg = bp / 0.98 + stA * batr;                 /* −6 ATR 손절선의 2% 아래 현재가 */
      }
      list.push({ t: bad.sym, avg: Math.round(bavg * 100) / 100, qty: 10, rule: ruleNow,
        d: bad.dates[bei], memo: '고점 추격 매수 — 손절선 점검용' });
    }
    if (!list.length) return mhMsg('예시로 쓸 종목을 찾지 못했습니다', 'err');
    myhold.items = list;
    mhResetForm(true); mhSave(); mhRender();
    mhMsg('예시 ' + list.length + '종목을 채웠습니다 — 진단은 실제 평단·종가로 계산한 값입니다', 'ok');
  }
  /* ============================================================
     ❓ 도움말 — 실전 보유 관리 FAQ 5문 5답 (2026-11-28)
     ------------------------------------------------------------
     · 기본은 접힘(#mhFaq hidden) — 도움말 버튼(#mhHelp)으로 펼친다
     · 답의 숫자는 전부 실제 엔진 파라미터(riskParams)에서 만든다 — 화면에 박지 않는다
     · 맨 아래는 회의실 안내 배너(hq/) — 질문 입력·복사 UI는 두지 않는다
     ============================================================ */
  function mhFaqItems() {
    var sp = riskParams('safe').swing || {}, ap = riskParams('aggr').swing || {};
    var tr = riskParams('safe').trend || {};
    var capS = Math.round((sp.stopCap == null ? 0.10 : sp.stopCap) * 100);
    var capA = Math.round((ap.stopCap == null ? 0.15 : ap.stopCap) * 100);
    var stopAtr = sp.stopAtr == null ? 4.5 : sp.stopAtr;
    var gate = Math.round((sp.ma20Gate == null ? 0.05 : sp.ma20Gate) * 100);
    var need = sp.ma20Confirm == null ? 2 : sp.ma20Confirm;
    var tStop = tr.stopAtr == null ? 6 : tr.stopAtr;
    var tStart = tr.trailStartAtr == null ? 6 : tr.trailStartAtr;
    var tTrail = tr.trailAtr == null ? 10 : tr.trailAtr;
    var tHold = tr.minHold == null ? 3 : tr.minHold;
    return [
      { q: '증권사 계좌와 연동되나요?',
        a: '아니요. 입력한 종목·평단·수량은 <b>내 기기 브라우저(localStorage)에만</b> 저장되고 실제 매매·주문·증권사 연동은 일어나지 않습니다. 로그인·계좌 비밀번호를 넣는 곳도 없고, 어떤 정보도 서버로 보내지 않습니다.' },
      { q: '🟢·🟡·🔴 판단 기준은 뭔가요?',
        a: '종목마다 고른 기준의 <b>실제 백테스트 규칙</b>으로 마지막 종가 기준 진단합니다.<br>· <b>스윙형</b>: 손절 max(평단 − ' + stopAtr + ' ATR, 평단 −' + capS + '%/공격형 −' + capA + '%) · 이익 +' + gate + '% 이상에서 20일선 아래 ' + need + '거래일 연속 마감 → 청산<br>· <b>추세형</b>: 손절 평단 − ' + tStop + ' ATR · 평단 +' + tStart + ' ATR 도달 후 고점 − ' + tTrail + ' ATR 트레일 · QQQ 100일선 아래면 전량 청산<br>· 🟢 여유 · 🟡 주의(청산선 3% 이내 또는 20일선 1일 이탈) · 🔴 규칙상 손절·청산 신호' },
      { q: '⚡ 수익최적 자동 vs 직접 선택 차이는?',
        a: '내가 산 의도(스윙/추세·안정/공격)가 있으면 <b>직접 고르고</b>, 잘 모르겠으면 <b>⚡ 수익최적 자동</b>이 4조합(안정·공격 × 추세·스윙)을 돌려 가장 앞선 조합을 골라 줍니다. 기간은 전략에 맞춰 <b>추세는 1Y(최근 1년·252거래일)</b>, <b>스윙은 1M·3M·6M(21·63·126거래일)</b> 세 창을 돌리고, 배지에는 대표 창(<b>추세 1Y · 스윙 1M</b>)과 1등 판정에 쓰인 <b>표본 N건(청산)</b>을 적습니다. 승부는 <b>연환산(CAGR) 중앙값</b>으로 가립니다 — 추세 1Y는 그대로 연 수익률, 스윙은 세 창을 각각 1년으로 환산한 값의 중앙값이라(1Y +50%와 1M +4%를 그대로 비교해 스윙이 늘 지는 일이 없습니다) 한 달 우연이 1등을 바꾸지 않고, 스윙이 실제로 유리한 종목은 스윙이 정상 추천됩니다. 청산 거래가 0건인 조합은 1등 후보에서 빠지고 카드에 <b>표본 부족</b>으로 표시됩니다. 직접 고른 경우에도 1등이 중앙 연환산으로 <b>5%p 이상</b> 앞서고 <b>청산 표본 2건 이상 · 3창 중 2창 합의</b>가 있으면 카드에 <b>💡 추천 · 전환</b> 칩이 떠서 한 번에 바꿀 수 있습니다. 공격형은 <b>스윙 손절 상한(−' + capA + '%)·손절 후 재진입 금지(0일)</b>만 바꾸므로, 추세형 두 조합은 1Y 성과가 같아 자동에서는 <b>안정·추세</b>로 표시됩니다.' },
      { q: '매수일은 왜 입력하나요?',
        a: '추세형의 <b>최소 ' + tHold + '거래일 보유 예외</b>와 <b>매수 후 최고가</b>(트레일 손절선: 고점 − ' + tTrail + ' ATR)를 정확히 계산하기 위해서입니다. 비워 두어도 진단은 되지만, 이 두 가지가 빠져 규칙보다 일찍 청산 신호가 보일 수 있습니다. 휴장일에 매수했다면 그 다음 거래일 종가 기준으로 계산하고 화면에 그 사실을 적습니다.' },
      { q: '다른 기기(폰↔PC)로 옮기려면?',
        a: '카드 오른쪽 위 <b>백업 내보내기</b>로 JSON 파일을 저장한 뒤, 다른 기기에서 <b>복원하기</b>를 누르면 모의투자·관심종목·작도와 함께 실전 보유 기록도 그대로 옮겨집니다. 서버에 올리는 방식이 아니라 파일을 직접 옮기는 방식입니다.' }
    ];
  }
  function mhFaqInit() {
    var hl = $('#mhHelp'), faq = $('#mhFaq');
    if (!hl || !faq) return;
    var open = false;
    function sync() {
      faq.hidden = !open;
      hl.classList.toggle('on', open);
      hl.setAttribute('aria-expanded', open ? 'true' : 'false');
      var tx = hl.querySelector('span');
      if (tx) tx.textContent = open ? '도움말 닫기' : '도움말';
    }
    hl.onclick = function () { open = !open; sync(); };
    var grid = $('#mhfList');
    if (grid) grid.innerHTML = mhFaqItems().map(function (x) {
      return '<div class="mhf-item"><b>Q. ' + mhEsc(x.q) + '</b><p>' + x.a + '</p></div>';
    }).join('');
    sync();
  }

  function mhGoChart(t) {
    if (!A[t]) return;
    select(t);
    $$('#mhList .mh-row').forEach(function (r) { r.classList.toggle('on', r.getAttribute('data-t') === t); });
    var hero = $('#hero');
    if (hero && hero.scrollIntoView) hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function mhFillList() {
    var dl = $('#mhSymList');
    if (!dl) return;
    dl.innerHTML = M.tickers.map(function (x) {
      return '<option value="' + mhEsc(x.t) + '">' + mhEsc(x.n || '') + (x.r ? ' · 시총 ' + x.r + '위' : '') + '</option>';
    }).join('');
  }
  /* ---------------- 매수 기준·적용 모드 변경 ---------------- */
  function mhSetRule(t, rule, fromReco) {
    var it = mhItem(t);
    if (!it) return;
    if (!MH_RULES[rule]) rule = 'auto';
    if (it.rule === rule && !(fromReco && myhold.mode !== 'auto')) return;
    it.rule = rule;
    if (fromReco && myhold.mode !== 'auto') myhold.mode = 'auto';   /* 추천을 받아들면 자동 모드로 */
    mhSave(); mhRender();
    mhMsg(t + ' 매수 기준을 ' + MH_RULES[rule].ko + '으로 바꿨습니다' +
      (rule === 'auto' ? ' — 4조합(추세 1Y·스윙 1M) 중 최고 조합을 자동 적용합니다' : ' — 이 규칙으로 바로 다시 진단했습니다'), 'ok');
  }
  function mhMode(m) {
    m = m === 'screen' ? 'screen' : 'auto';
    if (myhold.mode === m) return;
    myhold.mode = m;
    mhSave(); mhRender();
    mhMsg(m === 'auto'
      ? '⚡ 수익최적 자동 — 종목별로 저장된 매수 기준(자동 = 4조합 중 최고 조합)으로 진단합니다'
      : '🎛️ 내 성향 기준 — 지금 내 성향·전략 버튼의 규칙으로 모든 종목을 진단합니다 (저장된 매수 기준은 그대로)', 'ok');
  }

  function mhInit() {
    mhLoad();
    mhFillList();
    var form = $('#mhForm');
    if (!form) return;
    form.addEventListener('submit', mhSubmit);
    var basis = $('#mhBasis');
    if (basis) basis.onclick = function (e) {
      var b = e.target.closest ? e.target.closest('button[data-mbmode]') : null;
      if (b) mhMode(b.getAttribute('data-mbmode'));
    };
    var tabs = $('#mhTabs');
    if (tabs) tabs.onclick = function (e) {
      var b = e.target.closest('button[data-mtab]');
      if (b) mhTab(b.getAttribute('data-mtab'));
    };
    var cx = $('#mhCancel');
    if (cx) cx.onclick = function () { mhResetForm(true); mhMsg('수정을 취소했습니다'); };
    var sm = $('#mhSample'), rs = $('#mhReset');
    if (sm) sm.onclick = mhSample;
    if (rs) rs.onclick = mhResetAll;
    var dt = $('#mhDate');
    if (dt) { try { dt.max = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); } catch (e) {} }
    var list = $('#mhList');
    if (list) {
      list.onclick = function (e) {
        var row = e.target.closest ? e.target.closest('.mh-row') : null;
        if (!row) return;
        /* 기준 선택·배지 영역은 카드 열기로 번지지 않게 */
        if (e.target.closest && e.target.closest('.mhbasis')) return;
        var t = row.getAttribute('data-t');
        var btn = e.target.closest ? e.target.closest('button[data-mh]') : null;
        if (btn) {
          e.stopPropagation();
          var act = btn.getAttribute('data-mh');
          if (act === 'edit') mhEditStart(t);
          else if (act === 'del') mhDelete(t);
          else if (act === 'reco') mhSetRule(t, btn.getAttribute('data-rule'), true);
          else mhGoChart(t);
          return;
        }
        mhGoChart(t);
      };
      list.onchange = function (e) {
        var s = e.target.closest ? e.target.closest('select.mh-rsel') : null;
        if (!s) return;
        mhSetRule(s.getAttribute('data-mhr'), s.value);
      };
      list.onkeydown = function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (e.target.closest && e.target.closest('.mhbasis')) return;
        var row = e.target.closest ? e.target.closest('.mh-row') : null;
        if (!row) return;
        e.preventDefault();
        mhGoChart(row.getAttribute('data-t'));
      };
    }
    mhFaqInit();
    mhTab(myhold.tab, false);
    mhRender();
  }

  /* ---------------- go ---------------- */
  var pendingDeep = '';                              /* 분석이 끝난 뒤 선택할 딥링크 종목 */
  function start() {
    var h = (location.hash || '').replace('#', '');   /* boot()이 기본 종목을 고르기 전에 딥링크 보관 */
    if (!h) {                                          /* ?t=SYMBOL 쿼리도 딥링크로 받는다 */
      var mq = /[?&]t=([^&#]*)/.exec(location.search || '');
      if (mq) { try { h = decodeURIComponent(mq[1]).toUpperCase(); } catch (e) { h = ''; } }
    }
    cleanRestore();                                  /* 깔끔 보기 저장 상태 — 첫 draw 전에 */
    bootProgress(26, '데이터 확인 중…');
    riskRestore();                                   /* 성향(안정형/공격형) — 첫 분석 호출 전에 복원 */
    slotRestore();                                   /* 투자방식(집중1/분산3/분산10) — 기본 분산 10 */
    applyRiskClass();                                /* html[data-risk] · theme-color */
    accBuild();                                       /* 접힘 상태를 먼저 복원해 화면 깜빡임 방지 */
    beginInit();                                      /* 초보자 3단계 보는 법 — 접기/펼치기 저장 상태 */
    eduInit();                                        /* 오늘의 주식 공부 카드 (날짜별 자동 변경) */
    wire();
    relocateSearch();                                 /* 📱 모바일이면 검색창을 공포·탐욕 시계 위로 */
    cleanSync();                                     /* 깔끔 보기 버튼·툴바 상태 동기화 */
    backupInit();                                    /* 가상투자·관심종목·작도·설정 백업/복원 */
    mhInit();                                        /* 💼 실전 보유 관리 — 저장된 보유 복원·탭 조립 */
    boot();
    xtogSync();                                       /* SAR · 엔벨로프 저장 상태 복원 */
    if (h) pendingDeep = h;                            /* bootAfter() 가 분석 뒤에 선택한다 */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
