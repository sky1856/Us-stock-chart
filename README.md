# 미국주식 차트분석기

102개 미국 종목(대형주 100 + NKE, QQQ)의 최근 5년 일봉(1,255거래일)을 한 화면에서 보는 단일 HTML 차트 분석 도구입니다.
거시 지표(VIX · 미 10년물 금리)와 종목별 펀더멘털(Forward/Trailing PER, 매출성장률, 애널리스트 목표가, 배당수익률, 52주 범위)을 함께 보여줍니다.
엘리엇 파동 심층분석, 작도 도구, 일목균형표, 이동평균, 거래량 분석을 포함합니다.

- 앱: https://sky1856.github.io/Us-stock-chart/
- 받아서 쓰기: 저장소의 `index.html` 파일 하나만 내려받아도 동작합니다(외부 의존성 없음).

## 자동 갱신

미국 증시 마감 후 매일 아침(KST) 최신 일봉으로 `scripts/data.js` 와 `index.html` 이 다시 만들어져 커밋됩니다.
갱신은 `scripts/update_data.py`(Yahoo Finance 5년 일봉 + `^VIX`·`^TNX` + 펀더멘털 수집 → `data.js`) → `scripts/build.py`(`index.html` 재생성) 순서로 돌고,
GitHub Pages 가 `main` 브랜치를 그대로 배포하므로 커밋 후 몇 분 안에 사이트에 반영됩니다.

GitHub Actions 로 돌리고 싶다면 `docs/update-stocks.yml` 을 `.github/workflows/update-stocks.yml` 로 옮기면 됩니다
(화~토 21:30 UTC = 수~일 06:30 KST 자동 실행 + 수동 실행 버튼).

## 구조

```
index.html                  배포되는 단일 파일 앱 (scripts/ 조각들을 합친 결과물)
scripts/
  update_data.py            Yahoo Finance 5년 일봉 + VIX·US10Y + 펀더멘털 → data.js 생성
  build.py                  template + data + engine + ui → index.html
  template.html  ui.css  engine.js  ui.js  data.js  top100.json
docs/update-stocks.yml      GitHub Actions 워크플로 템플릿
```

## 로컬에서 갱신하기

```bash
python scripts/update_data.py   # 인터넷 필요, 102종목 5년 일봉 + 거시지표 + 펀더멘털 수집 후 data.js 갱신
python scripts/build.py         # index.html 재생성
```

`update_data.py` 는 일부 종목 수집에 실패하면 기존 `data.js` 를 그대로 두고 경고만 출력합니다(사이트는 이전 데이터로 정상 동작).
