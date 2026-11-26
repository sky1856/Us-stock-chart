#!/usr/bin/env python3
"""미국주식 차트분석기 데이터 갱신 스크립트.

Yahoo Finance 에서 top100.json 에 정의된 102종목(100 + NKE, QQQ)의
최근 2년 일봉을 내려받아 scripts/data.js 를 다시 생성한다.
실패한 종목이 있으면 기존 data.js 를 그대로 두고 경고만 남긴다(안전 폴백).

사용법:
    python scripts/update_data.py            # 갱신 후 data.js 기록
    python scripts/update_data.py --check    # 갱신 없이 상태만 출력
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(HERE, 'raw')
DATA_JS = os.path.join(HERE, 'data.js')
TOP100 = os.path.join(HERE, 'top100.json')

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
YAHOO = ("https://query1.finance.yahoo.com/v8/finance/chart/{t}"
         "?range=2y&interval=1d&includePrePost=false&events=div%2Csplit")

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
EXTRA_MC = {'NKE': 53.09e9, 'QQQ': None}
EXTRA = ('NKE', 'QQQ')


def ticker_list():
    base = json.load(open(TOP100, encoding='utf-8'))
    tickers = ['GOOGL' if d['ticker'] == 'GOOG' else d['ticker'] for d in base]
    for extra in EXTRA:
        if extra not in tickers:
            tickers.append(extra)
    return base, tickers


def fetch(t, tries=4):
    path = os.path.join(RAW_DIR, t + '.json')
    url = YAHOO.format(t=urllib.request.quote(t))
    last = ''
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
            d = json.loads(body)
            if d.get('chart', {}).get('result'):
                os.makedirs(RAW_DIR, exist_ok=True)
                with open(path, 'wb') as f:
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


def download(tickers):
    for f in os.listdir(RAW_DIR) if os.path.isdir(RAW_DIR) else []:
        if f.endswith('.json'):
            os.remove(os.path.join(RAW_DIR, f))
    res = {}
    with ThreadPoolExecutor(max_workers=3) as ex:
        futs = {ex.submit(fetch, t): t for t in tickers}
        for fu in as_completed(futs):
            t, s = fu.result()
            res[t] = s
    bad = [t for t in tickers if res.get(t) != 'ok']
    if bad:  # 순차 재시도
        print('retrying', bad)
        time.sleep(3)
        for t in bad:
            _, s = fetch(t, tries=3)
            res[t] = s
    return res


def build_payload(base, tickers):
    dates = None
    series = {}
    meta_list = []
    for d in base:
        t = 'GOOGL' if d['ticker'] == 'GOOG' else d['ticker']
        raw = json.load(open(os.path.join(RAW_DIR, t + '.json'), encoding='utf-8'))['chart']['result'][0]
        ts = raw['timestamp']
        q = raw['indicators']['quote'][0]
        ds = [datetime.fromtimestamp(x, timezone.utc).strftime('%Y-%m-%d') for x in ts]
        if dates is None:
            dates = ds
        series[t] = {
            'off': len(dates) - len(ds),
            'o': [round(x, 2) if x is not None else 0 for x in q['open']],
            'h': [round(x, 2) if x is not None else 0 for x in q['high']],
            'l': [round(x, 2) if x is not None else 0 for x in q['low']],
            'c': [round(x, 2) if x is not None else 0 for x in q['close']],
            'v': [int(round((x or 0) / 1000.0)) for x in q['volume']],
        }
        meta = raw['meta']
        ko, sec = KO.get(t, (d['name'], 'Technology'))
        name = (meta.get('longName') or meta.get('shortName') or d['name'])
        for junk in (' Inc.', ' Corporation', ' Company'):
            name = name.replace(junk, '')
        # 시가총액: 스냅샷 시점 주가(top100.json price) 대비 최신 종가 비율로 근사 보정
        mc = d.get('mc')
        ref = d.get('price')
        last = series[t]['c'][-1]
        if mc and ref and last and 0.5 <= last / ref <= 2.0:
            mc = mc * (last / ref)
        meta_list.append({'t': t, 'n': name, 'nk': ko, 'r': d['rank'], 'mc': mc,
                          'fav': 1 if t in ('NVDA', 'MSFT', 'GOOGL') else 0,
                          's': sec, 'sk': SECTOR_KO.get(sec, sec)})

    for t in EXTRA:
        raw = json.load(open(os.path.join(RAW_DIR, t + '.json'), encoding='utf-8'))['chart']['result'][0]
        ts = raw['timestamp']
        q = raw['indicators']['quote'][0]
        ds = [datetime.fromtimestamp(x, timezone.utc).strftime('%Y-%m-%d') for x in ts]
        if ds[-1] != dates[-1]:
            return None, 'date mismatch for %s (%s vs %s)' % (t, ds[-1], dates[-1])
        series[t] = {
            'off': len(dates) - len(ds),
            'o': [round(x, 2) for x in q['open']], 'h': [round(x, 2) for x in q['high']],
            'l': [round(x, 2) for x in q['low']], 'c': [round(x, 2) for x in q['close']],
            'v': [int(round((x or 0) / 1000.0)) for x in q['volume']],
        }
        ko, sec = KO[t]
        meta = raw['meta']
        nm = (meta.get('longName') or t).replace(' Inc.', '').replace(' Corporation', '').replace(',', '').strip()
        meta_list.append({'t': t, 'n': nm, 'nk': ko, 'r': None, 'mc': EXTRA_MC.get(t),
                          'fav': 1, 's': sec, 'sk': SECTOR_KO.get(sec, sec)})

    return {'asOf': dates[-1], 'dates': dates, 'tickers': meta_list, 'series': series}, None


def main():
    check_only = '--check' in sys.argv
    base, tickers = ticker_list()
    print('tickers:', len(tickers))
    res = download(tickers)
    bad = {k: v for k, v in res.items() if v != 'ok'}
    if bad:
        print('WARN: fetch failed for', bad, '- keeping existing data.js')
        return 2
    payload, err = build_payload(base, tickers)
    if err:
        print('WARN:', err, '- keeping existing data.js')
        return 2
    js = 'window.MARKET=' + json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + ';\n'
    if check_only:
        print('check ok: asOf', payload['asOf'], 'tickers', len(payload['tickers']),
              'dates', len(payload['dates']))
        return 0
    with open(DATA_JS, 'w', encoding='utf-8') as f:
        f.write(js)
    print('wrote data.js: asOf %s, %d tickers, %d dates, %d rows, %.2f MB' % (
        payload['asOf'], len(payload['tickers']), len(payload['dates']),
        sum(len(s['c']) for s in payload['series'].values()), len(js.encode()) / 1e6))
    return 0


if __name__ == '__main__':
    sys.exit(main())
