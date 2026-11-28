#!/usr/bin/env python3
"""scripts/ 의 조각 파일들을 하나의 배포용 index.html 로 합칩니다.

    python scripts/build.py

template.html 의 __CSS__ / __DATA__ / __ENGINE__ / __UI__ / __UPDATED__ 토큰을
ui.css / data.js / engine.js / ui.js / data.js 의 updatedAt(KST) 으로 치환해
저장소 루트의 index.html 로 씁니다.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', 'index.html'))


def read(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return f.read()


def updated_stamp(data_js):
    """data.js 의 updatedAt(KST) — 화면 상단 '장마감 · 갱신' 배지와 메타 태그에 들어간다."""
    m = re.search(r'"updatedAt":"([^"]+)"', data_js)
    return m.group(1) if m else ''


def main():
    tpl = read('template.html')
    for token, fname in (('__CSS__', 'ui.css'), ('__DATA__', 'data.js'), ('__WFDATA__', 'wfdata.js'),
                         ('__ENGINE__', 'engine.js'), ('__ACCT__', 'acct.js'),
                         ('__EDUFIG__', 'edufig.js'), ('__UI__', 'ui.js')):
        body = read(fname)
        if '</script>' in body:
            print('ERROR: %s contains </script>' % fname)
            return 1
        if token not in tpl:
            print('ERROR: token %s missing in template' % token)
            return 1
        tpl = tpl.replace(token, body)
    if '__UPDATED__' in tpl:
        stamp = updated_stamp(read('data.js'))
        tpl = tpl.replace('__UPDATED__', stamp or '')
        print('updatedAt(KST): %s' % (stamp or '—'))
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(tpl)
    print('wrote %s (%.2f MB)' % (OUT, len(tpl.encode()) / 1e6))
    # 문서·화면·상수 드리프트 자동 대조 (실패하면 빌드 실패로 본다)
    import subprocess
    chk = os.path.join(HERE, 'check_invariants.py')
    if os.path.exists(chk):
        r = subprocess.run([sys.executable, chk, '--quiet'])
        if r.returncode != 0:
            print('ERROR: check_invariants 실패 — 배포하지 말 것')
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
