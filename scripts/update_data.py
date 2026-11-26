#!/usr/bin/env python3
"""미국주식 차트분석기 데이터 갱신 스크립트 (v2 — 5년 + 거시지표 + 펀더멘털).

Yahoo Finance 에서 top100.json 에 정의된 102종목(100 + NKE, QQQ)의
최근 5년 일봉과 거시 지표(^VIX, ^TNX), 종목별 펀더멘털(quoteSummary)을
내려받아 scripts/data.js 를 다시 생성한다.

  window.MARKET = {asOf, dates[], tickers[], series{}, fundamentals{}}
    series       : 종목 102 + ^VIX + ^TNX  (off,o,h,l,c,v — 거래일 캘린더 정렬)
    fundamentals : {asOf, fetchedAt, tickers{t:{...}}}

실패 처리(안전 폴백):
  · 시세 종목이 95% 미만으로 수집되면 기존 data.js 를 그대로 두고 exit 2
  · 펀더멘털만 실패하면 기존 data.js 에 박혀 있던 펀더멘털을 이어 쓰고 시세는 갱신
  · 지수(^VIX/^TNX)를 못 받으면 기존 data.js 의 지수 시리즈를 이어 쓴다

사용법:
    python scripts/update_data.py            # 갱신 후 data.js 기록
    python scripts/update_data.py --check    # 갱신 없이 상태만 출력
"""
import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(HERE, 'raw')
RAW_FUND = os.path.join(HERE, 'rawfund')
DATA_JS = os.path.join(HERE, 'data.js')
TOP100 = os.path.join(HERE, 'top100.json')

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
YAHOO = ("https://query1.finance.yahoo.com/v8/finance/chart/{t}"
         "?range=5y&interval=1d&includePrePost=false&events=div%2Csplit")
FUND_MODULES = 'price,summaryDetail,defaultKeyStatistics,financialData'
# data.js 에 내장할 펀더멘털 필드 (UI 표시 + 참고 지표)
FUND_FIELDS = (
    'forwardPE', 'trailingPE', 'revenueGrowth', 'earningsGrowth',
    'targetMeanPrice', 'targetHighPrice', 'targetLowPrice',
    'marketCap', 'dividendYield', 'fiftyTwoWeekHigh', 'fiftyTwoWeekLow',
    'recommendationKey', 'recommendationMean', 'numberOfAnalystOpinions',
    'profitMargins', 'returnOnEquity', 'beta', 'priceToBook',
    'trailingEps', 'forwardEps', 'freeCashflow', 'totalRevenue',
    'quoteType',
)
INDICES = {'^VIX': 'VIX', '^TNX': 'US 10Y'}

KO = {
 'AAPL':('애플','Technology'),'NVDA':('엔비디아','Semiconductors'),'MSFT':('마이크로소프트','Software'),
 'GOOGL':('알파벳(구글)','Communication Services'),'AMZN':('아마존','Consumer Discretionary'),
 'SPCX':('스페이스X','Industrials'),'TSLA':('테슬라','Consumer Discretionary'),'META':('메타','Communication Services'),
 'AVGO':('브로드컴','Semiconductors'),'LLY':('일라이 릴리','Health Care'),'BRK-B':('버크셔 해서웨이','Financials'),
 'ANT':('앤스로픽','Software'),'WMT':('월마트','Consumer Staples'),'JPM':('JP모건','Financials'),
 'V':('비자','Financials'),'MU':('마이크론','Semiconductors'),'AMD':('AMD','Semiconductors'),
 'JNJ':('존슨앤드존슨','Health Care'),'XOM':('엑슨모빌','Energy'),'MA':('마스터카드','Financials'),
 'ABBV':('애브비','Health Care'),'COST':('코스트코','Consumer Staples'),'KO':('코카콜라','Consumer Staples'),
 'CVX':('셰브론','Energy'),'PG':('P&G','Consumer Staples'),'PLTR':('팔란티어','Software'),
 'CSCO':('시스코','Technology Hardware'),'HD':('홈디포','Consumer Discretionary'),'MRK':('머크','Health Care'),
 'ORCL':('오라클','Software'),'BAC':('뱅크오브아메리카','Financials'),'GE':('GE 에어로스페이스','Industrials'),
 'UNH':('유나이티드헬스','Health Care'),'INTC':('인텔','Semiconductors'),'PANW':('팔로알토 네트웍스','Software'),
 'PM':('필립모리스','Consumer Staples'),'MS':('모건스탠리','Financials'),'RTX':('RTX','Industrials'),
 'TMO':('서모피셔','Health Care'),'AMAT':('어플라이드 머티리얼즈','Semiconductors'),'AMGN':('암젠','Health Care'),
 'CAT':('캐터필러','Industrials'),'LRCX':('램리서치','Semiconductors'),'WFC':('웰스파고','Financials'),
 'NFLX':('넷플릭스','Communication Services'),'TXN':('텍사스 인스트루먼트','Semiconductors'),
 'GS':('골드만삭스','Financials'),'IBM':('IBM','Technology Hardware'),'GILD':('길리어드 사이언스','Health Care'),
 'CRWD':('크라우드스트라이크','Software'),'ANET':('아리스타 네트웍스','Technology Hardware'),
 'DIS':('월트디즈니','Communication Services'),'AXP':('아메리칸 익스프레스','Financials'),
 'MCD':('맥도날드','Consumer Discretionary'),'VZ':('버라이즌','Communication Services'),
 'PEP':('펩시코','Consumer Staples'),'GEV':('GE 버노바','Industrials'),'C':('씨티그룹','Financials'),
 'DELL':('델 테크놀로지스','Technology Hardware'),'ABT':('애보트','Health Care'),
 'APH':('암페놀','Technology Hardware'),'WELL':('웰타워','Real Estate'),
 'NEE':('넥스트에라 에너지','Utilities'),'TMUS':('T-모바일','Communication Services'),
 'BLK':('블랙록','Financials'),'QCOM':('퀄컴','Semiconductors'),'KLAC':('KLA','Semiconductors'),
 'UNP':('유니온퍼시픽','Industrials'),'CVNA':('카바나','Consumer Discretionary'),
 'DE':('디어','Industrials'),'PFE':('화이자','Health Care'),'SCHW':('찰스슈왑','Financials'),
 'DHR':('다나허','Health Care'),'COP':('코노코필립스','Energy'),'CRM':('세일즈포스','Software'),
 'TJX':('TJX','Consumer Discretionary'),'T':('AT&T','Communication Services'),
 'ADI':('아나로그 디바이스','Semiconductors'),'ISRG':('인튜이티브 서지컬','Health Care'),
 'BX':('블랙스톤','Financials'),'VRTX':('버텍스 파마슈티컬','Health Care'),
 'PGR':('프로그레시브','Financials'),'LMT':('록히드마틴','Industrials'),'UBER':('우버','Industrials'),
 'SPGI':('S&P 글로벌','Financials'),'BA':('보잉','Industrials'),'LOW':('로우스','Consumer Discretionary'),
 'IBKR':('인터랙티브 브로커스','Financials'),'BMY':('브리스톨 마이어스','Health Care'),
 'APP':('앱러빈','Software'),'MCK':('맥케슨','Health Care'),'MO':('알트리아','Consumer Staples'),
 'PLD':('프롤로지스','Real Estate'),'SYK':('스트라이커','Health Care'),'ADP':('ADP','Industrials'),
 'SBUX':('스타벅스','Consumer Discretionary'),'MRVL':('마벨 테크놀로지','Semiconductors'),
 'SCCO':('서던 코퍼','Materials'),'PH':('파커하니핀','Industrials'),'CME':('CME 그룹','Financials'),
 'NKE':('나이키','Consumer Discretionary'),'QQQ':('QQQ (나스닥100 ETF)','ETF'),
}
SECTOR_KO = {
 'Technology':'기술','Semiconductors':'반도체','Software':'소프트웨어',
 'Communication Services':'커뮤니케이션','Consumer Discretionary':'경기소비재',
 'Consumer Staples':'필수소비재','Health Care':'헬스케어','Financials':'금융',
 'Industrials':'산업재','Energy':'에너지','Materials':'소재','Utilities':'유틸리티',
 'Real Estate':'부동산','Technology Hardware':'하드웨어','ETF':'ETF',
}
EXTRA = ('NKE', 'QQQ')


def ticker_list():
    base = json.load(open(TOP100, encoding='utf-8'))
    tickers = ['GOOGL' if d['ticker'] == 'GOOG' else d['ticker'] for d in base]
    for extra in EXTRA:
        if extra not in tickers:
            tickers.append(extra)
    return base, tickers


# ------------------------------------------------------------------ 시세
def raw_path(t):
    return os.path.join(RAW_DIR, t.replace('^', '_') + '.json')


def fetch_chart(t, tries=4):
    url = YAHOO.format(t=urllib.parse.quote(t))
    last = ''
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=40) as r:
                body = r.read()
            d = json.loads(body)
            if d.get('chart', {}).get('result'):
                os.makedirs(RAW_DIR, exist_ok=True)
                with open(raw_path(t), 'wb') as f:
                    f.write(body)
                return t, 'ok'
            last = 'empty:' + json.dumps(d)[:120]
        except urllib.error.HTTPError as e:
            last = 'http%d' % e.code
            if e.code == 429:
                time.sleep(3.0 * (attempt + 1))
                continue
        except Exception as e:
            last = type(e).__name__ + ':' + str(e)[:80]
        time.sleep(1.5 * (attempt + 1))
    return t, last


def download_charts(tickers):
    os.makedirs(RAW_DIR, exist_ok=True)
    res = {}
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(fetch_chart, t): t for t in tickers}
        for fu in as_completed(futs):
            t, s = fu.result()
            res[t] = s
    bad = [t for t in tickers if res.get(t) != 'ok']
    if bad:  # 순차 재시도
        print('retrying', bad[:8], '...' if len(bad) > 8 else '')
        time.sleep(3)
        for t in bad:
            _, s = fetch_chart(t, tries=3)
            res[t] = s
    return res


def parse_chart(t):
    raw = json.load(open(raw_path(t), encoding='utf-8'))['chart']['result'][0]
    ts = raw['timestamp']
    q = raw['indicators']['quote'][0]
    rows = {}
    for i, x in enumerate(ts):
        c = q['close'][i]
        if c is None:
            continue
        d = datetime.fromtimestamp(x, timezone.utc).strftime('%Y-%m-%d')
        o = q['open'][i] if q['open'][i] is not None else c
        h = q['high'][i] if q['high'][i] is not None else c
        l = q['low'][i] if q['low'][i] is not None else c
        v = q['volume'][i] or 0
        rows[d] = [round(o, 2), round(h, 2), round(l, 2), round(c, 2), int(round(v / 1000.0))]
    return rows, raw.get('meta', {})


def build_series(dates, rows, fill_forward):
    """거래일 캘린더에 맞춘 {off,o,h,l,c,v} — 캘린더에 없는 날은 직전값 유지."""
    off = None
    prev = None
    o, h, l, c, v = [], [], [], [], []
    for i, d in enumerate(dates):
        r = rows.get(d)
        if r is None:
            if off is None:
                continue                      # 상장 전 — 선행 결측은 off 로 흡수
            if not fill_forward or prev is None:
                continue
            r = prev
        else:
            prev = r
        if off is None:
            off = i
        o.append(r[0]); h.append(r[1]); l.append(r[2]); c.append(r[3]); v.append(r[4])
    if off is None:
        return None
    return {'off': off, 'o': o, 'h': h, 'l': l, 'c': c, 'v': v}


# ------------------------------------------------------------- 펀더멘털
_cj = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_cj))
HEAD = {'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9'}


def _get(url, timeout=30):
    return _opener.open(urllib.request.Request(url, headers=HEAD), timeout=timeout).read()


def get_crumb():
    try:
        _get('https://finance.yahoo.com/quote/AAPL/')
    except Exception as e:
        print('cookie warmup warn:', e)
    for _ in range(3):
        try:
            c = _get('https://query1.finance.yahoo.com/v1/test/getcrumb').decode().strip()
            if c and len(c) < 40:
                return c
        except Exception as e:
            print('crumb warn:', e)
        time.sleep(2)
    return ''


def fetch_fund(t, crumb, tries=4):
    path = os.path.join(RAW_FUND, t + '.json')
    url = ('https://query2.finance.yahoo.com/v10/finance/quoteSummary/%s?modules=%s&crumb=%s'
           % (urllib.parse.quote(t), FUND_MODULES, urllib.parse.quote(crumb)))
    last = ''
    for attempt in range(tries):
        try:
            body = _get(url)
            d = json.loads(body)
            if d.get('quoteSummary', {}).get('result'):
                os.makedirs(RAW_FUND, exist_ok=True)
                with open(path, 'wb') as f:
                    f.write(body)
                return t, 'ok'
            last = 'empty:' + json.dumps(d)[:140]
        except urllib.error.HTTPError as e:
            last = 'http%d' % e.code
            if e.code in (401, 429):
                time.sleep(2.0 * (attempt + 1))
                continue
        except Exception as e:
            last = type(e).__name__ + ':' + str(e)[:80]
        time.sleep(1.5 * (attempt + 1))
    return t, last


def _raw(ms):
    return ms.get('raw') if isinstance(ms, dict) else None


def parse_fund(t):
    d = json.load(open(os.path.join(RAW_FUND, t + '.json'), encoding='utf-8'))['quoteSummary']['result'][0]
    p = d.get('price', {}) or {}
    sd = d.get('summaryDetail', {}) or {}
    ks = d.get('defaultKeyStatistics', {}) or {}
    fd = d.get('financialData', {}) or {}
    return {
        'forwardPE': _raw(sd.get('forwardPE')),
        'trailingPE': _raw(sd.get('trailingPE')),
        'marketCap': _raw(p.get('marketCap')) or _raw(sd.get('marketCap')),
        'dividendYield': _raw(sd.get('dividendYield')),
        'fiftyTwoWeekHigh': _raw(sd.get('fiftyTwoWeekHigh')),
        'fiftyTwoWeekLow': _raw(sd.get('fiftyTwoWeekLow')),
        'beta': _raw(sd.get('beta')),
        'priceToBook': _raw(ks.get('priceToBook')),
        'trailingEps': _raw(ks.get('trailingEps')),
        'forwardEps': _raw(ks.get('forwardEps')),
        'revenueGrowth': _raw(fd.get('revenueGrowth')),
        'earningsGrowth': _raw(fd.get('earningsGrowth')),
        'targetMeanPrice': _raw(fd.get('targetMeanPrice')),
        'targetHighPrice': _raw(fd.get('targetHighPrice')),
        'targetLowPrice': _raw(fd.get('targetLowPrice')),
        'recommendationMean': _raw(fd.get('recommendationMean')),
        'recommendationKey': fd.get('recommendationKey'),
        'numberOfAnalystOpinions': _raw(fd.get('numberOfAnalystOpinions')),
        'profitMargins': _raw(fd.get('profitMargins')),
        'returnOnEquity': _raw(fd.get('returnOnEquity')),
        'freeCashflow': _raw(fd.get('freeCashflow')),
        'totalRevenue': _raw(fd.get('totalRevenue')),
        'currentPrice': _raw(p.get('regularMarketPrice')),
        'quoteType': p.get('quoteType'),
    }


def load_fundamentals(tickers):
    """전 종목 펀더멘털 수집 — 실패분은 None."""
    os.makedirs(RAW_FUND, exist_ok=True)
    crumb = get_crumb()
    print('crumb %r' % crumb)
    res = {}
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = {ex.submit(fetch_fund, t, crumb): t for t in tickers}
        for fu in as_completed(futs):
            t, s = fu.result()
            res[t] = s
    bad = [t for t in tickers if res.get(t) != 'ok']
    if bad:
        print('retry fundamentals', bad[:6], '...' if len(bad) > 6 else '')
        time.sleep(4)
        crumb2 = get_crumb() or crumb
        for t in bad:
            _, s = fetch_fund(t, crumb2, tries=3)
            if s == 'ok':
                res[t] = s
    out = {}
    for t in tickers:
        if res.get(t) == 'ok':
            try:
                out[t] = parse_fund(t)
            except Exception as e:
                print('parse fail', t, e)
                out[t] = None
        else:
            out[t] = None
    return out


# ------------------------------------------------------------ 이전 data.js
def previous_payload():
    """기존 data.js 에서 지수 시리즈·펀더멘털을 읽어 폴백으로 쓴다."""
    try:
        s = open(DATA_JS, encoding='utf-8').read()
        i = s.index('window.MARKET=')
        body = s[i + len('window.MARKET='):].strip().rstrip(';')
        return json.loads(body)
    except Exception:
        return None


# ------------------------------------------------------------------ 빌드
def build_payload(base, tickers, charts_ok, prev):
    per, metas = {}, {}
    for t in charts_ok:
        per[t], metas[t] = parse_chart(t)
    for t in INDICES:
        if t in per:
            continue
        if t in charts_ok or os.path.exists(raw_path(t)):
            try:
                per[t], _ = parse_chart(t)
            except Exception as e:
                print('index parse fail %s: %s' % (t, e))

    # 거래일 캘린더 = 종목 102개의 합집합 (지수의 별도 휴장일은 캘린더에서 제외)
    alld = set()
    for t in tickers:
        if t in per:
            alld.update(per[t].keys())
    if not alld:
        return None, 'no price data'
    dates = sorted(alld)

    series = {}
    for t in tickers:
        if t not in per:
            continue
        s = build_series(dates, per[t], fill_forward=True)
        if s:
            series[t] = s
    if len(series) < len(tickers) * 0.95:
        return None, 'only %d/%d tickers' % (len(series), len(tickers))

    # 거시 지표 — 캘린더에 없는 날은 직전값 유지
    for t in INDICES:
        if t in per:
            s = build_series(dates, per[t], fill_forward=True)
            if s:
                series[t] = s
        elif prev and t in (prev.get('series') or {}):
            ps = prev['series'][t]
            pdates = prev['dates']
            rows = {}
            for k in range(len(ps['c'])):
                rows[pdates[ps['off'] + k]] = [ps['o'][k], ps['h'][k], ps['l'][k], ps['c'][k], ps['v'][k]]
            # 과거 구간만 직전 파일에서 이어 붙인다(최신일 결측은 그대로 표시)
            s = build_series([d for d in dates if d in rows], rows, fill_forward=True)
            if s:
                early = [d for d in dates if d in rows]
                s['off'] = dates.index(early[0])
                print('WARN index %s: 최신 수집 실패 — 기존 값 유지(%s 까지)' % (t, early[-1]))
                series[t] = s

    # 펀더멘털 (실패분은 None → UI 에서 —)
    funds = load_fundamentals(tickers)
    ok_f = sum(1 for v in funds.values() if v)
    prev_funds = (prev or {}).get('fundamentals') or {}
    prev_t = prev_funds.get('tickers') or {}
    if ok_f < len(tickers) * 0.6:
        print('WARN fundamentals %d/%d — 기존 내장 펀더멘털 사용' % (ok_f, len(tickers)))
        funds = prev_t or funds
        f_asof = prev_funds.get('asOf') or None
    else:
        # 실패한 종목은 기존 값으로 메운다
        for t in tickers:
            if not funds.get(t) and prev_t.get(t):
                funds[t] = prev_t[t]
        f_asof = dates[-1]

    slim_funds = {}
    for t in tickers:
        v = funds.get(t)
        if not v:
            continue
        slim_funds[t] = {k: v.get(k) for k in FUND_FIELDS if v.get(k) is not None}

    meta_list = []
    for d in base:
        t = 'GOOGL' if d['ticker'] == 'GOOG' else d['ticker']
        if t not in series:
            continue
        ko, sec = KO.get(t, (d['name'], 'Technology'))
        name = (metas.get(t, {}).get('longName') or metas.get(t, {}).get('shortName') or d['name'])
        for junk in (' Inc.', ' Corporation', ' Company'):
            name = name.replace(junk, '')
        fmc = (slim_funds.get(t) or {}).get('marketCap')
        mc = fmc if fmc else d.get('mc')
        if not fmc and mc and d.get('price') and series[t]['c'][-1]:
            mc = mc * (series[t]['c'][-1] / d['price'])
        meta_list.append({'t': t, 'n': name, 'nk': ko, 'r': d['rank'], 'mc': mc,
                          'fav': 1 if t in ('NVDA', 'MSFT', 'GOOGL') else 0,
                          's': sec, 'sk': SECTOR_KO.get(sec, sec)})
    for t in EXTRA:
        if t not in series:
            continue
        ko, sec = KO[t]
        nm = (metas.get(t, {}).get('longName') or t)
        for junk in (' Inc.', ' Corporation', ',', ' Company'):
            nm = nm.replace(junk, '')
        fmc = (slim_funds.get(t) or {}).get('marketCap')
        meta_list.append({'t': t, 'n': nm.strip(), 'nk': ko, 'r': None, 'mc': fmc,
                          'fav': 1, 's': sec, 'sk': SECTOR_KO.get(sec, sec)})

    payload = {
        'asOf': dates[-1], 'dates': dates, 'tickers': meta_list, 'series': series,
        'fundamentals': {
            'asOf': f_asof,
            'fetchedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'source': 'Yahoo Finance quoteSummary v10',
            'tickers': slim_funds,
        },
    }
    return payload, None


def _norm(x):
    """비교용 정규화 — 실수는 6자리 유효숫자로 반올림(같은 값의 미세한 부동소수 차이 무시)."""
    if isinstance(x, float):
        if x == 0 or not (x == x):
            return 0.0
        import math
        d = max(0, 6 - int(math.floor(math.log10(abs(x)))) - 1)
        return round(x, min(d, 12))
    if isinstance(x, dict):
        return {k: _norm(v) for k, v in sorted(x.items())}
    if isinstance(x, list):
        return [_norm(v) for v in x]
    return x


def _stable(payload):
    """fetchedAt 만 다른 동일 내용을 판별하기 위한 비교용 문자열."""
    p = dict(payload)
    f = dict(p.get('fundamentals') or {})
    f.pop('fetchedAt', None)
    p['fundamentals'] = f
    return json.dumps(_norm(p), sort_keys=True, ensure_ascii=False)


def sanity(payload):
    """치명적 결함이면 문자열 반환 (data.js 를 덮어쓰지 않는다)."""
    dates = payload['dates']
    if len(dates) < 1100:
        return 'dates too short: %d' % len(dates)
    for t, s in payload['series'].items():
        if len(s['c']) + s['off'] != len(dates):
            return 'alignment %s' % t
        if not s['c'] or min(s['c']) <= 0:
            return 'bad close %s' % t
    for t in INDICES:
        if t not in payload['series']:
            return 'missing index %s' % t
    if len(payload['tickers']) < 100:
        return 'tickers %d' % len(payload['tickers'])
    return None


def main():
    check_only = '--check' in sys.argv
    base, tickers = ticker_list()
    print('tickers:', len(tickers), flush=True)
    prev = previous_payload()
    res = download_charts(list(tickers) + list(INDICES))
    bad = {k: v for k, v in res.items() if v != 'ok'}
    if bad:
        print('WARN: chart fetch failed for', bad, flush=True)
    charts_ok = [t for t in tickers if res.get(t) == 'ok']
    if len(charts_ok) < len(tickers) * 0.95:
        print('ERROR only %d/%d tickers fetched - keeping existing data.js' % (len(charts_ok), len(tickers)))
        return 2
    charts_all = [t for t in list(tickers) + list(INDICES) if res.get(t) == 'ok']

    payload, err = build_payload(base, tickers, charts_all, prev)
    if err:
        print('WARN:', err, '- keeping existing data.js')
        return 2
    bad_s = sanity(payload)
    if bad_s:
        print('ERROR sanity:', bad_s, '- keeping existing data.js')
        return 2

    nf = len(payload['fundamentals']['tickers'])
    print('check ok: asOf %s, tickers %d, dates %d, series %d, fundamentals %d' % (
        payload['asOf'], len(payload['tickers']), len(payload['dates']),
        len(payload['series']), nf))
    if check_only:
        return 0
    if prev and _stable(prev) == _stable(payload):
        print('NOCHANGE: 기존 data.js 와 동일 (휴장일 등) — 쓰지 않음')
        return 0

    js = 'window.MARKET=' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n'
    with open(DATA_JS, 'w', encoding='utf-8') as f:
        f.write(js)
    print('wrote data.js: asOf %s, %d tickers, %d dates, %d rows, %.2f MB' % (
        payload['asOf'], len(payload['tickers']), len(payload['dates']),
        sum(len(s['c']) for s in payload['series'].values()), len(js.encode()) / 1e6))
    return 0


if __name__ == '__main__':
    sys.exit(main())
