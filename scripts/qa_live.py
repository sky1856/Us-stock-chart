#!/usr/bin/env python3
"""라이브 스모크 — 새 기능이 실제 배포본에서 도는지 (개발용)."""
import asyncio, json, os
os.environ.setdefault('LD_LIBRARY_PATH','/workspace/.libs/chromium')
from playwright.async_api import async_playwright
URL='https://sky1856.github.io/Us-stock-chart/?v=%s' % os.urandom(4).hex()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-sandbox'])
        pg=await (await b.new_context(viewport={'width':1440,'height':900})).new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL, wait_until='load')
        await pg.wait_for_function("() => !document.getElementById('bootLoad') && !!document.getElementById('wfTable').querySelector('tbody tr')", timeout=180000)
        await pg.wait_for_timeout(1200)
        d=await pg.evaluate("""() => ({
          title: document.title,
          wfRows: document.querySelectorAll('#wfTable tbody tr').length,
          blocks: [...document.querySelectorAll('.wf-bl')].map(x=>x.innerText.replace(/\\s+/g,' ').slice(0,60)),
          tabs: document.querySelectorAll('#nxTabs button').length,
          limTab: !!document.querySelector('#nxTabs button[data-nx="lim"]'),
          assume: (document.getElementById('acAssume')||{}).textContent.slice(0,60),
          stressBtn: !!document.getElementById('acStress'),
          per: document.getElementById('tcPerNow').textContent,
          sw: document.documentElement.scrollWidth, iw: window.innerWidth})""")
        d['errs']=errs[:4]
        print(json.dumps(d, ensure_ascii=False, indent=1))
        await b.close()
asyncio.run(main())
