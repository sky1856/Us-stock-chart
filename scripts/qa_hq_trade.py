#!/usr/bin/env python3
"""🏢 회의실 가상투자 — 연결·매매·직급 표기 QA (서버 쓰기 차단 상태로 안전하게).

  python3 scripts/qa_hq_trade.py

· Supabase POST(쓰기)를 가로채 막고, 화면·로컬 지갑만 검증한다(운영 데이터 무변경).
· 연결 전 매매 차단 · 연결 후 매수/매도 · 직급 배지 · 라이트 테마 · 1440/390 넘침·콘솔.
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
PORT = 8124
BASE = 'http://127.0.0.1:%d/index.html' % PORT

W_ID = '{"v":1,"name":"박지훈 회장","granted":true,"spent":0,"bonus":0,"prize":0,"pnlCut":0,"cashAdj":0,' \
       '"owned":{"gm-black":1,"gm-navy":1,"ac-glasses":1},"crew":[]}'
W_NONE = None


def serve():
    h = partial(SimpleHTTPRequestHandler, directory=ROOT)
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), h)
    srv.log_message = lambda *a, **k: None
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


async def boot(b, w, h, wallet, block_write=True, block_net=False):
    ctx = await b.new_context(viewport={'width': w, 'height': h},
                              is_mobile=(w < 500), has_touch=(w < 500))
    pg = await ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
    if block_write:
        async def rw(route):
            if route.request.method in ('POST', 'PATCH', 'DELETE'):
                return await route.fulfill(status=200, body='', content_type='application/json')
            return await route.continue_()
        await pg.route('**/rest/v1/hq_wallets*', rw)
    if block_net:
        await pg.route('**/rest/v1/hq_wallets*', lambda route: route.abort())
    await pg.goto(BASE, wait_until='load')
    await pg.wait_for_function("() => !document.getElementById('bootLoad')", timeout=180000)
    await pg.evaluate("(w) => { localStorage.removeItem('ckq.hq.invest.v1'); if (w) localStorage.setItem('ckq.hq.wallet.v1', w); else localStorage.removeItem('ckq.hq.wallet.v1'); }", wallet)
    await pg.reload(wait_until='load')
    await pg.wait_for_function("() => !document.getElementById('bootLoad')", timeout=180000)
    await pg.click('#mhTabs button[data-mtab="room"]')
    await pg.wait_for_timeout(2400)
    return ctx, pg, errs


async def main():
    srv = serve()
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])

        # A. 연결 전 — 매수 버튼은 잠김
        ctx, pg, errs = await boot(b, 1440, 900, W_NONE)
        a = await pg.evaluate("""() => {
          const q=(s)=>document.querySelector(s);
          return {locked:q('#hqPane').classList.contains('locked'), dis:q('#hqSubmit').disabled,
                  holds:q('#hqHoldN').textContent, msg:(q('#hqMsg')||{}).textContent,
                  input:!!q('#hqName'), dl:document.querySelectorAll('#hqNameList option').length,
                  gate:(q('#hqGate')||{}).hidden, gateTxt:(q('#hqGate')||{}).innerText.replace(/\\s+/g,' ').slice(0,80),
                  sw:document.documentElement.scrollWidth, iw:innerWidth};
        }""")
        # 연결 전 매수 시도 (잠금이 실제로 막는지)
        await pg.evaluate("() => { const b=document.querySelector('#hqSubmit'); if(b) b.click(); }")
        await pg.wait_for_timeout(300)
        a['afterClickHold'] = await pg.evaluate("() => document.querySelector('#hqHoldN').textContent")
        a['afterClickMsg'] = await pg.evaluate("() => document.querySelector('#hqMsg').textContent")
        a['errs'] = errs[:3]
        out['A_연결전'] = a
        el = await pg.query_selector('#hqPane')
        await el.scroll_into_view_if_needed()
        await pg.screenshot(path=os.path.join(ROOT, '_qa_trade_locked.png'))
        await ctx.close()

        # B. 연결 후 — 매수 (서버 쓰기 차단)
        ctx, pg, errs = await boot(b, 1440, 900, W_ID)
        b1 = await pg.evaluate("""() => {
          const q=(s)=>document.querySelector(s);
          return {locked:q('#hqPane').classList.contains('locked'), chip:q('#hqMe').textContent,
                  tier:!!q('#hqMe .hqw-tier'), tierTxt:(q('#hqMe .hqw-tier')||{}).textContent,
                  rankTier:document.querySelectorAll('#hqRank .hqw-tier').length,
                  state:(q('#hqNameState')||{}).innerText.slice(0,90)};
        }""")
        await pg.evaluate("() => { const b=document.querySelector('#hqAllocs button[data-pct=\"0.25\"]'); if(b) b.click(); }")
        await pg.wait_for_timeout(200)
        await pg.evaluate("() => document.querySelector('#hqSubmit').click()")
        await pg.wait_for_timeout(500)
        b2 = await pg.evaluate("""() => {
          const q=(s)=>document.querySelector(s);
          const w=JSON.parse(localStorage.getItem('ckq.hq.wallet.v1')||'{}');
          const inv=JSON.parse(localStorage.getItem('ckq.hq.invest.v1')||'{}');
          return {holdN:q('#hqHoldN').textContent, fillN:q('#hqFillN').textContent,
                  msg:q('#hqMsg').textContent.slice(0,110), cash:q('#hqSum .c:nth-child(2) .v').textContent,
                  spent:w.spent, pos:Object.keys(inv.positions||{}), name:w.name};
        }""")
        # 매도 (전량)
        await pg.evaluate("() => { const b=document.querySelector('#hqHoldings button[data-hqsell]'); if(b) b.click(); }")
        await pg.wait_for_timeout(200)
        await pg.evaluate("() => document.querySelector('#hqSubmit').click()")
        await pg.wait_for_timeout(500)
        b3 = await pg.evaluate("""() => {
          const q=(s)=>document.querySelector(s);
          const w=JSON.parse(localStorage.getItem('ckq.hq.wallet.v1')||'{}');
          const inv=JSON.parse(localStorage.getItem('ckq.hq.invest.v1')||'{}');
          return {holdN:q('#hqHoldN').textContent, cash:q('#hqSum .c:nth-child(2) .v').textContent,
                  spent:w.spent, prize:w.prize, realized:inv.realized, msg:q('#hqMsg').textContent.slice(0,110),
                  sw:document.documentElement.scrollWidth, iw:innerWidth};
        }""")
        b1.update({'buy': b2, 'sell': b3, 'errs': errs[:4]})
        out['B_연결후'] = b1
        el = await pg.query_selector('#hqPane')
        await el.scroll_into_view_if_needed()
        await pg.wait_for_timeout(200)
        await pg.screenshot(path=os.path.join(ROOT, '_qa_trade_own.png'))
        # 라이트 테마
        await pg.click('#themeBtn')
        await pg.wait_for_timeout(400)
        await el.scroll_into_view_if_needed()
        await pg.screenshot(path=os.path.join(ROOT, '_qa_trade_own_light.png'))
        await ctx.close()

        # C. 모바일 390
        ctx, pg, errs = await boot(b, 390, 844, W_ID)
        c1 = await pg.evaluate("""() => {
          const q=(s)=>document.querySelector(s);
          return {chip:q('#hqMe').textContent, sw:document.documentElement.scrollWidth, iw:innerWidth,
                  paneW:Math.round(q('#hqPane').getBoundingClientRect().width)};
        }""")
        el = await pg.query_selector('#hqPane')
        await el.scroll_into_view_if_needed()
        await pg.screenshot(path=os.path.join(ROOT, '_qa_trade_m390.png'))
        c1['errs'] = errs[:3]
        out['C_390'] = c1
        await ctx.close()

        # D. 서버 연결 실패 — 잠금 유지(미등록과 구분)
        ctx, pg, errs = await boot(b, 1440, 900, W_ID, block_write=False, block_net=True)
        d1 = await pg.evaluate("""() => {
          const q=(s)=>document.querySelector(s);
          return {locked:q('#hqPane').classList.contains('locked'),
                  gate:(q('#hqGateNote')||{}).innerText.slice(0,80), dis:q('#hqSubmit').disabled};
        }""")
        d1['errs'] = errs[:3]
        out['D_서버실패'] = d1
        await ctx.close()
        await b.close()
    srv.shutdown()
    print(json.dumps(out, ensure_ascii=False, indent=1))


asyncio.run(main())
