#!/usr/bin/env python3
"""wf_extract 용 11년(2015-01~) raw 수집 — /tmp/wf_raw11 에 저장(저장소 밖).

    python3 scripts/fetch_wf_raw.py [--dir <raw 저장 폴더>]

표본외(wfdata.js)용 원천. 저장소 밖 폴더에 받아 두고 wf_extract.py --raw-dir 로 넘긴다.

10년 raw(scripts/raw)는 2016-11-28 에서 시작해 2017년 창의 웜업이 24봉뿐이었다.
2015-01-02 부터 받으면 2017년 창도 250봉 웜업을 확보한다.
"""
import datetime
import glob
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36")
P1 = int(datetime.datetime(2014, 12, 1, tzinfo=datetime.timezone.utc).timestamp())


def url_of(t):
    return ("https://query1.finance.yahoo.com/v8/finance/chart/%s"
            "?period1=%d&period2=%d&interval=1d&includePrePost=false&events=div%%2Csplit"
            % (urllib.parse.quote(t), P1, int(time.time())))


def main():
    out = os.path.join(ROOT, 'wf_raw11')
    for i, a in enumerate(sys.argv):
        if a == '--dir' and i + 1 < len(sys.argv):
            out = sys.argv[i + 1]
    os.makedirs(out, exist_ok=True)
    tickers = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'scripts', 'raw', '*.json'))):
        tickers.append(os.path.splitext(os.path.basename(f))[0].replace('_', '^', 1)
                       if os.path.basename(f).startswith('_') else os.path.splitext(os.path.basename(f))[0])
    done = fail = 0
    for t in tickers:
        p = os.path.join(out, t.replace('^', '_') + '.json')
        if os.path.exists(p) and os.path.getsize(p) > 2000:
            done += 1
            continue
        ok = False
        for attempt in range(3):
            try:
                req = urllib.request.Request(url_of(t), headers={'User-Agent': UA, 'Accept': 'application/json'})
                with urllib.request.urlopen(req, timeout=40) as r:
                    body = r.read()
                d = json.loads(body)
                if d.get('chart', {}).get('result'):
                    with open(p, 'wb') as f:
                        f.write(body)
                    ok = True
                    break
            except urllib.error.HTTPError as e:
                if e.code in (429, 401):
                    time.sleep(2.0 * (attempt + 1))
            except Exception:
                time.sleep(0.7 * (attempt + 1))
        if ok:
            done += 1
        else:
            fail += 1
            print('FAIL', t)
        time.sleep(0.15)
    print('done %d / %d (fail %d)' % (done, len(tickers), fail))
    return 0 if fail == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
