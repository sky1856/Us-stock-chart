#!/usr/bin/env python3
"""최종 스크린샷 — 라이브에서 1600×900 / 390×844 (새 패널 강조)."""
import asyncio, os, random
os.environ.setdefault('LD_LIBRARY_PATH','/workspace/.libs/chromium')
from playwright.async_api import async_playwright
URL='https://sky1856.github.io/Us-stock-chart/?v=%s' % os.urandom(4).hex()
DL='/workspace/downloads'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-sandbox'])
        pg=await (await b.new_context(viewport={'width':1600,'height':900})).new_page()
        await pg.goto(URL, wait_until='load')
        await pg.wait_for_function("() => !document.getElementById('bootLoad') && !!document.getElementById('wfTable').querySelector('tbody tr')", timeout=180000)
        await pg.wait_for_timeout(1800)
        el=await pg.query_selector('#acctCard'); await el.scroll_into_view_if_needed(); await pg.wait_for_timeout(600)
        await pg.screenshot(path=os.path.join(DL,'차트분석기-95점고도화-1600.png'))
        pg2=await (await b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, device_scale_factor=2)).new_page()
        await pg2.goto(URL, wait_until='load')
        await pg2.wait_for_function("() => !document.getElementById('bootLoad') && !!document.getElementById('wfTable').querySelector('tbody tr')", timeout=180000)
        await pg2.wait_for_timeout(2000)
        el2=await pg2.query_selector('#acctCard'); await el2.scroll_into_view_if_needed(); await pg2.wait_for_timeout(800)
        await pg2.screenshot(path=os.path.join(DL,'차트분석기-95점고도화-모바일.png'))
        # 모바일 성적표 표 구간도 한 장 더(검수용)
        el3=await pg2.query_selector('#wfTable'); await el3.scroll_into_view_if_needed(); await pg2.wait_for_timeout(600)
        await pg2.screenshot(path=os.path.join(DL,'차트분석기-95점고도화-모바일-성적표.png'))
        await b.close()
asyncio.run(main())
