#!/usr/bin/env python3
"""scripts/ 의 조각 파일들을 하나의 배포용 index.html 로 합칩니다.

    python scripts/build.py

template.html 의 __CSS__ / __DATA__ / __ENGINE__ / __UI__ 토큰을
ui.css / data.js / engine.js / ui.js 로 치환해 저장소 루트의 index.html 로 씁니다.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, '..', 'index.html'))


def read(name):
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return f.read()


def main():
    tpl = read('template.html')
    for token, fname in (('__CSS__', 'ui.css'), ('__DATA__', 'data.js'),
                         ('__ENGINE__', 'engine.js'), ('__EDUFIG__', 'edufig.js'),
                         ('__UI__', 'ui.js')):
        body = read(fname)
        if '</script>' in body:
            print('ERROR: %s contains </script>' % fname)
            return 1
        if token not in tpl:
            print('ERROR: token %s missing in template' % token)
            return 1
        tpl = tpl.replace(token, body)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(tpl)
    print('wrote %s (%.2f MB)' % (OUT, len(tpl.encode()) / 1e6))
    return 0


if __name__ == '__main__':
    sys.exit(main())
