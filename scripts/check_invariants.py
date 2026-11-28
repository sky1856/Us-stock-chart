#!/usr/bin/env python3
"""문서·화면·상수 자동 대조 — build.py 가 매 빌드마다 실행한다.

    python3 scripts/check_invariants.py [--quiet]

실패가 하나라도 있으면 종료코드 1 (빌드 중단). 검사 항목은 모두
"예전에 실제로 어긋났던 것" 또는 "숫자와 문구가 갈라지면 안 되는 것" 이다.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

FAILS = []
PASS = []


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def check(name, cond, detail=''):
    (PASS if cond else FAILS).append((name, detail))
    return cond


def const_num(src, key, default=None):
    m = re.search(r'\b' + key + r'\s*:\s*([0-9.]+)', src)
    return float(m.group(1)) if m else default


def main():
    quiet = '--quiet' in sys.argv
    arch = read(os.path.join(ROOT, 'ARCHITECTURE.md'))
    tpl = read(os.path.join(HERE, 'template.html'))
    ui = read(os.path.join(HERE, 'ui.js'))
    acct = read(os.path.join(HERE, 'acct.js'))
    eng = read(os.path.join(HERE, 'engine.js'))
    build = read(os.path.join(HERE, 'build.py'))
    idx_path = os.path.join(ROOT, 'index.html')
    idx = read(idx_path) if os.path.exists(idx_path) else ''
    data_path = os.path.join(HERE, 'data.js')
    data = read(data_path) if os.path.exists(data_path) else ''
    wf_path = os.path.join(HERE, 'wfdata.js')
    wf = read(wf_path) if os.path.exists(wf_path) else ''

    # ---------- 1. 문서 드리프트 ----------
    check('ARCHITECTURE 승률 = 52.8%', '승률 52.8%' in arch and '승률 53.2%' not in arch,
          '3차 재채점 실측 0.5285 — 문서에 53.2%가 남아 있으면 안 된다')
    check('ARCHITECTURE 전략 라벨 = 3 전략', '`3 전략`' in arch and '`2 전략`' not in arch,
          '화면 라벨은 3 전략(성향·투자방식·전략 중 세 번째)')
    check('패닉 정의 = 추세 100 · 스윙 200', '추세 100일선 · 스윙 200일선' in arch)
    check('FAQ 문구 = 1Y 성과가 같아', '1Y 성과가 같아' in ui and '5년 성과가 같아' not in ui)
    check('ARCHITECTURE 예전 QQQ 벤치 문구 없음', '창 첫날 종가)' not in arch,
          '벤치는 창 첫날 시가 기준으로 정렬됐다')

    # ---------- 2. 상수 ↔ 화면 문구 ----------
    fee = const_num(acct, 'fee', 0)
    panic = const_num(acct, 'panic', 0)
    warm = const_num(acct, 'warm', 0)
    slip = const_num(acct, 'slip', 0)
    gap = const_num(acct, 'gap', 0)
    check('수수료 상수 = 0.03%/편도', abs(fee - 0.0003) < 1e-9)
    check('패닉 투입 상한 = 70%', abs(panic - 0.70) < 1e-9)
    check('웜스타트 = 250봉', abs(warm - 250) < 1e-9)
    check('슬리피지 상수 = 0.15%/편도', abs(slip - 0.0015) < 1e-9)
    check('갭 충격 상수 = 10%', abs(gap - 0.10) < 1e-9)
    check('화면 가정 문구 — 왕복 0.06%', '왕복 0.06%' in ui)
    check('화면 가정 문구 — 연 4% 이자', '현금 연 4%' in ui)
    check('한계 탭 — 웜스타트 250봉', '250봉' in tpl)
    check('한계 탭 — 슬리피지 왕복 0.3%', '왕복 0.3%' in tpl)
    check('한계 탭 — −10% 갭', '−10% 갭' in tpl)
    check('한계 탭 — 생존편향', '생존편향' in tpl)

    # ---------- 3. 표본 안정화(MH) ----------
    check('MH 다중 창 = 21·63·126', re.search(r'MH_WINS\s*=\s*\{\s*trend:\s*\[252\],\s*swing:\s*\[21,\s*63,\s*126\]', ui) is not None)
    check('청산 표본 최소 2건(추천)', 'MH_RECO_SAMPLE = 2' in ui)
    check('표본 표기 = 표본 N건(청산)', '표본 ' in ui and '건(청산)' in ui)
    check('표본 부족 표기', '표본 부족' in ui)
    check('3창 합의 조건', 'MH_RECO_AGREE' in ui and 'agree < need' in ui)

    # ---------- 4. 계좌 창 정합 ----------
    check('계좌 엔진 단일 구현(acct.js)', 'QE_ACCT.run' in ui and 'function run(rows, slot, opt)' in acct)
    check('패닉 이평선 분리 함수', 'acctPanicMa' in ui and re.search(r"=== 'swing' \? 200 : 100", ui) is not None)
    check('스트레스 토글 존재', 'acctToggleStress' in ui and 'id="acStress"' in tpl)
    check('벤치 시가 정렬', "baseKind: (s.o && s.o[i0] > 0) ? '시가' : '전일 종가'" in ui)
    check('차트 = 백테스트 봉 수', 'chart.setRange(BT_WIN[String(n)] || btBars())' in ui)

    # ---------- 5. 구조·빌드 ----------
    check('빌드 토큰 __ACCT__', '__ACCT__' in tpl and "'acct.js'" in build)
    check('빌드 토큰 __WFDATA__', '__WFDATA__' in tpl and "'wfdata.js'" in build)
    check('빌드는 불변규칙 대조를 실행', 'check_invariants.py' in build)
    check('탭 매핑 64→63 · 128→126 · 501→504',
          re.search(r"BT_WIN\s*=\s*\{\s*'64':\s*63,\s*'128':\s*126,\s*'252':\s*252,\s*'501':\s*504", ui) is not None)
    bars = 0
    if data:
        m = re.search(r'"dates":\[', data)
        if m:
            seg = data[m.end():m.end() + 400000]
            bars = seg.count('"20')
    check('data.js 봉 수 ≥ 1,505(웜스타트 250 + 5Y 1,255)', bars >= 1505, 'found %d' % bars)
    check('index.html 존재', bool(idx))
    if idx:
        check('index.html — 한계 탭 포함', 'data-nx="lim"' in idx)
        check('index.html — 성적표 패널 포함', 'id="wfTable"' in idx)
        check('index.html — 예전 벤치 문구 없음', '마지막 날 종가 ÷ 창 첫날 종가' not in idx)

    # ---------- 6. 표본외 데이터 ----------
    if check('wfdata.js 존재', bool(wf), 'scripts/wf_build.py 로 생성'):
        yrs = re.findall(r'"y":"(\d{4})"', wf)
        check('표본외 연도 = 2017~2026', yrs[:1] == ['2017'] and yrs[-1:] == ['2026'], str(yrs[:2] + yrs[-2:]))
        for k in ('"oos"', '"crash"', '"recent"'):
            check('표본외 블록 %s' % k, k in wf)
        check('표본외 벤치 QQQ·SPY', '"qqq"' in wf and '"spy"' in wf)
        check('표본외 슬롯 3종', wf.count('"conc1"') == 0 and 'safe|trend|conc1' in wf)

    if not quiet:
        for n, d in PASS:
            print('  ok   %s' % n)
    for n, d in FAILS:
        print('  FAIL %s%s' % (n, ('  — ' + d) if d else ''))
    print('check_invariants: %d pass · %d fail' % (len(PASS), len(FAILS)))
    return 1 if FAILS else 0


if __name__ == '__main__':
    sys.exit(main())
