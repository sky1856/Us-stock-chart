#!/usr/bin/env python3
"""미국주식 차트분석기 데이터 갱신 스크립트 (v3 — 5년 백테스트 + 워밍업 + 거시지표 + 펀더멘털).

Yahoo Finance 에서 top150.json 에 정의된 152종목(시총 1~150위 + NKE, QQQ)의
10년 일봉을 내려받아 그중 최근 KEEP_BARS(1,505)봉만 남기고,
거시 지표(^VIX, ^TNX), 종목별 펀더멘털(quoteSummary)과 함께
다음 실적 발표일(calendarEvents.earnings.earningsDate)까지 모아
scripts/data.js 를 다시 생성한다.

1,505봉 = 백테스트 5년(1,255거래일) + 워밍업 250봉.
엔진(engine.js)은 최근 1,255봉만 백테스트 구간으로 쓰므로, 매일 갱신해도
백테스트 창은 항상 정확히 5년으로 유지된다.

  window.MARKET = {asOf, updatedAt, dates[], tickers[], series{}, fundamentals{}, fearGreed{}, macro{}}
    updatedAt    : 데이터를 확인해 기록한 한국시간 'YYYY-MM-DD HH:MM' (휴장일 포함 매 실행 갱신)
    series       : 종목 152 + ^VIX + ^TNX + DXY  (off,o,h,l,c,v — 거래일 캘린더 정렬)
    fundamentals : {asOf, fetchedAt, tickers{t:{...}}}   # t.earningsDate = 다음 실적 발표일 YYYY-MM-DD (없으면 생략)
    fearGreed    : CNN 공포·탐욕 지수 {score, rating, previousClose, previous1Week,
                   previous1Month, previous1Year, timestamp, fetchedAt, source}
    macro        : 거시 지표 {rates{us2y, us10y, spread}, fed{targetLow,targetHigh,effr,asOf},
                   cpi{yoy,period,latest}, pce{yoy,core,period}, jobs{unemp,period},
                   events[{k,d,n}], refreshedAt}  # DXY 는 series['DXY']

실패 처리(안전 폴백):
  · 시세 종목이 95% 미만으로 수집되면 기존 data.js 를 그대로 두고 exit 2
  · 펀더멘털만 실패하면 기존 data.js 에 박혀 있던 펀더멘털을 이어 쓰고 시세는 갱신
  · 지수(^VIX/^TNX)를 못 받으면 기존 data.js 의 지수 시리즈를 이어 쓴다
  · CNN 공포·탐욕 API 가 실패하면 기존 data.js 의 fearGreed 를 그대로 이어 쓴다
  · 거시 지표는 美 재무부(2Y·10Y) · NY Fed(기준금리) · BLS(CPI·실업률) · BEA(PCE)를
    직접 수집하고, 실패하면 기존 data.js 의 값 → 내장 안전 폴백 순서로 채운다

사용법:
    python scripts/update_data.py            # 갱신 후 data.js 기록
    python scripts/update_data.py --check    # 갱신 없이 상태만 출력
"""
import html
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

try:
    from zoneinfo import ZoneInfo
    _KST = ZoneInfo('Asia/Seoul')
except Exception:  # tzdata 없는 환경 — UTC+9 고정
    _KST = timezone.utc

HERE = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(HERE, 'raw')
RAW_FUND = os.path.join(HERE, 'rawfund')
DATA_JS = os.path.join(HERE, 'data.js')


def kst_now_str():
    """한국시간 갱신 시각 'YYYY-MM-DD HH:MM' — 화면 상단 '장마감 · 갱신' 배지에 표기한다."""
    now = datetime.now(_KST)
    if _KST is timezone.utc:            # tzdata 없는 환경 — UTC+9 고정
        from datetime import timedelta
        now = now + timedelta(hours=9)
    return now.strftime('%Y-%m-%d %H:%M')
# 유니버스 설정 — 시총 1~150위 150행(+EXTRA NKE·QQQ) = 분석 152종목.
#   rank 1~100 = 추세형 유니버스(Top 100), rank 101~150 = 스윙형에만 추가되는 구간.
#   (top100.json 은 이 파일의 1~100위 부분과 같은 옛 사본 — 과거 연구 스크립트 호환용으로만 남긴다)
TOP150 = os.path.join(HERE, 'top150.json')

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
YAHOO = ("https://query1.finance.yahoo.com/v8/finance/chart/{t}"
         "?range=10y&interval=1d&includePrePost=false&events=div%2Csplit")
# data.js 에 담는 봉 수 = 백테스트 5년(1,255거래일) + 앞쪽 워밍업 250봉
KEEP_BARS = 1505
BT_BARS = 1255
FUND_MODULES = 'price,summaryDetail,defaultKeyStatistics,financialData,calendarEvents'
# data.js 에 내장할 펀더멘털 필드 (UI 표시 + 참고 지표)
FUND_FIELDS = (
    'forwardPE', 'trailingPE', 'revenueGrowth', 'earningsGrowth',
    'targetMeanPrice', 'targetHighPrice', 'targetLowPrice',
    'marketCap', 'dividendYield', 'fiftyTwoWeekHigh', 'fiftyTwoWeekLow',
    'recommendationKey', 'recommendationMean', 'numberOfAnalystOpinions',
    'profitMargins', 'returnOnEquity', 'beta', 'priceToBook',
    'trailingEps', 'forwardEps', 'freeCashflow', 'totalRevenue',
    'quoteType', 'earningsDate',
)
INDICES = {'^VIX': 'VIX', '^TNX': 'US 10Y'}
# 달러 인덱스 — Yahoo DX-Y.NYB 를 series['DXY'] 로 담는다
DXY_SYMBOL = 'DX-Y.NYB'
DXY_KEY = 'DXY'
# CNN 공포·탐욕 지수 (dataviz JSON API) — 브라우저에서 Referer 없이도 열리도록 CORS *
FG_URL = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata'
FG_HEADERS = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.cnn.com/markets/fear-and-greed',
    'Origin': 'https://www.cnn.com',
}

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
 # 시총 101~150위 — 스윙형(Top 150) 유니버스에서만 쓰는 구간
 'STX':('시게이트','Technology Hardware'),'BKNG':('부킹홀딩스','Consumer Discretionary'),
 'COF':('캐피털원','Financials'),'NEM':('뉴몬트','Materials'),'SO':('서던 컴퍼니','Utilities'),
 'WDC':('웨스턴 디지털','Technology Hardware'),'MAR':('메리어트','Consumer Discretionary'),
 'ABNB':('에어비앤비','Consumer Discretionary'),'CVS':('CVS 헬스','Health Care'),
 'HCA':('HCA 헬스케어','Health Care'),'MRSH':('마쉬앤맥레넌','Financials'),
 'DUK':('듀크 에너지','Utilities'),'REGN':('리제네론','Health Care'),'FTNT':('포티넷','Software'),
 'BNY':('BNY 멜론','Financials'),'ICE':('인터컨티넨탈 익스체인지','Financials'),
 'MMM':('3M','Industrials'),'GD':('제너럴 다이내믹스','Industrials'),
 'WM':('웨이스트 매니지먼트','Industrials'),'MPC':('마라톤 페트롤리엄','Energy'),
 'EQIX':('이퀴닉스','Real Estate'),'SNDK':('샌디스크','Technology Hardware'),
 'NOW':('서비스나우','Software'),'UPS':('UPS','Industrials'),'CSX':('CSX','Industrials'),
 'PSX':('필립스66','Energy'),'CMCSA':('컴캐스트','Communication Services'),
 'MRNA':('모더나','Health Care'),'USB':('US 뱅코프','Financials'),
 'VLO':('발레로 에너지','Energy'),'ADBE':('어도비','Software'),'CTAS':('신타스','Industrials'),
 'WAT':('워터스','Health Care'),'GLW':('코닝','Technology Hardware'),
 'MSI':('모토로라 솔루션즈','Technology Hardware'),'SPG':('사이먼 프로퍼티','Real Estate'),
 'EMR':('에머슨 일렉트릭','Industrials'),'TT':('트레인 테크놀로지스','Industrials'),
 'PNC':('PNC 파이낸셜','Financials'),'KKR':('KKR','Financials'),
 'SHW':('셔윈윌리엄스','Materials'),'PWR':('콴타 서비스','Industrials'),
 'ECL':('에코랩','Materials'),'HWM':('하우멧 에어로스페이스','Industrials'),
 'MDLZ':('몬델리즈','Consumer Staples'),'AMT':('아메리칸 타워','Real Estate'),
 'ELV':('엘레반스 헬스','Health Care'),'RCL':('로열 캐리비안','Consumer Discretionary'),
 'MCO':('무디스','Financials'),'WMB':('윌리엄스','Energy'),
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
    base = json.load(open(TOP150, encoding='utf-8'))
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
    meta = raw.get('meta', {}) or {}
    rows = {}
    for i, x in enumerate(ts):
        c = q['close'][i]
        o = q['open'][i]
        h = q['high'][i]
        l = q['low'][i]
        if c is None:
            # 마지막 봉의 종가만 비어 있는 경우(Yahoo 부분 결측)는 정규장 가격으로 보완한다.
            #  → 시가·고가·저가·거래량이 있는데 종가만 None 이라 직전 봉으로 덮여 '동일 봉'이 되던 문제
            last = (i == len(ts) - 1)
            rmp = meta.get('regularMarketPrice')
            if last and rmp is not None and o is not None and h is not None and l is not None:
                c = rmp
            else:
                continue
        d = datetime.fromtimestamp(x, timezone.utc).strftime('%Y-%m-%d')
        o = o if o is not None else c
        h = h if h is not None else c
        l = l if l is not None else c
        v = q['volume'][i] or 0
        rows[d] = [round(o, 2), round(h, 2), round(l, 2), round(c, 2), int(round(v / 1000.0))]
    return rows, meta


def build_series(dates, rows, fill_forward):
    """거래일 캘린더에 맞춘 {off,o,h,l,c,v} — 캘린더에 없는 날은 직전값 유지.

    추가로 staleN(마지막 실제 봉 이후 직전값으로 채운 거래일 수)·miss10(최근 10봉 중 채운 봉 수)·
    lastReal(마지막 실제 봉 날짜)을 담는다. 화면은 이 값으로 '데이터 지연/결측' 배지를 띄운다
    (SNDK 처럼 원천(Yahoo)이 봉을 비워 보내는 종목 — 직전값이 반복돼 같은 봉처럼 보이는 문제).
    """
    off = None
    prev = None
    o, h, l, c, v = [], [], [], [], []
    real_idx = -1
    real_flags = []                 # 출력 봉마다 실제 시세가 있었는지 (직전값 채움 = False)
    for i, d in enumerate(dates):
        r = rows.get(d)
        real = r is not None
        if r is None:
            if off is None:
                continue                      # 상장 전 — 선행 결측은 off 로 흡수
            if not fill_forward or prev is None:
                continue
            r = prev
        else:
            prev = r
            real_idx = len(c)
        if off is None:
            off = i
        real_flags.append(real)
        o.append(r[0]); h.append(r[1]); l.append(r[2]); c.append(r[3]); v.append(r[4])
    if off is None:
        return None
    stale = (len(c) - 1 - real_idx) if real_idx >= 0 else 0
    win = 10
    head = max(0, len(real_flags) - win)
    miss10 = sum(1 for f in real_flags[head:] if not f)
    return {'off': off, 'o': o, 'h': h, 'l': l, 'c': c, 'v': v,
            'staleN': stale, 'miss10': miss10,
            'lastReal': (dates[off + real_idx] if real_idx >= 0 else None)}


def carry_series(prev, key, dates):
    """직전 data.js 의 지표 시리즈를 새 거래일 캘린더에 이어 붙인다(수집 실패 폴백)."""
    ps = ((prev or {}).get('series') or {}).get(key)
    if not ps:
        return None
    pdates = prev['dates']
    rows = {}
    for k in range(len(ps['c'])):
        rows[pdates[ps['off'] + k]] = [ps['o'][k], ps['h'][k], ps['l'][k], ps['c'][k], ps['v'][k]]
    if not any(d in rows for d in dates):
        return None
    s = build_series(dates, rows, fill_forward=True)
    if s:
        last_known = max(d for d in dates if d in rows)
        print('WARN %s: 최신 수집 실패 — 기존 값 유지(%s 까지)' % (key, last_known))
    return s


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


_TODAY_ET = None


def today_et():
    """미국 동부 기준 오늘 (실적 발표일이 지났는지 판단하는 기준)."""
    global _TODAY_ET
    if _TODAY_ET is None:
        try:
            from zoneinfo import ZoneInfo
            _TODAY_ET = datetime.now(ZoneInfo('America/New_York')).date()
        except Exception:
            _TODAY_ET = datetime.now(timezone.utc).date()
    return _TODAY_ET


def next_earnings_date(ce):
    """calendarEvents → 다음 실적 발표일 'YYYY-MM-DD'.

    · 복수 날짜(발표 예정 범위)면 가장 이른 날짜를 쓴다
    · 전부 지난 날짜면 None (지난 실적은 표시하지 않는다)
    · ETF·미제공 종목은 None
    """
    e = (ce or {}).get('earnings') or {}
    dates = []
    for x in (e.get('earningsDate') or []):
        d = None
        if isinstance(x, dict):
            fmt = x.get('fmt')
            if isinstance(fmt, str) and re.match(r'^\d{4}-\d{2}-\d{2}$', fmt):
                d = fmt
            else:
                raw = x.get('raw')
                if isinstance(raw, (int, float)):
                    try:
                        d = datetime.fromtimestamp(raw, timezone.utc).strftime('%Y-%m-%d')
                    except Exception:
                        d = None
        elif isinstance(x, str) and re.match(r'^\d{4}-\d{2}-\d{2}$', x):
            d = x
        if d and d not in dates:
            dates.append(d)
    if not dates:
        return None
    dates.sort()
    today = today_et().strftime('%Y-%m-%d')
    for d in dates:
        if d >= today:
            return d
    return None


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
        'earningsDate': next_earnings_date(d.get('calendarEvents')),
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


# --------------------------------------------------- CNN 공포·탐욕 지수
def _fg_num(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if v != v or v < 0 or v > 100:
        return None
    return round(v, 1)


def fetch_fear_greed(tries=3):
    """CNN Fear & Greed 현재값 + 직전 마감/1주/1개월/1년 전. 실패하면 (None, 이유)."""
    last = ''
    for attempt in range(tries):
        try:
            req = urllib.request.Request(FG_URL, headers=FG_HEADERS)
            with urllib.request.urlopen(req, timeout=20) as r:
                body = r.read()
            d = json.loads(body)
            fg = d.get('fear_and_greed') or {}
            score = _fg_num(fg.get('score'))
            if score is None:
                last = 'no score:' + json.dumps(fg)[:100]
            else:
                return {
                    'score': score,
                    'rating': fg.get('rating'),
                    'previousClose': _fg_num(fg.get('previous_close')),
                    'previous1Week': _fg_num(fg.get('previous_1_week')),
                    'previous1Month': _fg_num(fg.get('previous_1_month')),
                    'previous1Year': _fg_num(fg.get('previous_1_year')),
                    'timestamp': fg.get('timestamp'),
                    'fetchedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'source': 'CNN Fear & Greed Index',
                }, None
        except urllib.error.HTTPError as e:
            last = 'http%d' % e.code
        except Exception as e:
            last = type(e).__name__ + ':' + str(e)[:80]
        time.sleep(1.5 * (attempt + 1))
    return None, last


# ------------------------------------ 거시 지표 · 발표 일정 (DXY · 2Y · 금리차 · 기준금리)
#   美 재무부 일별 수익률(2Y·10Y)  ·  뉴욕연은 EFFR(기준금리 범위)  ·  BLS(CPI·실업률)  ·  BEA(PCE)
#   FRED 는 이 환경에서 접속되지 않아 공식 배포처를 직수집한다(실패 시 안전 폴백).
TREASURY_URL = ('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml'
                '?data=daily_treasury_yield_curve&field_tdr_date_value=%d')
EFFR_URL = 'https://markets.newyorkfed.org/api/rates/unsecured/effr/last/1.json'
BLS_URL = 'https://api.bls.gov/publicAPI/v1/timeseries/data/'
BEA_PCE_URL = 'https://www.bea.gov/news/%d/personal-income-and-outlays-%s-%d'
MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
             'august', 'september', 'october', 'november', 'december']

# 공식 발표 일정 (연준 FOMC · BLS CPI·고용보고서 · BEA PCE) — 2026-12 ~ 2027-12
#   FOMC: 연준 2026-11-12 발표 개정 일정 (2027-10-26/27 은 전략회의로 금리 결정 없음 → 표시에서 제외)
#   CPI·고용: BLS 공개 일정표 / PCE: BEA 공개 일정표
SCHEDULE = [
    ('JOBS', '2026-12-04'), ('FOMC', '2026-12-09'), ('CPI', '2026-12-10'), ('PCE', '2026-12-23'),
    ('JOBS', '2027-01-08'), ('CPI', '2027-01-13'), ('FOMC', '2027-01-27'), ('PCE', '2027-01-28'),
    ('JOBS', '2027-02-05'), ('CPI', '2027-02-11'), ('PCE', '2027-02-25'),
    ('JOBS', '2027-03-05'), ('CPI', '2027-03-10'), ('FOMC', '2027-03-17'), ('PCE', '2027-03-31'),
    ('JOBS', '2027-04-02'), ('CPI', '2027-04-13'), ('FOMC', '2027-04-28'), ('PCE', '2027-04-29'),
    ('JOBS', '2027-05-07'), ('CPI', '2027-05-12'), ('PCE', '2027-05-27'),
    ('JOBS', '2027-06-04'), ('FOMC', '2027-06-09'), ('CPI', '2027-06-10'), ('PCE', '2027-06-25'),
    ('JOBS', '2027-07-02'), ('CPI', '2027-07-14'), ('PCE', '2027-07-29'), ('FOMC', '2027-07-28'),
    ('JOBS', '2027-08-06'), ('CPI', '2027-08-11'), ('PCE', '2027-08-25'),
    ('JOBS', '2027-09-03'), ('CPI', '2027-09-14'), ('FOMC', '2027-09-15'), ('PCE', '2027-09-30'),
    ('JOBS', '2027-10-08'), ('CPI', '2027-10-14'), ('PCE', '2027-10-28'),
    ('JOBS', '2027-11-05'), ('CPI', '2027-11-10'), ('FOMC', '2027-11-17'), ('PCE', '2027-11-24'),
    ('JOBS', '2027-12-03'), ('CPI', '2027-12-10'), ('PCE', '2027-12-22'),
]
# 수집이 모두 실패해 기존 data.js 에도 값이 없을 때 쓰는 안전 폴백 (2026-11-25/26 공식 발표값)
BASE_MACRO = {
    'fed': {'targetLow': 3.75, 'targetHigh': 4.00, 'effr': 3.88, 'asOf': '2026-11-24'},
    'cpi': {'yoy': 3.7, 'period': '2026-09', 'latest': '2026-10'},
    'pce': {'yoy': 3.8, 'core': 3.3, 'period': '2026-10'},
    'jobs': {'unemp': 4.1, 'period': '2026-10'},
}


def _brief_http(url, data=None, timeout=30, headers=None, tries=2):
    """UA 만 붙인 단순 GET/POST — 거시 지표 사이트용."""
    h = {'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9'}
    if headers:
        h.update(headers)
    last = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            last = e
            time.sleep(1.2 * (attempt + 1))
    raise last


def fetch_treasury():
    """美 재무부 일별 수익률 — {날짜: {'y2':2년, 'y10':10년}}."""
    rows = {}
    y0 = today_et().year
    for y in (y0 - 1, y0):
        try:
            body = _brief_http(TREASURY_URL % y, timeout=40).decode('utf-8', 'replace')
        except Exception as e:
            print('WARN treasury %d: %s' % (y, e))
            continue
        for blk in re.findall(r'<m:properties>(.*?)</m:properties>', body, re.S):
            m = re.search(r'<d:NEW_DATE[^>]*>(\d{4}-\d{2}-\d{2})', blk)
            if not m:
                continue
            two = re.search(r'<d:BC_2YEAR[^>]*>([\d.]+)</d:BC_2YEAR>', blk)
            ten = re.search(r'<d:BC_10YEAR[^>]*>([\d.]+)</d:BC_10YEAR>', blk)
            rows[m.group(1)] = {
                'y2': float(two.group(1)) if two else None,
                'y10': float(ten.group(1)) if ten else None,
            }
    return rows


def macro_rates_from_treasury(rows):
    ds = sorted(rows)
    if not ds:
        return None
    last = ds[-1]
    y2s = [(d, rows[d]['y2']) for d in ds if rows[d]['y2'] is not None]
    if not y2s:
        return None
    us2y = {
        'v': y2s[-1][1], 'prev': y2s[-2][1] if len(y2s) > 1 else None,
        'spark': [v for _, v in y2s[-66:]], 'asOf': y2s[-1][0],
    }
    sp = [(d, round(rows[d]['y10'] - rows[d]['y2'], 2)) for d in ds
          if rows[d]['y10'] is not None and rows[d]['y2'] is not None]
    spread = {
        'v': sp[-1][1] if sp else None, 'prev': sp[-2][1] if len(sp) > 1 else None,
        'spark': [v for _, v in sp[-66:]], 'asOf': sp[-1][0] if sp else last,
    }
    y10s = [(d, rows[d]['y10']) for d in ds if rows[d]['y10'] is not None]
    rates = {'us2y': us2y, 'spread': spread}
    if y10s:
        rates['us10y'] = {'v': y10s[-1][1], 'prev': y10s[-2][1] if len(y10s) > 1 else None, 'asOf': y10s[-1][0]}
    return rates


def fetch_fed_rate():
    """뉴욕연은 EFFR — 기준금리 목표 범위 + 실효 연방기금금리."""
    try:
        d = json.loads(_brief_http(EFFR_URL, timeout=20))
        r = (d.get('refRates') or [{}])[0]
        lo, hi = r.get('targetRateFrom'), r.get('targetRateTo')
        if lo is None or hi is None:
            print('WARN fed: 목표 범위 없음')
            return None
        return {'targetLow': float(lo), 'targetHigh': float(hi),
                'effr': (float(r['percentRate']) if r.get('percentRate') is not None else None),
                'asOf': r.get('effectiveDate')}
    except Exception as e:
        print('WARN fed: %s' % e)
        return None


def fetch_bls_macro():
    """BLS CPI-U(NSA) 12개월 상승률 + 실업률. (같은 달 작년 값이 없으면 최근 가용 월로 대체)"""
    out = {}
    y = today_et().year
    try:
        payload = json.dumps({'seriesid': ['CUUR0000SA0', 'LNS14000000'],
                              'startyear': str(y - 2), 'endyear': str(y)}).encode()
        d = json.loads(_brief_http(BLS_URL, data=payload, timeout=30,
                                   headers={'Content-Type': 'application/json'}))
        ser = {s.get('seriesID'): (s.get('data') or []) for s in ((d.get('Results') or {}).get('series') or [])}
    except Exception as e:
        print('WARN bls: %s' % e)
        return out
    m = {}
    for x in ser.get('CUUR0000SA0') or []:
        try:
            if str(x.get('period', '')).startswith('M') and x['period'] != 'M13':
                m[(int(x['year']), int(x['period'][1:]))] = float(x['value'])
        except (TypeError, ValueError):
            pass
    if m:
        latest = max(m)
        for k in range(4):
            yy, mm = latest[0], latest[1] - k
            while mm <= 0:
                mm += 12
                yy -= 1
            base = m.get((yy - 1, mm))
            if base and (yy, mm) in m:
                out['cpi'] = {'yoy': round((m[(yy, mm)] / base - 1) * 100, 1),
                              'period': '%d-%02d' % (yy, mm),
                              'latest': '%d-%02d' % latest}
                break
    un = [x for x in (ser.get('LNS14000000') or [])
          if str(x.get('period', '')).startswith('M') and x['period'] != 'M13']
    if un:
        un.sort(key=lambda x: (int(x['year']), int(x['period'][1:])), reverse=True)
        try:
            out['jobs'] = {'unemp': float(un[0]['value']),
                           'period': '%s-%02d' % (un[0]['year'], int(un[0]['period'][1:]))}
        except (TypeError, ValueError):
            pass
    return out


def fetch_pce():
    """BEA 개인소비지출(PCE) 물가지수 — 발표문에서 전년비·근원 전년비를 읽는다."""
    today = today_et()
    for back in range(0, 4):
        y, mo = today.year, today.month - back
        while mo <= 0:
            mo += 12
            y -= 1
        url = BEA_PCE_URL % (y, MONTHS_EN[mo - 1], y)
        try:
            body = _brief_http(url, timeout=25, tries=1).decode('utf-8', 'replace')
        except Exception:
            continue
        txt = re.sub(r'<(script|style).*?</\1>', ' ', body, flags=re.S)
        txt = re.sub(r'<[^>]+>', ' ', txt)
        txt = re.sub(r'\s+', ' ', html.unescape(txt))
        m1 = re.search(r'one year ago,\s*the\s*PCE price index\s*for\s+\w+\s*increased\s+([\d.]+)\s*percent', txt)
        if not m1:
            continue
        m2 = re.search(r'Excluding food and energy,\s*the PCE price index\s*increased\s+([\d.]+)\s*percent from one year ago', txt)
        return {'yoy': float(m1.group(1)), 'core': (float(m2.group(1)) if m2 else None),
                'period': '%d-%02d' % (y, mo), 'source': 'BEA Personal Income and Outlays'}
    return None


def macro_events():
    """오늘 이후 발표 일정 — 종류별로 가장 가까운 일정을 UI 가 골라 쓴다."""
    today = today_et().strftime('%Y-%m-%d')
    label = {'CPI': 'CPI', 'PCE': 'PCE', 'JOBS': '고용보고서'}
    out = []
    for kind, d in sorted(SCHEDULE, key=lambda x: x[1]):
        if d < today:
            continue
        if kind == 'FOMC':
            n = 'FOMC 금리 결정'
        else:
            yy, mm = int(d[:4]), int(d[5:7]) - 1
            if mm == 0:
                yy, mm = yy - 1, 12
            n = '%d월 %s' % (mm, label[kind])
        out.append({'k': kind, 'd': d, 'n': n})
    return out


def build_macro(prev_macro):
    """거시 지표 묶음 — 최신 수집 → 기존 data.js 값 → 안전 폴백 순서."""
    prev_macro = prev_macro or {}
    macro = {}
    tre = fetch_treasury()
    rates = macro_rates_from_treasury(tre) if tre else None
    if rates:
        macro['rates'] = rates
    elif prev_macro.get('rates'):
        macro['rates'] = prev_macro['rates']
        print('WARN rates 수집 실패 — 기존 값 유지')
    fed = fetch_fed_rate() or prev_macro.get('fed') or BASE_MACRO['fed']
    macro['fed'] = fed
    bls = fetch_bls_macro()
    macro['cpi'] = bls.get('cpi') or prev_macro.get('cpi') or BASE_MACRO['cpi']
    macro['jobs'] = bls.get('jobs') or prev_macro.get('jobs') or BASE_MACRO['jobs']
    macro['pce'] = fetch_pce() or prev_macro.get('pce') or BASE_MACRO['pce']
    macro['events'] = macro_events()
    macro['refreshedAt'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    r = macro.get('rates') or {}
    print('macro: fed %s~%s (EFFR %s) · CPI %s%% (%s) · PCE %s%% core %s%% · 실업률 %s%% · 2Y %s · 10Y-2Y %s · 일정 %d' % (
        fed.get('targetLow'), fed.get('targetHigh'), fed.get('effr'),
        (macro['cpi'] or {}).get('yoy'), (macro['cpi'] or {}).get('period'),
        (macro['pce'] or {}).get('yoy'), (macro['pce'] or {}).get('core'),
        (macro['jobs'] or {}).get('unemp'),
        ((r.get('us2y') or {}).get('v')), ((r.get('spread') or {}).get('v')), len(macro['events'])))
    return macro


# ------------------------------------------------------------ 이전 data.js
def previous_payload():
    """기존 data.js 에서 지수 시리즈·펀더멘털·공포탐욕을 읽어 폴백으로 쓴다."""
    try:
        s = open(DATA_JS, encoding='utf-8').read()
        i = s.index('window.MARKET=')
        body = s[i + len('window.MARKET='):].strip().rstrip(';')
        return json.loads(body)
    except Exception:
        return None


# ------------------------------------------------------------------ 빌드
def build_payload(base, tickers, charts_ok, prev, fg=None):
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

    # 거래일 캘린더 = 종목 152개의 합집합 (지수의 별도 휴장일은 캘린더에서 제외)
    alld = set()
    for t in tickers:
        if t in per:
            alld.update(per[t].keys())
    if not alld:
        return None, 'no price data'
    dates = sorted(alld)
    if len(dates) < KEEP_BARS:
        return None, 'calendar too short: %d bars (need %d)' % (len(dates), KEEP_BARS)
    # 최근 KEEP_BARS봉만 남긴다 — 백테스트 5년 + 워밍업 250봉
    dates = dates[-KEEP_BARS:]

    series = {}
    for t in tickers:
        if t not in per:
            continue
        s = build_series(dates, per[t], fill_forward=True)
        if s:
            series[t] = s
    if len(series) < len(tickers) * 0.95:
        return None, 'only %d/%d tickers' % (len(series), len(tickers))

    # 원천 결측 경고 — 직전 봉이 반복돼 '같은 봉'처럼 보이는 종목 (화면에 '데이터 지연' 배지)
    for t in tickers:
        sv = series.get(t)
        if not sv:
            continue
        if sv.get('staleN', 0) >= 2 or sv.get('miss10', 0) >= 2:
            print('WARN 데이터 결측 %s: 최근 10봉 중 %d봉이 비어 직전 값으로 채움 (마지막 실제 봉 %s)'
                  % (t, sv.get('miss10', 0), sv.get('lastReal')))

    # 거시 지표 — 캘린더에 없는 날은 직전값 유지
    for t in INDICES:
        if t in per:
            s = build_series(dates, per[t], fill_forward=True)
            if s:
                series[t] = s
        elif prev and t in (prev.get('series') or {}):
            s = carry_series(prev, t, dates)
            if s:
                series[t] = s

    # 달러 인덱스(DXY) — Yahoo DX-Y.NYB
    if DXY_SYMBOL in per:
        s = build_series(dates, per[DXY_SYMBOL], fill_forward=True)
        if s:
            series[DXY_KEY] = s
    elif prev and DXY_KEY in (prev.get('series') or {}):
        s = carry_series(prev, DXY_KEY, dates)
        if s:
            series[DXY_KEY] = s

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
        'asOf': dates[-1], 'updatedAt': kst_now_str(), 'dates': dates, 'tickers': meta_list, 'series': series,
        'fundamentals': {
            'asOf': f_asof,
            'fetchedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'source': 'Yahoo Finance quoteSummary v10',
            'tickers': slim_funds,
        },
        'macro': build_macro((prev or {}).get('macro')),
    }
    # CNN 공포·탐욕 — 이번 수집 실패 시 기존 내장값 유지
    fg_use = fg or (prev or {}).get('fearGreed')
    if fg_use and _fg_num(fg_use.get('score')) is not None:
        payload['fearGreed'] = fg_use
        if not fg:
            print('WARN fear&greed 수집 실패 — 기존 내장값 유지 (score %s)' % fg_use.get('score'))
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
    g = dict(p.get('fearGreed') or {})
    g.pop('fetchedAt', None)          # 공포·탐욕도 값(점수·직전값·갱신시각)이 바뀌면 반영 대상
    if g:
        p['fearGreed'] = g
    mc = dict(p.get('macro') or {})
    mc.pop('refreshedAt', None)       # 거시 지표는 값·일정이 바뀔 때만 다시 쓴다
    if mc:
        p['macro'] = mc
    return json.dumps(_norm(p), sort_keys=True, ensure_ascii=False)


def sanity(payload):
    """치명적 결함이면 문자열 반환 (data.js 를 덮어쓰지 않는다)."""
    dates = payload['dates']
    if len(dates) != KEEP_BARS:
        return 'dates %d (need %d)' % (len(dates), KEEP_BARS)
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
    fg, fg_err = fetch_fear_greed()
    if fg:
        print('fear&greed: %.1f %s (prev %.1f / 1w %s / 1m %s / 1y %s)' % (
            fg['score'], fg.get('rating'), fg.get('previousClose') or -1,
            fg.get('previous1Week'), fg.get('previous1Month'), fg.get('previous1Year')), flush=True)
    else:
        print('WARN fear&greed fetch failed: %s' % fg_err, flush=True)
    res = download_charts(list(tickers) + list(INDICES) + [DXY_SYMBOL])
    bad = {k: v for k, v in res.items() if v != 'ok'}
    if bad:
        print('WARN: chart fetch failed for', bad, flush=True)
    charts_ok = [t for t in tickers if res.get(t) == 'ok']
    if len(charts_ok) < len(tickers) * 0.95:
        print('ERROR only %d/%d tickers fetched - keeping existing data.js' % (len(charts_ok), len(tickers)))
        return 2
    charts_all = [t for t in list(tickers) + list(INDICES) + [DXY_SYMBOL] if res.get(t) == 'ok']

    payload, err = build_payload(base, tickers, charts_all, prev, fg)
    if err:
        print('WARN:', err, '- keeping existing data.js')
        return 2
    bad_s = sanity(payload)
    if bad_s:
        print('ERROR sanity:', bad_s, '- keeping existing data.js')
        return 2

    nf = len(payload['fundamentals']['tickers'])
    fgp = payload.get('fearGreed') or {}
    print('check ok: asOf %s, tickers %d, dates %d, series %d, fundamentals %d, fearGreed %s' % (
        payload['asOf'], len(payload['tickers']), len(payload['dates']),
        len(payload['series']), nf,
        ('%.1f (%s)' % (fgp.get('score'), fgp.get('timestamp'))) if fgp else '—'))
    if check_only:
        return 0
    # 갱신 시각(updatedAt)만 다른 경우도 '확인 완료'를 남기기 위해 다시 쓴다 — 값이 같으면 NOCHANGE 로 알린다
    same = False
    if prev:
        a_prev = dict(prev); a_new = dict(payload)
        a_prev.pop('updatedAt', None); a_new.pop('updatedAt', None)
        same = _stable(a_prev) == _stable(a_new)
    if same:
        print('NOCHANGE: 시세·지표 값은 기존 data.js 와 동일 (휴장일 등) — 갱신 시각만 기록')

    js = 'window.MARKET=' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n'
    with open(DATA_JS, 'w', encoding='utf-8') as f:
        f.write(js)
    print('wrote data.js: asOf %s, %d tickers, %d dates, %d rows, %.2f MB' % (
        payload['asOf'], len(payload['tickers']), len(payload['dates']),
        sum(len(s['c']) for s in payload['series'].values()), len(js.encode()) / 1e6))
    return 0


if __name__ == '__main__':
    sys.exit(main())
