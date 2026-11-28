#!/usr/bin/env python3
"""표본외 워크포워드용 10년 시계열 추출 — scripts/raw/*.json → scripts/wf_src.js

update_data.py 의 parse_chart / build_series 를 그대로 써서 data.js 와 **같은 규칙**으로
거래일 캘린더에 정렬한다(fill_forward=True, 상장 전은 off 로 흡수).

    python3 scripts/wf_extract.py

    python3 scripts/wf_extract.py [--raw-dir /tmp/wf_raw11]

출력: scripts/wf_src.js (window.WFRAW = {dates, series:{T:{off,o,h,l,c}}})
      — 저장소에 커밋하지 않는다(.gitignore). wf_build.js 의 입력일 뿐이다.

--raw-dir 을 주면 그 디렉터리의 raw 로 만든다(기본 scripts/raw). 2015년부터 받은 raw 를
넘기면 2017년 창도 250봉 웜업을 확보한다(10년 raw 는 2016-11-28 시작 → 2017 웜업 24봉).
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import update_data as U  # noqa: E402


def main():
    raw_dir = None
    for i, a in enumerate(sys.argv):
        if a == '--raw-dir' and i + 1 < len(sys.argv):
            raw_dir = os.path.abspath(sys.argv[i + 1])
    if raw_dir:                        # 다른 raw 디렉터리(예: 2015년부터 받은 11년 raw)
        U.RAW_DIR = raw_dir
    files = sorted(glob.glob(os.path.join(raw_dir or U.RAW_DIR, '*.json')))
    rows_by_t = {}
    dates = set()
    for f in files:
        t = os.path.splitext(os.path.basename(f))[0]
        try:
            rows, _ = U.parse_chart(t)
        except Exception as e:            # 깨진 raw 는 건너뛴다
            print('SKIP %s (%s)' % (t, e))
            continue
        if not rows:
            continue
        rows_by_t[t] = rows
        dates.update(rows.keys())
    dates = sorted(dates)
    print('tickers %d · dates %d (%s ~ %s)' % (len(rows_by_t), len(dates), dates[0], dates[-1]))

    out = {}
    for t, rows in rows_by_t.items():
        s = U.build_series(dates, rows, fill_forward=True)
        if not s:
            continue
        out[t] = {'off': s['off'], 'o': s['o'], 'h': s['h'], 'l': s['l'], 'c': s['c']}

    payload = {'dates': dates, 'series': out}
    with open(os.path.join(HERE, 'wf_src.js'), 'w', encoding='utf-8') as f:
        f.write('window.WFRAW=' + json.dumps(payload, separators=(',', ':')) + ';\n')
    print('wrote scripts/wf_src.js (%.1f MB)' % (os.path.getsize(os.path.join(HERE, 'wf_src.js')) / 1e6))
    return 0


if __name__ == '__main__':
    sys.exit(main())
