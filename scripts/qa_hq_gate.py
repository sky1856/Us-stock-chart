#!/usr/bin/env python3
"""🏢 회의실 가상투자 — '내 등록 지갑만 연결' 게이트 QA.

  python3 scripts/qa_hq_gate.py

· 1440×900 · 390×844 에서 콘솔 에러 0 · 가로 넘침 0
· 시나리오: ①지갑 없음 ②내 이름+서버 등록 ③미등록 이름 ④이름 없음(지문 일치) ⑤기본값 지갑(지문 불가)
"""
import asyncio
import json
import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

os.environ.setdefault('LD_LIBRARY_PATH', '/workspace/.libs/chromium')
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8123
BASE = 'http://127.0.0.1:%d/index.html' % PORT

W_ID = '{"v":1,"name":"박지훈 회장","granted":true,"spent":0,"bonus":0,"prize":0,"pnlCut":0,"cashAdj":0,' \
       '"owned":{"gm-black":1,"gm-navy":1,"ac-glasses":1},"crew":[],"at":"2026-11-28T18:41:17.000Z"}'
W_NO_NAME = '{"v":1,"granted":true,"spent":0,"bonus":0,"prize":0,"pnlCut":0,"cashAdj":0,' \
            '"owned":{"gm-black":1,"gm-navy":1,"ac-glasses":1},"crew":[]}'
W_DEFAULT = '{"v":1,"granted":true,"spent":0,"bonus":0,"prize":0,"pnlCut":0,"cashAdj":0,' \
            '"owned":{"gm-black":1,"gm-navy":1},"crew":[]}'
W_GHOST = '{"v":1,"name":"없는사람","granted":true,"spent":0,"bonus":0,"prize":0,"pnlCut":0,"cashAdj":0,' \
          '"owned":{"gm-black":1,"gm-navy":1},"crew":[]}'


def serve():
    h = partial(SimpleHTTPRequestHandler, directory=ROOT)
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), h)
    srv.log_message = lambda *a, **k: None
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


async def open_room(b, w, h, wallet):
    ctx = await b.new_context(viewport={'width': w, 'height': h},
                              is_mobile=(w < 500), has_touch=(w < 500), device_scale_factor=1)
    pg = await ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    await pg.goto(BASE, wait_until='load')
    await pg.wait_for_function("() => !document.getElementById('bootLoad')", timeout=180000)
    if wallet is not None:
        await pg.evaluate("(w) => localStorage.setItem('ckq.hq.wallet.v1', w)", wallet)
        await pg.evaluate("() => localStorage.removeItem('ckq.hq.invest.v1')")
        await pg.reload(wait_until='load')
        await pg.wait_for_function("() => !document.getElementById('bootLoad')", timeout=180000)
    else:
        await pg.evaluate("() => { localStorage.removeItem('ckq.hq.wallet.v1'); localStorage.removeItem('ckq.hq.invest.v1'); }")
        await pg.reload(wait_until='load')
        await pg.wait_for_function("() => !document.getElementById('bootLoad')", timeout=180000)
    await pg.click('#mhTabs button[data-mtab="room"]')
    await pg.wait_for_timeout(2600)
    d = await pg.evaluate("""() => {
      const q = (s) => document.querySelector(s);
      const gate = q('#hqGate');
      return {
        paneLocked: q('#hqPane').classList.contains('locked'),
        gateHidden: gate ? gate.hidden : null,
        gateText: gate ? gate.innerText.replace(/\\s+/g,' ').slice(0,160) : '',
        gateHref: (q('#hqGateGo')||{}).getAttribute ? q('#hqGateGo').getAttribute('href') : '',
        chip: (q('#hqMe')||{}).textContent,
        chipHtml: (q('#hqMe')||{}).innerHTML,
        state: (q('#hqNameState')||{}).innerText,
        rank: (q('#hqRank')||{}).innerText.replace(/\\s+/g,' ').slice(0,140),
        rankHtml: (q('#hqRank')||{}).innerHTML,
        sum1: (q('#hqSum .c .v')||{}).textContent,
        submitDisabled: !!(q('#hqSubmit')||{}).disabled,
        nameInput: !!q('#hqName'),
        nameOptions: document.querySelectorAll('#hqNameList option').length,
        msg: (q('#hqMsg')||{}).textContent,
        sw: document.documentElement.scrollWidth, iw: window.innerWidth
      };
    }""")
    return ctx, pg, errs, d


async def main():
    srv = serve()
    out = {'scenarios': [], 'widths': []}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        cases = [
            ('① 지갑 없음', None),
            ('② 내 이름 + 서버 등록', W_ID),
            ('③ 미등록 이름', W_GHOST),
            ('④ 이름 없음 · 지문 일치', W_NO_NAME),
            ('⑤ 기본값 지갑', W_DEFAULT),
        ]
        for w, h in ((1440, 900), (390, 844)):
            for label, wallet in cases:
                ctx, pg, errs, d = await open_room(b, w, h, wallet)
                d.update({'w': w, 'h': h, 'case': label, 'errs': errs[:4]})
                out['scenarios'].append(d)
                if w == 1440 and label in ('① 지갑 없음', '② 내 이름 + 서버 등록'):
                    el = await pg.query_selector('#hqPane')
                    await el.scroll_into_view_if_needed()
                    await pg.wait_for_timeout(300)
                    await pg.screenshot(path='/workspace/work/gh-us-stock-chart/_qa_gate_%s.png'
                                        % ('none' if wallet is None else 'own'))
                await ctx.close()
        # 폭 전수 — 연결된 상태에서 가로 넘침
        for w in (360, 390, 414, 480, 620, 768, 900, 1024, 1180, 1280, 1366, 1440, 1600, 1920):
            ctx, pg, errs, d = await open_room(b, w, 900, W_ID)
            out['widths'].append({'w': w, 'sw': d['sw'], 'iw': d['iw'], 'errs': errs[:3]})
            await ctx.close()
        await b.close()
    srv.shutdown()
    print(json.dumps(out, ensure_ascii=False, indent=1))


asyncio.run(main())
