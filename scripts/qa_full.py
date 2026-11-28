#!/usr/bin/env python3
"""전체 QA — 폭(360~1920) × 테마 × 성향 × 전략 × 기간, 콘솔 0 · 넘침 0 · 새 패널 렌더.
   스크린샷: downloads/차트분석기-95점고도화-1600.png · downloads/차트분석기-95점고도화-모바일.png
"""
import asyncio, json, os

os.environ.setdefault('LD_LIBRARY_PATH', '/workspace/.libs/chromium')
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'index.html')
DL = '/workspace/downloads'


async def canvasing():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width': 1600, 'height': 1000})).new_page()
        await pg.goto(URL, wait_until='load')
        await pg.wait_for_function("() => !document.getElementById('bootLoad')", timeout=120000)
        await pg.wait_for_timeout(1500)
        el = await pg.query_selector('#wfCard')
        await el.scroll_into_view_if_needed()
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=os.path.join(DL, '차트분석기-95점고도화-1600.png'))
        # 모바일
        pg2 = await (await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)).new_page()
        await pg2.goto(URL, wait_until='load')
        await pg2.wait_for_function("() => !document.getElementById('bootLoad')", timeout=120000)
        await pg2.wait_for_timeout(1800)
        el2 = await pg2.query_selector('#acctCard')
        await el2.scroll_into_view_if_needed()
        await pg2.wait_for_timeout(700)
        await pg2.screenshot(path=os.path.join(DL, '차트분석기-95점고도화-모바일.png'))
        await b.close()


async def main():
    rows = []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(URL, wait_until='load')
        await pg.wait_for_function("() => !document.getElementById('bootLoad') && window.APEX_ACCT && Object.keys(window.APEX_ACCT.cache).length>0", timeout=150000)
        await pg.wait_for_selector('#wfTable tbody tr', timeout=60000)
        # 성향 × 전략 × 기간 × 테마 교차
        combos = []
        for theme in ('dark', 'light'):
            for risk in ('safe', 'aggr'):
                for strat in ('trend', 'swing'):
                    combos.append((theme, risk, strat))
        for theme, risk, strat in combos:
            await pg.click('#themeBtn' if theme != (await pg.evaluate("() => document.documentElement.getAttribute('data-theme')")) else '#themeBtn')
            await pg.wait_for_timeout(150)
            cur = await pg.evaluate("() => document.documentElement.getAttribute('data-theme')")
            if cur != theme:
                await pg.click('#themeBtn')
            await pg.evaluate("""(r) => { const b=document.querySelector('#topRisk button[data-risk-btn="'+r+'"]'); if(b) b.click(); }""", risk)
            await pg.wait_for_timeout(500)
            await pg.evaluate("""(s) => { const b=document.querySelector('#topStratSeg button[data-m="'+s+'"]'); if(b) b.click(); }""", strat)
            await pg.wait_for_timeout(2200)
            for n in ('64', '128', '252', '501', '1255'):
                await pg.click(f'#topPeriod button[data-n="{n}"]')
                await pg.wait_for_timeout(1200)
                d = await pg.evaluate("""() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth,
                    per:(document.getElementById('tcPerNow')||{}).textContent,
                    wf: document.querySelectorAll('#wfTable tbody tr').length,
                    bars: window.APEX_DIAG.axis().dataBars,
                    ac:(document.getElementById('acGrid')||{}).innerText.slice(0,40)})""")
                rows.append({'theme': theme, 'risk': risk, 'strat': strat, 'n': n, **d})
        # 한계 탭
        await pg.click('#nxTabs button[data-nx="lim"]')
        await pg.wait_for_timeout(300)
        lim = await pg.evaluate("""() => {const p=document.getElementById('nxLim'); const b=p.getBoundingClientRect();
            return {hidden:p.hidden, h:Math.round(b.height), text:p.innerText.slice(0,80), tabs:document.querySelectorAll('#nxTabs button').length};}""")
        # 폭 전수
        widths = [360, 390, 414, 480, 620, 768, 900, 1024, 1180, 1280, 1366, 1440, 1600, 1920]
        widths_out = {}
        for w in widths:
            await pg.set_viewport_size({'width': w, 'height': 900})
            await pg.wait_for_timeout(450)
            widths_out[w] = await pg.evaluate("() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth})")
        # 스트레스 토글
        await pg.set_viewport_size({'width': 1440, 'height': 900})
        await pg.click('#acStress')
        await pg.wait_for_function("() => Object.keys(window.APEX_ACCT.cache).some(k => k.endsWith('|S'))", timeout=120000)
        await pg.wait_for_timeout(800)
        stress = await pg.evaluate("""() => ({cls:document.getElementById('acStress').className, assume:document.getElementById('acAssume').textContent.slice(0,90),
            cache:Object.keys(window.APEX_ACCT.cache).filter(k=>k.endsWith('|S')).length})""")
        await pg.click('#acStress')
        await pg.wait_for_timeout(600)
        errs_all = errs[:15]
        await b.close()
    bad = [r for r in rows if r['sw'] > r['iw'] + 1]
    mism = [r for r in rows if r['per'] and ('거래일' in r['per']) and int(r['per'].split('·')[2].strip().split('거래일')[0].replace(',', '')) != r['bars']]
    print(json.dumps({'combos': len(rows), 'overflow': bad[:4], 'chartBarsMismatch': mism[:4],
                      'wfRows': rows[0]['wf'], 'lim': lim, 'widths': widths_out, 'stress': stress, 'errs': errs_all},
                     ensure_ascii=False, indent=1))


if __name__ == '__main__':
    asyncio.run(main())
    asyncio.run(canvasing())
