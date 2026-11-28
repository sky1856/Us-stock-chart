#!/usr/bin/env python3
"""표본외 패널 QA — 렌더·값·PC/모바일 넘침 (개발용)."""
import asyncio, json, os

os.environ.setdefault('LD_LIBRARY_PATH', '/workspace/.libs/chromium')
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'index.html')


async def main():
    out = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        for name, vp in (('pc', {'width': 1440, 'height': 900}), ('mo', {'width': 390, 'height': 844})):
            pg = await (await b.new_context(viewport=vp)).new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
            await pg.goto(URL, wait_until='load')
            await pg.wait_for_function("() => !document.getElementById('bootLoad') && !!document.getElementById('wfTable').querySelector('tbody tr')", timeout=120000)
            await pg.wait_for_timeout(800)
            d = await pg.evaluate("""() => {
              const t = document.getElementById('wfTable');
              const rows = [...t.querySelectorAll('tbody tr')].map(r => [...r.children].map(c => c.textContent.trim()));
              const bl = [...document.querySelectorAll('.wf-bl')].map(x => x.innerText.replace(/\\s+/g,' '));
              const card = document.getElementById('wfCard');
              return {sub: document.getElementById('wfSub').textContent,
                      blocks: bl, rows, foot: document.getElementById('wfFoot').textContent,
                      scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth,
                      cardW: card.getBoundingClientRect().width, tblW: t.getBoundingClientRect().width,
                      wrapScroll: (function(){const w=document.querySelector('.wf-scroll'); return {sw:w.scrollWidth, cw:w.clientWidth};})()};
            }""")
            d['errs'] = errs[:6]
            out[name] = d
            # 슬롯 칩 전환
            await pg.click('#wfSlot button[data-wfslot="conc1"]')
            await pg.wait_for_timeout(400)
            out[name + '_conc1'] = await pg.evaluate("() => [...document.querySelectorAll('#wfTable tbody tr')].slice(0,2).map(r=>[...r.children].map(c=>c.textContent.trim()))")
            # 성향·전략 전환 후 갱신
            await pg.click('#topStratSeg button[data-m="swing"]')
            await pg.wait_for_timeout(2500)
            out[name + '_swing'] = await pg.evaluate("() => ({sub:document.getElementById('wfSub').textContent, first:[...document.querySelectorAll('#wfTable tbody tr')].slice(0,2).map(r=>[...r.children].map(c=>c.textContent.trim()))})")
            await pg.close()
        await b.close()
    print(json.dumps(out, ensure_ascii=False, indent=1)[:6000])


asyncio.run(main())
